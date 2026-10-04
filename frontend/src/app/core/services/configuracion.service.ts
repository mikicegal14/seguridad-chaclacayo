import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OtpResponse {
  code: string;
  secondsRemaining: number;
  period: number;
  timestamp: number;
}

export interface AuditLog {
  id: number;
  fecha: string;
  responsable: string;
  rol: string;
  accion: string;
  modulo: string;
  detalles: any;
  ip_address: string;
}

export interface AuditResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

const HTTP_TIMEOUT_MS = 12000;

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private apiUrl = `${environment.apiUrl}/configuracion`;

  constructor(private http: HttpClient) {}

  getOtp(): Observable<OtpResponse> {
    return this.http.get<OtpResponse>(`${this.apiUrl}/otp`).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  getAuditoria(filters?: { responsable?: string; accion?: string; limit?: number; offset?: number }): Observable<AuditResponse> {
    let params = new HttpParams();
    if (filters?.responsable) {
      params = params.set('responsable', filters.responsable);
    }
    if (filters?.accion) {
      params = params.set('accion', filters.accion);
    }
    if (filters?.limit !== undefined) {
      params = params.set('limit', filters.limit.toString());
    }
    if (filters?.offset !== undefined) {
      params = params.set('offset', filters.offset.toString());
    }

    return this.http.get<AuditResponse>(`${this.apiUrl}/auditoria`, { params }).pipe(timeout(HTTP_TIMEOUT_MS));
  }
}
