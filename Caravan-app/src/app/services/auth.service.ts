import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

interface SessionResponse {
  loggedIn: boolean;
  user?: { userId?: number | string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly cartOwnerKey = 'caravan.cart.owner.v1';
  readonly isAuthenticated = signal(false);
  readonly ready = signal(false);

  constructor(private readonly http: HttpClient) {}

  async refresh(): Promise<boolean> {
    try {
      const session = await firstValueFrom(
        this.http.get<SessionResponse>('/api/isLoggedIn').pipe(timeout(3000)),
      );
      this.isAuthenticated.set(session.loggedIn === true);
      if (session.loggedIn && session.user?.userId !== undefined) {
        this.syncCartOwner(session.user.userId);
      } else if (!session.loggedIn) {
        localStorage.removeItem('auth_token');
      }
    } catch {
      this.isAuthenticated.set(false);
    } finally {
      this.ready.set(true);
    }
    return this.isAuthenticated();
  }

  acceptLoginToken(token: string): void {
    localStorage.setItem('auth_token', token);
    const userId = this.userIdFromToken(token);
    if (userId !== null) this.syncCartOwner(userId);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/logout', {}));
    } catch {
      // Clear the local account state even when the API is offline.
    } finally {
      localStorage.removeItem('cart');
      localStorage.removeItem(this.cartOwnerKey);
      sessionStorage.removeItem('pendingCheckout');
      sessionStorage.removeItem('checkoutConfirmation');
      this.isAuthenticated.set(false);
      this.ready.set(true);
    }
  }

  private syncCartOwner(userId: number | string): void {
    const owner = String(userId).trim();
    if (!owner) return;
    try {
      if (localStorage.getItem(this.cartOwnerKey) !== owner) {
        localStorage.removeItem('cart');
        sessionStorage.removeItem('pendingCheckout');
        sessionStorage.removeItem('checkoutConfirmation');
      }
      localStorage.setItem(this.cartOwnerKey, owner);
    } catch {
      // Authentication remains available if browser storage is unavailable.
    }
  }

  private userIdFromToken(token: string): number | string | null {
    try {
      const encodedPayload = token.split('.')[1];
      if (!encodedPayload) return null;
      const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
      return payload.userId === undefined || payload.userId === null ? null : payload.userId;
    } catch {
      return null;
    }
  }
}
