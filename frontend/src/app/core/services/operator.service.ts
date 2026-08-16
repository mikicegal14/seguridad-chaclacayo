import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

const HTTP_TIMEOUT_MS = 12000;

export interface CreateOperatorDto {
  dni: string;
  nombre: string;
  password: string;
  email_telefono?: string;
}

export interface UpdateOperatorDto {
  dni: string;
  nombre: string;
  password?: string;
  email_telefono?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorService {
  private apiUrl = `${environment.apiUrl}/operadores`;

  constructor(private http: HttpClient) {}

  getOperadores(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  getOperador(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  crearOperador(data: CreateOperatorDto): Observable<{ message: string; operador: User }> {
    return this.http.post<{ message: string; operador: User }>(this.apiUrl, data).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  actualizarOperador(id: number, data: UpdateOperatorDto): Observable<{ message: string; operador: User }> {
    return this.http.put<{ message: string; operador: User }>(`${this.apiUrl}/${id}`, data).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  eliminarOperador(id: number): Observable<{ message: string; id: number }> {
    return this.http.delete<{ message: string; id: number }>(`${this.apiUrl}/${id}`).pipe(timeout(HTTP_TIMEOUT_MS));
  }
}
