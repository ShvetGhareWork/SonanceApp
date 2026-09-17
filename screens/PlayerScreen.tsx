import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppStore } from '../store/useAppStore';
import { AudioPlayerService } from '../services/AudioPlayerService';

const SAMPLE_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

function formatTime(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const PlayerScreen: React.FC = () => {
  const {
    playbackState,
    setPlaybackState,
    positionMs,
    setPositionMs,
    durationMs,
    setDurationMs,
  } = useAppStore();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stateSub = AudioPlayerService.onPlaybackStateChanged((state) => {
      setPlaybackState(state);
      if (state === 'playing') {
        AudioPlayerService.getDuration().then(setDurationMs);
      }
    });

    const errorSub = AudioPlayerService.onPlaybackError((err) => {
      setErrorMessage(err);
      setPlaybackState('idle');
    });

    return () => {
      stateSub.remove();
      errorSub.remove();
    };
  }, [setPlaybackState, setDurationMs]);

  useEffect(() => {
    if (playbackState === 'playing') {
      intervalRef.current = setInterval(async () => {
        const pos = await AudioPlayerService.getCurrentPosition();
        const dur = await AudioPlayerService.getDuration();
        setPositionMs(pos);
        if (dur > 0) {
          setDurationMs(dur);
        }
      }, 500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playbackState, setPositionMs, setDurationMs]);

  const handlePlayPause = () => {
    setErrorMessage(null);
    if (playbackState === 'playing') {
      AudioPlayerService.pause();
    } else if (playbackState === 'paused') {
      AudioPlayerService.resume();
    } else {
      AudioPlayerService.play(SAMPLE_AUDIO_URL);
    }
  };

  const handleStop = () => {
    AudioPlayerService.stop();
    setPlaybackState('idle');
    setPositionMs(0);
  };

  const handleSeekForward = async () => {
    const current = await AudioPlayerService.getCurrentPosition();
    AudioPlayerService.seekTo(current + 10000);
  };

  const handleSeekBackward = async () => {
    const current = await AudioPlayerService.getCurrentPosition();
    AudioPlayerService.seekTo(Math.max(0, current - 10000));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header title="Now Playing" subtitle="Sonance Audio Player" />
        <View style={styles.playerContent}>
          <View style={styles.artworkPlaceholder}>
            <Ionicons name="musical-notes" size={80} color={theme.colors.primary} />
            <Text style={styles.artworkLabel}>SoundHelix Song 1</Text>
          </View>

          <Text style={styles.trackTitle}>SoundHelix Sample Track</Text>
          <Text style={styles.artistName}>Public Domain Demo Stream</Text>

          <View style={styles.stateBadge}>
            <Text style={styles.stateBadgeText}>
              STATUS: {playbackState.toUpperCase()}
            </Text>
          </View>

          {errorMessage && (
            <Text style={styles.errorText}>Error: {errorMessage}</Text>
          )}

          {/* Progress bar info */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: durationMs > 0
                      ? `${Math.min(100, (positionMs / durationMs) * 100)}%`
                      : '0%',
                  },
                ]}
              />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
              <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={handleSeekBackward} style={styles.iconButton}>
              <Ionicons name="play-back" size={32} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePlayPause} style={styles.playButton} activeOpacity={0.8}>
              <Ionicons
                name={
                  playbackState === 'playing'
                    ? 'pause'
                    : playbackState === 'buffering'
                    ? 'hourglass-outline'
                    : 'play'
                }
                size={36}
                color={theme.colors.background}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleStop} style={styles.iconButton}>
              <Ionicons name="square" size={28} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSeekForward} style={styles.iconButton}>
              <Ionicons name="play-forward" size={32} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
  },
  playerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: theme.spacing.md,
  },
  artworkPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  artworkLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
  trackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  artistName: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
  },
  stateBadge: {
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
  },
  stateBadgeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  progressContainer: {
    width: '90%',
    marginVertical: theme.spacing.sm,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '90%',
    marginTop: theme.spacing.md,
  },
  iconButton: {
    padding: theme.spacing.sm,
  },
  playButton: {
    backgroundColor: theme.colors.primary,
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
