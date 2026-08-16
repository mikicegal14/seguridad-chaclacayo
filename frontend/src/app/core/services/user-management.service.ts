import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

const HTTP_TIMEOUT_MS = 12000;

export interface CreateCitizenDto {
  dni: string;
  nombre: string;
  password: string;
  email_telefono?: string;
}

export interface UpdateCitizenDto {
  dni: string;
  nombre: string;
  password?: string;
  email_telefono?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private apiUrl = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  getCitizens(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  getCitizen(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  createCitizen(data: CreateCitizenDto): Observable<{ message: string; usuario: User }> {
    return this.http.post<{ message: string; usuario: User }>(this.apiUrl, data).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  updateCitizen(id: number, data: UpdateCitizenDto): Observable<{ message: string; usuario: User }> {
    return this.http.put<{ message: string; usuario: User }>(`${this.apiUrl}/${id}`, data).pipe(timeout(HTTP_TIMEOUT_MS));
  }

  deleteCitizen(id: number): Observable<{ message: string; id: number }> {
    return this.http.delete<{ message: string; id: number }>(`${this.apiUrl}/${id}`).pipe(timeout(HTTP_TIMEOUT_MS));
  }
}
