package com.sonance.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class AudioPlayerModule extends ReactContextBaseJavaModule implements AudioPlayerService.PlaybackListener {

    public static final String MODULE_NAME = "AudioPlayerModule";
    private AudioPlayerService audioService;
    private boolean isBound = false;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            AudioPlayerService.LocalBinder binder = (AudioPlayerService.LocalBinder) service;
            audioService = binder.getService();
            audioService.setPlaybackListener(AudioPlayerModule.this);
            isBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            audioService = null;
            isBound = false;
        }
    };

    public AudioPlayerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        bindAudioService();
    }

    private void bindAudioService() {
        ReactApplicationContext context = getReactApplicationContext();
        Intent intent = new Intent(context, AudioPlayerService.class);
        context.startService(intent);
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (getReactApplicationContext().hasActiveReactInstance()) {
            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, params);
        }
    }

    @Override
    public void onPlaybackStateChanged(String state) {
        WritableMap params = Arguments.createMap();
        params.putString("state", state);
        sendEvent("onPlaybackStateChanged", params);
    }

    @Override
    public void onError(String errorMessage) {
        WritableMap params = Arguments.createMap();
        params.putString("error", errorMessage);
        sendEvent("onPlaybackError", params);
    }

    @ReactMethod
    public void play(String url) {
        if (isBound && audioService != null) {
            audioService.playUrl(url);
        }
    }

    @ReactMethod
    public void pause() {
        if (isBound && audioService != null) {
            audioService.pause();
        }
    }

    @ReactMethod
    public void resume() {
        if (isBound && audioService != null) {
            audioService.resume();
        }
    }

    @ReactMethod
    public void stop() {
        if (isBound && audioService != null) {
            audioService.stop();
        }
    }

    @ReactMethod
    public void seekTo(double positionMs) {
        if (isBound && audioService != null) {
            audioService.seekTo((long) positionMs);
        }
    }

    @ReactMethod
    public void getCurrentPosition(Promise promise) {
        if (isBound && audioService != null) {
            audioService.getCurrentPosition(positionMs -> promise.resolve((double) positionMs));
        } else {
            promise.resolve(0.0);
        }
    }

    @ReactMethod
    public void getDuration(Promise promise) {
        if (isBound && audioService != null) {
            audioService.getDuration(durationMs -> promise.resolve((double) durationMs));
        } else {
            promise.resolve(0.0);
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for RN Event Emitter
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Required for RN Event Emitter
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        if (isBound) {
            getReactApplicationContext().unbindService(serviceConnection);
            isBound = false;
        }
    }
}
