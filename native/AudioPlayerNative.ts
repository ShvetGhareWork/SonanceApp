import { NativeModules, NativeEventEmitter } from 'react-native';

const { AudioPlayerModule } = NativeModules;

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'buffering' | 'ended';

export interface TrackMetadata {
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
}

export interface AudioPlayerNativeInterface {
  play(url: string, metadata?: TrackMetadata): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seekTo(positionMs: number): void;
  getCurrentPosition(): Promise<number>;
  getDuration(): Promise<number>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export const AudioPlayerNative: AudioPlayerNativeInterface = AudioPlayerModule;

export const audioPlayerEmitter = AudioPlayerModule
  ? new NativeEventEmitter(AudioPlayerModule)
  : null;
