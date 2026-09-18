import { NativeModules } from 'react-native';

const { YouTubeExtractorModule } = NativeModules;

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number; // in seconds
}

export interface YouTubeExtractorNativeInterface {
  resolveStreamUrl(videoId: string): Promise<string>;
  getPlaylistTracks(playlistUrl: string): Promise<PlaylistTrack[]>;
}

interface CacheEntry {
  url: string;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

const YouTubeExtractorNative: YouTubeExtractorNativeInterface = YouTubeExtractorModule;

class YouTubeExtractorServiceWrapper {
  private cache: Map<string, CacheEntry> = new Map();

  async resolveStreamUrl(videoId: string): Promise<string> {
    if (!YouTubeExtractorNative || !YouTubeExtractorNative.resolveStreamUrl) {
      throw new Error('YouTubeExtractorModule is not available on this platform.');
    }

    const cached = this.cache.get(videoId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[YouTubeExtractorService] Cache hit for videoId: ${videoId}`);
      return cached.url;
    }

    if (cached) {
      console.log(`[YouTubeExtractorService] Cache expired for videoId: ${videoId}, re-resolving...`);
      this.cache.delete(videoId);
    }

    let attempt = 0;
    const maxRetries = 1;

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          console.warn(`[YouTubeExtractorService] Retry attempt #${attempt} for videoId: ${videoId}`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const streamUrl = await YouTubeExtractorNative.resolveStreamUrl(videoId);
        this.cache.set(videoId, {
          url: streamUrl,
          timestamp: Date.now(),
        });
        return streamUrl;
      } catch (error: any) {
        attempt++;
        if (attempt > maxRetries) {
          console.error(
            `[YouTubeExtractorService] Failed to resolve stream URL after ${maxRetries + 1} attempt(s) for videoId: ${videoId}`,
            error
          );
          throw error;
        }
      }
    }

    throw new Error(`Failed to resolve stream URL for videoId: ${videoId}`);
  }

  async getPlaylistTracks(playlistUrl: string): Promise<PlaylistTrack[]> {
    if (!YouTubeExtractorNative || !YouTubeExtractorNative.getPlaylistTracks) {
      throw new Error('YouTubeExtractorModule is not available on this platform.');
    }
    try {
      const tracks = await YouTubeExtractorNative.getPlaylistTracks(playlistUrl);
      return tracks;
    } catch (error: any) {
      console.error('[YouTubeExtractorService] Failed to fetch playlist tracks:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const YouTubeExtractorService = new YouTubeExtractorServiceWrapper();
