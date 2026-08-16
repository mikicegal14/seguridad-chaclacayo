import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.html'
})
export class AdminLoginComponent {
  identifier = '';
  password = '';
  
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(event: Event) {
    event.preventDefault();
    const loginUser = this.identifier.trim();
    if (!loginUser || !this.password) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(loginUser, this.password).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.user.rol !== 'admin') {
          this.errorMessage.set('Acceso denegado: El usuario no cuenta con privilegios de operador.');
          this.authService.logout();
        } else {
          this.router.navigate(['/admin']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error de conexión con el servidor.');
      }
    });
  }
}
