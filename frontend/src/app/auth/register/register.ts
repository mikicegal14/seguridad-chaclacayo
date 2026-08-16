import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html'
})
export class RegisterComponent {
  nombre = '';
  dni = '';
  email_telefono = '';
  password = '';
  
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(event: Event) {
    event.preventDefault();
    if (!this.nombre || !this.dni || !this.password) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.register(this.dni, this.nombre, this.password, this.email_telefono).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.router.navigate(['/citizen']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error de conexión con el servidor.');
      }
    });
  }
}
