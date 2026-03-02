import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ServiceApi } from '../../services/service-api';

@Component({
  selector: 'app-taxi',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './taxi.html',
  styleUrl: './taxi.scss',
})
export class Taxi implements OnInit {
  private platformId = inject(PLATFORM_ID);

  loading = false;
  loadingNearby = false;
  submitting = false;
  submittingRequest = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  showAddForm = false;
  availableTaxis: any[] = [];
  nearbyTaxis: any[] = [];
  user: any | null = null;

  latitude: number | null = null;
  longitude: number | null = null;
  radiusKm = 5;

  expandedAvailableId: number | null = null;
  expandedNearbyId: number | null = null;

  selectedTaxiForRequest: any | null = null;

  taxiForm!: FormGroup;
  callTaxiForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private service: ServiceApi
  ) {}

  ngOnInit(): void {
    this.taxiForm = this.fb.group({
      license_plate_number: ['', [Validators.required, Validators.maxLength(50)]],
      vehicle_model: ['', [Validators.required, Validators.maxLength(120)]],
      number_of_seats: [4, [Validators.required, Validators.min(1), Validators.max(12)]],
      image: [''],
      color: [''],
      vehicle_year: [null as number | null],
      additional_details: [''],
      latitude: [null as number | null],
      longitude: [null as number | null],
      location_label: [''],
      is_active: [true, Validators.required],
    });

    this.callTaxiForm = this.fb.group({
      pickup_location: ['', Validators.required],
      dropoff_location: ['', Validators.required],
      pickup_date: ['', Validators.required],
      pickup_time: ['', Validators.required],
      notes: [''],
    });

    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      user: this.service.getUser(),
      taxis: this.service.getAvailableTaxis(),
    }).subscribe({
      next: ({ user, taxis }) => {
        this.user = user;
        this.availableTaxis = taxis || [];
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.detail || 'Unable to load available taxis.';
        this.loading = false;
      },
    });
  }

  toggleAddTaxiForm(): void {
    this.showAddForm = !this.showAddForm;
    this.errorMessage = null;
    this.successMessage = null;
  }

  loadAvailableTaxis(): void {
    this.loading = true;
    this.service.getAvailableTaxis().subscribe({
      next: (data) => {
        this.availableTaxis = data || [];
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.detail || 'Unable to load available taxis.';
        this.loading = false;
      },
    });
  }

  findNearbyTaxis(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
      this.errorMessage = 'Geolocation is not available on this device.';
      return;
    }

    this.loadingNearby = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.taxiForm.patchValue({
          latitude: this.latitude,
          longitude: this.longitude,
        });

        this.service.getNearbyTaxis(this.latitude, this.longitude, this.radiusKm).subscribe({
          next: (data) => {
            this.nearbyTaxis = data || [];
            this.loadingNearby = false;
          },
          error: (error) => {
            this.errorMessage = error?.detail || 'Unable to load nearby taxis.';
            this.loadingNearby = false;
          },
        });
      },
      () => {
        this.errorMessage = 'Unable to access your location.';
        this.loadingNearby = false;
      }
    );
  }

  toggleDetails(scope: 'available' | 'nearby', taxiId: number): void {
    if (scope === 'available') {
      this.expandedAvailableId = this.expandedAvailableId === taxiId ? null : taxiId;
    } else {
      this.expandedNearbyId = this.expandedNearbyId === taxiId ? null : taxiId;
    }
  }

  isExpanded(scope: 'available' | 'nearby', taxiId: number): boolean {
    return scope === 'available'
      ? this.expandedAvailableId === taxiId
      : this.expandedNearbyId === taxiId;
  }

  isOwnTaxi(taxi: any): boolean {
    return !!this.user && taxi?.driver === this.user.id;
  }

  openCallTaxiForm(taxi: any): void {
    this.selectedTaxiForRequest = taxi;
    this.callTaxiForm.reset({
      pickup_location: '',
      dropoff_location: '',
      pickup_date: '',
      pickup_time: '',
      notes: '',
    });
    this.errorMessage = null;
    this.successMessage = null;
  }

  cancelCallTaxiForm(): void {
    this.selectedTaxiForRequest = null;
  }

  submitCallTaxiRequest(): void {
    if (!this.selectedTaxiForRequest) return;

    if (this.callTaxiForm.invalid) {
      this.callTaxiForm.markAllAsTouched();
      return;
    }

    this.submittingRequest = true;
    this.errorMessage = null;
    this.successMessage = null;

    const payload = {
      taxi: this.selectedTaxiForRequest.id,
      ...this.callTaxiForm.value,
      status: 'REQUESTED',
    };

    this.service.createServiceTaxi(payload).subscribe({
      next: () => {
        this.submittingRequest = false;
        this.successMessage = 'Taxi request sent. The driver will accept or reject soon.';
        this.selectedTaxiForRequest = null;
      },
      error: (error) => {
        this.submittingRequest = false;
        this.errorMessage = error?.error?.detail || 'Unable to call this taxi.';
      },
    });
  }

  onSubmitTaxi(): void {
    if (this.taxiForm.invalid) {
      this.taxiForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.service.createTaxi(this.taxiForm.value).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Taxi created successfully.';
        this.showAddForm = false;
        this.taxiForm.reset({
          number_of_seats: 4,
          is_active: true,
        });
        this.loadAvailableTaxis();
        if (this.latitude != null && this.longitude != null) {
          this.findNearbyTaxis();
        }
      },
      error: (error) => {
        this.submitting = false;
        this.errorMessage = error?.error?.detail || 'Unable to create taxi.';
      },
    });
  }
}
