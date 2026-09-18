import * as FileSystem from 'expo-file-system/legacy';
import { usePlayerStore } from '../store/playerStore';
import { AudioPlayerService } from './AudioPlayerService';
import { YouTubeExtractorService, PlaylistTrack } from './YouTubeExtractorService';
import { PlaylistStorageService } from './PlaylistStorageService';

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
        console.log('[PlaybackController] Track ended naturally. Advancing to next track...');
        this.playNext();
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
  }

  async loadQueue(tracks: PlaylistTrack[], startIndex = 0): Promise<void> {
    if (!tracks || tracks.length === 0) {
      usePlayerStore.getState().reset();
      AudioPlayerService.stop();
      return;
    }

    usePlayerStore.getState().setQueue(tracks, startIndex);
    await this.playTrackAtIndex(startIndex);
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

    // 1. Check if track is available offline locally
    try {
      const localRecord = await PlaylistStorageService.getDownloadedTrack(track.id);
      if (localRecord && localRecord.localFilePath) {
        const fileInfo = await FileSystem.getInfoAsync(localRecord.localFilePath);
        if (fileInfo.exists) {
          console.log(`[PlaybackController] Playing offline downloaded track for: ${track.title} -> ${localRecord.localFilePath}`);
          store.setIsResolving(false);
          AudioPlayerService.play(localRecord.localFilePath, {
            title: track.title,
            artist: track.artist,
            thumbnailUrl: track.thumbnailUrl,
          });
          return;
        } else {
          console.warn(`[PlaybackController] Local file record found but file missing on disk: ${localRecord.localFilePath}`);
          await PlaylistStorageService.deleteDownloadedTrack(track.id);
        }
      }
    } catch (e) {
      console.warn('[PlaybackController] Error checking local file status, falling back to online extraction:', e);
    }

    // 2. Online stream resolution fallback
    try {
      let streamUrl: string;
      if (track.id.startsWith('http://') || track.id.startsWith('https://')) {
        streamUrl = track.id; // Direct URL fallback
      } else {
        streamUrl = await YouTubeExtractorService.resolveStreamUrl(track.id);
      }

      store.setIsResolving(false);
      console.log(`[PlaybackController] Playing resolved stream for: ${track.title}`);
      AudioPlayerService.play(streamUrl);
    } catch (err: any) {
      store.setIsResolving(false);
      const rawErrorMsg = err?.message || 'Extraction failed';
      console.error(`[PlaybackController] Extraction failed for track ${track.title} (${track.id}):`, rawErrorMsg);
      store.markTrackFailed(track.id);

      const offlineError = `Offline, track not available`;
      store.setErrorMessage(`Failed to play "${track.title}": ${offlineError}`);

      // Automatically skip to next track
      console.log('[PlaybackController] Automatically skipping to next track after offline/extraction failure...');
      this.playNext();
    }
  }

  async playNext(): Promise<void> {
    const { currentIndex, queue } = usePlayerStore.getState();
    if (currentIndex + 1 < queue.length) {
      await this.playTrackAtIndex(currentIndex + 1);
    } else {
      console.log('[PlaybackController] End of queue reached. Stopping playback.');
      AudioPlayerService.stop();
      usePlayerStore.getState().setPlaybackState('idle');
    }
  }

  async playPrevious(): Promise<void> {
    const { currentIndex, positionMs } = usePlayerStore.getState();

    // If more than 3 seconds into track, restart current track
    if (positionMs > 3000) {
      console.log('[PlaybackController] Restarting current track (>3s in)');
      AudioPlayerService.seekTo(0);
      return;
    }

    if (currentIndex - 1 >= 0) {
      await this.playTrackAtIndex(currentIndex - 1);
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
