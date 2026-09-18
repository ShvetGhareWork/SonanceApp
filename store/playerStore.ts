import { create } from 'zustand';
import { PlaylistTrack } from '../services/YouTubeExtractorService';
import { PlaybackState } from '../native/AudioPlayerNative';
import { DownloadManagerService, DownloadProgress } from '../services/DownloadManagerService';
import { PlaylistStorageService, DownloadedTrackRecord } from '../services/PlaylistStorageService';

export interface PlayerState {
  queue: PlaylistTrack[];
  currentIndex: number;
  currentTrack: PlaylistTrack | null;
  playbackState: PlaybackState;
  positionMs: number;
  durationMs: number;
  failedTrackIds: Record<string, boolean>;
  isResolving: boolean;
  errorMessage: string | null;

  // Setters
  setQueue: (queue: PlaylistTrack[], startIndex?: number) => void;
  setCurrentIndex: (index: number) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setPositionMs: (positionMs: number) => void;
  setDurationMs: (durationMs: number) => void;
  markTrackFailed: (trackId: string) => void;
  setIsResolving: (isResolving: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  playbackState: 'idle',
  positionMs: 0,
  durationMs: 0,
  failedTrackIds: {},
  isResolving: false,
  errorMessage: null,

  setQueue: (queue, startIndex = 0) => {
    const validIndex = queue.length > 0 && startIndex >= 0 && startIndex < queue.length ? startIndex : -1;
    const currentTrack = validIndex !== -1 ? queue[validIndex] : null;
    set({
      queue,
      currentIndex: validIndex,
      currentTrack,
      positionMs: 0,
      durationMs: 0,
    });
  },

    if (progress.status === 'failed' && progress.error) {
      set({ errorMessage: progress.error });
    }
  });

  return {
    queue: [],
    originalQueue: [],
    currentIndex: -1,
    currentTrack: null,
    playbackState: 'idle',
    positionMs: 0,
    durationMs: 0,
    failedTrackIds: {},
    isResolving: false,
    errorMessage: null,
    shuffleMode: false,
    repeatMode: 'off',
    downloadsState: {},
    downloadedTracks: [],

    setQueue: (queue, startIndex = 0) => {
      const { shuffleMode } = get();
      const originalQueue = [...queue];

      if (!queue || queue.length === 0) {
        set({
          queue: [],
          originalQueue: [],
          currentIndex: -1,
          currentTrack: null,
          positionMs: 0,
          durationMs: 0,
        });
        return;
      }

      const validIndex = startIndex >= 0 && startIndex < queue.length ? startIndex : 0;
      const initialTrack = queue[validIndex];

      if (shuffleMode) {
        const remainingTracks = originalQueue.filter((_, idx) => idx !== validIndex);
        const shuffled = shuffleArray(remainingTracks);
        const activeQueue = [initialTrack, ...shuffled];
        set({
          queue: activeQueue,
          originalQueue,
          currentIndex: 0,
          currentTrack: initialTrack,
          positionMs: 0,
          durationMs: 0,
        });
      } else {
        set({
          queue: originalQueue,
          originalQueue,
          currentIndex: validIndex,
          currentTrack: initialTrack,
          positionMs: 0,
          durationMs: 0,
        });
      }
    },

    setCurrentIndex: (index) => {
      const { queue } = get();
      if (index >= 0 && index < queue.length) {
        set({
          currentIndex: index,
          currentTrack: queue[index],
          positionMs: 0,
          durationMs: 0,
        });
      } else {
        set({
          currentIndex: -1,
          currentTrack: null,
          positionMs: 0,
          durationMs: 0,
        });
      }
    },

    setPlaybackState: (playbackState) => set({ playbackState }),
    setPositionMs: (positionMs) => set({ positionMs }),
    setDurationMs: (durationMs) => set({ durationMs }),

    markTrackFailed: (trackId) => {
      set((state) => ({
        failedTrackIds: { ...state.failedTrackIds, [trackId]: true },
      }));
    },

  reset: () =>
    set({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      playbackState: 'idle',
      positionMs: 0,
      durationMs: 0,
      failedTrackIds: {},
      isResolving: false,
      errorMessage: null,
    }),
}));
