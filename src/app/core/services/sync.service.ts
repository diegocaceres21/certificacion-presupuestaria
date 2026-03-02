import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';
import { invoke } from '@tauri-apps/api/core';
import { SyncStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly _status = signal<SyncStatus>({
    last_sync: null,
    pending_count: 0,
    is_online: false,
  });
  private readonly _syncing = signal(false);
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private connectivityIntervalId: ReturnType<typeof setInterval> | null = null;
  private wasOnline = false;

  readonly status = this._status.asReadonly();
  readonly syncing = this._syncing.asReadonly();
  readonly isOnline = computed(() => this._status().is_online);
  readonly pendingCount = computed(() => this._status().pending_count);
  readonly lastSync = computed(() => this._status().last_sync);

  /**
   * Emits once after every successful sync pull.
   * Components subscribe to silently refresh their data when cloud changes arrive.
   */
  readonly syncCompleted$ = new Subject<void>();

  /** Start periodic sync (every 5 minutes) and connectivity watcher (every 30s). Call once after login. */
  startPeriodicSync(): void {
    this.stopPeriodicSync();
    // Initial full sync to ensure local data is up to date
    this.syncNow();
    // Periodic full sync every 5 minutes
    this.syncIntervalId = setInterval(() => {
      this.syncNow();
    }, 5 * 60 * 1000);

    // Connectivity watcher: check every 30 seconds.
    // When API transitions from offline → online, trigger an automatic sync.
    this.connectivityIntervalId = setInterval(() => {
      this.checkConnectivityAndAutoSync();
    }, 30_000);
  }

  /** Stop periodic sync and connectivity watcher. Call on logout. */
  stopPeriodicSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.connectivityIntervalId) {
      clearInterval(this.connectivityIntervalId);
      this.connectivityIntervalId = null;
    }
    this.wasOnline = false;
  }

  /** Trigger a full sync (pull + push). */
  async syncNow(): Promise<SyncStatus | null> {
    if (this._syncing()) return null;
    this._syncing.set(true);
    try {
      const status = await invoke<SyncStatus>('sync_now');
      this._status.set(status);
      this.wasOnline = status.is_online;
      this.syncCompleted$.next();
      return status;
    } catch (err) {
      console.warn('Sync failed:', err);
      return null;
    } finally {
      this._syncing.set(false);
    }
  }

  /** Refresh just the status without triggering a full sync. */
  async refreshStatus(): Promise<void> {
    try {
      const status = await invoke<SyncStatus>('get_sync_status');
      this._status.set(status);
    } catch (err) {
      console.warn('Status refresh failed:', err);
    }
  }

  /**
   * Lightweight connectivity check. When the API transitions from
   * offline → online, automatically trigger a full sync so that any
   * writes made while offline are reconciled immediately.
   */
  private async checkConnectivityAndAutoSync(): Promise<void> {
    // Skip if a sync is already running
    if (this._syncing()) return;

    try {
      const status = await invoke<SyncStatus>('get_sync_status');
      this._status.set(status);

      const nowOnline = status.is_online;

      if (nowOnline && !this.wasOnline) {
        // Connectivity restored — trigger automatic sync
        console.info('Connectivity restored. Starting automatic sync…');
        this.wasOnline = true;
        await this.syncNow();
      } else {
        this.wasOnline = nowOnline;
      }
    } catch {
      // If the check itself fails, mark as offline
      this.wasOnline = false;
    }
  }
}
