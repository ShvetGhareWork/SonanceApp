import * as SQLite from 'expo-sqlite';
import { PlaylistTrack } from './YouTubeExtractorService';

export interface DownloadedTrackRecord {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
  localFilePath: string;
  downloadedAt: number;
  fileSize: number;
}

class PlaylistStorageServiceClass {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInit = false;

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;
    this.db = await SQLite.openDatabaseAsync('sonance.db');
    if (!this.isInit) {
      await this.initDb();
      this.isInit = true;
    }
    return this.db;
  }

  private async initDb(): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        trackCount INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS downloaded_tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        thumbnailUrl TEXT,
        duration INTEGER NOT NULL,
        localFilePath TEXT NOT NULL,
        downloadedAt INTEGER NOT NULL,
        fileSize INTEGER NOT NULL
      );
    `);
  }

  async saveDownloadedTrack(track: PlaylistTrack, localFilePath: string, fileSize: number): Promise<DownloadedTrackRecord> {
    const db = await this.getDb();
    const downloadedAt = Date.now();
    const record: DownloadedTrackRecord = {
      id: track.id,
      title: track.title,
      artist: track.artist || 'Unknown Artist',
      thumbnailUrl: track.thumbnailUrl || '',
      duration: track.duration || 0,
      localFilePath,
      downloadedAt,
      fileSize,
    };

    await db.runAsync(
      `INSERT OR REPLACE INTO downloaded_tracks (id, title, artist, thumbnailUrl, duration, localFilePath, downloadedAt, fileSize)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [record.id, record.title, record.artist, record.thumbnailUrl, record.duration, record.localFilePath, record.downloadedAt, record.fileSize]
    );

    return record;
  }

  async getDownloadedTrack(trackId: string): Promise<DownloadedTrackRecord | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<DownloadedTrackRecord>(
      `SELECT * FROM downloaded_tracks WHERE id = ?;`,
      [trackId]
    );
    return row || null;
  }

  async getAllDownloadedTracks(): Promise<DownloadedTrackRecord[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<DownloadedTrackRecord>(
      `SELECT * FROM downloaded_tracks ORDER BY downloadedAt DESC;`
    );
    return rows || [];
  }

  async deleteDownloadedTrack(trackId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM downloaded_tracks WHERE id = ?;`, [trackId]);
  }
}

export const PlaylistStorageService = new PlaylistStorageServiceClass();
