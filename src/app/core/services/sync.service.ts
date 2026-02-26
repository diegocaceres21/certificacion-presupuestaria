import { Injectable, signal, computed } from '@angular/core';
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
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly status = this._status.asReadonly();
  readonly syncing = this._syncing.asReadonly();
  readonly isOnline = computed(() => this._status().is_online);
  readonly pendingCount = computed(() => this._status().pending_count);
  readonly lastSync = computed(() => this._status().last_sync);

  /** Start periodic sync (every 5 minutes). Call once after login. */
  startPeriodicSync(): void {
    this.stopPeriodicSync();
    // Initial status check
    this.refreshStatus();
    // Periodic refresh every 5 minutes
    this.intervalId = setInterval(() => {
      this.syncNow();
    }, 5 * 60 * 1000);
  }

  /** Stop periodic sync. Call on logout. */
  stopPeriodicSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Trigger a full sync (pull + push). */
  async syncNow(): Promise<SyncStatus | null> {
    if (this._syncing()) return null;
    this._syncing.set(true);
    try {
      const status = await invoke<SyncStatus>('sync_now');
      this._status.set(status);
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
}
