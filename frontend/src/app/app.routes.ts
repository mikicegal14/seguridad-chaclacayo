import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Default redirect
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  // Lazy loaded Auth routes
  { 
    path: 'auth/login', 
    loadComponent: () => import('./auth/login/login').then(m => m.LoginComponent) 
  },
  { 
    path: 'auth/admin-login', 
    loadComponent: () => import('./auth/admin-login/admin-login').then(m => m.AdminLoginComponent) 
  },
  { 
    path: 'auth/register', 
    loadComponent: () => import('./auth/register/register').then(m => m.RegisterComponent) 
  },

  // Protected Admin route with child routes (lazy loaded)
  { 
    path: 'admin', 
    loadComponent: () => import('./admin/dashboard').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard, roleGuard(['admin'])],
    children: [
      { path: '', redirectTo: 'monitor', pathMatch: 'full' },
      { 
        path: 'monitor', 
        loadComponent: () => import('./admin/monitor/admin-monitor').then(m => m.AdminMonitorComponent) 
      },
      { 
        path: 'heatmap', 
        loadComponent: () => import('./admin/heatmap/admin-heatmap').then(m => m.AdminHeatmapComponent) 
      },
      { 
        path: 'operators', 
        loadComponent: () => import('./admin/operators/admin-operators').then(m => m.AdminOperatorsComponent) 
      },
      { 
        path: 'citizens', 
        loadComponent: () => import('./admin/citizens/admin-citizens').then(m => m.AdminCitizensComponent) 
      }
    ]
  },

  // Protected Citizen route with child routes (lazy loaded)
  { 
    path: 'citizen', 
    loadComponent: () => import('./citizen/dashboard').then(m => m.CitizenDashboardComponent),
    canActivate: [authGuard, roleGuard(['citizen'])],
    children: [
      { path: '', redirectTo: 'panic', pathMatch: 'full' },
      { 
        path: 'panic', 
        loadComponent: () => import('./citizen/panic/citizen-panic').then(m => m.CitizenPanicComponent) 
      },
      { 
        path: 'history', 
        loadComponent: () => import('./citizen/history/citizen-history').then(m => m.CitizenHistoryComponent) 
      }
    ]
  },

  // Wildcard redirect
  { path: '**', redirectTo: 'auth/login' }
];
