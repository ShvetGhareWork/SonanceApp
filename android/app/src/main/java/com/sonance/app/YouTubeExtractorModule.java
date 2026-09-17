package com.sonance.app;

import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamExtractor;
import org.schabi.newpipe.extractor.stream.StreamInfo;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class YouTubeExtractorModule extends ReactContextBaseJavaModule {

    public static final String MODULE_NAME = "YouTubeExtractorModule";
    private static final String TAG = "YouTubeExtractorModule";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static boolean isNewPipeInitialized = false;

    public YouTubeExtractorModule(ReactApplicationContext reactContext) {
        super(reactContext);
        initNewPipe();
    }

    private synchronized void initNewPipe() {
        if (!isNewPipeInitialized) {
            try {
                NewPipe.init(DownloaderImpl.getInstance());
                isNewPipeInitialized = true;
                Log.d(TAG, "NewPipeExtractor initialized successfully");
            } catch (Exception e) {
                Log.e(TAG, "Failed to initialize NewPipeExtractor", e);
            }
        }
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void resolveStreamUrl(final String videoId, final Promise promise) {
        if (videoId == null || videoId.trim().isEmpty()) {
            promise.reject("INVALID_ID", "YouTube video ID cannot be null or empty");
            return;
        }

        executor.execute(() -> {
            try {
                String videoUrl = "https://www.youtube.com/watch?v=" + videoId.trim();
                Log.d(TAG, "Resolving stream URL for video URL: " + videoUrl);

                StreamInfo streamInfo = StreamInfo.getInfo(ServiceList.YouTube, videoUrl);

                if (streamInfo == null) {
                    Log.e(TAG, "StreamInfo is null for videoId: " + videoId);
                    promise.reject("EXTRACTION_FAILED", "Failed to retrieve stream info for video: " + videoId);
                    return;
                }

                List<AudioStream> audioStreams = streamInfo.getAudioStreams();
                String streamUrl = null;

                if (audioStreams != null && !audioStreams.isEmpty()) {
                    // Find highest average bitrate audio stream
                    AudioStream bestAudioStream = null;
                    long maxBitrate = -1;

                    for (AudioStream audioStream : audioStreams) {
                        if (audioStream != null && audioStream.getUrl() != null) {
                            long bitrate = audioStream.getAverageBitrate();
                            if (bitrate > maxBitrate) {
                                maxBitrate = bitrate;
                                bestAudioStream = audioStream;
                            }
                        }
                    }

                    if (bestAudioStream != null) {
                        streamUrl = bestAudioStream.getUrl();
                    }
                }

                // Fallback to video/audio combined streams if no audio-only stream found
                if (streamUrl == null && streamInfo.getVideoStreams() != null && !streamInfo.getVideoStreams().isEmpty()) {
                    streamUrl = streamInfo.getVideoStreams().get(0).getUrl();
                }

                if (streamUrl != null && !streamUrl.isEmpty()) {
                    Log.d(TAG, "Successfully resolved stream URL for videoId: " + videoId);
                    promise.resolve(streamUrl);
                } else {
                    Log.e(TAG, "No playable stream URL found for videoId: " + videoId);
                    promise.reject("NO_STREAM", "No playable audio or video stream found for video: " + videoId);
                }

            } catch (Exception e) {
                Log.e(TAG, "Error extracting YouTube stream for videoId: " + videoId, e);
                promise.reject("EXTRACTION_ERROR", "Extraction failed: " + e.getMessage(), e);
            }
        });
    }
}
