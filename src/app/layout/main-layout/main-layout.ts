import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UpdateService } from '../../core/services/update.service';
import { UpdateDialog } from '../../shared/components/update-dialog/update-dialog';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UpdateDialog],
  template: `
    <!-- Header -->
    <header class="app-header no-print">
      <div class="header-left">
        <button class="btn-icon sidebar-toggle" (click)="toggleSidebar()" aria-label="Alternar menú lateral">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </button>
        <div class="header-brand">
          <img src="logo-ucb.png" alt="Logo UCB" class="header-logo" width="32" height="32" />
          <span class="header-title">Certificación Presupuestaria</span>
        </div>
      </div>
      <div class="header-right">
        <div class="header-user">
          <div class="header-user-info">
            <span class="header-user-name">{{ auth.currentUser()?.nombre_completo }}</span>
            <span class="header-user-role badge badge-primary">{{ auth.currentUser()?.rol }}</span>
          </div>
          <button class="btn btn-sm btn-secondary" (click)="logout()" aria-label="Cerrar sesión">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Salir
          </button>
        </div>
      </div>
    </header>

    <!-- Sidebar -->
    <aside class="sidebar no-print" [class.collapsed]="sidebarCollapsed()">
      <nav class="sidebar-nav" aria-label="Navegación principal">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          <span class="nav-label">Panel de Control</span>
        </a>

        @if (auth.canEdit()) {
          <a routerLink="/certificaciones/nueva" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <span class="nav-label">Nueva Certificación</span>
          </a>
        }

        <div class="nav-section">
          <span class="nav-section-label">Administración</span>
        </div>

        @if (auth.canEdit()) {
          <a routerLink="/administracion/unidades" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            <span class="nav-label">Unidades Org.</span>
          </a>
          <a routerLink="/administracion/tipo-cuentas" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            <span class="nav-label">Tipos de Cuenta</span>
          </a>
          <a routerLink="/administracion/cuentas" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
            <span class="nav-label">Cuentas Contables</span>
          </a>
          <a routerLink="/administracion/proyectos" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
            <span class="nav-label">Proyectos</span>
          </a>
          <a routerLink="/administracion/dependencias" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <span class="nav-label">Dependencias</span>
          </a>
        }

        <div class="nav-section">
          <span class="nav-section-label">Informes</span>
        </div>

        <a routerLink="/reportes" routerLinkActive="active" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span class="nav-label">Reportes</span>
        </a>

        <div class="nav-section">
          <span class="nav-section-label">Mi Cuenta</span>
        </div>
        <a routerLink="/perfil" routerLinkActive="active" class="nav-item">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span class="nav-label">Mi Perfil</span>
        </a>

        @if (auth.isAdmin()) {
          <div class="nav-section">
            <span class="nav-section-label">Sistema</span>
          </div>
          <a routerLink="/usuarios" routerLinkActive="active" class="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span class="nav-label">Usuarios</span>
          </a>
        }
      </nav>
    </aside>

    <!-- Main content -->
    <main class="main-content" [class.sidebar-collapsed]="sidebarCollapsed()">
      <router-outlet />
    </main>

    <!-- Toasts -->
    @if (toastService.toasts().length > 0) {
      <div class="toast-container" role="status" aria-live="polite">
        @for (toast of toastService.toasts(); track toast.id) {
          <div class="toast toast-{{ toast.type }}">
            {{ toast.message }}
            <button class="btn-icon" style="color: inherit" (click)="toastService.remove(toast.id)" aria-label="Cerrar notificación">✕</button>
          </div>
        }
      </div>
    }

    <!-- Update dialog -->
    <app-update-dialog />
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }

    .app-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: white;
      border-bottom: 1px solid var(--color-ucb-gray-200);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      z-index: 100;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sidebar-toggle {
      display: flex;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .header-logo {
      border-radius: 4px;
    }

    .header-title {
      font-weight: 600;
      font-size: 0.9375rem;
      color: var(--color-ucb-primary);
    }

    .header-right {
      display: flex;
      align-items: center;
    }

    .header-user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .header-user-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-align: right;
    }

    .header-user-name {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-ucb-gray-800);
    }

    .sidebar {
      position: fixed;
      top: 56px;
      left: 0;
      bottom: 0;
      width: 240px;
      background: white;
      border-right: 1px solid var(--color-ucb-gray-200);
      overflow-y: auto;
      transition: width 0.2s ease, transform 0.2s ease;
      z-index: 90;
    }

    .sidebar.collapsed {
      width: 60px;
    }

    .sidebar.collapsed .nav-label,
    .sidebar.collapsed .nav-section {
      display: none;
    }

    .sidebar-nav {
      padding: 0.5rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      color: var(--color-ucb-gray-700);
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 500;
      transition: all 0.15s ease;
      margin-bottom: 0.125rem;
    }

    .nav-item:hover {
      background-color: var(--color-ucb-gray-50);
      color: var(--color-ucb-primary);
    }

    .nav-item.active {
      background-color: #e8f0fe;
      color: var(--color-ucb-primary);
      font-weight: 600;
    }

    .nav-section {
      padding: 1rem 0.75rem 0.25rem;
    }

    .nav-section-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-ucb-gray-500);
    }

    .main-content {
      margin-top: 56px;
      margin-left: 240px;
      padding: 1.5rem;
      min-height: calc(100vh - 56px);
      transition: margin-left 0.2s ease;
    }

    .main-content.sidebar-collapsed {
      margin-left: 60px;
    }
  `],
})
export class MainLayout implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly toastService = inject(ToastService);
  private readonly updateService = inject(UpdateService);
  protected readonly sidebarCollapsed = signal(false);

  async ngOnInit(): Promise<void> {
    await this.updateService.checkForUpdate();
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected logout(): void {
    this.auth.logout();
    window.location.href = '/login';
  }
}
