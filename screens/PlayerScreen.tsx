import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppStore } from '../store/useAppStore';
import { AudioPlayerService } from '../services/AudioPlayerService';
import { YouTubeExtractorService } from '../services/YouTubeExtractorService';

const SAMPLE_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const SAMPLE_YOUTUBE_VIDEO_ID = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up (Standard on-demand audio track)

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
  const [isResolvingYouTube, setIsResolvingYouTube] = useState<boolean>(false);
  const [currentSourceLabel, setCurrentSourceLabel] = useState<string>('No track selected');
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

  const handlePlaySoundHelix = () => {
    setErrorMessage(null);
    setCurrentSourceLabel('SoundHelix Direct Stream');
    AudioPlayerService.play(SAMPLE_AUDIO_URL);
  };

  const handleExtractAndPlayYouTube = async () => {
    setErrorMessage(null);
    setIsResolvingYouTube(true);
    setCurrentSourceLabel(`YouTube ID: ${SAMPLE_YOUTUBE_VIDEO_ID}`);

    try {
      const streamUrl = await YouTubeExtractorService.resolveStreamUrl(SAMPLE_YOUTUBE_VIDEO_ID);
      setIsResolvingYouTube(false);
      AudioPlayerService.play(streamUrl);
    } catch (err: any) {
      setIsResolvingYouTube(false);
      const errMsg = err?.message || 'Failed to extract YouTube audio stream';
      setErrorMessage(errMsg);
    }
  };

  const handlePlayPause = () => {
    setErrorMessage(null);
    if (playbackState === 'playing') {
      AudioPlayerService.pause();
    } else if (playbackState === 'paused') {
      AudioPlayerService.resume();
    } else {
      handlePlaySoundHelix();
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
            <Ionicons name="logo-youtube" size={70} color={theme.colors.primary} />
            <Text style={styles.artworkLabel}>{currentSourceLabel}</Text>
          </View>

          <Text style={styles.trackTitle}>Sonance Track Demo</Text>
          <Text style={styles.artistName}>Direct MP3 & YouTube Extractor</Text>

          <View style={styles.stateBadge}>
            <Text style={styles.stateBadgeText}>
              STATUS: {playbackState.toUpperCase()}
            </Text>
          </View>

          {/* Source Selectors */}
          <View style={styles.sourceButtonsRow}>
            <TouchableOpacity
              style={styles.sourceButton}
              onPress={handlePlaySoundHelix}
              disabled={isResolvingYouTube}
            >
              <Text style={styles.sourceButtonText}>Play Direct MP3</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sourceButton, styles.youtubeButton]}
              onPress={handleExtractAndPlayYouTube}
              disabled={isResolvingYouTube}
            >
              {isResolvingYouTube ? (
                <ActivityIndicator color={theme.colors.background} size="small" />
              ) : (
                <Text style={styles.youtubeButtonText}>Extract & Play YouTube</Text>
              )}
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#FF4D4D" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Progress bar info */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      durationMs > 0
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

            <TouchableOpacity
              onPress={handlePlayPause}
              style={styles.playButton}
              activeOpacity={0.8}
            >
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
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  artworkLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  trackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  artistName: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: theme.spacing.xs,
  },
  stateBadge: {
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
  },
  stateBadgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  sourceButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sourceButton: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sourceButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  youtubeButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeButtonText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A1414',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 8,
    marginVertical: theme.spacing.xs,
    maxWidth: '90%',
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 12,
    flexShrink: 1,
  },
  progressContainer: {
    width: '90%',
    marginVertical: theme.spacing.xs,
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
    marginTop: 4,
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
    marginTop: theme.spacing.sm,
  },
  iconButton: {
    padding: theme.spacing.sm,
  },
  playButton: {
    backgroundColor: theme.colors.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
