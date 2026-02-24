import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img src="logo-ucb.png" alt="Logo UCB" class="login-logo" width="72" height="72" />
          <h1 class="login-title">Universidad Católica Boliviana</h1>
          <p class="login-subtitle">"San Pablo" — Sede Cochabamba</p>
          <h2 class="login-app-title">Certificación Presupuestaria</h2>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="usuario">Usuario</label>
            <input
              id="usuario"
              type="text"
              formControlName="usuario"
              placeholder="Ingrese su usuario"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="Ingrese su contraseña"
              autocomplete="current-password"
            />
          </div>

          @if (errorMessage()) {
            <div class="error-message" role="alert">
              {{ errorMessage() }}
            </div>
          }

          <button
            type="submit"
            class="btn btn-primary login-btn"
            [disabled]="loading() || form.invalid"
          >
            @if (loading()) {
              <span class="spinner"></span>
              Ingresando...
            } @else {
              Iniciar Sesión
            }
          </button>
        </form>

        <div class="login-footer">
          <p>Sistema de Gestión Presupuestaria — UCB</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--color-ucb-primary) 0%, var(--color-ucb-primary-dark) 100%);
      padding: 1rem;
    }

    .login-card {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 420px;
      overflow: hidden;
    }

    .login-header {
      text-align: center;
      padding: 2rem 2rem 1rem;
      background: var(--color-ucb-gray-50);
      border-bottom: 3px solid var(--color-ucb-primary);
    }

    .login-logo {
      margin: 0 auto 0.75rem;
      display: block;
      border-radius: 0.5rem;
    }

    .login-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-ucb-primary);
      margin: 0 0 0.125rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .login-subtitle {
      font-size: 0.8125rem;
      color: var(--color-ucb-gray-600);
      margin: 0 0 0.75rem;
    }

    .login-app-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-ucb-gray-800);
      margin: 0;
    }

    .login-form {
      padding: 1.5rem 2rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .error-message {
      background-color: #fce8e8;
      color: var(--color-ucb-secondary);
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      margin-bottom: 1rem;
    }

    .login-btn {
      width: 100%;
      padding: 0.625rem 1rem;
      font-size: 0.9375rem;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-footer {
      padding: 1rem 2rem;
      text-align: center;
      border-top: 1px solid var(--color-ucb-gray-200);
    }

    .login-footer p {
      font-size: 0.6875rem;
      color: var(--color-ucb-gray-500);
      margin: 0;
    }
  `],
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    usuario: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.login(this.form.getRawValue());
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage.set(typeof error === 'string' ? error : 'Error al iniciar sesión');
    } finally {
      this.loading.set(false);
    }
  }
}
