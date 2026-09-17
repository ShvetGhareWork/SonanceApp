package com.sonance.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

public class AudioPlayerService extends MediaSessionService {

    private static final String CHANNEL_ID = "sonance_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    private ExoPlayer player;
    private MediaSession mediaSession;
    private final IBinder binder = new LocalBinder();
    private PlaybackListener playbackListener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface PlaybackListener {
        void onPlaybackStateChanged(String state);
        void onError(String errorMessage);
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
        mediaSession = new MediaSession.Builder(this, player).build();

        createNotificationChannel();

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
                        stopForegroundService();
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
                if (isPlaying) {
                    startForegroundServiceWithNotification();
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

    public void playUrl(final String url) {
        mainHandler.post(() -> {
            if (player != null) {
                MediaItem mediaItem = MediaItem.fromUri(url);
                player.setMediaItem(mediaItem);
                player.prepare();
                player.play();
                startForegroundServiceWithNotification();
            }
        });
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
                startForegroundServiceWithNotification();
            }
        });
    }

    public void stop() {
        mainHandler.post(() -> {
            if (player != null) {
                player.stop();
            }
            stopForegroundService();
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

    private void startForegroundServiceWithNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Sonance Audio Player")
                .setContentText("Playing audio stream...")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();

        startForeground(NOTIFICATION_ID, notification);
    }

    private void stopForegroundService() {
        stopForeground(true);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Sonance Playback Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background audio playback for Sonance");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
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
        super.onDestroy();
    }
}
