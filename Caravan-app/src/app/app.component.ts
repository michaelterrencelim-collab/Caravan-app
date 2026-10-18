import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AuthService } from './services/auth.service';
import { SettingsService } from './services/settings.service';
import { ConnectivityNoticeComponent } from './components/connectivity-notice.component';
import {
  IonApp,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuButton,
  IonMenuToggle,
  IonRouterOutlet,
  IonToolbar,
} from '@ionic/angular';

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuButton,
    IonMenuToggle,
    IonRouterOutlet,
    IonToolbar,
    ConnectivityNoticeComponent,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly showSplash = signal(true);
  readonly splashFading = signal(false);
  private splashTimer?: ReturnType<typeof setTimeout>;
  private splashHideTimer?: ReturnType<typeof setTimeout>;

  private navigationSubscription?: Subscription;

  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
    readonly settings: SettingsService,
  ) {}

  readonly showNavigation = signal(true);
  readonly navigationItems: NavigationItem[] = [
    { label: 'Home', path: '/home', icon: 'home-outline' },
    { label: 'Market', path: '/store', icon: 'storefront-outline' },
    { label: 'Cart', path: '/cart', icon: 'cart-outline' },
    { label: 'Order history', path: '/orderhistory', icon: 'receipt-outline' },
    { label: 'Settings', path: '/settings', icon: 'settings-outline' },
    { label: 'FAQs', path: '/faqs', icon: 'help-circle-outline' },
    { label: 'About Caravan', path: '/about', icon: 'information-circle-outline' },
  ];

  ngOnInit(): void {
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appUrlOpen', (event) => {
        const rawUrl = event.url || '';
        const path = rawUrl.includes('://') ? rawUrl.split('://')[1] : rawUrl;
        if (path) {
          const targetPath = path.startsWith('/') ? path : `/${path}`;
          void this.router.navigateByUrl(targetPath);
          void this.auth.refresh();
        }
      });
    }

    this.updateNavigationVisibility(this.router.url);
    this.navigationSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateNavigationVisibility(event.urlAfterRedirects));

    // Startup must continue to login even when the API server is offline.
    this.splashTimer = setTimeout(() => {
      this.splashFading.set(true);
      this.splashHideTimer = setTimeout(() => this.showSplash.set(false), 300);
    }, 900);
    void this.auth.refresh();
  }

  ngOnDestroy(): void {
    this.navigationSubscription?.unsubscribe();
    clearTimeout(this.splashTimer);
    clearTimeout(this.splashHideTimer);
  }

  private updateNavigationVisibility(url: string): void {
    const path = url.split(/[?#]/, 1)[0];
    this.showNavigation.set(path !== '/login' && path !== '/register');
  }
}
