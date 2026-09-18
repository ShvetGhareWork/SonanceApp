import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
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
import { DownloadProgress } from '../services/DownloadManagerService';

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

interface TrackCardProps {
  item: PlaylistTrack;
  index: number;
  isCurrent: boolean;
  isFailed: boolean;
  isDownloaded: boolean;
  isResolving: boolean;
  playbackState: string;
  dlState?: DownloadProgress;
  onSelectTrack: (index: number) => void;
  onDownloadTrack: (track: PlaylistTrack) => void;
  onDeleteTrack: (trackId: string) => void;
}

const TrackCard = memo<TrackCardProps>(
  ({
    item,
    index,
    isCurrent,
    isFailed,
    isDownloaded,
    isResolving,
    playbackState,
    dlState,
    onSelectTrack,
    onDownloadTrack,
    onDeleteTrack,
  }) => {
    return (
      <TouchableOpacity
        style={[
          styles.trackCard,
          isCurrent && styles.trackCardActive,
          isFailed && styles.trackCardFailed,
        ]}
        onPress={() => onSelectTrack(index)}
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

        {/* Download Action Controls */}
        <View style={styles.downloadActionContainer}>
          {isDownloaded ? (
            <View style={styles.downloadDoneRow}>
              <Ionicons name="checkmark-circle" size={20} color="#00FF88" style={{ marginRight: 4 }} />
              <TouchableOpacity
                onPress={() => onDeleteTrack(item.id)}
                style={styles.deleteButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="#FF4D4D" />
              </TouchableOpacity>
            </View>
          ) : dlState && dlState.status === 'downloading' ? (
            <View style={styles.downloadingProgressRow}>
              <ActivityIndicator color={theme.colors.primary} size="small" style={{ marginRight: 4 }} />
              <Text style={styles.progressText}>{dlState.progress}%</Text>
            </View>
          ) : dlState && dlState.status === 'queued' ? (
            <Ionicons name="time-outline" size={20} color={theme.colors.textSecondary} />
          ) : (
            <TouchableOpacity
              onPress={() => onDownloadTrack(item)}
              style={styles.downloadButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="download-outline" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {isCurrent && isResolving ? (
          <ActivityIndicator color={theme.colors.primary} size="small" style={{ marginLeft: 6 }} />
        ) : isFailed ? (
          <Ionicons name="close-circle" size={22} color="#FF4D4D" style={{ marginLeft: 6 }} />
        ) : isCurrent ? (
          <Ionicons
            name={playbackState === 'playing' ? 'volume-high' : 'pause-circle'}
            size={24}
            color={theme.colors.primary}
            style={{ marginLeft: 6 }}
          />
        ) : (
          <Ionicons name="play-circle-outline" size={24} color={theme.colors.textSecondary} style={{ marginLeft: 6 }} />
        )}
      </TouchableOpacity>
    );
  }
);

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
    loadDownloadedTracks();
  }, []);

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

  const handleSelectTrack = useCallback((index: number) => {
    PlaybackController.playTrackAtIndex(index);
  }, []);

  const handleDownloadTrack = useCallback((track: PlaylistTrack) => {
    downloadTrack(track);
  }, [downloadTrack]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    deleteDownloadedTrack(trackId);
  }, [deleteDownloadedTrack]);

  const renderItem = useCallback(
    ({ item, index }: { item: PlaylistTrack; index: number }) => {
      const isCurrent = index === currentIndex;
      const isFailed = !!failedTrackIds[item.id];
      const isDownloaded = downloadedTracks.some((record) => record.id === item.id);
      const dlState = downloadsState[item.id];

      return (
        <TrackCard
          item={item}
          index={index}
          isCurrent={isCurrent}
          isFailed={isFailed}
          isDownloaded={isDownloaded}
          isResolving={isCurrent && isResolving}
          playbackState={playbackState}
          dlState={dlState}
          onSelectTrack={handleSelectTrack}
          onDownloadTrack={handleDownloadTrack}
          onDeleteTrack={handleDeleteTrack}
        />
      );
    },
    [
      currentIndex,
      failedTrackIds,
      downloadedTracks,
      downloadsState,
      isResolving,
      playbackState,
      handleSelectTrack,
      handleDownloadTrack,
      handleDeleteTrack,
    ]
  );

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
            renderItem={renderItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
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
  downloadActionContainer: {
    marginRight: 4,
  },
  downloadDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadingProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  downloadButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
});
