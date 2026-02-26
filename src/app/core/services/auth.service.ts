import { Injectable, signal, computed } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { LoginRequest, LoginResponse, Rol, UserInfo } from '../models';

const TOKEN_KEY = 'cp_auth_token';
const USER_KEY = 'cp_auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser = signal<UserInfo | null>(this.loadStoredUser());
  private readonly _token = signal<string | null>(this.loadStoredToken());

  constructor() {
    // Migrate: clear any leftover data from the old localStorage-based session
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  readonly currentUser = this._currentUser.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token() && !!this._currentUser());
  readonly role = computed<Rol | null>(() => this._currentUser()?.rol ?? null);
  readonly userId = computed(() => this._currentUser()?.id ?? null);

  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await invoke<LoginResponse>('login', { request });
    this._token.set(response.token);
    this._currentUser.set(response.user);
    sessionStorage.setItem(TOKEN_KEY, response.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(response.user));
    return response;
  }

  logout(): void {
    this._token.set(null);
    this._currentUser.set(null);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  getToken(): string {
    return this._token() ?? '';
  }

  hasRole(...roles: Rol[]): boolean {
    const currentRole = this.role();
    return currentRole !== null && roles.includes(currentRole);
  }

  canEdit(): boolean {
    return this.hasRole('administrador', 'encargado');
  }

  isAdmin(): boolean {
    return this.hasRole('administrador');
  }

  async cambiarPassword(passwordActual: string, passwordNueva: string): Promise<string> {
    return invoke<string>('cambiar_password', {
      token: this.getToken(),
      passwordActual,
      passwordNueva,
    });
  }

  actualizarInfoUsuario(updates: Partial<Pick<UserInfo, 'nombre_completo' | 'cargo'>>): void {
    const current = this._currentUser();
    if (!current) return;
    const updated: UserInfo = { ...current, ...updates };
    this._currentUser.set(updated);
    sessionStorage.setItem(USER_KEY, JSON.stringify(updated));
  }

  private loadStoredToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  private loadStoredUser(): UserInfo | null {
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as UserInfo;
    } catch {
      return null;
    }
  }
}
