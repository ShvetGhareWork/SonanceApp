package com.sonance.app;

import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.schabi.newpipe.extractor.ListExtractor.InfoItemsPage;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.Page;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.linkhandler.ListLinkHandler;
import org.schabi.newpipe.extractor.playlist.PlaylistExtractor;
import org.schabi.newpipe.extractor.playlist.PlaylistInfo;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamInfo;
import org.schabi.newpipe.extractor.stream.StreamInfoItem;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class YouTubeExtractorModule extends ReactContextBaseJavaModule {

    public static final String MODULE_NAME = "YouTubeExtractorModule";
    private static final String TAG = "YouTubeExtractorModule";
    private static final int MAX_PLAYLIST_TRACKS = 400;

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

    @ReactMethod
    public void getPlaylistTracks(final String playlistUrl, final Promise promise) {
        if (playlistUrl == null || playlistUrl.trim().isEmpty()) {
            promise.reject("INVALID_URL", "Playlist URL cannot be null or empty");
            return;
        }

        executor.execute(() -> {
            try {
                Log.d(TAG, "Fetching playlist info for URL: " + playlistUrl);
                PlaylistExtractor extractor = ServiceList.YouTube.getPlaylistExtractor(playlistUrl.trim());
                extractor.fetchPage();

                PlaylistInfo playlistInfo = PlaylistInfo.getInfo(extractor);

                if (playlistInfo == null) {
                    promise.reject("PLAYLIST_NOT_FOUND", "Could not fetch playlist info for URL: " + playlistUrl);
                    return;
                }

                WritableArray tracksArray = Arguments.createArray();
                int trackCount = 0;

                // Process initial batch of items
                List<StreamInfoItem> items = playlistInfo.getRelatedItems();
                if (items != null) {
                    for (StreamInfoItem item : items) {
                        if (trackCount >= MAX_PLAYLIST_TRACKS) break;
                        WritableMap trackMap = extractTrackMetadata(item);
                        if (trackMap != null) {
                            tracksArray.pushMap(trackMap);
                            trackCount++;
                        }
                    }
                }

                // Handle pagination if playlist has more pages
                Page nextPage = playlistInfo.getNextPage();
                while (nextPage != null && trackCount < MAX_PLAYLIST_TRACKS) {
                    InfoItemsPage<StreamInfoItem> page = PlaylistInfo.getMoreItems(ServiceList.YouTube, extractor.getUrl(), nextPage);
                    if (page != null) {
                        List<StreamInfoItem> pageItems = page.getItems();
                        if (pageItems != null) {
                            for (StreamInfoItem item : pageItems) {
                                if (trackCount >= MAX_PLAYLIST_TRACKS) break;
                                WritableMap trackMap = extractTrackMetadata(item);
                                if (trackMap != null) {
                                    tracksArray.pushMap(trackMap);
                                    trackCount++;
                                }
                            }
                        }
                        if (page.hasNextPage()) {
                            nextPage = page.getNextPage();
                        } else {
                            nextPage = null;
                        }
                    } else {
                        nextPage = null;
                    }
                }

                Log.d(TAG, "Successfully extracted " + trackCount + " tracks from playlist");
                promise.resolve(tracksArray);

            } catch (Exception e) {
                Log.e(TAG, "Error extracting playlist tracks for URL: " + playlistUrl, e);
                promise.reject("PLAYLIST_EXTRACTION_ERROR", "Playlist extraction failed: " + e.getMessage(), e);
            }
        });
    }

    private WritableMap extractTrackMetadata(StreamInfoItem item) {
        if (item == null) return null;

        try {
            String url = item.getUrl();
            String videoId = extractVideoId(url);
            if (videoId == null || videoId.isEmpty()) {
                Log.w(TAG, "Skipping item due to unresolvable video ID. URL: " + url);
                return null;
            }

            String thumbnailUrl = "";
            if (item.getThumbnails() != null && !item.getThumbnails().isEmpty()) {
                thumbnailUrl = item.getThumbnails().get(0).getUrl();
            }

            WritableMap map = Arguments.createMap();
            map.putString("id", videoId);
            map.putString("title", item.getName() != null ? item.getName() : "Unknown Title");
            map.putString("artist", item.getUploaderName() != null ? item.getUploaderName() : "Unknown Artist");
            map.putString("thumbnailUrl", thumbnailUrl);
            map.putDouble("duration", item.getDuration() >= 0 ? (double) item.getDuration() : 0.0);

            return map;
        } catch (Exception e) {
            Log.w(TAG, "Skipping playlist item due to error: " + e.getMessage());
            return null;
        }
    }

    private String extractVideoId(String url) {
        if (url == null) return null;
        if (url.contains("v=")) {
            int vIndex = url.indexOf("v=") + 2;
            int ampIndex = url.indexOf("&", vIndex);
            if (ampIndex != -1) {
                return url.substring(vIndex, ampIndex);
            }
            return url.substring(vIndex);
        } else if (url.contains("youtu.be/")) {
            int idIndex = url.indexOf("youtu.be/") + 9;
            int qIndex = url.indexOf("?", idIndex);
            if (qIndex != -1) {
                return url.substring(idIndex, qIndex);
            }
            return url.substring(idIndex);
        }
        return url;
    }
}
