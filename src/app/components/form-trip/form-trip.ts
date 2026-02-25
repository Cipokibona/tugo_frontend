import { Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { ServiceApi } from '../../services/service-api';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-form-trip',
  imports: [ReactiveFormsModule],
  templateUrl: './form-trip.html',
  styleUrl: './form-trip.scss',
})
export class FormTrip implements OnInit {

  rideForm!: FormGroup;
  userRole: 'DRIVER' | 'CLIENT' = 'DRIVER';
  platformId = inject(PLATFORM_ID);
  map: any;
  private L: any;
  routeLayer: any;
  loading = false;
  errorMessage: string | null = null;

  user: any | null = null;

  constructor(
    private location: Location,
    private fb: FormBuilder,
    private service: ServiceApi,
    private http: HttpClient,
    private router: Router
  ) {}

  // async initMap() {
  //   if (!isPlatformBrowser(this.platformId)) return;

  //   this.L = await import('leaflet');

  //   // Hauteur responsive
  //   const mapDiv = document.getElementById('map');
  //   if (mapDiv) {
  //     const height = Math.min(window.innerHeight * 0.35, 450);
  //     mapDiv.style.height = `${height}px`;
  //   }

  //   this.map = this.L.map('map', { zoomControl: false }).setView([-3.38, 29.36], 7);

  //   this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
  //     .addTo(this.map);

  //   this.routeLayer = this.L.layerGroup().addTo(this.map);

  //   setTimeout(() => this.map.invalidateSize(), 200);
  // }

  goBack(): void {
    this.location.back();
  }

  ngOnInit() {
    this.getUser();
    this.initForm();
  }

  // ngAfterViewInit() {
  //   this.initMap();
  // }

  getUser(){
    this.service.getUser().subscribe({
      next:user=>{
        this.user=user;
        console.log("utilisateur connecte",this.user);
      },
      error: err =>console.log("erreur pour l'utilisateur connecte",err)
    })
  }

  initForm() {
    this.rideForm = this.fb.group({
      from_city: ['', Validators.required],
      to_city: ['', Validators.required],
      departure_date: ['', Validators.required],
      departure_time: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(1)]],
      available_seats: [1, Validators.required],
      vehicule: ['', Validators.required],
      note: [''],
      status: ['OPEN']
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

  // Charger l’itinéraire et choisir la meilleure route
  loadRoute() {
    if (!this.L || !this.map) return;

    const { from_city, to_city } = this.rideForm.value;
    if (!from_city || !to_city) return;

    // 1️⃣ Geocoding pour obtenir plusieurs options de départ/arrivée
    const from$ = this.http.get<any>(`https://nominatim.openstreetmap.org/search?q=${from_city}&format=json`);
    const to$ = this.http.get<any>(`https://nominatim.openstreetmap.org/search?q=${to_city}&format=json`);

    forkJoin([from$, to$]).subscribe(([startOptions, endOptions]) => {
      if (!startOptions.length || !endOptions.length) return;

      // Ici tu peux choisir la première option, ou implémenter une logique pour choisir
      const start = startOptions[0];
      const end = endOptions[0];

      const startLatLng = this.L.latLng(start.lat, start.lon);
      const endLatLng = this.L.latLng(end.lat, end.lon);

      this.routeLayer.clearLayers();
      this.L.marker(startLatLng).addTo(this.routeLayer);
      this.L.marker(endLatLng).addTo(this.routeLayer);

      // 2️⃣ Utiliser OSRM pour récupérer plusieurs routes possibles
      this.http.get<any>(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`)
        .subscribe(osrmData => {
          if (!osrmData.routes || !osrmData.routes.length) return;

          // Choisir la première route pour l’exemple
          const chosenRoute = osrmData.routes[0].geometry.coordinates; // [[lon, lat], ...]

          // Transformer en LatLng pour Leaflet
          const latLngRoute = chosenRoute.map((c: [number, number]) => this.L.latLng(c[1], c[0]));

          // Ajouter polyline
          this.L.polyline(latLngRoute, { color: 'blue', weight: 4 }).addTo(this.routeLayer);

          // Fit bounds
          const bounds = this.L.latLngBounds(latLngRoute);
          this.map.fitBounds(bounds, { padding: [30, 30] });

          // Enregistrer route pour GeoDjango
          this.rideForm.patchValue({
            route_coords: chosenRoute // lon/lat pour backend
          });

          setTimeout(() => this.map.invalidateSize(), 200);
        });
    });
  }

  submit() {
    if (this.rideForm.invalid) return;

    const departureDate = this.rideForm.value.departure_date;
    const departureTime = this.rideForm.value.departure_time;

    // Construire une vraie date complète (date + heure)
    const departureDateTime = new Date(`${departureDate}T${departureTime}`);
    const now = new Date();

    // Vérifier si le temps de départ est déjà passé
    if (departureDateTime <= now) {
      this.errorMessage = 'Impossible de créer un ride : l’heure de départ est déjà dépassée.';
      return;
    }

    this.loading = true;

    // Envoyer la route choisie au backend
    const basePayload = {
      ...this.rideForm.value,
      status: this.userRole === 'CLIENT' ? 'PROPOSED' : 'OPEN',
    };

    const payload = this.userRole === 'CLIENT'
      ? {
          ...basePayload,
          proposer: this.user.id,
        }
      : {
          ...basePayload,
          driver: this.user.id,
        };
    console.log('Payload pour création de ride:', payload);
    this.service.createRide(payload).subscribe({
      next: () => {
        this.loading = false;
        console.log('Ride créé avec succès');
        // redirection vers home
        this.router.navigate(['/home']).then(() => {
          window.location.reload();
          console.log('Navigation to /home successful');
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Erreur lors de la création du ride';
        console.error('Erreur lors de la création du ride', err);
      }
    });
  }

}
