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
import { useAppStore } from '../store/useAppStore';
import { AudioPlayerService } from '../services/AudioPlayerService';
import {
  YouTubeExtractorService,
  PlaylistTrack,
} from '../services/YouTubeExtractorService';

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
    playbackState,
    setPlaybackState,
    positionMs,
    setPositionMs,
    durationMs,
    setDurationMs,
  } = useAppStore();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playlistInputUrl, setPlaylistInputUrl] = useState<string>(SAMPLE_PLAYLIST_URL);
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState<boolean>(false);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<PlaylistTrack | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

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
      setLoadingTrackId(null);
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

  const handleFetchPlaylist = async () => {
    setErrorMessage(null);
    setIsFetchingPlaylist(true);

    try {
      const tracks = await YouTubeExtractorService.getPlaylistTracks(playlistInputUrl);
      setIsFetchingPlaylist(false);
      setPlaylistTracks(tracks);
      console.log(`[PlayerScreen] Fetched ${tracks.length} tracks:`, tracks);
    } catch (err: any) {
      setIsFetchingPlaylist(false);
      const errMsg = err?.message || 'Failed to fetch playlist tracks';
      setErrorMessage(errMsg);
    }
  };

  const handlePlayTrack = async (track: PlaylistTrack) => {
    setErrorMessage(null);
    setSelectedTrack(track);
    setLoadingTrackId(track.id);

    try {
      const streamUrl = await YouTubeExtractorService.resolveStreamUrl(track.id);
      setLoadingTrackId(null);
      AudioPlayerService.play(streamUrl);
    } catch (err: any) {
      setLoadingTrackId(null);
      const errMsg = err?.message || `Failed to resolve stream for ${track.title}`;
      setErrorMessage(errMsg);
    }
  };

  const handlePlaySoundHelix = () => {
    setErrorMessage(null);
    setSelectedTrack({
      id: 'soundhelix-1',
      title: 'SoundHelix Song 1',
      artist: 'SoundHelix Direct MP3',
      thumbnailUrl: '',
      duration: 372,
    });
    AudioPlayerService.play(SAMPLE_AUDIO_URL);
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

        {/* Top Player Card */}
        <View style={styles.nowPlayingCard}>
          <Text style={styles.trackTitle}>
            {selectedTrack ? selectedTrack.title : 'No Track Playing'}
          </Text>
          <Text style={styles.artistName}>
            {selectedTrack ? selectedTrack.artist : 'Select a track below'}
          </Text>

          <View style={styles.stateBadge}>
            <Text style={styles.stateBadgeText}>
              STATUS: {playbackState.toUpperCase()}
            </Text>
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
            <TouchableOpacity onPress={handleSeekBackward} style={styles.iconButton}>
              <Ionicons name="play-back" size={24} color={theme.colors.textPrimary} />
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
                size={28}
                color={theme.colors.background}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleStop} style={styles.iconButton}>
              <Ionicons name="square" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSeekForward} style={styles.iconButton}>
              <Ionicons name="play-forward" size={24} color={theme.colors.textPrimary} />
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
          <Text style={styles.sectionTitle}>YouTube Playlist Extractor</Text>
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
                <Text style={styles.fetchButtonText}>Fetch</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={handlePlaySoundHelix}
          >
            <Text style={styles.fallbackButtonText}>Play Fallback MP3 Stream</Text>
          </TouchableOpacity>
        </View>

        {/* Playlist Track List */}
        <View style={styles.listContainer}>
          <Text style={styles.listHeader}>
            Playlist Tracks ({playlistTracks.length})
          </Text>
          <FlatList
            data={playlistTracks}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.trackCard}
                onPress={() => handlePlayTrack(item)}
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
                  <Text style={styles.trackCardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.trackCardArtist} numberOfLines={1}>
                    {item.artist} • {formatDurationSeconds(item.duration)}
                  </Text>
                </View>

                {loadingTrackId === item.id ? (
                  <ActivityIndicator color={theme.colors.primary} size="small" />
                ) : (
                  <Ionicons name="play-circle-outline" size={26} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            )}
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
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  artistName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  stateBadge: {
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: theme.spacing.xs,
  },
  stateBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
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
    width: '80%',
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
    marginTop: theme.spacing.sm,
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
    marginTop: theme.spacing.sm,
  },
  listHeader: {
    color: theme.colors.textPrimary,
    fontSize: 13,
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
  trackThumbnail: {
    width: 40,
    height: 40,
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
  trackCardArtist: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
});
