import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-colaborador-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './colaborador-login.html'
})
export class ColaboradorLoginComponent {
  seudonimo = '';
  otp = '';
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  onSubmit(event: Event) {
    event.preventDefault();
    this.errorMessage.set(null);

    const cleanSeudonimo = (this.seudonimo || '').trim();
    const cleanOtp = (this.otp || '').trim().replace(/\s+/g, '');

    if (!cleanSeudonimo || cleanSeudonimo.length < 3) {
      this.errorMessage.set('Por favor ingrese un seudónimo o identificador de máquina (mínimo 3 caracteres).');
      return;
    }

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      this.errorMessage.set('El código OTP debe ser exactamente un número de 6 dígitos.');
      return;
    }

    this.isLoading.set(true);

    this.authService.colaboradorLogin(cleanSeudonimo, cleanOtp).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toastService.show(`Bienvenido al sistema de monitoreo, ${cleanSeudonimo}`, 'success');
        this.router.navigate(['/admin/monitor']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || 'Error al iniciar sesión con el código OTP.';
        this.errorMessage.set(msg);
        this.toastService.show(msg, 'error');
      }
    });
  }
}
