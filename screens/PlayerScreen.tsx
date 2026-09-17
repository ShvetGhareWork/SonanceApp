import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { theme } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppStore } from '../store/useAppStore';

export const PlayerScreen: React.FC = () => {
  const { isPlaying, setIsPlaying } = useAppStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header title="Now Playing" subtitle="Sonance Audio Player" />
        <View style={styles.playerContent}>
          <View style={styles.artworkPlaceholder}>
            <Text style={styles.artworkText}>Sonance</Text>
          </View>
          <Text style={styles.trackTitle}>No Track Selected</Text>
          <Text style={styles.artistName}>Select a track from Library</Text>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => setIsPlaying(!isPlaying)}
              activeOpacity={0.8}
            >
              <Text style={styles.playButtonText}>
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </Text>
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
    paddingBottom: theme.spacing.xl,
  },
  artworkPlaceholder: {
    width: 240,
    height: 240,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  artworkText: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  trackTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  artistName: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: theme.spacing.xl,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: 30,
    minWidth: 140,
    alignItems: 'center',
  },
  playButtonText: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});
