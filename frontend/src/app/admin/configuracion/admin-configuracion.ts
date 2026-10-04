import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfiguracionService, OtpResponse } from '../../core/services/configuracion.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-configuracion.html'
})
export class AdminConfiguracionComponent implements OnInit, OnDestroy {
  private configService = inject(ConfiguracionService);
  private toastService = inject(ToastService);

  otpCode = signal<string>('------');
  secondsRemaining = signal<number>(30);
  period = signal<number>(30);
  isLoading = signal<boolean>(true);
  copied = signal<boolean>(false);

  private timerInterval: any = null;

  ngOnInit() {
    this.cargarOtp();
    this.startCountdown();
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  cargarOtp() {
    this.configService.getOtp().subscribe({
      next: (res: OtpResponse) => {
        this.otpCode.set(res.code);
        this.secondsRemaining.set(res.secondsRemaining);
        this.period.set(res.period || 30);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastService.show('Error al consultar código OTP del servidor.', 'error');
      }
    });
  }

  private startCountdown() {
    this.timerInterval = setInterval(() => {
      const remaining = this.secondsRemaining();
      if (remaining > 1) {
        this.secondsRemaining.set(remaining - 1);
      } else {
        // Time expired, refresh OTP from backend
        this.secondsRemaining.set(0);
        this.cargarOtp();
      }
    }, 1000);
  }

  copiarCodigo() {
    const code = this.otpCode();
    if (!code || code === '------') return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        this.copied.set(true);
        this.toastService.show('Código OTP copiado al portapapeles.', 'success');
        setTimeout(() => this.copied.set(false), 2000);
      }).catch(() => {
        this.fallbackCopy(code);
      });
    } else {
      this.fallbackCopy(code);
    }
  }

  private fallbackCopy(code: string) {
    const tempInput = document.createElement('input');
    tempInput.value = code;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    this.copied.set(true);
    this.toastService.show('Código OTP copiado al portapapeles.', 'success');
    setTimeout(() => this.copied.set(false), 2000);
  }
}
