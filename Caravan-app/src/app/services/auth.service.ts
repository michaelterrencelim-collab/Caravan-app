import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

interface SessionResponse {
  loggedIn: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(false);
  readonly ready = signal(false);

  constructor(private readonly http: HttpClient) {}

  async refresh(): Promise<boolean> {
    try {
      const session = await firstValueFrom(
        this.http.get<SessionResponse>('/api/isLoggedIn').pipe(timeout(3000)),
      );
      this.isAuthenticated.set(session.loggedIn === true);
      if (!session.loggedIn) {
        localStorage.removeItem('auth_token');
      }
    } catch {
      this.isAuthenticated.set(false);
    } finally {
      this.ready.set(true);
    }
    return this.isAuthenticated();
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/logout', {}));
    } catch {
      // Clear the local account state even when the API is offline.
    } finally {
      localStorage.removeItem('cart');
      sessionStorage.removeItem('pendingCheckout');
      sessionStorage.removeItem('checkoutConfirmation');
      this.isAuthenticated.set(false);
      this.ready.set(true);
    }
  }
}
