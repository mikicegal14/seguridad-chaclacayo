import { Component, OnInit, signal, computed, DestroyRef, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserManagementService, CreateCitizenDto, UpdateCitizenDto } from '../../core/services/user-management.service';
import { AlertService } from '../../core/services/alert.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-citizens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-citizens.html',
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
export class AdminCitizensComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  mediaUrl = environment.mediaUrl;

  citizens = signal<User[]>([]);
  totalAlertasCount = signal<number>(0);
  isCitizensLoading = signal(false);
  citizenSearchTerm = signal('');

  readonly filteredCitizens = computed<User[]>(() => {
    const term = this.citizenSearchTerm().toLowerCase().trim();
    if (!term) return this.citizens();
    return this.citizens().filter(c => 
      c.nombre.toLowerCase().includes(term) ||
      c.dni.toLowerCase().includes(term) ||
      (c.email_telefono && c.email_telefono.toLowerCase().includes(term))
    );
  });

  // Citizen Modals State
  showCreateCitizenModal = signal(false);
  isCreatingCitizen = signal(false);
  newCitizenDni = '';
  newCitizenName = '';
  newCitizenEmail = '';
  newCitizenPassword = '';
  createCitizenError = signal<string | null>(null);

  showEditCitizenModal = signal(false);
  isUpdatingCitizen = signal(false);
  selectedCitizenToEdit = signal<User | null>(null);
  editCitizenDni = '';
  editCitizenName = '';
  editCitizenEmail = '';
  editCitizenPassword = '';
  editCitizenError = signal<string | null>(null);

  showDeleteCitizenModal = signal(false);
  isDeletingCitizen = signal(false);
  citizenToDelete = signal<User | null>(null);
  deleteCitizenError = signal<string | null>(null);

  showCitizenHistoryModal = signal(false);
  isCitizenDetailLoading = signal(false);
  selectedCitizenDetail = signal<User | null>(null);

  constructor(
    private userManagementService: UserManagementService,
    private alertService: AlertService,
    private toastService: ToastService
  ) {}

  @HostListener('document:keydown.escape')
  onEscapePress() {
    if (this.showCreateCitizenModal()) this.closeCreateCitizenModal();
    if (this.showEditCitizenModal()) this.closeEditCitizenModal();
    if (this.showDeleteCitizenModal()) this.closeDeleteCitizenModal();
    if (this.showCitizenHistoryModal()) this.closeCitizenHistoryModal();
  }

  ngOnInit() {
    this.loadCitizens();
    this.loadTotalAlertsCount();
  }

  loadTotalAlertsCount() {
    this.alertService.getAlertas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (alerts) => {
          this.totalAlertasCount.set(alerts.length);
        }
      });
  }

  loadCitizens() {
    this.isCitizensLoading.set(true);
    this.userManagementService.getCitizens()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.citizens.set(list);
          this.isCitizensLoading.set(false);
        },
        error: (err) => {
          this.isCitizensLoading.set(false);
          this.toastService.show(err.error?.message || 'Error al cargar la lista de ciudadanos.', 'error');
        }
      });
  }

  openCreateCitizenModal() {
    this.newCitizenDni = '';
    this.newCitizenName = '';
    this.newCitizenEmail = '';
    this.newCitizenPassword = '';
    this.createCitizenError.set(null);
    this.showCreateCitizenModal.set(true);
  }

  closeCreateCitizenModal() {
    this.showCreateCitizenModal.set(false);
    this.newCitizenDni = '';
    this.newCitizenName = '';
    this.newCitizenEmail = '';
    this.newCitizenPassword = '';
    this.createCitizenError.set(null);
  }

  onCreateCitizen(event: Event) {
    event.preventDefault();
    if (!this.newCitizenDni || !this.newCitizenName || !this.newCitizenPassword) return;

    this.isCreatingCitizen.set(true);
    this.createCitizenError.set(null);

    const dto: CreateCitizenDto = {
      dni: this.newCitizenDni.trim(),
      nombre: this.newCitizenName.trim(),
      password: this.newCitizenPassword,
      email_telefono: this.newCitizenEmail.trim() || undefined
    };

    this.userManagementService.createCitizen(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isCreatingCitizen.set(false);
          this.closeCreateCitizenModal();
          this.toastService.show(res.message || 'Ciudadano registrado exitosamente.', 'success');
          this.loadCitizens();
        },
        error: (err) => {
          this.isCreatingCitizen.set(false);
          this.createCitizenError.set(err.error?.message || 'Error al registrar ciudadano.');
        }
      });
  }

  openEditCitizenModal(citizen: User) {
    this.selectedCitizenToEdit.set(citizen);
    this.editCitizenDni = citizen.dni;
    this.editCitizenName = citizen.nombre;
    this.editCitizenEmail = citizen.email_telefono || '';
    this.editCitizenPassword = '';
    this.editCitizenError.set(null);
    this.showEditCitizenModal.set(true);
  }

  closeEditCitizenModal() {
    this.showEditCitizenModal.set(false);
    this.selectedCitizenToEdit.set(null);
    this.editCitizenDni = '';
    this.editCitizenName = '';
    this.editCitizenEmail = '';
    this.editCitizenPassword = '';
    this.editCitizenError.set(null);
  }

  onUpdateCitizen(event: Event) {
    event.preventDefault();
    const citizen = this.selectedCitizenToEdit();
    if (!citizen || !this.editCitizenDni || !this.editCitizenName) return;

    this.isUpdatingCitizen.set(true);
    this.editCitizenError.set(null);

    const dto: UpdateCitizenDto = {
      dni: this.editCitizenDni.trim(),
      nombre: this.editCitizenName.trim(),
      email_telefono: this.editCitizenEmail.trim() || undefined,
      password: this.editCitizenPassword.trim() ? this.editCitizenPassword.trim() : undefined
    };

    this.userManagementService.updateCitizen(citizen.id, dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isUpdatingCitizen.set(false);
          this.closeEditCitizenModal();
          this.toastService.show(res.message || 'Ciudadano actualizado exitosamente.', 'success');
          this.loadCitizens();
        },
        error: (err) => {
          this.isUpdatingCitizen.set(false);
          this.editCitizenError.set(err.error?.message || 'Error al actualizar ciudadano.');
        }
      });
  }

  openDeleteCitizenModal(citizen: User) {
    this.citizenToDelete.set(citizen);
    this.deleteCitizenError.set(null);
    this.showDeleteCitizenModal.set(true);
  }

  closeDeleteCitizenModal() {
    this.showDeleteCitizenModal.set(false);
    this.citizenToDelete.set(null);
    this.deleteCitizenError.set(null);
  }

  onConfirmDeleteCitizen() {
    const citizen = this.citizenToDelete();
    if (!citizen) return;

    this.isDeletingCitizen.set(true);
    this.deleteCitizenError.set(null);

    this.userManagementService.deleteCitizen(citizen.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isDeletingCitizen.set(false);
          this.closeDeleteCitizenModal();
          this.toastService.show(res.message || 'Ciudadano eliminado exitosamente.', 'success');
          this.loadCitizens();
        },
        error: (err) => {
          this.isDeletingCitizen.set(false);
          this.deleteCitizenError.set(err.error?.message || 'Error al eliminar ciudadano.');
        }
      });
  }

  openCitizenHistoryModal(citizen: User) {
    this.selectedCitizenDetail.set(citizen);
    this.isCitizenDetailLoading.set(true);
    this.showCitizenHistoryModal.set(true);

    this.userManagementService.getCitizen(citizen.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selectedCitizenDetail.set(detail);
          this.isCitizenDetailLoading.set(false);
        },
        error: () => {
          this.isCitizenDetailLoading.set(false);
        }
      });
  }

  closeCitizenHistoryModal() {
    this.showCitizenHistoryModal.set(false);
    this.selectedCitizenDetail.set(null);
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
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
