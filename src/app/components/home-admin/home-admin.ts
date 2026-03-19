import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ServiceApi } from '../../services/service-api';

type LocationGroup = {
  label: string;
  count: number;
  lat?: number;
  lon?: number;
};

@Component({
  selector: 'app-home-admin',
  imports: [CommonModule],
  templateUrl: './home-admin.html',
  styleUrl: './home-admin.scss',
})
export class HomeAdmin implements OnInit, AfterViewInit, OnDestroy {
  adminUser: any | null = null;
  loggedInUsers: any[] = [];
  allBookings: any[] = [];
  confirmedBookings: any[] = [];
  locationGroups: LocationGroup[] = [];
  totalLoggedInUsers = 0;
  usersWithoutLocation = 0;
  totalPaidAmount = 0;
  totalDriverAmount = 0;
  totalPlatformAmount = 0;
  totalPlatformVatAmount = 0;
  totalCancelledBookings = 0;
  selectedDateCancelledBookings = 0;
  selectedDateDriversCount = 0;
  selectedDateDriverAmount = 0;
  selectedDate = this.getTodayDateString();
  loading = true;
  mapLoading = false;
  errorMessage: string | null = null;
  mapMessage: string | null = null;

  private readonly platformId = inject(PLATFORM_ID);
  private map: any;
  private L: any;
  private markerLayer: any;
  private viewInitialized = false;

