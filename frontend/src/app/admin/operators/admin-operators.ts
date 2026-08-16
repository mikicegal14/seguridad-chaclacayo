import { Component, OnInit, signal, computed, DestroyRef, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { OperatorService, CreateOperatorDto, UpdateOperatorDto } from '../../core/services/operator.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-admin-operators',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-operators.html',
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
export class AdminOperatorsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  operators = signal<User[]>([]);
  isOperatorsLoading = signal(false);
  operatorSearchTerm = signal('');

  readonly filteredOperators = computed<User[]>(() => {
    const term = this.operatorSearchTerm().toLowerCase().trim();
    if (!term) return this.operators();
    return this.operators().filter(op => 
      op.nombre.toLowerCase().includes(term) ||
      op.dni.toLowerCase().includes(term) ||
      (op.email_telefono && op.email_telefono.toLowerCase().includes(term))
    );
  });

  // Modal States
  showCreateOperatorModal = signal(false);
  isCreatingOperator = signal(false);
  newOperatorDni = '';
  newOperatorName = '';
  newOperatorEmail = '';
  newOperatorPassword = '';
  createOperatorError = signal<string | null>(null);

  showEditOperatorModal = signal(false);
  isUpdatingOperator = signal(false);
  selectedOperatorToEdit = signal<User | null>(null);
  editOperatorDni = '';
  editOperatorName = '';
  editOperatorEmail = '';
  editOperatorPassword = '';
  editOperatorError = signal<string | null>(null);

  showDeleteOperatorModal = signal(false);
  isDeletingOperator = signal(false);
  operatorToDelete = signal<User | null>(null);
  deleteOperatorError = signal<string | null>(null);

  constructor(
    public authService: AuthService,
    private operatorService: OperatorService,
    private toastService: ToastService
  ) {}

  @HostListener('document:keydown.escape')
  onEscapePress() {
    if (this.showCreateOperatorModal()) this.closeCreateOperatorModal();
    if (this.showEditOperatorModal()) this.closeEditOperatorModal();
    if (this.showDeleteOperatorModal()) this.closeDeleteOperatorModal();
  }

  ngOnInit() {
    this.loadOperators();
  }

  loadOperators() {
    this.isOperatorsLoading.set(true);
    this.operatorService.getOperadores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ops) => {
          this.operators.set(ops);
          this.isOperatorsLoading.set(false);
        },
        error: (err) => {
          this.isOperatorsLoading.set(false);
          this.toastService.show(err.error?.message || 'Error al cargar la lista de operadores.', 'error');
        }
      });
  }

  openCreateOperatorModal() {
    this.newOperatorDni = '';
    this.newOperatorName = '';
    this.newOperatorEmail = '';
    this.newOperatorPassword = '';
    this.createOperatorError.set(null);
    this.showCreateOperatorModal.set(true);
  }

  closeCreateOperatorModal() {
    this.showCreateOperatorModal.set(false);
    this.newOperatorDni = '';
    this.newOperatorName = '';
    this.newOperatorEmail = '';
    this.newOperatorPassword = '';
    this.createOperatorError.set(null);
  }

  onCreateOperator(event: Event) {
    event.preventDefault();
    if (!this.newOperatorDni || !this.newOperatorName || !this.newOperatorPassword) return;

    this.isCreatingOperator.set(true);
    this.createOperatorError.set(null);

    const dto: CreateOperatorDto = {
      dni: this.newOperatorDni.trim(),
      nombre: this.newOperatorName.trim(),
      password: this.newOperatorPassword,
      email_telefono: this.newOperatorEmail.trim() || undefined
    };

    this.operatorService.crearOperador(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isCreatingOperator.set(false);
          this.closeCreateOperatorModal();
          this.toastService.show(res.message || 'Operador creado exitosamente.', 'success');
          this.loadOperators();
        },
        error: (err) => {
          this.isCreatingOperator.set(false);
          this.createOperatorError.set(err.error?.message || 'Error al registrar operador.');
        }
      });
  }

  openEditOperatorModal(operator: User) {
    this.selectedOperatorToEdit.set(operator);
    this.editOperatorDni = operator.dni;
    this.editOperatorName = operator.nombre;
    this.editOperatorEmail = operator.email_telefono || '';
    this.editOperatorPassword = '';
    this.editOperatorError.set(null);
    this.showEditOperatorModal.set(true);
  }

  closeEditOperatorModal() {
    this.showEditOperatorModal.set(false);
    this.selectedOperatorToEdit.set(null);
    this.editOperatorDni = '';
    this.editOperatorName = '';
    this.editOperatorEmail = '';
    this.editOperatorPassword = '';
    this.editOperatorError.set(null);
  }

  onUpdateOperator(event: Event) {
    event.preventDefault();
    const op = this.selectedOperatorToEdit();
    if (!op || !this.editOperatorDni || !this.editOperatorName) return;

    this.isUpdatingOperator.set(true);
    this.editOperatorError.set(null);

    const dto: UpdateOperatorDto = {
      dni: this.editOperatorDni.trim(),
      nombre: this.editOperatorName.trim(),
      email_telefono: this.editOperatorEmail.trim() || undefined,
      password: this.editOperatorPassword.trim() ? this.editOperatorPassword.trim() : undefined
    };

    this.operatorService.actualizarOperador(op.id, dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isUpdatingOperator.set(false);
          this.closeEditOperatorModal();
          this.toastService.show(res.message || 'Operador actualizado exitosamente.', 'success');
          this.loadOperators();
        },
        error: (err) => {
          this.isUpdatingOperator.set(false);
          this.editOperatorError.set(err.error?.message || 'Error al actualizar operador.');
        }
      });
  }

  openDeleteOperatorModal(operator: User) {
    const currentUser = this.authService.currentUser();
    if (currentUser && currentUser.id === operator.id) {
      this.toastService.show('No puedes eliminar tu propia cuenta mientras estés en sesión activa.', 'error');
      return;
    }
    this.operatorToDelete.set(operator);
    this.deleteOperatorError.set(null);
    this.showDeleteOperatorModal.set(true);
  }

  closeDeleteOperatorModal() {
    this.showDeleteOperatorModal.set(false);
    this.operatorToDelete.set(null);
    this.deleteOperatorError.set(null);
  }

  onConfirmDeleteOperator() {
    const op = this.operatorToDelete();
    if (!op) return;

    this.isDeletingOperator.set(true);
    this.deleteOperatorError.set(null);

    this.operatorService.eliminarOperador(op.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isDeletingOperator.set(false);
          this.closeDeleteOperatorModal();
          this.toastService.show(res.message || 'Operador eliminado correctamente.', 'success');
          this.loadOperators();
        },
        error: (err) => {
          this.isDeletingOperator.set(false);
          this.deleteOperatorError.set(err.error?.message || 'Error al eliminar operador.');
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
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
