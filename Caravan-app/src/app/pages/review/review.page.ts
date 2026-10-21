import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { firstValueFrom, timeout } from 'rxjs';

interface Product {
  product_id: number;
  type_id?: number;
  product_name: string;
  product_image: string;
  product_country?: string;
  product_desc?: string;
}

interface Review {
  review_id: number;
  product_id: number;
  Customer_id?: number;
  rating: number;
  review_title: string;
  review_text: string;
  review_date: string;
  first_name?: string;
  last_name?: string;
}

interface ReviewSummary {
  average_rating: number;
  review_count: number;
}

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner],
  templateUrl: './review.page.html',
  styleUrls: ['./review.page.scss'],
})
export class ReviewsPage implements OnInit {
  readonly starValues = [1, 2, 3, 4, 5];
  readonly cardsPerPage = 6;

  itemId = 0;
  isBundle = false;
  product?: Product;
  reviews: Review[] = [];
  myReview: Review | null = null;
  summary: ReviewSummary = { average_rating: 0, review_count: 0 };
  currentPage = 0;
  loading = true;
  saving = false;
  loggedIn = false;
  error = '';

  modalOpen = false;
  editMode = false;
  deleteConfirmOpen = false;
  rating = 5;
  hoverRating = 0;
  form = { title: '', comment: '' };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const bundleId = Number(params.get('bundleId')) || 0;
      const productId = Number(params.get('productId')) || 0;
      this.isBundle = bundleId > 0;
      this.itemId = bundleId || productId;
      void this.load();
    });
  }

  get totalPages(): number { return Math.ceil(this.reviews.length / this.cardsPerPage); }
  get pagedReviews(): Review[] {
    const start = this.currentPage * this.cardsPerPage;
    return this.reviews.slice(start, start + this.cardsPerPage);
  }
  get canGoPrev(): boolean { return this.currentPage > 0; }
  get canGoNext(): boolean { return this.currentPage < this.totalPages - 1; }
  get shownRating(): number { return this.hoverRating || this.rating; }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.product = undefined;
    this.reviews = [];
    this.myReview = null;
    this.summary = { average_rating: 0, review_count: 0 };
    this.currentPage = 0;
    this.changeDetector.detectChanges();

    if (!Number.isInteger(this.itemId) || this.itemId <= 0) {
      this.loading = false;
      this.error = 'Open reviews from a product page to select an item.';
      this.changeDetector.detectChanges();
      return;
    }

    try {
      const productsRequest = firstValueFrom(this.http.get<Product[]>('/api/fetchProducts').pipe(timeout({ first: 15000 })));
      const reviewsRequest = firstValueFrom(this.http.get<Review[]>('/api/fetchReviews', { params: { productId: this.itemId } }).pipe(timeout({ first: 15000 })));
      const summaryRequest = firstValueFrom(this.http.get<ReviewSummary>('/api/reviewSummary', { params: { productId: this.itemId } }).pipe(timeout({ first: 15000 })));
      const loginRequest = firstValueFrom(this.http.get<{ loggedIn: boolean }>('/api/isLoggedIn').pipe(timeout({ first: 10000 }))).catch(() => ({ loggedIn: false }));
      const myReviewRequest = firstValueFrom(this.http.get<Review | null>('/api/myReview', { params: { productId: this.itemId } }).pipe(timeout({ first: 10000 }))).catch(() => null);
      const [products, reviews, summary, login, myReview] = await Promise.all([
        productsRequest, reviewsRequest, summaryRequest, loginRequest, myReviewRequest,
      ]);
      const selected = (Array.isArray(products) ? products : []).find(p => Number(p.product_id) === this.itemId);
      if (!selected || (Number(selected.type_id) === 2) !== this.isBundle) throw new Error('The selected item could not be found.');
      this.product = selected;
      this.loggedIn = !!login.loggedIn;
      this.myReview = myReview;
      this.reviews = (Array.isArray(reviews) ? reviews : [])
        .filter(review => !this.myReview || Number(review.review_id) !== Number(this.myReview.review_id));
      this.summary = {
        average_rating: Number(summary?.average_rating) || 0,
        review_count: Number(summary?.review_count) || 0,
      };
    } catch (error) {
      console.error('Error loading reviews:', error);
      this.error = error instanceof Error ? error.message : 'Unable to load reviews. Please try again.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  prev(): void { if (this.canGoPrev) this.currentPage--; }
  next(): void { if (this.canGoNext) this.currentPage++; }
  goBackToProduct(): void {
    if (this.itemId > 0) {
      const key = this.isBundle ? 'bundleId' : 'productId';
      void this.router.navigate(['/product'], { queryParams: { [key]: this.itemId } });
      return;
    }
    void this.router.navigateByUrl('/store');
  }
  starString(count: number): string { return '★'.repeat(Math.max(0, Math.min(5, count))) + '☆'.repeat(5 - Math.max(0, Math.min(5, count))); }
  starsForAverage(): string {
    const rounded = Math.round(this.summary.average_rating);
    return this.starString(rounded);
  }
  reviewerName(review: Review): string {
    return `${review.first_name ?? ''} ${review.last_name ?? ''}`.trim() || 'Caravan customer';
  }
  formatDate(value: string): string {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
  }
  imageUrl(path: string | undefined): string {
    return path || 'assets/Images/ItemNotFound_nobg.png';
  }

  imageFailed(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/Images/ItemNotFound_nobg.png';
  }

  openModal(edit = false): void {
    if (!this.loggedIn) {
      void this.router.navigate(['/login']);
      return;
    }
    this.editMode = edit;
    this.rating = edit && this.myReview ? Number(this.myReview.rating) : 5;
    this.hoverRating = 0;
    this.form = edit && this.myReview
      ? { title: this.myReview.review_title, comment: this.myReview.review_text }
      : { title: '', comment: '' };
    this.error = '';
    this.modalOpen = true;
  }

  closeModal(): void { if (!this.saving) this.modalOpen = false; }

  async submit(form: NgForm): Promise<void> {
    const title = this.form.title.trim();
    const comment = this.form.comment.trim();
    if (form.invalid || this.rating < 1 || !title || !comment || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      if (this.editMode && this.myReview) {
        await firstValueFrom(this.http.put('/api/updateReview', {
          reviewId: this.myReview.review_id,
          rating: this.rating,
          review_title: title,
          review_text: comment,
        }));
      } else {
        await firstValueFrom(this.http.post('/api/addReview', {
          productId: this.itemId,
          rating: this.rating,
          review_title: title,
          review_text: comment,
        }));
      }
      this.modalOpen = false;
      await this.load();
    } catch (error) {
      this.error = this.apiError(error, 'Unable to save your review.');
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  async deleteReview(): Promise<void> {
    if (!this.myReview || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      await firstValueFrom(this.http.delete('/api/deleteReview', { body: { reviewId: this.myReview.review_id } }));
      this.deleteConfirmOpen = false;
      this.modalOpen = false;
      await this.load();
    } catch (error) {
      this.error = this.apiError(error, 'Unable to delete your review.');
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  private apiError(error: unknown, fallback: string): string {
    const response = error as HttpErrorResponse;
    return response.error?.error || fallback;
  }
}
