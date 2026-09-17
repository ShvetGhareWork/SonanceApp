/**
 * Native Module Bridge Placeholder for Sonance
 * Custom Java Native Modules will be integrated here in future sprints.
 */

export interface NativeAudioBridge {
  isAvailable: () => boolean;
}

export const NativeAudioBridge: NativeAudioBridge = {
  isAvailable: () => false,
};
