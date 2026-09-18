import { create } from 'zustand';
import { PlaylistTrack } from '../services/YouTubeExtractorService';
import { PlaybackState } from '../native/AudioPlayerNative';
import { DownloadManagerService, DownloadProgress } from '../services/DownloadManagerService';
import { PlaylistStorageService, DownloadedTrackRecord } from '../services/PlaylistStorageService';

export type RepeatMode = 'off' | 'repeat-all' | 'repeat-one';

export interface PlayerState {
  queue: PlaylistTrack[];
  originalQueue: PlaylistTrack[];
  currentIndex: number;
  currentTrack: PlaylistTrack | null;
  playbackState: PlaybackState;
  positionMs: number;
  durationMs: number;
  failedTrackIds: Record<string, boolean>;
  isResolving: boolean;
  errorMessage: string | null;
  shuffleMode: boolean;
  repeatMode: RepeatMode;
  downloadsState: Record<string, DownloadProgress>;
  downloadedTracks: DownloadedTrackRecord[];

  // Setters & Actions
  setQueue: (queue: PlaylistTrack[], startIndex?: number) => void;
  setCurrentIndex: (index: number) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setPositionMs: (positionMs: number) => void;
  setDurationMs: (durationMs: number) => void;
  markTrackFailed: (trackId: string) => void;
  setIsResolving: (isResolving: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  downloadTrack: (track: PlaylistTrack) => Promise<void>;
  deleteDownloadedTrack: (trackId: string) => Promise<void>;
  loadDownloadedTracks: () => Promise<void>;
  reset: () => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
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

  setIsResolving: (isResolving) => set({ isResolving }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),

  toggleShuffle: () => {
    const { shuffleMode, queue, originalQueue, currentIndex, currentTrack } = get();
    const nextShuffleMode = !shuffleMode;

    if (originalQueue.length === 0) {
      set({ shuffleMode: nextShuffleMode });
      return;
    }

    if (nextShuffleMode) {
      const activeTrack = currentTrack || (currentIndex >= 0 ? queue[currentIndex] : originalQueue[0]);
      const remaining = originalQueue.filter((t) => t.id !== activeTrack.id);
      const shuffled = shuffleArray(remaining);
      const newQueue = activeTrack ? [activeTrack, ...shuffled] : shuffled;
      set({
        shuffleMode: true,
        queue: newQueue,
        currentIndex: activeTrack ? 0 : -1,
        currentTrack: activeTrack || null,
      });
    } else {
      const activeTrack = currentTrack || (currentIndex >= 0 ? queue[currentIndex] : null);
      let newIndex = 0;
      if (activeTrack) {
        const foundIdx = originalQueue.findIndex((t) => t.id === activeTrack.id);
        if (foundIdx !== -1) {
          newIndex = foundIdx;
        }
      }
      set({
        shuffleMode: false,
        queue: [...originalQueue],
        currentIndex: originalQueue.length > 0 ? newIndex : -1,
        currentTrack: originalQueue.length > 0 ? originalQueue[newIndex] : null,
      });
    }
  },

  toggleRepeat: () => {
    const { repeatMode } = get();
    let nextMode: RepeatMode = 'off';
    if (repeatMode === 'off') {
      nextMode = 'repeat-all';
    } else if (repeatMode === 'repeat-all') {
      nextMode = 'repeat-one';
    } else {
      nextMode = 'off';
    }
    set({ repeatMode: nextMode });
  },

  downloadTrack: async (track: PlaylistTrack) => {
    try {
      set({ errorMessage: null });
      await DownloadManagerService.enqueueDownload(track);
    } catch (err: any) {
      const msg = err?.message || 'Failed to start download';
      set({ errorMessage: msg });
    }
  },

  deleteDownloadedTrack: async (trackId: string) => {
    await DownloadManagerService.deleteDownload(trackId);
    await get().loadDownloadedTracks();
  },

  loadDownloadedTracks: async () => {
    try {
      const records = await PlaylistStorageService.getAllDownloadedTracks();
      set({ downloadedTracks: records });
    } catch (e) {
      console.error('[playerStore] Failed to load downloaded tracks from DB:', e);
    }
  },

  reset: () =>
    set({
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
    }),
}));

DownloadManagerService.addListener((progress) => {
  usePlayerStore.setState((state) => ({
    downloadsState: {
      ...state.downloadsState,
      [progress.trackId]: progress,
    },
  }));

  if (progress.status === 'completed' || progress.status === 'idle') {
    usePlayerStore.getState().loadDownloadedTracks();
  }

  if (progress.status === 'failed' && progress.error) {
    usePlayerStore.setState({ errorMessage: progress.error });
  }
});
