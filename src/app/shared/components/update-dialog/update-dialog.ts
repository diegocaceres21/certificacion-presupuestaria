import {
  Component,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { UpdateService } from '../../../core/services/update.service';
import { Modal } from '../modal/modal';

@Component({
  selector: 'app-update-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal
      [open]="updateService.updateAvailable()"
      title="Actualización Disponible"
      ariaLabel="Nueva actualización disponible"
      maxWidth="450px"
      (closed)="updateService.dismiss()"
    >
      @if (!updateService.downloading() && !updateService.installing()) {
        <div class="update-info">
          <div class="update-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-ucb-primary)" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <p class="update-version">
            Versión <strong>{{ updateService.updateVersion() }}</strong> disponible
          </p>
          @if (updateService.updateBody()) {
            <p class="update-body">{{ updateService.updateBody() }}</p>
          }
        </div>
      }

      @if (!updateService.downloading() && !updateService.installing()) {
        <ng-container modalFooter>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="updateService.dismiss()">
              Más tarde
            </button>
            <button type="button" class="btn btn-primary" (click)="install()">
              Actualizar ahora
            </button>
          </div>
        </ng-container>
      }

      @if (updateService.downloading()) {
        <div class="update-progress">
          <p class="update-progress__label">Descargando actualización...</p>
          <div class="progress-bar">
            <div class="progress-bar__fill" [style.width.%]="updateService.downloadProgress()"></div>
          </div>
          <p class="update-progress__percent">{{ updateService.downloadProgress() }}%</p>
        </div>
      }

      @if (updateService.installing()) {
        <div class="update-progress">
          <p class="update-progress__label">Instalando actualización...</p>
          <p class="update-progress__sublabel">La aplicación se reiniciará automáticamente.</p>
        </div>
      }
    </app-modal>
  `,
  styles: `
    .update-info {
      text-align: center;
      padding: 1rem 0;
    }

    .update-icon {
      margin-bottom: 1rem;
    }

    .update-version {
      font-size: 1rem;
      color: var(--color-ucb-gray-800);
      margin: 0 0 0.5rem;
    }

    .update-body {
      font-size: 0.8125rem;
      color: var(--color-ucb-gray-600);
      margin: 0;
      white-space: pre-line;
    }

    .update-progress {
      text-align: center;
      padding: 1.5rem 0;
    }

    .update-progress__label {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--color-ucb-gray-800);
      margin: 0 0 1rem;
    }

    .update-progress__sublabel {
      font-size: 0.8125rem;
      color: var(--color-ucb-gray-500);
      margin: 0.5rem 0 0;
    }

    .update-progress__percent {
      font-size: 0.8125rem;
      color: var(--color-ucb-gray-600);
      margin: 0.5rem 0 0;
    }

    .progress-bar {
      height: 0.5rem;
      background: var(--color-ucb-gray-200);
      border-radius: 0.25rem;
      overflow: hidden;
    }

    .progress-bar__fill {
      height: 100%;
      background: var(--color-ucb-primary);
      border-radius: 0.25rem;
      transition: width 0.3s ease;
    }
  `,
})
export class UpdateDialog {
  protected readonly updateService = inject(UpdateService);

  protected async install(): Promise<void> {
    try {
      await this.updateService.installUpdate();
    } catch {
      // Error already logged in service
    }
  }
}
