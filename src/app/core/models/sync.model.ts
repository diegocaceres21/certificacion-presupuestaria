export interface SyncStatus {
  last_sync: string | null;
  pending_count: number;
  is_online: boolean;
}
