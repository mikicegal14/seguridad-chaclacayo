import { Component, signal, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { SocketService } from '../../core/services/socket.service';
import { Alert } from '../../core/models/alert.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-citizen-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './citizen-history.html',
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class CitizenHistoryComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  mediaUrl = environment.mediaUrl;

  isReportsLoading = signal(false);
  misReportes = signal<Alert[]>([]);

  constructor(
    public authService: AuthService,
    private alertService: AlertService,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.loadMisReportes();
    
    // Connect to citizen's websocket room for real-time state changes
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.socketService.joinUserRoom(currentUser.id);
      this.socketService.onAlertStatusUpdated()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data) => {
          this.misReportes.update(reports => 
            reports.map(r => r.id === data.id ? { ...r, estado: data.estado } : r)
          );
        });
    }
  }

  loadMisReportes() {
    this.isReportsLoading.set(true);
    this.alertService.getMisReportes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.misReportes.set(data);
          this.isReportsLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading personal reports:', err);
          this.isReportsLoading.set(false);
        }
      });
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
