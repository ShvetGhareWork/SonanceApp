import { create } from 'zustand';

interface AppState {
  // Placeholder state properties for future audio playback & playlist logic
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;

  // Actions
  setCurrentTrackId: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentTrackId: null,
  isPlaying: false,
  volume: 1.0,

  setCurrentTrackId: (id) => set({ currentTrackId: id }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume: volume }),
}));
