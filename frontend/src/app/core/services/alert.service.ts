import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { Alert } from '../models/alert.model';
import { environment } from '../../../environments/environment';

const HTTP_TIMEOUT_MS = 12000;

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private apiUrl = `${environment.apiUrl}/alertas`;

  constructor(private http: HttpClient) {}

  getAlertas(): Observable<Alert[]> {
    return this.http.get<Alert[]>(this.apiUrl).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  crearAlerta(alertData: FormData | {
    tipo_incidencia: string;
    descripcion?: string;
    latitud: number;
    longitud: number;
    fecha_suceso: string;
  }): Observable<Alert> {
    return this.http.post<Alert>(this.apiUrl, alertData).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  getMisReportes(): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.apiUrl}/mis-reportes`).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  updateEstadoAlerta(id: number, estado: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/estado`, { estado }).pipe(timeout(HTTP_TIMEOUT_MS));
  }
}

