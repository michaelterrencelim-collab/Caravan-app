import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TeamBannerComponent } from '../components/team-banner/team-banner.component';
import { SettingsService } from '../services/settings.service';
import { SiteFooterComponent } from '../components/site-footer/site-footer.component';

import {
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonImg,
  IonLabel,
  IonRow,
} from '@ionic/angular';

interface HomeFeature {
  icon: string;
  title: string;
  text: string;
}

interface HomeCategory {
  name: string;
  image: string;
}

interface HomeProduct {
  id: number;
  typeId?: number;
  name: string;
  price: number;
  image: string;
  rating?: number;
  reviewCount?: number;
}

interface ApiProduct {
  product_id: number;
  type_id: number;
  product_name: string;
  product_price: number;
  product_image: string;
  product_rating?: number;
  review_count?: number;
}

@Component({
  selector: 'app-homepage',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    CommonModule,
    TeamBannerComponent,
    SiteFooterComponent,
    RouterLink,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonCol,
    IonContent,
    IonGrid,
    IonImg,
    IonLabel,
    IonRow,
  ],
})
export class HomePage implements AfterViewInit, OnInit {
  showTeamBanner = false;
  readonly features: HomeFeature[] = [
    {
      icon: 'assets/Images/Cart.png',
      title: 'PURCHASE SECURELY',
      text: 'Buy your herbs and spices with our secure and easy payment process.',
    },
    {
      icon: 'assets/Images/Truck.png',
      title: 'SHIPPED TO YOU',
      text: 'Get your package safely delivered to your doorstep.',
    },
    {
      icon: 'assets/Images/Checklist.png',
      title: 'DEDICATED RECIPES',
      text: 'We offer a list of recipes you can cook using our herbs and spices.',
    },
    {
      icon: 'assets/Images/Wallet.png',
      title: 'SAVE MORE',
      text: 'Buying bundles will cost less than buying them individually.',
    },
  ];

  readonly categories: HomeCategory[] = [
    { name: 'Baking', image: 'assets/Images/Baking.jpg' },
    { name: 'Drinking', image: 'assets/Images/Drinking.jpg' },
    { name: 'Cooking', image: 'assets/Images/Cooking.jpg' },
    { name: 'Garnishing', image: 'assets/Images/Garnishing.jpg' },
    { name: 'Medicinal', image: 'assets/Images/Medicinal.jpg' },
  ];

  newArrivals: HomeProduct[] = [];
  popularProducts: HomeProduct[] = [];

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    readonly settings: SettingsService,
  ) {}

  ngOnInit(): void {
    void this.loadHomeProducts();
  }

  ionViewWillEnter(): void {
    try {
      if (sessionStorage.getItem('caravan.team-banner.pending') === 'true') {
        sessionStorage.removeItem('caravan.team-banner.pending');
        this.showTeamBanner = !this.settings.disableBanners();
      }
    } catch {
      this.showTeamBanner = false;
    }
  }

  closeTeamBanner(): void {
    this.showTeamBanner = false;
  }

  async loadHomeProducts(): Promise<void> {
    try {
      const rows = await firstValueFrom(this.http.get<ApiProduct[]>('/api/fetchProducts'));
      const products: HomeProduct[] = rows.map(row => ({
        id: Number(row.product_id),
        typeId: Number(row.type_id),
        name: row.product_name ?? 'Caravan product',
        price: Number(row.product_price) || 0,
        image: row.product_image || 'assets/Images/ItemNotFound_nobg.png',
        rating: Number(row.product_rating) || 0,
        reviewCount: Number(row.review_count) || 0,
      }));

      // Product IDs are assigned as new products are created, so descending IDs
      // provide a stable newest-first order until the API exposes a created date.
      this.newArrivals = [...products].sort((a, b) => b.id - a.id).slice(0, 3);
      this.popularProducts = [...products]
        .sort((a, b) => Number(b.rating) - Number(a.rating)
          || Number(b.reviewCount) - Number(a.reviewCount)
          || b.id - a.id)
        .slice(0, 3);
    } catch (error) {
      console.error('Unable to load home page products:', error);
      this.newArrivals = [];
      this.popularProducts = [];
    } finally {
      this.changeDetector.detectChanges();
    }
  }

  openProduct(product: HomeProduct): void {
    const idParam = product.typeId === 2 ? 'bundleId' : 'productId';
    void this.router.navigate(['/product'], { queryParams: { [idParam]: product.id } });
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.15 },
    );

    setTimeout(() => {
      this.host.nativeElement
        .querySelectorAll('.fade-title, .category, .card-section ion-card, .explore-wrapper')
        .forEach(element => observer.observe(element));
    }, 300);
  }
}
