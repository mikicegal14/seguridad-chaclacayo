import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  message = signal<string | null>(null);
  type = signal<'success' | 'error'>('success');
  private timeoutId: any = null;

  show(msg: string, type: 'success' | 'error' = 'success', durationMs = 4000) {
    this.message.set(msg);
    this.type.set(type);
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.message.set(null), durationMs);
  }

  clear() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.message.set(null);
  }
}
