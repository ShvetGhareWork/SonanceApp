import { AudioPlayerNative, audioPlayerEmitter, PlaybackState, TrackMetadata } from '../native/AudioPlayerNative';

export type PlaybackStateCallback = (state: PlaybackState) => void;
export type PlaybackErrorCallback = (error: string) => void;
export type SkipCallback = () => void;

class AudioPlayerServiceWrapper {
  play(url: string, metadata?: TrackMetadata): void {
    if (AudioPlayerNative) {
      AudioPlayerNative.play(url, metadata);
    }
  }

  pause(): void {
    if (AudioPlayerNative) {
      AudioPlayerNative.pause();
    }
  }

  resume(): void {
    if (AudioPlayerNative) {
      AudioPlayerNative.resume();
    }
  }

  stop(): void {
    if (AudioPlayerNative) {
      AudioPlayerNative.stop();
    }
  }

  seekTo(positionMs: number): void {
    if (AudioPlayerNative) {
      AudioPlayerNative.seekTo(positionMs);
    }
  }

  async getCurrentPosition(): Promise<number> {
    if (AudioPlayerNative) {
      return await AudioPlayerNative.getCurrentPosition();
    }
    return 0;
  }

  async getDuration(): Promise<number> {
    if (AudioPlayerNative) {
      return await AudioPlayerNative.getDuration();
    }
    return 0;
  }

  onPlaybackStateChanged(callback: PlaybackStateCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    return audioPlayerEmitter.addListener('onPlaybackStateChanged', (event: { state: PlaybackState }) => {
      callback(event.state);
    });
  }

  onPlaybackError(callback: PlaybackErrorCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    return audioPlayerEmitter.addListener('onPlaybackError', (event: { error: string }) => {
      callback(event.error);
    });
  }

  onSkipToNext(callback: SkipCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    return audioPlayerEmitter.addListener('onSkipToNext', () => {
      callback();
    });
  }

  onSkipToPrevious(callback: SkipCallback) {
    if (!audioPlayerEmitter) return { remove: () => {} };
    return audioPlayerEmitter.addListener('onSkipToPrevious', () => {
      callback();
    });
  }
}

export const AudioPlayerService = new AudioPlayerServiceWrapper();
