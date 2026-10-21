import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { person } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';

type ProfileTab = 'overview' | 'addresses' | 'vouchers' | 'wishlist' | 'logout';

interface Profile {
  email: string;
  phone: string;
  birthdate: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface Address {
  id: number;
  street: string;
  city: string;
  zipCode: string;
}

interface Voucher {
  Voucher_id: number;
  Voucher_name: string;
  Voucher_desc: string;
  discount: number;
  Voucher_status: string;
}

interface WishlistItem {
  id: number;
  name: string;
  price: number;
  image: string;
  typeId: number;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonSpinner],
})
export class ProfilePage implements OnInit {
  private readonly addressesPerPage = 5;
  private readonly wishlistItemsPerPage = 5;
  activeTab: ProfileTab = 'overview';
  addressPage = 1;
  wishlistPage = 1;
  customerName = '';
  customerEmail = '';
  isEditingProfile = false;
  loading = true;
  saving = false;
  busy = false;
  error = '';

  showAddressModal = false;
  showSaveProfileModal = false;
  showDeleteAddressModal = false;
  showDeleteWishlistModal = false;
  showLogoutModal = false;
  addressToDeleteId: number | null = null;
  wishlistToDeleteId: number | null = null;
  editingAddressId: number | null = null;

  profile: Profile = { email: '', phone: '', birthdate: '', firstName: '', lastName: '', password: '' };
  private originalProfile: Profile = { ...this.profile };
  newAddress = { street: '', city: '', zipCode: '' };
  addresses: Address[] = [];
  vouchers: Voucher[] = [];
  wishlistItems: WishlistItem[] = [];

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
    readonly settings: SettingsService,
  ) {
    addIcons({ person });
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tab') === 'addresses') {
      this.activeTab = 'addresses';
    }
  }

  ionViewWillEnter(): void {
    void this.loadProfileData();
  }

  get addressToDelete(): Address | undefined {
    return this.addresses.find(address => address.id === this.addressToDeleteId);
  }

  get wishlistItemToDelete(): WishlistItem | undefined {
    return this.wishlistItems.find(item => item.id === this.wishlistToDeleteId);
  }

  formatCurrency(value: number): string {
    return this.settings.formatCurrency(value);
  }

  get addressPageCount(): number {
    return Math.max(1, Math.ceil(this.addresses.length / this.addressesPerPage));
  }

  get paginatedAddresses(): Address[] {
    const start = (this.addressPage - 1) * this.addressesPerPage;
    return this.addresses.slice(start, start + this.addressesPerPage);
  }

  get wishlistPageCount(): number {
    return Math.max(1, Math.ceil(this.wishlistItems.length / this.wishlistItemsPerPage));
  }

  get paginatedWishlistItems(): WishlistItem[] {
    const start = (this.wishlistPage - 1) * this.wishlistItemsPerPage;
    return this.wishlistItems.slice(start, start + this.wishlistItemsPerPage);
  }

  previousWishlistPage(): void {
    if (this.wishlistPage > 1) this.wishlistPage--;
  }

  nextWishlistPage(): void {
    if (this.wishlistPage < this.wishlistPageCount) this.wishlistPage++;
  }

  private clampWishlistPage(): void {
    this.wishlistPage = Math.min(this.wishlistPage, this.wishlistPageCount);
  }

  previousAddressPage(): void {
    if (this.addressPage > 1) this.addressPage--;
  }

  nextAddressPage(): void {
    if (this.addressPage < this.addressPageCount) this.addressPage++;
  }

  private clampAddressPage(): void {
    this.addressPage = Math.min(this.addressPage, this.addressPageCount);
  }

  private async loadProfileData(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.changeDetector.detectChanges();
    try {
      const [profile, addresses, vouchers, wishlist] = await Promise.all([
        firstValueFrom(this.http.get<any>('/api/profile')),
        firstValueFrom(this.http.get<any[]>('/api/addresses')),
        firstValueFrom(this.http.get<any[]>('/vouchers/me')),
        firstValueFrom(this.http.get<any[]>('/api/fetchWishlist')),
      ]);

      this.profile = {
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        birthdate: this.toDateInput(profile.birthdate),
        password: '',
      };
      this.originalProfile = { ...this.profile };
      this.updateCustomerHeading();
      this.addresses = addresses.map(row => ({
        id: Number(row.Address_id ?? row.address_id),
        street: row.Street_address ?? row.street_address ?? '',
        city: row.City ?? row.city ?? '',
        zipCode: String(row.Zip_code ?? row.zip_code ?? ''),
      }));
      this.clampAddressPage();
      this.vouchers = vouchers.filter(voucher =>
        String(voucher.Voucher_status ?? '').toLowerCase() === 'unused');
      this.wishlistItems = wishlist.map(item => ({
        id: Number(item.product_id),
        name: item.product_name ?? '',
        price: Number(item.product_price) || 0,
        image: item.product_image || 'assets/images/product-placeholder.png',
        typeId: Number(item.type_id) || 1,
      }));
      this.clampWishlistPage();
    } catch (error: any) {
      console.error('Unable to load profile data:', error);
      this.error = error?.status === 401
        ? 'Please sign in to view your profile.'
        : 'Unable to load your profile. Please Check your Internet Connection.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  private toDateInput(value: unknown): string {
    if (!value) return '';
    const text = String(value);
    const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (isoDate) return isoDate;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }

  private updateCustomerHeading(): void {
    this.customerName = `${this.profile.firstName} ${this.profile.lastName}`.trim();
    this.customerEmail = this.profile.email;
  }

  startEditProfile(): void {
    this.error = '';
    this.originalProfile = { ...this.profile };
    this.profile.password = '';
    this.isEditingProfile = true;
  }

  saveProfile(): void {
    if (!this.profile.email.trim() || !this.profile.firstName.trim() || !this.profile.lastName.trim()) {
      this.error = 'Email, first name, and last name are required.';
      return;
    }
    this.showSaveProfileModal = true;
  }

  async confirmSaveProfile(): Promise<void> {
    this.saving = true;
    this.error = '';
    try {
      const payload = {
        email: this.profile.email.trim(),
        phone: this.profile.phone.trim(),
        firstName: this.profile.firstName.trim(),
        lastName: this.profile.lastName.trim(),
        birthdate: this.profile.birthdate || null,
        password: this.profile.password,
      };
      await firstValueFrom(this.http.put('/api/profile', payload));
      this.profile.password = '';
      this.originalProfile = { ...this.profile };
      this.updateCustomerHeading();
      this.isEditingProfile = false;
      this.showSaveProfileModal = false;
    } catch (error: any) {
      console.error('Profile update failed:', error);
      this.error = error?.error?.error || 'Unable to save profile changes.';
      this.showSaveProfileModal = false;
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  cancelSaveProfile(): void { this.showSaveProfileModal = false; }

  cancelEditProfile(): void {
    this.profile = { ...this.originalProfile, password: '' };
    this.updateCustomerHeading();
    this.isEditingProfile = false;
    this.error = '';
  }

  openAddressModal(): void {
    this.editingAddressId = null;
    this.newAddress = { street: '', city: '', zipCode: '' };
    this.error = '';
    this.showAddressModal = true;
  }

  closeAddressModal(): void {
    this.showAddressModal = false;
    this.editingAddressId = null;
    this.newAddress = { street: '', city: '', zipCode: '' };
  }

  editAddress(addressId: number): void {
    const address = this.addresses.find(item => item.id === addressId);
    if (!address) return;
    this.editingAddressId = address.id;
    this.newAddress = { street: address.street, city: address.city, zipCode: address.zipCode };
    this.error = '';
    this.showAddressModal = true;
  }

  async saveAddress(): Promise<void> {
    const payload = {
      streetAddress: this.newAddress.street.trim(),
      city: this.newAddress.city.trim(),
      zipCode: this.newAddress.zipCode.trim(),
    };
    if (!payload.streetAddress || !payload.city || !payload.zipCode) return;
    this.busy = true;
    this.error = '';
    try {
      if (this.editingAddressId === null) {
        await firstValueFrom(this.http.post('/api/addresses', payload));
      } else {
        await firstValueFrom(this.http.put(`/api/addresses/${this.editingAddressId}`, payload));
      }
      this.closeAddressModal();
      this.addresses = await firstValueFrom(this.http.get<any[]>('/api/addresses')).then(rows => rows.map(row => ({
        id: Number(row.Address_id ?? row.address_id),
        street: row.Street_address ?? row.street_address ?? '',
        city: row.City ?? row.city ?? '',
        zipCode: String(row.Zip_code ?? row.zip_code ?? ''),
      })));
      this.clampAddressPage();
    } catch (error: any) {
      console.error('Address save failed:', error);
      this.error = error?.error?.error || 'Unable to save this address.';
    } finally {
      this.busy = false;
      this.changeDetector.detectChanges();
    }
  }

  deleteAddress(addressId: number): void {
    this.addressToDeleteId = addressId;
    this.showDeleteAddressModal = true;
  }

  async confirmDeleteAddress(): Promise<void> {
    if (this.addressToDeleteId === null) return;
    this.busy = true;
    this.error = '';
    try {
      await firstValueFrom(this.http.delete(`/api/addresses/${this.addressToDeleteId}`));
      this.addresses = this.addresses.filter(address => address.id !== this.addressToDeleteId);
      this.clampAddressPage();
      this.addressToDeleteId = null;
      this.showDeleteAddressModal = false;
    } catch (error: any) {
      console.error('Address delete failed:', error);
      this.error = error?.error?.error || 'Unable to delete this address.';
    } finally {
      this.busy = false;
      this.changeDetector.detectChanges();
    }
  }

  cancelDeleteAddress(): void {
    this.addressToDeleteId = null;
    this.showDeleteAddressModal = false;
  }

  viewWishlistItem(item: WishlistItem): void {
    const key = item.typeId === 2 ? 'bundleId' : 'productId';
    void this.router.navigate(['/product'], { queryParams: { [key]: item.id } });
  }

  requestDeleteWishlistItem(itemId: number): void {
    this.wishlistToDeleteId = itemId;
    this.showDeleteWishlistModal = true;
  }

  async confirmDeleteWishlistItem(): Promise<void> {
    const itemId = this.wishlistToDeleteId;
    if (itemId === null) return;
    this.busy = true;
    this.error = '';
    try {
      await firstValueFrom(this.http.delete(`/api/removeWishlist/${itemId}`));
      this.wishlistItems = this.wishlistItems.filter(item => item.id !== itemId);
      this.clampWishlistPage();
      this.cancelDeleteWishlistItem();
    } catch (error: any) {
      console.error('Wishlist removal failed:', error);
      this.error = error?.error?.error || 'Unable to remove this wishlist item.';
    } finally {
      this.busy = false;
      this.changeDetector.detectChanges();
    }
  }

  cancelDeleteWishlistItem(): void {
    this.wishlistToDeleteId = null;
    this.showDeleteWishlistModal = false;
  }

  logout(): void { this.showLogoutModal = true; }

  async confirmLogout(): Promise<void> {
    this.showLogoutModal = false;
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  cancelLogout(): void { this.showLogoutModal = false; }
}