  constructor(
    private service: ServiceApi,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.renderLocationMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private loadDashboard(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      user: this.service.getUser(),
      users: this.service.getUsers(),
      bookings: this.service.getBookings(),
    }).subscribe({
      next: ({ user, users, bookings }) => {
        if (!user?.is_superuser) {
          this.router.navigate(['/home']);
          return;
        }

        this.adminUser = user;
        const allUsers = Array.isArray(users) ? users : [];
        this.allBookings = Array.isArray(bookings) ? bookings : [];

        this.loggedInUsers = allUsers.filter((candidate) => !!candidate?.last_login);
        this.confirmedBookings = this.allBookings.filter((booking) => booking?.status === 'CONFIRMED');
        this.totalLoggedInUsers = this.loggedInUsers.length;
        this.locationGroups = this.buildLocationGroups(this.loggedInUsers);
        this.usersWithoutLocation =
          this.locationGroups.find((group) => group.label === 'Location not set')?.count ?? 0;

        this.computeBookingRevenue();
        this.computeDateMetrics();
        this.loading = false;
        this.mapMessage = null;
        setTimeout(() => {
          this.renderLocationMap();
        }, 0);
      },
      error: (error) => {
        this.errorMessage = error?.error?.detail || error?.message || 'Unable to load admin dashboard';
        this.loading = false;
      },
    });
  }

  private computeBookingRevenue(): void {
    let driverTotal = 0;
    let platformTotal = 0;
    let vatTotal = 0;

    for (const booking of this.confirmedBookings) {
      const basePrice = Number(booking?.ride_details?.price || 0);
      const platformFee = basePrice * 0.1;
      const vatOnPlatformFee = platformFee * 0.18;

      driverTotal += basePrice;
      platformTotal += platformFee;
      vatTotal += vatOnPlatformFee;
    }

    this.totalDriverAmount = driverTotal;
    this.totalPlatformAmount = platformTotal;
    this.totalPlatformVatAmount = vatTotal;
    this.totalPaidAmount = driverTotal + platformTotal + vatTotal;
    this.totalCancelledBookings = this.cancelledBookings.length;
  }

  private computeDateMetrics(): void {
    const selectedConfirmedBookings = this.confirmedBookings.filter(
      (booking) => this.extractDatePart(booking?.booked_at) === this.selectedDate
    );

    const selectedCancelledBookings = this.cancelledBookings.filter(
      (booking) => this.extractDatePart(booking?.updated_at || booking?.booked_at) === this.selectedDate
    );

    this.selectedDateCancelledBookings = selectedCancelledBookings.length;
    this.selectedDateDriversCount = new Set(
      selectedConfirmedBookings
        .map((booking) => booking?.ride_details?.driver)
        .filter((driverId) => driverId !== null && driverId !== undefined)
    ).size;
    this.selectedDateDriverAmount = selectedConfirmedBookings.reduce(
      (sum, booking) => sum + Number(booking?.ride_details?.price || 0),
      0
    );
  }

  get cancelledBookings(): any[] {
    return this.allBookings.filter((booking) => booking?.status === 'CANCELLED');
  }

  private buildLocationGroups(users: any[]): LocationGroup[] {
    const counts = new Map<string, number>();

    for (const user of users) {
      const label = this.locationLabel(user);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  locationLabel(user: any): string {
    const city = String(user?.city ?? '').trim();
    const country = String(user?.country ?? '').trim();

    if (city && country) {
      return `${city}, ${country}`;
    }

    if (city) {
      return city;
    }

    if (country) {
      return country;
    }

    return 'Location not set';
  }

  detailLabel(user: any): string {
    return user?.first_name || user?.email || 'No details';
  }

  onSelectedDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedDate = target.value || this.getTodayDateString();
    this.computeDateMetrics();
  }

  formatLastLogin(value: string | null | undefined): string {
    if (!value) return 'Unknown';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private async renderLocationMap(): Promise<void> {
    if (!this.viewInitialized || this.loading || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const groupsToMap = this.locationGroups.filter((group) => group.label !== 'Location not set');
    if (!groupsToMap.length) {
      this.mapMessage = 'No user locations are available to display on the map.';
      return;
    }

    this.mapLoading = true;
    const ready = await this.initMap();
    if (!ready || !this.markerLayer) {
      this.mapMessage = 'Unable to initialize the map container.';
      this.mapLoading = false;
      return;
    }

    const geocodedGroups = await Promise.all(
      groupsToMap.map(async (group) => {
        const coords = await this.geocodeLocation(group.label);
        return coords ? { ...group, ...coords } : group;
      })
    );

    this.locationGroups = this.locationGroups.map((group) => {
      const geocoded = geocodedGroups.find((item) => item.label === group.label);
      return geocoded ?? group;
    });

    const mappedGroups = this.locationGroups.filter(
      (group) => typeof group.lat === 'number' && typeof group.lon === 'number'
    );

    this.markerLayer.clearLayers();
    if (!mappedGroups.length) {
      this.mapMessage = 'Locations were found, but they could not be placed on the map.';
      this.mapLoading = false;
      return;
    }

    const bounds: any[] = [];
    for (const group of mappedGroups) {
      const marker = this.L.circleMarker([group.lat, group.lon], {
        radius: Math.min(16, 7 + group.count),
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(this.markerLayer);
      marker.bindPopup(`<strong>${group.label}</strong><br>${group.count} user(s)`);
      bounds.push([group.lat, group.lon]);
    }

    if (bounds.length === 1) {
      this.map.setView(bounds[0], 6);
    } else {
      this.map.fitBounds(bounds, { padding: [30, 30] });
    }

    setTimeout(() => this.map.invalidateSize(), 150);
    this.mapMessage = null;
    this.mapLoading = false;
  }

  private async initMap(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;

    const container = document.getElementById('admin-user-map');
    if (!container) return false;

    if (!this.map) {
      this.L = await import('leaflet');
      this.map = this.L.map('admin-user-map', { zoomControl: true }).setView([-3.38, 29.36], 6);
      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.map);
      this.markerLayer = this.L.layerGroup().addTo(this.map);
    }

    return true;
  }

  private geocodeLocation(label: string): Promise<{ lat: number; lon: number } | null> {
    const query =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(label)}&format=json&limit=1`;

    return new Promise((resolve) => {
      this.http.get<any[]>(query).subscribe({
        next: (results) => {
          const first = Array.isArray(results) ? results[0] : null;
          if (!first?.lat || !first?.lon) {
            resolve(null);
            return;
          }

          resolve({
            lat: Number(first.lat),
            lon: Number(first.lon),
          });
        },
        error: () => resolve(null),
      });
    });
  }

  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractDatePart(value: string | null | undefined): string {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 10);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
