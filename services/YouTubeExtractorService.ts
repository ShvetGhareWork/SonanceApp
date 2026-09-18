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

const YouTubeExtractorNative: YouTubeExtractorNativeInterface = YouTubeExtractorModule;

class YouTubeExtractorServiceWrapper {
  async resolveStreamUrl(videoId: string): Promise<string> {
    if (!YouTubeExtractorNative || !YouTubeExtractorNative.resolveStreamUrl) {
      throw new Error('YouTubeExtractorModule is not available on this platform.');
    }
    try {
      const streamUrl = await YouTubeExtractorNative.resolveStreamUrl(videoId);
      return streamUrl;
    } catch (error: any) {
      console.error('[YouTubeExtractorService] Failed to resolve stream URL:', error);
      throw error;
    }
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
}

export const YouTubeExtractorService = new YouTubeExtractorServiceWrapper();
