import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../constants/theme';
import { Header } from '../components/Header';
import { usePlayerStore } from '../store/playerStore';
import { PlaybackController } from '../services/PlaybackController';
import {
  YouTubeExtractorService,
  PlaylistTrack,
} from '../services/YouTubeExtractorService';
import { AudioPlayerService } from '../services/AudioPlayerService';

const SAMPLE_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const SAMPLE_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jXS_OtUyaL12Q14O2L18R';

function formatTime(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function formatDurationSeconds(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const PlayerScreen: React.FC = () => {
  const {
    queue,
    currentIndex,
    currentTrack,
    playbackState,
    positionMs,
    durationMs,
    failedTrackIds,
    isResolving,
    errorMessage,
    setPositionMs,
    setDurationMs,
  } = usePlayerStore();

  const [playlistInputUrl, setPlaylistInputUrl] = useState<string>(SAMPLE_PLAYLIST_URL);
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleFetchPlaylist = async () => {
    setIsFetchingPlaylist(true);
    usePlayerStore.getState().setErrorMessage(null);

    try {
      const tracks = await YouTubeExtractorService.getPlaylistTracks(playlistInputUrl);
      setIsFetchingPlaylist(false);
      console.log(`[PlayerScreen] Fetched ${tracks.length} tracks. Loading queue...`);
      await PlaybackController.loadQueue(tracks, 0);
    } catch (err: any) {
      setIsFetchingPlaylist(false);
      const errMsg = err?.message || 'Failed to fetch playlist tracks';
      usePlayerStore.getState().setErrorMessage(errMsg);
    }
  };

  const handlePlayDirectMp3 = () => {
    const directTrack: PlaylistTrack = {
      id: SAMPLE_AUDIO_URL,
      title: 'SoundHelix Song 1 (Direct MP3)',
      artist: 'SoundHelix Demo Stream',
      thumbnailUrl: '',
      duration: 372,
    };
    PlaybackController.loadQueue([directTrack], 0);
  };

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      PlaybackController.pause();
    } else if (playbackState === 'paused') {
      PlaybackController.resume();
    } else if (queue.length > 0) {
      PlaybackController.playTrackAtIndex(currentIndex >= 0 ? currentIndex : 0);
    } else {
      handlePlayDirectMp3();
    }
  };

  const handleStop = () => {
    PlaybackController.stop();
  };

  const handleSeekForward = () => {
    PlaybackController.seekTo(positionMs + 10000);
  };

  const handleSeekBackward = () => {
    PlaybackController.seekTo(Math.max(0, positionMs - 10000));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header title="Now Playing" subtitle="Sonance Audio Engine & Queue" />

        {/* Now Playing Card */}
        <View style={styles.nowPlayingCard}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentTrack ? currentTrack.title : 'No Track Playing'}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {currentTrack
              ? `${currentTrack.artist} • Track ${currentIndex + 1} of ${queue.length}`
              : 'Fetch a playlist or select a track below'}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.stateBadge}>
              <Text style={styles.stateBadgeText}>
                STATUS: {playbackState.toUpperCase()}
              </Text>
            </View>

            {isResolving && (
              <View style={[styles.stateBadge, styles.resolvingBadge]}>
                <ActivityIndicator size="small" color={theme.colors.background} style={{ marginRight: 4 }} />
                <Text style={styles.resolvingBadgeText}>RESOLVING STREAM...</Text>
              </View>
            )}
          </View>

          {/* Progress Bar */}
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

          {/* Playback Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={() => PlaybackController.playPrevious()} style={styles.iconButton}>
              <Ionicons name="play-skip-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSeekBackward} style={styles.iconButton}>
              <Ionicons name="play-back" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePlayPause}
              style={styles.playButton}
              activeOpacity={0.8}
              disabled={isResolving}
            >
              <Ionicons
                name={
                  playbackState === 'playing'
                    ? 'pause'
                    : playbackState === 'buffering'
                    ? 'hourglass-outline'
                    : 'play'
                }
                size={28}
                color={theme.colors.background}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleStop} style={styles.iconButton}>
              <Ionicons name="square" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSeekForward} style={styles.iconButton}>
              <Ionicons name="play-forward" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => PlaybackController.playNext()} style={styles.iconButton}>
              <Ionicons name="play-skip-forward" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#FF4D4D" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Playlist Input Section */}
        <View style={styles.playlistInputSection}>
          <Text style={styles.sectionTitle}>Queue & Playlist Loader</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.urlInput}
              value={playlistInputUrl}
              onChangeText={setPlaylistInputUrl}
              placeholder="Paste YouTube Playlist URL"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.fetchButton}
              onPress={handleFetchPlaylist}
              disabled={isFetchingPlaylist}
            >
              {isFetchingPlaylist ? (
                <ActivityIndicator color={theme.colors.background} size="small" />
              ) : (
                <Text style={styles.fetchButtonText}>Load Queue</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={handlePlayDirectMp3}
          >
            <Text style={styles.fallbackButtonText}>Play Fallback Direct MP3 Stream</Text>
          </TouchableOpacity>
        </View>

        {/* Playlist Track List */}
        <View style={styles.listContainer}>
          <Text style={styles.listHeader}>
            Active Queue ({queue.length} tracks)
          </Text>
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const isCurrent = index === currentIndex;
              const isFailed = !!failedTrackIds[item.id];

              return (
                <TouchableOpacity
                  style={[
                    styles.trackCard,
                    isCurrent && styles.trackCardActive,
                    isFailed && styles.trackCardFailed,
                  ]}
                  onPress={() => PlaybackController.playTrackAtIndex(index)}
                  activeOpacity={0.7}
                >
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.trackThumbnail} />
                  ) : (
                    <View style={[styles.trackThumbnail, styles.thumbnailPlaceholder]}>
                      <Ionicons name="musical-note" size={20} color={theme.colors.primary} />
                    </View>
                  )}

                  <View style={styles.trackInfo}>
                    <Text
                      style={[styles.trackCardTitle, isCurrent && styles.trackCardTitleActive]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.trackCardArtist} numberOfLines={1}>
                      {item.artist} • {formatDurationSeconds(item.duration)}
                    </Text>
                  </View>

                  {isCurrent && isResolving ? (
                    <ActivityIndicator color={theme.colors.primary} size="small" />
                  ) : isFailed ? (
                    <Ionicons name="close-circle" size={22} color="#FF4D4D" />
                  ) : isCurrent ? (
                    <Ionicons
                      name={playbackState === 'playing' ? 'volume-high' : 'pause-circle'}
                      size={24}
                      color={theme.colors.primary}
                    />
                  ) : (
                    <Ionicons name="play-circle-outline" size={24} color={theme.colors.textSecondary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
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
  nowPlayingCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  trackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  artistName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  stateBadge: {
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stateBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  resolvingBadge: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resolvingBadgeText: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressContainer: {
    width: '100%',
    marginVertical: theme.spacing.xs,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: theme.spacing.xs,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  playButton: {
    backgroundColor: theme.colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A1414',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 8,
    marginVertical: theme.spacing.xs,
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 12,
    flexShrink: 1,
  },
  playlistInputSection: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  urlInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    borderRadius: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    fontSize: 11,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fetchButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fetchButtonText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  fallbackButton: {
    marginTop: theme.spacing.xs,
    alignItems: 'center',
  },
  fallbackButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  listContainer: {
    flex: 1,
    marginTop: theme.spacing.xs,
  },
  listHeader: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  listContent: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xl,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  trackCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceHighlight,
  },
  trackCardFailed: {
    borderColor: '#FF4D4D',
    opacity: 0.6,
  },
  trackThumbnail: {
    width: 38,
    height: 38,
    borderRadius: 6,
  },
  thumbnailPlaceholder: {
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    marginRight: theme.spacing.xs,
  },
  trackCardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  trackCardTitleActive: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  trackCardArtist: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
});
