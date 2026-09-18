import { usePlayerStore } from '../store/playerStore';
import { AudioPlayerService } from './AudioPlayerService';
import { YouTubeExtractorService, PlaylistTrack } from './YouTubeExtractorService';

class PlaybackControllerClass {
  private isInitialized = false;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    AudioPlayerService.onPlaybackStateChanged((state) => {
      usePlayerStore.getState().setPlaybackState(state);

      if (state === 'playing') {
        AudioPlayerService.getDuration().then((dur) => {
          if (dur > 0) {
            usePlayerStore.getState().setDurationMs(dur);
          }
        });
      }

      if (state === 'ended') {
        console.log('[PlaybackController] Track ended naturally. Handling end-of-track advancement...');
        this.handleTrackEnded();
      }
    });

    AudioPlayerService.onPlaybackError((err) => {
      console.error('[PlaybackController] Audio player error:', err);
      const { currentTrack } = usePlayerStore.getState();
      if (currentTrack) {
        usePlayerStore.getState().markTrackFailed(currentTrack.id);
      }
      usePlayerStore.getState().setErrorMessage(`Playback error: ${err}`);
      console.log('[PlaybackController] Automatically skipping failed track...');
      this.playNext();
    });

    AudioPlayerService.onSkipToNext(() => {
      console.log('[PlaybackController] System skip to next triggered');
      this.playNext();
    });

    AudioPlayerService.onSkipToPrevious(() => {
      console.log('[PlaybackController] System skip to previous triggered');
      this.playPrevious();
    });
  }

  private async handleTrackEnded(): Promise<void> {
    const { repeatMode, currentIndex, queue } = usePlayerStore.getState();

    if (repeatMode === 'repeat-one') {
      console.log('[PlaybackController] repeat-one is ON. Replaying current track...');
      if (currentIndex >= 0 && currentIndex < queue.length) {
        await this.playTrackAtIndex(currentIndex);
      } else {
        AudioPlayerService.seekTo(0);
        AudioPlayerService.resume();
      }
      return;
    }

    if (currentIndex + 1 < queue.length) {
      await this.playTrackAtIndex(currentIndex + 1);
    } else {
      if (repeatMode === 'repeat-all' && queue.length > 0) {
        console.log('[PlaybackController] repeat-all is ON and end of queue reached. Looping back to first track...');
        await this.playTrackAtIndex(0);
      } else {
        console.log('[PlaybackController] End of queue reached. Stopping playback.');
        AudioPlayerService.stop();
        usePlayerStore.getState().setPlaybackState('idle');
      }
    }
  }

  async loadQueue(tracks: PlaylistTrack[], startIndex = 0): Promise<void> {
    if (!tracks || tracks.length === 0) {
      usePlayerStore.getState().reset();
      AudioPlayerService.stop();
      return;
    }

    usePlayerStore.getState().setQueue(tracks, startIndex);
    const activeIndex = usePlayerStore.getState().currentIndex;
    await this.playTrackAtIndex(activeIndex >= 0 ? activeIndex : 0);
  }

  async playTrackAtIndex(index: number): Promise<void> {
    const store = usePlayerStore.getState();
    const { queue, failedTrackIds } = store;

    if (index < 0 || index >= queue.length) {
      console.log('[PlaybackController] Reached end of queue or invalid index:', index);
      AudioPlayerService.stop();
      store.setPlaybackState('idle');
      return;
    }

    const track = queue[index];
    store.setCurrentIndex(index);
    store.setErrorMessage(null);

    // If track is already known to fail, skip immediately
    if (failedTrackIds[track.id]) {
      console.warn(`[PlaybackController] Skipping previously failed track: ${track.title} (${track.id})`);
      this.playNext();
      return;
    }

    store.setIsResolving(true);
    console.log(`[PlaybackController] Resolving track [${index + 1}/${queue.length}]: ${track.title} (${track.id})`);

    try {
      let streamUrl: string;
      if (track.id.startsWith('http://') || track.id.startsWith('https://')) {
        streamUrl = track.id; // Direct URL fallback
      } else {
        streamUrl = await YouTubeExtractorService.resolveStreamUrl(track.id);
      }

      store.setIsResolving(false);
      console.log(`[PlaybackController] Playing resolved stream for: ${track.title}`);
      AudioPlayerService.play(streamUrl, {
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.thumbnailUrl,
      });
    } catch (err: any) {
      store.setIsResolving(false);
      const errorMsg = err?.message || 'Extraction failed';
      console.error(`[PlaybackController] Extraction failed for track ${track.title} (${track.id}):`, errorMsg);
      store.markTrackFailed(track.id);
      store.setErrorMessage(`Failed to load "${track.title}": ${errorMsg}`);

      // Automatically skip to next track
      console.log('[PlaybackController] Automatically skipping to next track after extraction error...');
      this.playNext();
    }
  }

  async playNext(): Promise<void> {
    const { currentIndex, queue, repeatMode } = usePlayerStore.getState();
    if (currentIndex + 1 < queue.length) {
      await this.playTrackAtIndex(currentIndex + 1);
    } else if (repeatMode === 'repeat-all' && queue.length > 0) {
      console.log('[PlaybackController] User pressed next at end of queue with repeat-all ON. Looping to track 0...');
      await this.playTrackAtIndex(0);
    } else {
      console.log('[PlaybackController] End of queue reached on playNext. Stopping playback.');
      AudioPlayerService.stop();
      usePlayerStore.getState().setPlaybackState('idle');
    }
  }

  async playPrevious(): Promise<void> {
    const { currentIndex, positionMs, queue, repeatMode } = usePlayerStore.getState();

    // If more than 3 seconds into track, restart current track
    if (positionMs > 3000) {
      console.log('[PlaybackController] Restarting current track (>3s in)');
      AudioPlayerService.seekTo(0);
      return;
    }

    if (currentIndex - 1 >= 0) {
      await this.playTrackAtIndex(currentIndex - 1);
    } else if (repeatMode === 'repeat-all' && queue.length > 0) {
      console.log('[PlaybackController] User pressed previous at start of queue with repeat-all ON. Wrapping to last track...');
      await this.playTrackAtIndex(queue.length - 1);
    } else {
      AudioPlayerService.seekTo(0);
    }
  }

  pause(): void {
    AudioPlayerService.pause();
  }

  resume(): void {
    AudioPlayerService.resume();
  }

  stop(): void {
    AudioPlayerService.stop();
    usePlayerStore.getState().setPlaybackState('idle');
    usePlayerStore.getState().setPositionMs(0);
  }

  seekTo(positionMs: number): void {
    AudioPlayerService.seekTo(positionMs);
    usePlayerStore.getState().setPositionMs(positionMs);
  }
}

export const PlaybackController = new PlaybackControllerClass();
