import React, { useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../constants/theme';
import { Header } from '../components/Header';
import { usePlayerStore } from '../store/playerStore';
import { PlaybackController } from '../services/PlaybackController';
import { PlaylistTrack } from '../services/YouTubeExtractorService';
import { DownloadedTrackRecord } from '../services/PlaylistStorageService';

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

interface LibraryTrackCardProps {
  item: DownloadedTrackRecord;
  onPlay: (item: DownloadedTrackRecord) => void;
  onDelete: (trackId: string) => void;
}

const LibraryTrackCard = memo<LibraryTrackCardProps>(({ item, onPlay, onDelete }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPlay(item)} activeOpacity={0.7}>
      {item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Ionicons name="musical-note" size={20} color={theme.colors.primary} />
        </View>
      )}

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {item.artist} • {formatSize(item.fileSize)}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        style={styles.deleteButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color="#FF4D4D" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export const LibraryScreen: React.FC = () => {
  const { downloadedTracks, loadDownloadedTracks, deleteDownloadedTrack } = usePlayerStore();

  useEffect(() => {
    loadDownloadedTracks();
  }, []);

  const totalBytes = downloadedTracks.reduce((acc, item) => acc + (item.fileSize || 0), 0);

  const handlePlayDownloadedTrack = useCallback(async (item: DownloadedTrackRecord) => {
    const track: PlaylistTrack = {
      id: item.id,
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      duration: item.duration,
    };
    await PlaybackController.loadQueue([track], 0);
  }, []);

  const handleDeleteDownloadedTrack = useCallback(
    async (trackId: string) => {
      await deleteDownloadedTrack(trackId);
    },
    [deleteDownloadedTrack]
  );

  const renderItem = useCallback(
    ({ item }: { item: DownloadedTrackRecord }) => (
      <LibraryTrackCard
        item={item}
        onPlay={handlePlayDownloadedTrack}
        onDelete={handleDeleteDownloadedTrack}
      />
    ),
    [handlePlayDownloadedTrack, handleDeleteDownloadedTrack]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header title="Library" subtitle="Offline Downloaded Tracks & Persistence" />

        <View style={styles.storageSummaryCard}>
          <View style={styles.summaryIconContainer}>
            <Ionicons name="folder-open" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle}>Downloaded Audio Files</Text>
            <Text style={styles.summarySubtitle}>
              {downloadedTracks.length} tracks • {formatSize(totalBytes)} used
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Offline Tracks ({downloadedTracks.length})</Text>

        <FlatList
          data={downloadedTracks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Downloaded Tracks Yet</Text>
              <Text style={styles.emptySubtitle}>
                Download tracks from the Now Playing screen to enjoy them offline anytime.
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
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
  storageSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  summarySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  listContent: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  thumbnail: {
    width: 42,
    height: 42,
    borderRadius: 6,
  },
  thumbnailPlaceholder: {
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    marginRight: theme.spacing.xs,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    padding: theme.spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
  },
});
