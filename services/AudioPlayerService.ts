import { AudioPlayerNative, audioPlayerEmitter, PlaybackState, TrackMetadata } from '../native/AudioPlayerNative';

export type PlaybackStateCallback = (state: PlaybackState) => void;
export type PlaybackErrorCallback = (error: string) => void;
export type SkipCallback = () => void;

class AudioPlayerServiceWrapper {
  play(url: string, metadata?: TrackMetadata): void {
    try {
      if (AudioPlayerNative) {
        AudioPlayerNative.play(url, metadata);
      }
    } catch (e) {
      console.error('[AudioPlayerService] Error calling native play():', e);
    }
  }

  pause(): void {
    try {
      if (AudioPlayerNative) {
        AudioPlayerNative.pause();
      }
    } catch (e) {
      console.error('[AudioPlayerService] Error calling native pause():', e);
    }
  }

  resume(): void {
    try {
      if (AudioPlayerNative) {
        AudioPlayerNative.resume();
      }
    } catch (e) {
      console.error('[AudioPlayerService] Error calling native resume():', e);
    }
  }

  stop(): void {
    try {
      if (AudioPlayerNative) {
        AudioPlayerNative.stop();
      }
    } catch (e) {
      console.error('[AudioPlayerService] Error calling native stop():', e);
    }
  }

  seekTo(positionMs: number): void {
    try {
      if (AudioPlayerNative) {
        AudioPlayerNative.seekTo(positionMs);
      }
    } catch (e) {
      console.error('[AudioPlayerService] Error calling native seekTo():', e);
    }
  }

  async getCurrentPosition(): Promise<number> {
    try {
      if (AudioPlayerNative) {
        return await AudioPlayerNative.getCurrentPosition();
      }
    } catch (e) {
      console.error('[AudioPlayerService] Error calling native getCurrentPosition():', e);
    }
    return 0;
  }

  async getDuration(): Promise<number> {
    try {
      if (AudioPlayerNative) {
        return await AudioPlayerNative.getDuration();
      }
    } catch (e) {
      console.error('[AudioPlayerService] Error calling native getDuration():', e);
    }
    return 0;
  }

  onPlaybackStateChanged(callback: PlaybackStateCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    try {
      return audioPlayerEmitter.addListener('onPlaybackStateChanged', (event: { state: PlaybackState }) => {
        callback(event.state);
      });
    } catch (e) {
      console.error('[AudioPlayerService] Error adding listener onPlaybackStateChanged:', e);
      return { remove: () => {} };
    }
  }

  onPlaybackError(callback: PlaybackErrorCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    try {
      return audioPlayerEmitter.addListener('onPlaybackError', (event: { error: string }) => {
        callback(event.error);
      });
    } catch (e) {
      console.error('[AudioPlayerService] Error adding listener onPlaybackError:', e);
      return { remove: () => {} };
    }
  }

  onSkipToNext(callback: SkipCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    try {
      return audioPlayerEmitter.addListener('onSkipToNext', () => {
        callback();
      });
    } catch (e) {
      console.error('[AudioPlayerService] Error adding listener onSkipToNext:', e);
      return { remove: () => {} };
    }
  }

  onSkipToPrevious(callback: SkipCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    try {
      return audioPlayerEmitter.addListener('onSkipToPrevious', () => {
        callback();
      });
    } catch (e) {
      console.error('[AudioPlayerService] Error adding listener onSkipToPrevious:', e);
      return { remove: () => {} };
    }
  }
}

export const AudioPlayerService = new AudioPlayerServiceWrapper();
