import { Component, OnDestroy, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonToolbar } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../services/auth.service';
import { apiEndpoint } from '../../services/api-endpoint';

interface RegisterResponse {
  error?: string;
  login?: string;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, NgIf, RouterLink, IonToolbar, IonIcon],
})
export class RegisterPage implements OnDestroy {
  readonly googleLoginUrl = apiEndpoint(
    `/api/auth/google?returnTo=${encodeURIComponent(
      Capacitor.isNativePlatform() ? 'caravan://home' : window.location.origin
    )}`
  );
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';

  privacyConsent = false;
  privacyModalOpen = false;

  showPassword = false;
  showConfirmPassword = false;

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  private errorTimer?: ReturnType<typeof setTimeout>;
  private successTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private http: HttpClient,
    private router: Router,
    private auth: AuthService,
  ) {}

  goBack(): void { void this.router.navigateByUrl('/login'); }

  // ---- Privacy modal ----
  openPrivacy(event: Event): void {
    event.preventDefault();
    this.privacyModalOpen = true;
  }

  closePrivacy(): void {
    this.privacyModalOpen = false;
  }

  acceptPrivacy(): void {
    this.privacyConsent = true;
    this.closePrivacy();
  }

  // ---- Helpers ----
  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.errorMessage.set(''), 2000);
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => {
      this.successMessage.set('');
      this.router.navigateByUrl('/home');
    }, 2000);
  }

  // ---- Submit ----
  async onSubmit(): Promise<void> {
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    const email = this.email.trim();
    const password = this.password;

    this.errorMessage.set('');
    this.successMessage.set('');

    if (firstName === '') return this.showError('Please enter your first name.');
    if (lastName === '') return this.showError('Please enter your last name.');
    if (!this.validateEmail(email)) return this.showError("That isn't a valid email address.");
    if (password.length < 6) return this.showError('Password must be at least 6 characters.');
    if (password !== this.confirmPassword) return this.showError('Passwords do not match.');
    if (!this.privacyConsent) {
      return this.showError('You must agree to the Data Privacy Policy to register.');
    }

    this.loading.set(true);

    try {
      const data = await firstValueFrom(
        this.http.post<RegisterResponse>('/api/register', { firstName, lastName, email, password })
      );

      if (data.error) {
        this.loading.set(false);
        this.showError(data.error);
        return;
      }

      if (data.login) {
        this.auth.isAuthenticated.set(true);
        this.auth.ready.set(true);
        this.showSuccess(data.login);
      }
    } catch (err: any) {
      this.loading.set(false);
      this.showError(err?.error?.error ?? 'Something went wrong. Please try again.');
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.errorTimer);
    clearTimeout(this.successTimer);
  }
}
