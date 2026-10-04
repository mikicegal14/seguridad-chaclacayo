import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { Alert } from '../models/alert.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  private url = environment.socketUrl;
  private isOperatorsJoined = false;
  private currentJoinedUserId: number | null = null;

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    const token = localStorage.getItem('token');

    this.socket = io(this.url, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        token: token || ''
      }
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connection established with backend.');
      
      // Auto re-join rooms on reconnect
      if (this.isOperatorsJoined) {
        this.socket.emit('join_operators');
      }
      if (this.currentJoinedUserId !== null) {
        this.socket.emit('join_user', this.currentJoinedUserId);
      }
    });

    this.socket.on('error_auth', (err: { message: string }) => {
      console.warn('Socket.IO authorization warning:', err.message);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket.IO disconnected from backend.');
    });
  }

  updateAuthToken() {
    const token = localStorage.getItem('token');
    if (this.socket) {
      this.socket.auth = { token: token || '' };
      if (this.socket.connected) {
        this.socket.disconnect().connect();
      }
    }
  }

  joinOperators() {
    this.isOperatorsJoined = true;
    this.updateAuthToken();
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_operators');
    }
  }

  joinUserRoom(userId: number) {
    this.currentJoinedUserId = userId;
    this.updateAuthToken();
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_user', userId);
    }
  }

  onNewAlert(): Observable<Alert> {
    return new Observable<Alert>((observer) => {
      const handler = (alert: Alert) => {
        observer.next(alert);
      };

      this.socket.on('nueva_alerta', handler);

      return () => {
        this.socket.off('nueva_alerta', handler);
      };
    });
  }

  onAlertStatusUpdated(): Observable<{ id: number, estado: string }> {
    return new Observable((observer) => {
      const handler = (data: { id: number, estado: string }) => {
        observer.next(data);
      };

      this.socket.on('alerta_estado_actualizado', handler);

      return () => {
        this.socket.off('alerta_estado_actualizado', handler);
      };
    });
  }

  disconnect() {
    this.isOperatorsJoined = false;
    this.currentJoinedUserId = null;
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
