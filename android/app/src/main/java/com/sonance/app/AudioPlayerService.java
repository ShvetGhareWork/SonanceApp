package com.sonance.app;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Binder;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.SessionResult;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AudioPlayerService extends MediaSessionService {

    private ExoPlayer player;
    private MediaSession mediaSession;
    private final IBinder binder = new LocalBinder();
    private PlaybackListener playbackListener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();

    public interface PlaybackListener {
        void onPlaybackStateChanged(String state);
        void onError(String errorMessage);
        void onSkipToNext();
        void onSkipToPrevious();
    }

    public interface PromiseCallback<T> {
        void onResult(T result);
    }

    public class LocalBinder extends Binder {
        public AudioPlayerService getService() {
            return AudioPlayerService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this).build();

        MediaSession.Callback sessionCallback = new MediaSession.Callback() {
            @Override
            public int onPlayerCommandRequest(
                    MediaSession session,
                    MediaSession.ControllerInfo controller,
                    int playerCommand) {
                if (playerCommand == Player.COMMAND_SEEK_TO_NEXT || playerCommand == Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM) {
                    mainHandler.post(() -> {
                        if (playbackListener != null) {
                            playbackListener.onSkipToNext();
                        }
                    });
                    return SessionResult.RESULT_SUCCESS;
                }
                if (playerCommand == Player.COMMAND_SEEK_TO_PREVIOUS || playerCommand == Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
                    mainHandler.post(() -> {
                        if (playbackListener != null) {
                            playbackListener.onSkipToPrevious();
                        }
                    });
                    return SessionResult.RESULT_SUCCESS;
                }
                return SessionResult.RESULT_SUCCESS;
            }
        };

        mediaSession = new MediaSession.Builder(this, player)
                .setCallback(sessionCallback)
                .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                String stateStr;
                switch (playbackState) {
                    case Player.STATE_BUFFERING:
                        stateStr = "buffering";
                        break;
                    case Player.STATE_READY:
                        stateStr = player.getPlayWhenReady() ? "playing" : "paused";
                        break;
                    case Player.STATE_ENDED:
                        stateStr = "ended";
                        break;
                    case Player.STATE_IDLE:
                    default:
                        stateStr = "idle";
                        break;
                }
                if (playbackListener != null) {
                    playbackListener.onPlaybackStateChanged(stateStr);
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (playbackListener != null) {
                    playbackListener.onPlaybackStateChanged(isPlaying ? "playing" : "paused");
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                if (playbackListener != null) {
                    playbackListener.onError(error.getMessage() != null ? error.getMessage() : "Playback error");
                }
            }
        });
    }

    public void setPlaybackListener(PlaybackListener listener) {
        this.playbackListener = listener;
    }

    public void playUrl(final String url, final String title, final String artist, final String thumbnailUrl) {
        mainHandler.post(() -> {
            if (player != null) {
                MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder();
                if (title != null) metadataBuilder.setTitle(title);
                if (artist != null) metadataBuilder.setArtist(artist);
                if (thumbnailUrl != null && !thumbnailUrl.isEmpty()) {
                    metadataBuilder.setArtworkUri(Uri.parse(thumbnailUrl));
                }

                MediaMetadata metadata = metadataBuilder.build();

                MediaItem mediaItem = new MediaItem.Builder()
                        .setMediaId(url)
                        .setUri(url)
                        .setMediaMetadata(metadata)
                        .build();

                player.setMediaItem(mediaItem);
                player.prepare();
                player.play();

                if (thumbnailUrl != null && !thumbnailUrl.isEmpty() && (thumbnailUrl.startsWith("http://") || thumbnailUrl.startsWith("https://"))) {
                    loadArtworkAsync(thumbnailUrl, metadataBuilder, mediaItem);
                }
            }
        });
    }

    private void loadArtworkAsync(String thumbnailUrl, MediaMetadata.Builder metadataBuilder, MediaItem currentMediaItem) {
        imageExecutor.execute(() -> {
            try {
                URL url = new URL(thumbnailUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setDoInput(true);
                connection.connect();
                InputStream input = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                if (bitmap != null) {
                    mainHandler.post(() -> {
                        if (player != null) {
                            MediaItem activeItem = player.getCurrentMediaItem();
                            if (activeItem != null && activeItem.mediaId.equals(currentMediaItem.mediaId)) {
                                MediaMetadata updatedMetadata = metadataBuilder
                                        .setArtworkData(bitmapToByteArray(bitmap), MediaMetadata.PICTURE_TYPE_FRONT_COVER)
                                        .build();
                                MediaItem updatedItem = currentMediaItem.buildUpon()
                                        .setMediaMetadata(updatedMetadata)
                                        .build();
                                player.replaceMediaItem(player.getCurrentMediaItemIndex(), updatedItem);
                            }
                        }
                    });
                }
            } catch (Exception e) {
                // Artwork fallback to uri
            }
        });
    }

    private byte[] bitmapToByteArray(Bitmap bitmap) {
        java.io.ByteArrayOutputStream stream = new java.io.ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
        return stream.toByteArray();
    }

    public void pause() {
        mainHandler.post(() -> {
            if (player != null) {
                player.pause();
            }
        });
    }

    public void resume() {
        mainHandler.post(() -> {
            if (player != null) {
                player.play();
            }
        });
    }

    public void stop() {
        mainHandler.post(() -> {
            if (player != null) {
                player.stop();
            }
        });
    }

    public void seekTo(final long positionMs) {
        mainHandler.post(() -> {
            if (player != null) {
                player.seekTo(positionMs);
            }
        });
    }

    public void getCurrentPosition(final PromiseCallback<Long> callback) {
        mainHandler.post(() -> {
            long pos = player != null ? player.getCurrentPosition() : 0;
            callback.onResult(pos);
        });
    }

    public void getDuration(final PromiseCallback<Long> callback) {
        mainHandler.post(() -> {
            long dur = player != null ? player.getDuration() : 0;
            callback.onResult(dur);
        });
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        super.onBind(intent);
        return binder;
    }

    @Override
    public void onDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        imageExecutor.shutdown();
        super.onDestroy();
    }
}
