import { NativeModules } from 'react-native';

const { YouTubeExtractorModule } = NativeModules;

export interface YouTubeExtractorNativeInterface {
  resolveStreamUrl(videoId: string): Promise<string>;
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
}

export const YouTubeExtractorService = new YouTubeExtractorServiceWrapper();
