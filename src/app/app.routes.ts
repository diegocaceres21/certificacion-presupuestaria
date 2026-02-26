import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'certificaciones/nueva',
        loadComponent: () =>
          import('./features/certificaciones/form-certificacion/form-certificacion').then(
            (m) => m.FormCertificacion,
          ),
        canActivate: [roleGuard('administrador', 'encargado')],
      },
      {
        path: 'certificaciones/:id/editar',
        loadComponent: () =>
          import('./features/certificaciones/form-certificacion/form-certificacion').then(
            (m) => m.FormCertificacion,
          ),
        canActivate: [roleGuard('administrador', 'encargado')],
      },
      {
        path: 'administracion/unidades',
        loadComponent: () =>
          import('./features/administracion/unidades/unidades').then((m) => m.Unidades),
        canActivate: [roleGuard('administrador', 'encargado')],
      },
      {
        path: 'administracion/tipo-cuentas',
        loadComponent: () =>
          import('./features/administracion/tipo-cuentas/tipo-cuentas').then(
            (m) => m.TipoCuentas,
          ),
        canActivate: [roleGuard('administrador', 'encargado')],
      },
      {
        path: 'administracion/cuentas',
        loadComponent: () =>
          import('./features/administracion/cuentas/cuentas').then((m) => m.Cuentas),
        canActivate: [roleGuard('administrador', 'encargado')],
      },
      {
        path: 'administracion/proyectos',
        loadComponent: () =>
          import('./features/administracion/proyectos/proyectos').then((m) => m.Proyectos),
        canActivate: [roleGuard('administrador', 'encargado')],
      },
      {
        path: 'administracion/dependencias',
        loadComponent: () =>
          import('./features/administracion/dependencias/dependencias').then(
            (m) => m.Dependencias,
          ),
        canActivate: [roleGuard('administrador', 'encargado')],
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./features/reportes/reportes').then((m) => m.Reportes),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/usuarios/usuarios').then((m) => m.Usuarios),
        canActivate: [roleGuard('administrador')],
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/perfil/perfil').then((m) => m.Perfil),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
