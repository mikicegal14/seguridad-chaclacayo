import { Component, signal, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-citizen-panic',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './citizen-panic.html',
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
export class CitizenPanicComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);

  isLoading = signal(false);
  isPulsing = signal(true);
  showForm = signal(false);
  
  // Status message state
  statusTitle = signal<string>('');
  statusMessage = signal<string | null>(null);
  statusType = signal<'success' | 'error'>('success');
  private statusTimeoutId: any = null;

  // Form attributes
  tipoIncidencia = 'Asalto';
  descripcion = '';
  fechaSuceso = '';
  selectedFile: File | null = null;
  imagePreview = signal<string | null>(null);

  constructor(
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.resetForm();
    this.checkAndRequestGPSPermission();
  }

  ngOnDestroy() {
    if (this.statusTimeoutId) {
      clearTimeout(this.statusTimeoutId);
    }
  }

  checkAndRequestGPSPermission() {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => console.log('GPS pre-approval verified on citizen PWA.'),
        (err) => console.log('GPS pre-approval status:', err.message),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }

  resetForm() {
    this.tipoIncidencia = 'Asalto';
    this.descripcion = '';
    
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const formattedParts = formatter.format(new Date());
    this.fechaSuceso = formattedParts.replace(' ', 'T');
    
    this.selectedFile = null;
    this.imagePreview.set(null);
  }

  cancelReport() {
    this.showForm.set(false);
    this.statusMessage.set(null);
    this.resetForm();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.match('image.*')) {
        this.statusType.set('error');
        this.statusTitle.set('Archivo no admitido');
        this.statusMessage.set('Por favor, seleccione un archivo de imagen válido (JPG, PNG, WEBP).');
        return;
      }

      this.selectedFile = file;

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto() {
    this.selectedFile = null;
    this.imagePreview.set(null);
  }

  triggerPanic() {
    this.isLoading.set(true);
    this.statusMessage.set(null);
    this.isPulsing.set(false);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.handleError('GPS no soportado', 'Tu dispositivo o navegador no soporta la captura de ubicación por GPS.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const now = new Date().toISOString();

        this.alertService.crearAlerta({
          tipo_incidencia: 'Emergencia',
          descripcion: 'Botón de pánico presionado desde dispositivo móvil.',
          latitud: latitude,
          longitud: longitude,
          fecha_suceso: now
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isLoading.set(false);
            this.isPulsing.set(true);
            this.statusType.set('success');
            this.statusTitle.set('¡ALERTA DE EMERGENCIA ENVIADA!');
            this.statusMessage.set('El Centro de Operaciones ha recibido tus coordenadas GPS y un operador está atendiendo tu reporte en este instante.');

            if (this.statusTimeoutId) clearTimeout(this.statusTimeoutId);
            this.statusTimeoutId = setTimeout(() => this.statusMessage.set(null), 10000);
          },
          error: (err) => {
            this.handleError('Error de Conexión', err.error?.message || 'No se pudo transmitir la alerta al servidor central. Intente nuevamente.');
          }
        });
      },
      (error) => {
        let msg = 'No se pudo obtener las coordenadas GPS del dispositivo.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permiso de GPS denegado. Habilite permisos de localización para poder enviar alertas de pánico.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'La ubicación GPS no está disponible en este momento.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'La solicitud de ubicación expiró por límite de tiempo.';
        }
        this.handleError('Error de Geolocalización', msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  submitDetailedReport(event: Event) {
    event.preventDefault();
    if (!this.fechaSuceso) return;

    this.isLoading.set(true);
    this.statusMessage.set(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.handleError('GPS no soportado', 'Debe usar un navegador o dispositivo con GPS para reportar incidencias.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const dateObj = new Date(this.fechaSuceso + '-05:00');

        const formData = new FormData();
        formData.append('tipo_incidencia', this.tipoIncidencia);
        formData.append('descripcion', this.descripcion);
        formData.append('latitud', latitude.toString());
        formData.append('longitud', longitude.toString());
        formData.append('fecha_suceso', dateObj.toISOString());
        
        if (this.selectedFile) {
          formData.append('evidencia', this.selectedFile);
        }

        this.alertService.crearAlerta(formData)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.isLoading.set(false);
              this.showForm.set(false);
              this.resetForm();
              
              this.statusType.set('success');
              this.statusTitle.set('¡Reporte registrado con éxito!');
              this.statusMessage.set('La incidencia ha sido registrada en la base de datos de Serenazgo y transmitida en tiempo real al panel administrativo.');

              if (this.statusTimeoutId) clearTimeout(this.statusTimeoutId);
              this.statusTimeoutId = setTimeout(() => this.statusMessage.set(null), 10000);
            },
            error: (err) => {
              this.handleError('Error al enviar reporte', err.error?.message || 'Error al guardar la incidencia. Por favor intente de nuevo.');
            }
          });
      },
      (error) => {
        let msg = 'No se pudo obtener las coordenadas GPS del dispositivo.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Debe otorgar permisos de localización para poder registrar la incidencia con su ubicación exacta.';
        }
        this.handleError('Error de Geolocalización', msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  private handleError(title: string, msg: string) {
    this.isLoading.set(false);
    this.isPulsing.set(true);
    this.statusType.set('error');
    this.statusTitle.set(title);
    this.statusMessage.set(msg);
  }
}
