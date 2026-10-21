import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { IonIcon } from '@ionic/angular';
import { firstValueFrom, Subscription, take } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { apiEndpoint } from '../../services/api-endpoint';

interface LoginResponse {
  error?: string;
  role?: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, NgIf, RouterLink, IonIcon],
})
export class LoginPage implements OnInit, OnDestroy {
  readonly googleLoginUrl = apiEndpoint(
    `/api/auth/google?returnTo=${encodeURIComponent(
      Capacitor.isNativePlatform() ? 'caravan://home' : window.location.origin
    )}`
  );
  email = '';
  password = '';
  showPassword = false;
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  private errorTimer?: ReturnType<typeof setTimeout>;
  private querySubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private settings: SettingsService,
  ) {}

  ngOnInit(): void {
    this.querySubscription = this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      if (params.get('error') === 'google_auth') {
        this.clearPendingTeamBanner();
        this.showError('Google sign-in could not be completed. Please try again.');
      } else if (params.get('error') === 'account_disabled') {
        this.clearPendingTeamBanner();
        this.showError('Your account is disabled. Please reach out to the Caravan team.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  beginGoogleLogin(): void {
    // Google OAuth authenticates through the cookie callback. Remove an old
    // bearer token so it cannot shadow the account returned by Google.
    localStorage.removeItem('auth_token');
    this.auth.isAuthenticated.set(false);
    this.queueTeamBanner();
  }

  private queueTeamBanner(): void {
    try {
      if (this.settings.disableBanners()) {
        sessionStorage.removeItem('caravan.team-banner.pending');
      } else {
        sessionStorage.setItem('caravan.team-banner.pending', 'true');
      }
    } catch {
      // The sign-in flow continues when session storage is unavailable.
    }
  }

  private clearPendingTeamBanner(): void {
    try {
      sessionStorage.removeItem('caravan.team-banner.pending');
    } catch {
      // Ignore unavailable session storage.
    }
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.errorMessage.set(''), 2000);
  }

  async onSubmit(): Promise<void> {
    const email = this.email.trim();
    const password = this.password;

    this.errorMessage.set('');

    if (email === '') return this.showError('Please enter your email address.');
    if (!this.validateEmail(email)) return this.showError("That isn't a valid email address.");
    if (password === '') return this.showError('Please enter your password.');
    if (password.length < 6) return this.showError('Password must be at least 6 characters.');

    this.loading.set(true);

    try {
      const data = await firstValueFrom(
        this.http.post<LoginResponse>('/api/login', { email, password })
      );

      if (data.error) {
        this.showError(data.error);
        return;
      }

      if ((data as any)?.token) {
        localStorage.setItem('auth_token', (data as any).token);
      }

      this.auth.isAuthenticated.set(true);
      this.auth.ready.set(true);
      this.queueTeamBanner();
      this.router.navigateByUrl('/home');
    } catch (err: any) {
      localStorage.removeItem('auth_token');
      this.auth.isAuthenticated.set(false);
      this.auth.ready.set(true);
      // Non-2xx responses land here; use the server's error message if it sent one
      const message = typeof err?.error === 'string'
        ? err.error
        : (err?.error?.error || err?.error?.message || err?.message);
      this.showError(message || 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.errorTimer);
    this.querySubscription?.unsubscribe();
  }
}
