import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { firstValueFrom, timeout } from 'rxjs';
import { SettingsService } from '../../services/settings.service';

interface Category { category_id: number; }

interface Product {
  product_id: number;
  type_id: number; // 2 = bundle
  product_name: string;
  product_image: string;
  product_price: number;
  product_rating?: number;
  review_count?: number;
  product_country?: string;
  product_desc?: string;
  product_category?: Category[];
}

interface CartItem {
  cartprod_id: number | null;
  cartbundle_id: number | null;
  cartprod_size: string;
  quantity: number;
  isBundle: boolean;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner],
  templateUrl: './product.page.html',
  styleUrls: ['./product.page.scss'],
})
export class ProductPage implements OnInit {
  isBundle = false;
  itemId = 0;
  item?: Product;
  loading = true;
  error = '';
  size: '8oz' | '16oz' = '8oz';
  wishlistBusy = false;
  actionModalMode: 'confirm-cart' | 'notice' | null = null;
  actionModalTitle = '';
  actionModalMessage = '';
  similar: Product[] = [];
  random: Product[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private changeDetector: ChangeDetectorRef,
    private readonly settings: SettingsService,
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const bundleId = Number(params.get('bundleId')) || 0;
      const productId = Number(params.get('productId')) || 0;
      this.isBundle = bundleId > 0;
      this.itemId = bundleId || productId;
      this.size = '8oz';
      void this.load();
    });
  }

  get price(): string {
    const ounces = this.size === '8oz' ? 8 : 16;
    return this.settings.formatCurrency((Number(this.item?.product_price) || 0) * ounces);
  }

  formatCurrency(value: number): string {
    return this.settings.formatCurrency(value);
  }

  private async load() {
    this.loading = true;
    this.error = '';
    this.item = undefined;
    this.changeDetector.detectChanges();

    if (!Number.isInteger(this.itemId) || this.itemId <= 0) {
      this.error = `Unable to identify this ${this.isBundle ? 'bundle' : 'product'}.`;
      this.loading = false;
      this.changeDetector.detectChanges();
      return;
    }

    try {
      // Use the same catalog request as the Market page, then derive the selected,
      // related, and random items from that single response.
      const response = await firstValueFrom(
        this.http.get<Product[]>('/api/fetchProducts').pipe(timeout({ first: 15000 }))
      );
      const all = Array.isArray(response) ? response : [];
      const item = all.find(product => Number(product.product_id) === this.itemId);
      if (!item) throw new Error('Item not found');
      if ((Number(item.type_id) === 2) !== this.isBundle) throw new Error('Item type does not match route');

      this.item = item;
      this.similar = this.shuffle(this.getSimilar(item, all)).slice(0, 7);
      this.random = this.shuffle(all.filter(p => Number(p.product_id) !== Number(item.product_id))).slice(0, 7);
    } catch (e) {
      console.error('Error loading item:', e);
      this.error = `Unable to load this ${this.isBundle ? 'bundle' : 'product'}.`;
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  private getSimilar(item: Product, all: Product[]): Product[] {
    const mine = item.product_category ?? [];
    return all.filter(other => {
      if (Number(other.product_id) === Number(item.product_id)) return false;
      const sameCountry = !!item.product_country && !!other.product_country &&
        item.product_country.trim().toLocaleLowerCase() === other.product_country.trim().toLocaleLowerCase();
      const sameCategory = (other.product_category ?? []).some(otherCategory =>
        mine.some(category => Number(category.category_id) === Number(otherCategory.category_id)));
      return sameCountry || sameCategory;
    });
  }

  private shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  goBack() {
    void this.router.navigateByUrl('/store');
  }

  openItem(product: Product) {
    const key = Number(product.type_id) === 2 ? 'bundleId' : 'productId';
    void this.router.navigate(['/product'], { queryParams: { [key]: product.product_id } });
  }

  goToReviews() {
    const queryParams = this.isBundle ? { bundleId: this.itemId } : { productId: this.itemId };
    void this.router.navigate(['/review'], { queryParams });
  }

  starString(): string {
    const rating = Math.max(0, Math.min(5, Math.round(Number(this.item?.product_rating) || 0)));
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  ratingLabel(): string {
    const count = Number(this.item?.review_count) || 0;
    return count ? `${Number(this.item?.product_rating || 0).toFixed(1)} (${count})` : 'No ratings';
  }

  private showNotice(title: string, message: string): void {
    this.actionModalTitle = title;
    this.actionModalMessage = message;
    this.actionModalMode = 'notice';
    this.changeDetector.detectChanges();
  }

  private async isLoggedIn(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ loggedIn: boolean }>('/api/isLoggedIn').pipe(timeout({ first: 10000 }))
      );
      return !!response?.loggedIn;
    } catch {
      return false;
    }
  }

  async addToCart() {
    if (!(await this.isLoggedIn())) {
      this.showNotice('LOGIN REQUIRED', 'Sign in to add this item to your cart.');
      return;
    }
    this.actionModalTitle = 'Add to Cart?';
    this.actionModalMessage = `Add ${this.item?.product_name ?? 'this item'} (${this.size}) to your cart for ${this.price}?`;
    this.actionModalMode = 'confirm-cart';
    this.changeDetector.detectChanges();
  }

  confirmAddToCart(): void {
    const type = this.isBundle ? 'bundle' : 'product';
    if (!this.itemId) return this.showNotice('Cart Error', 'Unable to identify this item.');

    let cart: CartItem[] = [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('cart') || '[]');
      cart = Array.isArray(stored) ? stored as CartItem[] : [];
    } catch {
      cart = [];
    }

    const exists = cart.some(entry =>
      entry.isBundle === this.isBundle &&
      Number(this.isBundle ? entry.cartbundle_id : entry.cartprod_id) === this.itemId &&
      entry.cartprod_size === this.size
    );
    if (exists) return this.showNotice('Already in Cart', `This ${type} with the selected size is already in your cart.`);

    cart.push({
      cartprod_id: this.isBundle ? null : this.itemId,
      cartbundle_id: this.isBundle ? this.itemId : null,
      cartprod_size: this.size,
      quantity: 1,
      isBundle: this.isBundle,
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    this.showNotice('Added to Cart', `Your ${type} has been added to your cart.`);
  }

  dismissActionModal(): void {
    this.actionModalMode = null;
  }

  goToLogin(): void {
    this.dismissActionModal();
    void this.router.navigateByUrl('/login');
  }

  async addToWishlist() {
    if (!this.itemId) return this.showNotice('Wishlist Error', 'Unable to identify this item.');
    this.wishlistBusy = true;
    this.changeDetector.detectChanges();
    try {
      const response = await firstValueFrom(
        this.http.post<{ alreadyExists?: boolean }>('/api/addWishlist', { productId: this.itemId })
          .pipe(timeout({ first: 10000 }))
      );
      if (response?.alreadyExists) return this.showNotice('Already in Wishlist', 'This item is already in your wishlist.');
      return this.showNotice('Wishlist', 'Item added to your wishlist.');
    } catch (e) {
      const error = e as HttpErrorResponse;
      if (error.status === 401) return this.showNotice('Login Required', 'Sign in to add items to your wishlist.');
      if (error.status === 409 || error.error?.alreadyExists) {
        return this.showNotice('Already in Wishlist', 'This item is already in your wishlist.');
      }
      return this.showNotice('Wishlist Error', error.error?.error || 'Unable to add item to wishlist.');
    } finally {
      this.wishlistBusy = false;
      this.changeDetector.detectChanges();
    }
  }
}
