import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, timeout } from 'rxjs';
import { AuthResponse, User } from '../models/user.model';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

const HTTP_TIMEOUT_MS = 12000;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  
  // Angular Signal to hold the current user state
  currentUserSignal = signal<User | null>(null);
  
  // Computed signals for derived state
  currentUser = computed(() => this.currentUserSignal());
  isLoggedIn = computed(() => this.currentUserSignal() !== null);
  isAdmin = computed(() => this.currentUserSignal()?.rol === 'admin');

  constructor(private http: HttpClient, private router: Router) {
    this.loadSession();
  }

  private loadSession() {
    const token = this.getToken();
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        // Validate JWT expiration safely
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
          const decodedJson = JSON.parse(decodeURIComponent(escape(atob(base64))));
          if (decodedJson.exp && decodedJson.exp * 1000 < Date.now()) {
            console.warn('JWT session expired. Clearing stored auth state.');
            this.logout();
            return;
          }
        }

        const user: User = JSON.parse(storedUser);
        this.currentUserSignal.set(user);
      } catch (e) {
        this.logout();
      }
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  login(identifier: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { 
      dni: identifier, 
      identifier, 
      password 
    }).pipe(
      timeout(HTTP_TIMEOUT_MS),
      tap(response => {
        if (response.token && response.user) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSignal.set(response.user);
        }
      })
    );
  }

  register(dni: string, nombre: string, password: string, email_telefono?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, {
      dni,
      nombre,
      password,
      email_telefono
    }).pipe(
      timeout(HTTP_TIMEOUT_MS),
      tap(response => {
        if (response.token && response.user) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSignal.set(response.user);
        }
      })
    );
  }

  registerAdmin(dni: string, nombre: string, password: string, email_telefono?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register-admin`, {
      dni,
      nombre,
      password,
      email_telefono
    }).pipe(
      timeout(HTTP_TIMEOUT_MS)
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSignal.set(null);
    this.router.navigate(['/auth/login']);
  }
}

