import { Injectable, signal } from '@angular/core';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly updateAvailable = signal(false);
  readonly updateVersion = signal('');
  readonly updateBody = signal('');
  readonly downloading = signal(false);
  readonly downloadProgress = signal(0);
  readonly installing = signal(false);

  private pendingUpdate: Awaited<ReturnType<typeof check>> | null = null;

  async checkForUpdate(): Promise<void> {
    try {
      const update = await check();
      if (update) {
        this.pendingUpdate = update;
        this.updateVersion.set(update.version);
        this.updateBody.set(update.body ?? '');
        this.updateAvailable.set(true);
      }
    } catch (err) {
      console.warn('Update check failed:', err);
    }
  }

  async installUpdate(): Promise<void> {
    if (!this.pendingUpdate) return;

    this.downloading.set(true);
    this.downloadProgress.set(0);

    try {
      let totalLength = 0;
      let downloaded = 0;

      await this.pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (totalLength > 0) {
              this.downloadProgress.set(Math.round((downloaded / totalLength) * 100));
            }
            break;
          case 'Finished':
            this.downloading.set(false);
            this.installing.set(true);
            break;
        }
      });

      await relaunch();
    } catch (err) {
      console.error('Update installation failed:', err);
      this.downloading.set(false);
      this.installing.set(false);
      throw err;
    }
  }

  dismiss(): void {
    this.updateAvailable.set(false);
  }
}
