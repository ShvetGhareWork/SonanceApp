import { create } from 'zustand';
import { PlaybackState } from '../native/AudioPlayerNative';

interface AppState {
  currentTrackId: string | null;
  currentTrackUrl: string | null;
  playbackState: PlaybackState;
  positionMs: number;
  durationMs: number;

  setCurrentTrackUrl: (url: string | null) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setPositionMs: (positionMs: number) => void;
  setDurationMs: (durationMs: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentTrackId: null,
  currentTrackUrl: null,
  playbackState: 'idle',
  positionMs: 0,
  durationMs: 0,

  setCurrentTrackUrl: (url) => set({ currentTrackUrl: url }),
  setPlaybackState: (state) => set({ playbackState: state }),
  setPositionMs: (positionMs) => set({ positionMs }),
  setDurationMs: (durationMs) => set({ durationMs }),
}));
