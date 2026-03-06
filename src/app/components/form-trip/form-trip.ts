import { Location, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { ServiceApi } from '../../services/service-api';

@Component({
  selector: 'app-form-trip',
  imports: [ReactiveFormsModule],
  templateUrl: './form-trip.html',
  styleUrl: './form-trip.scss',
})
export class FormTrip implements OnInit, AfterViewInit, OnDestroy {
  rideForm!: FormGroup;
  userRole: 'DRIVER' | 'CLIENT' = 'DRIVER';
  platformId = inject(PLATFORM_ID);

  map: any;
  private L: any;
  markerLayer: any;
  routeLayer: any;
  routePolylines: any[] = [];

  startPoint: { lat: number; lon: number } | null = null;
  endPoint: { lat: number; lon: number } | null = null;
  startMarker: any | null = null;
  endMarker: any | null = null;
  mapSelectMode: 'START' | 'END' | null = null;
  locationSuggestionTried = false;

  loading = false;
  routeLoading = false;
  errorMessage: string | null = null;

  user: any | null = null;

  routeOptions: Array<{
    index: number;
    coords: [number, number][];
    distanceKm: number;
    durationMin: number;
  }> = [];
  selectedRouteIndex = 0;
  savedRouteSignatures = new Set<string>();
  currentRouteRequestKey = '';

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private service: ServiceApi,
    private http: HttpClient,
    private router: Router
  ) {}

  async ngAfterViewInit() {
    await this.initMap();
  }

  ngOnInit() {
    this.getUser();
    this.initForm();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  async initMap() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.L = await import('leaflet');
    this.map = this.L.map('trip-map', { zoomControl: true }).setView([-3.38, 29.36], 7);

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.markerLayer = this.L.layerGroup().addTo(this.map);
    this.routeLayer = this.L.layerGroup().addTo(this.map);

    this.map.on('click', (e: any) => this.handleMapClick(e));
    setTimeout(() => this.map.invalidateSize(), 200);

    this.suggestCurrentLocationAsStart();
  }

  goBack(): void {
    this.location.back();
  }

  getUser() {
    this.service.getUser().subscribe({
      next: (user) => {
        this.user = user;
      },
      error: (err) => console.log("erreur pour l'utilisateur connecte", err),
    });
  }

  initForm() {
    this.rideForm = this.fb.group({
      from_city: ['', Validators.required],
      to_city: ['', Validators.required],
      departure_date: ['', Validators.required],
      departure_time: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(1)]],
      available_seats: [1, Validators.required],
      distance_km: [null as number | null],
      route_coords: [null as [number, number][] | null],
      vehicule: ['', Validators.required],
      note: [''],
      status: ['OPEN'],
    });
  }

  setUserRole(role: 'DRIVER' | 'CLIENT') {
    this.userRole = role;

    const priceCtrl = this.rideForm.get('price');
    const seatsCtrl = this.rideForm.get('available_seats');
    const vehiculeCtrl = this.rideForm.get('vehicule');
    const statusCtrl = this.rideForm.get('status');

    if (role === 'CLIENT') {
      seatsCtrl?.clearValidators();
      vehiculeCtrl?.clearValidators();

      this.rideForm.patchValue({
        available_seats: 1,
        vehicule: 'N/A',
        status: 'PROPOSED',
      });
    } else {
      priceCtrl?.setValidators([Validators.required, Validators.min(1)]);
      seatsCtrl?.setValidators([Validators.required]);
      vehiculeCtrl?.setValidators([Validators.required]);

      this.rideForm.patchValue({
        status: 'OPEN',
      });
    }

    priceCtrl?.updateValueAndValidity();
    seatsCtrl?.updateValueAndValidity();
    vehiculeCtrl?.updateValueAndValidity();
    statusCtrl?.updateValueAndValidity();
  }

  isDriverRole(): boolean {
    return this.userRole === 'DRIVER';
  }

  setMapSelectMode(mode: 'START' | 'END') {
    this.mapSelectMode = mode;
  }

  useCurrentLocationAsStart() {
    this.suggestCurrentLocationAsStart(true);
  }

  clearMapSelection() {
    this.startPoint = null;
    this.endPoint = null;
    this.routeOptions = [];
    this.routePolylines = [];
    this.selectedRouteIndex = 0;
    this.savedRouteSignatures.clear();
    this.currentRouteRequestKey = '';

    this.rideForm.patchValue({
      from_city: '',
      to_city: '',
      route_coords: null,
      distance_km: null,
    });

    this.markerLayer?.clearLayers();
    this.routeLayer?.clearLayers();
    this.startMarker = null;
    this.endMarker = null;
  }

  handleMapClick(event: any) {
    if (!this.map || !this.L) return;

    const clicked = { lat: event.latlng.lat, lon: event.latlng.lng };

    if (this.mapSelectMode === 'START') {
      this.startPoint = clicked;
      this.mapSelectMode = 'END';
      this.updateMarker('START', clicked);
      this.reverseGeocodeAndPatch(clicked, 'from_city');
      return;
    }

    if (this.mapSelectMode === 'END') {
      this.endPoint = clicked;
      this.mapSelectMode = null;
      this.updateMarker('END', clicked);
      this.reverseGeocodeAndPatch(clicked, 'to_city', true);
      return;
    }

    if (!this.startPoint) {
      this.startPoint = clicked;
      this.updateMarker('START', clicked);
      this.reverseGeocodeAndPatch(clicked, 'from_city');
      return;
    }

    if (!this.endPoint) {
      this.endPoint = clicked;
      this.updateMarker('END', clicked);
      this.reverseGeocodeAndPatch(clicked, 'to_city', true);
      return;
    }

    // If both are already selected, clicking again updates destination by default.
    this.endPoint = clicked;
    this.updateMarker('END', clicked);
    this.reverseGeocodeAndPatch(clicked, 'to_city', true);
  }

  updateMarker(type: 'START' | 'END', point: { lat: number; lon: number }) {
    if (type === 'START') {
      if (this.startMarker) this.markerLayer.removeLayer(this.startMarker);
      this.startMarker = this.L.circleMarker([point.lat, point.lon], {
        radius: 7,
        color: '#16a34a',
      }).addTo(this.markerLayer);
    } else {
      if (this.endMarker) this.markerLayer.removeLayer(this.endMarker);
      this.endMarker = this.L.circleMarker([point.lat, point.lon], {
        radius: 7,
        color: '#dc2626',
      }).addTo(this.markerLayer);
    }
  }

  reverseGeocodeAndPatch(
    point: { lat: number; lon: number },
    controlName: 'from_city' | 'to_city',
    loadAfterPatch = false
  ) {
    const reverseUrl =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lon}`;

    this.http.get<any>(reverseUrl).subscribe({
      next: (resp) => {
        const address = resp?.address || {};
        const cityName =
          address.city ||
          address.town ||
          address.village ||
          address.county ||
          resp?.display_name ||
          `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;

        this.rideForm.patchValue({ [controlName]: cityName });
        if (loadAfterPatch && this.startPoint && this.endPoint) {
          this.loadRouteFromPoints(this.startPoint, this.endPoint);
        }
      },
      error: () => {
        this.rideForm.patchValue({ [controlName]: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` });
        if (loadAfterPatch && this.startPoint && this.endPoint) {
          this.loadRouteFromPoints(this.startPoint, this.endPoint);
        }
      },
    });
  }

  loadRoute(preferredRouteIndex = 0, requireUnsavedRoute = false) {
    if (!this.L || !this.map) return;

    if (this.startPoint && this.endPoint) {
      this.loadRouteFromPoints(this.startPoint, this.endPoint, preferredRouteIndex, requireUnsavedRoute);
      return;
    }

    const { from_city, to_city } = this.rideForm.value;
    if (!from_city || !to_city) return;

    this.routeLoading = true;
    this.errorMessage = null;

    const from$ = this.http.get<any>(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(from_city)}&format=json&limit=1`
    );
    const to$ = this.http.get<any>(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(to_city)}&format=json&limit=1`
    );

    forkJoin([from$, to$]).subscribe({
      next: ([startOptions, endOptions]) => {
        if (!startOptions.length || !endOptions.length) {
          this.routeLoading = false;
          this.errorMessage = 'Unable to find cities on map.';
          return;
        }

        const start = { lat: Number(startOptions[0].lat), lon: Number(startOptions[0].lon) };
        const end = { lat: Number(endOptions[0].lat), lon: Number(endOptions[0].lon) };

        this.startPoint = start;
        this.endPoint = end;
        this.updateMarker('START', start);
        this.updateMarker('END', end);

        this.loadRouteFromPoints(start, end, preferredRouteIndex, requireUnsavedRoute);
      },
      error: () => {
        this.errorMessage = 'Unable to geocode selected cities.';
        this.routeLoading = false;
      },
    });
  }

  calculateAnotherRoute() {
    if (this.routeLoading) return;
    this.errorMessage = null;

    const currentRoute = this.routeOptions[this.selectedRouteIndex];
    if (currentRoute) {
      this.savedRouteSignatures.add(this.getRouteSignature(currentRoute.coords));
    }

    if (this.routeOptions.length > 1) {
      const nextUnsavedIndex = this.findFirstUnsavedRouteIndex(this.routeOptions);
      if (nextUnsavedIndex !== -1) {
        this.selectRoute(nextUnsavedIndex);
        return;
      }
    }

    if (this.startPoint && this.endPoint) {
      this.loadRouteFromPoints(this.startPoint, this.endPoint, 0, true);
      return;
    }

    this.loadRoute(0, true);
  }

  loadRouteFromPoints(
    start: { lat: number; lon: number },
    end: { lat: number; lon: number },
    preferredRouteIndex = 0,
    requireUnsavedRoute = false
  ) {
    const requestKey =
      `${start.lat.toFixed(5)},${start.lon.toFixed(5)}|` +
      `${end.lat.toFixed(5)},${end.lon.toFixed(5)}`;
    if (this.currentRouteRequestKey !== requestKey) {
      this.savedRouteSignatures.clear();
      this.currentRouteRequestKey = requestKey;
    }

    this.routeLoading = true;
    this.errorMessage = null;

    this.routeLayer.clearLayers();
    this.routePolylines = [];

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}` +
      '?overview=full&alternatives=true&geometries=geojson&steps=false';

    this.http.get<any>(osrmUrl).subscribe({
      next: (osrmData) => {
        if (!osrmData.routes || !osrmData.routes.length) {
          this.errorMessage = 'No route found between these points.';
          this.routeLoading = false;
          return;
        }

        this.routeOptions = osrmData.routes.map((route: any, index: number) => ({
          index,
          coords: route.geometry.coordinates,
          distanceKm: Math.max(1, Math.round((route.distance || 0) / 1000)),
          durationMin: Math.max(1, Math.round((route.duration || 0) / 60)),
        }));

        this.routeOptions.forEach((routeOption, index) => {
          const latLngRoute = routeOption.coords.map((c: [number, number]) =>
            this.L.latLng(c[1], c[0])
          );

          const polyline = this.L.polyline(latLngRoute, {
            color: index === 0 ? '#2563eb' : '#9ca3af',
            weight: index === 0 ? 5 : 4,
            opacity: index === 0 ? 0.95 : 0.7,
          }).addTo(this.routeLayer);

          polyline.on('click', () => this.selectRoute(index));
          this.routePolylines.push(polyline);
        });

        let selectedIndex = Math.min(
          Math.max(preferredRouteIndex, 0),
          this.routeOptions.length - 1
        );
        if (requireUnsavedRoute) {
          const nextUnsavedIndex = this.findFirstUnsavedRouteIndex(this.routeOptions);
          if (nextUnsavedIndex === -1) {
            this.errorMessage = 'No additional different route is available.';
            this.routeLoading = false;
            return;
          }
          selectedIndex = nextUnsavedIndex;
        }

        this.selectRoute(selectedIndex);
        this.routeLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to compute routes right now.';
        this.routeLoading = false;
      },
    });
  }

  selectRoute(index: number) {
    if (!this.routeOptions[index]) return;

    this.selectedRouteIndex = index;

    this.routePolylines.forEach((polyline, i) => {
      polyline.setStyle({
        color: i === index ? '#2563eb' : '#9ca3af',
        weight: i === index ? 5 : 4,
        opacity: i === index ? 0.95 : 0.7,
      });
    });

    const selectedRoute = this.routeOptions[index];
    this.rideForm.patchValue({
      route_coords: selectedRoute.coords,
      distance_km: selectedRoute.distanceKm,
    });

    if (this.routePolylines[index]) {
      this.map.fitBounds(this.routePolylines[index].getBounds(), { padding: [30, 30] });
    }
  }

  submit() {
    if (this.rideForm.invalid) return;
    this.errorMessage = null;

    const departureDate = this.rideForm.value.departure_date;
    const departureTime = this.rideForm.value.departure_time;

    const departureDateTime = new Date(`${departureDate}T${departureTime}`);
    const now = new Date();

    if (departureDateTime <= now) {
      this.errorMessage = 'Impossible de creer un ride : heure de depart deja depassee.';
      return;
    }

    this.loading = true;

    const basePayload = {
      ...this.rideForm.value,
      route_coords: this.rideForm.value.route_coords || null,
      distance_km: this.rideForm.value.distance_km || null,
      status: this.userRole === 'CLIENT' ? 'PROPOSED' : 'OPEN',
    };
    const isProposed = basePayload.status === 'PROPOSED';

    const payload = isProposed
      ? {
          ...basePayload,
          proposer: this.user.id,
          driver: null,
        }
      : {
          ...basePayload,
          driver: this.user.id,
          proposer: null,
        };

    this.service.createRide(payload).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/home']).then(() => {
          window.location.reload();
        });
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Erreur lors de la creation du ride';
      },
    });
  }

  private suggestCurrentLocationAsStart(force = false) {
    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation || !this.map) {
      return;
    }

    if (this.locationSuggestionTried && !force) {
      return;
    }

    const hasStartValue = !!String(this.rideForm?.value?.from_city ?? '').trim();
    if (!force && (this.startPoint || hasStartValue)) {
      return;
    }

    this.locationSuggestionTried = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };

        this.startPoint = point;
        this.updateMarker('START', point);
        this.reverseGeocodeAndPatch(point, 'from_city');

        // Focus map on suggested departure location.
        this.map.setView([point.lat, point.lon], 13);
      },
      () => {
        // If permission is denied or unavailable, keep current behavior.
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private getRouteSignature(coords: [number, number][]): string {
    if (!coords.length) return '';
    const first = coords[0];
    const mid = coords[Math.floor(coords.length / 2)];
    const last = coords[coords.length - 1];
    return [
      `${first[0].toFixed(5)},${first[1].toFixed(5)}`,
      `${mid[0].toFixed(5)},${mid[1].toFixed(5)}`,
      `${last[0].toFixed(5)},${last[1].toFixed(5)}`,
      String(coords.length),
    ].join('|');
  }

  private findFirstUnsavedRouteIndex(
    routes: Array<{ coords: [number, number][] }>
  ): number {
    for (let i = 0; i < routes.length; i++) {
      const signature = this.getRouteSignature(routes[i].coords);
      if (!this.savedRouteSignatures.has(signature)) {
        return i;
      }
    }
    return -1;
  }
}

