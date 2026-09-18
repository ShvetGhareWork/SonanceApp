import * as FileSystem from 'expo-file-system/legacy';
import { PlaylistTrack, YouTubeExtractorService } from './YouTubeExtractorService';
import { PlaylistStorageService } from './PlaylistStorageService';

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'completed' | 'failed';

export interface DownloadProgress {
  trackId: string;
  status: DownloadStatus;
  progress: number; // 0 to 100
  error?: string;
}

export type DownloadProgressListener = (progress: DownloadProgress) => void;

const MIN_FREE_DISK_BYTES = 50 * 1024 * 1024; // 50 MB minimum required free disk space
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads/`;

class DownloadManagerServiceClass {
  private queue: PlaylistTrack[] = [];
  private activeTrackId: string | null = null;
  private listeners: Set<DownloadProgressListener> = new Set();
  private progressMap: Map<string, DownloadProgress> = new Map();

  constructor() {
    this.ensureDownloadDir();
  }

  private async ensureDownloadDir(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
      }
    } catch (e) {
      console.error('[DownloadManagerService] Failed to create download directory:', e);
    }
  }

  addListener(listener: DownloadProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(progress: DownloadProgress) {
    this.progressMap.set(progress.trackId, progress);
    this.listeners.forEach((listener) => listener(progress));
  }

  getProgress(trackId: string): DownloadProgress | null {
    return this.progressMap.get(trackId) || null;
  }

  async enqueueDownload(track: PlaylistTrack): Promise<void> {
    // Check if already downloaded
    const existing = await PlaylistStorageService.getDownloadedTrack(track.id);
    if (existing) {
      const info = await FileSystem.getInfoAsync(existing.localFilePath);
      if (info.exists) {
        this.notify({ trackId: track.id, status: 'completed', progress: 100 });
        return;
      }
    }

    // Check if already in queue or active
    if (this.queue.some((t) => t.id === track.id) || this.activeTrackId === track.id) {
      return;
    }

    // Check disk storage before enqueuing
    try {
      const freeDisk = await FileSystem.getFreeDiskStorageAsync();
      if (freeDisk < MIN_FREE_DISK_BYTES) {
        const errorMsg = 'Insufficient storage space on device for download';
        console.warn(`[DownloadManagerService] ${errorMsg} (${Math.round(freeDisk / 1024 / 1024)}MB free)`);
        this.notify({ trackId: track.id, status: 'failed', progress: 0, error: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Insufficient storage')) {
        throw err;
      }
      // If getFreeDiskStorageAsync fails or isn't supported, continue
    }

    this.queue.push(track);
    this.notify({ trackId: track.id, status: 'queued', progress: 0 });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.activeTrackId || this.queue.length === 0) {
      return;
    }

    const track = this.queue.shift()!;
    this.activeTrackId = track.id;

    this.notify({ trackId: track.id, status: 'downloading', progress: 0 });

    try {
      await this.ensureDownloadDir();
      console.log(`[DownloadManagerService] Resolving stream URL for download: ${track.title} (${track.id})`);
      const streamUrl = await YouTubeExtractorService.resolveStreamUrl(track.id);

      const sanitizedId = track.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileUri = `${DOWNLOAD_DIR}${sanitizedId}.mp3`;

      const downloadResumable = FileSystem.createDownloadResumable(
        streamUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const total = downloadProgress.totalBytesExpectedToWrite;
          const written = downloadProgress.totalBytesWritten;
          const percentage = total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
          this.notify({
            trackId: track.id,
            status: 'downloading',
            progress: percentage,
          });
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        const fileSize = fileInfo.exists && 'size' in fileInfo && fileInfo.size ? fileInfo.size : 0;

        await PlaylistStorageService.saveDownloadedTrack(track, result.uri, fileSize);
        console.log(`[DownloadManagerService] Successfully downloaded: ${track.title} -> ${result.uri} (${fileSize} bytes)`);

        this.notify({ trackId: track.id, status: 'completed', progress: 100 });
      } else {
        throw new Error('Download result returned empty URI');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Download failed';
      console.error(`[DownloadManagerService] Download error for ${track.title}:`, errorMsg);
      this.notify({ trackId: track.id, status: 'failed', progress: 0, error: errorMsg });
    } finally {
      this.activeTrackId = null;
      this.processQueue();
    }
  }

  async deleteDownload(trackId: string): Promise<void> {
    try {
      const record = await PlaylistStorageService.getDownloadedTrack(trackId);
      if (record) {
        const info = await FileSystem.getInfoAsync(record.localFilePath);
        if (info.exists) {
          await FileSystem.deleteAsync(record.localFilePath, { idempotent: true });
        }
        await PlaylistStorageService.deleteDownloadedTrack(trackId);
      }
      this.progressMap.delete(trackId);
      this.notify({ trackId, status: 'idle', progress: 0 });
      console.log(`[DownloadManagerService] Deleted downloaded file for trackId: ${trackId}`);
    } catch (err: any) {
      console.error(`[DownloadManagerService] Failed to delete download for trackId ${trackId}:`, err);
    }
  }

  async isTrackDownloaded(trackId: string): Promise<boolean> {
    const record = await PlaylistStorageService.getDownloadedTrack(trackId);
    if (!record) return false;
    const info = await FileSystem.getInfoAsync(record.localFilePath);
    if (!info.exists) {
      // Clean up orphaned DB record
      await PlaylistStorageService.deleteDownloadedTrack(trackId);
      return false;
    }
    return true;
  }
}

export const DownloadManagerService = new DownloadManagerServiceClass();
