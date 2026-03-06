import { AfterViewInit, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { ServiceApi } from '../../services/service-api';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-details-trip',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './details-trip.html',
  styleUrl: './details-trip.scss',
})
export class DetailsTrip implements OnInit, AfterViewInit, OnDestroy {
  ride: any | null = null;
  user: any | null = null;
  currentRideId: number | null = null;
  currentRideShareCode: string | null = null;

  bookings: any[] = [];

  loading = false;
  loadingBooking = false;
  cancellingBooking = false;
  cancellingRide = false;
  errorPage: any | null = null;
  errorMessage: string | null = null;
  shareMessage: string | null = null;

  selectedSeats = 1;
  proposedJoinRole: 'CLIENT' | 'DRIVER' = 'CLIENT';
  proposedDriverSeats = 1;
  proposedDriverDepartureTime = '';
  proposedDriverPrice = 0;

  showInvoice = false;
  invoiceData: any = null;

  today: Date = new Date();
  platformId = inject(PLATFORM_ID);

  map: any;
  private L: any;
  routeLayer: any;

  constructor(
    private service: ServiceApi,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
  ) {}

  async ngAfterViewInit() {
    this.renderRideRoute();
  }

  ngOnInit() {
    const shareCode = this.route.snapshot.paramMap.get('shareCode');
    this.currentRideShareCode = shareCode ? decodeURIComponent(shareCode) : null;

    this.getUser();
    this.getRideDetails();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  async initMap() {
    if (!isPlatformBrowser(this.platformId)) return;
    const container = document.getElementById('ride-map');
    if (!container) return;
    if (this.map) return;

    this.L = await import('leaflet');
    this.map = this.L.map('ride-map', { zoomControl: true }).setView([-3.38, 29.36], 7);
    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.routeLayer = this.L.layerGroup().addTo(this.map);
    setTimeout(() => this.map.invalidateSize(), 200);
  }

  async ensureMapReady(retries = 5, delayMs = 120): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      await this.initMap();
      if (this.map && this.L && this.routeLayer) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return false;
  }

  async renderRideRoute() {
    if (!this.ride?.route_coords?.length) return;
    const ready = await this.ensureMapReady();
    if (!ready || !this.map || !this.L || !this.routeLayer) return;

    const coords = this.ride.route_coords as [number, number][];
    const latLngRoute = coords
      .filter((point) => Array.isArray(point) && point.length === 2)
      .map((point) => this.L.latLng(point[1], point[0]));

    if (!latLngRoute.length) return;

    this.routeLayer.clearLayers();
    this.L.polyline(latLngRoute, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.95,
    }).addTo(this.routeLayer);

    this.L.circleMarker(latLngRoute[0], { radius: 6, color: '#16a34a' }).addTo(this.routeLayer);
    this.L.circleMarker(latLngRoute[latLngRoute.length - 1], { radius: 6, color: '#dc2626' }).addTo(this.routeLayer);

    const bounds = this.L.latLngBounds(latLngRoute);
    this.map.fitBounds(bounds, { padding: [30, 30] });
    setTimeout(() => this.map.invalidateSize(), 120);
  }

  getUser() {
    this.service.getUser().subscribe({
      next: user => {
        this.user = user;
        console.log('utilisateur connecte', this.user);
      },
      error: err => console.log("erreur pour l'utilisateur connecte", err)
    });
  }

  getRideDetails() {
    if (!this.currentRideShareCode) return;

    this.loading = true;
    this.service.getRideDetailsByShareCode(this.currentRideShareCode).subscribe({
      next: ride => {
        this.ride = ride;
        this.currentRideId = ride?.id ?? null;
        if (!this.proposedDriverDepartureTime) {
          this.proposedDriverDepartureTime = ride?.departure_time || '';
        }
        if (!this.proposedDriverPrice) {
          this.proposedDriverPrice = Number(ride?.price || 0);
        }
        this.loading = false;
        this.renderRideRoute();
        this.getBookings();
        console.log('Details de la course', this.ride);
      },
      error: err => {
        const fallbackId = Number(this.currentRideShareCode);
        if (!Number.isNaN(fallbackId) && fallbackId > 0) {
          this.currentRideId = fallbackId;
          this.service.getRideDetails(fallbackId).subscribe({
            next: (rideFallback) => {
              this.ride = rideFallback;
              this.currentRideShareCode = rideFallback?.share_code || String(fallbackId);
              if (!this.proposedDriverDepartureTime) {
                this.proposedDriverDepartureTime = rideFallback?.departure_time || '';
              }
              if (!this.proposedDriverPrice) {
                this.proposedDriverPrice = Number(rideFallback?.price || 0);
              }
              this.loading = false;
              this.renderRideRoute();
              this.getBookings();
            },
            error: () => {
              this.errorPage = 'Erreur lors de la recuperation des details de la course';
              this.loading = false;
            }
          });
          return;
        }
        this.errorPage = 'Erreur lors de la recuperation des details de la course';
        this.loading = false;
        console.log('Erreur pour les details de la course', err);
      }
    });
  }

  getBookings() {
    if (!this.currentRideId) return;

    this.service.getBookings().subscribe({
      next: bookings => {
        this.bookings = bookings.filter((b: any) =>
          b.ride === this.currentRideId && b.status !== 'CANCELLED'
        );
        console.log('Reservations pour cette course', bookings);
      },
      error: err => {
        console.log('Erreur pour les reservations de la course', err);
      }
    });
  }

  prixFinal(prix: number): number {
    const TVA = 0.18;
    const commissionRate = 0.10;

    const commission = prix * commissionRate;
    const tvaSurCommission = commission * TVA;

    return prix + commission + tvaSurCommission;
  }

  goBack(): void {
    this.location.back();
  }

  isDriver(): boolean {
    return this.ride?.driver === this.user?.id;
  }

  isProposedRide(): boolean {
    return this.ride?.status === 'PROPOSED';
  }

  isProposer(): boolean {
    return this.ride?.proposer === this.user?.id;
  }

  // get joinedUsersCount(): number {
  //   const joined = this.bookings.filter(
  //     booking => booking.status !== 'CANCELLED' && booking.status !== 'CLOSED'
  //   );
  //   return new Set(joined.map(booking => booking.passenger)).size;
  // }

  get joinedUsersCount(): number {
    const joined = this.bookings.filter(
      booking => booking.status !== 'CANCELLED' && booking.status !== 'CLOSED'
    );

    const uniquePassengers = new Set(
      joined.map(booking => booking.passenger)
    ).size;

    // +1 pour inclure le proposer
    return uniquePassengers + 1;
  }

  hasJoinedRide(): boolean {
    if (!this.user) return false;
    return this.bookings.some(
      booking =>
        booking.passenger === this.user.id &&
        booking.status !== 'CANCELLED' &&
        booking.status !== 'CLOSED'
    );
  }

  get userBookedSeatsCount(): number {
    if (!this.user) return 0;
    return this.bookings.filter(
      booking =>
        booking.passenger === this.user.id &&
        booking.status !== 'CANCELLED' &&
        booking.status !== 'CLOSED'
    ).length;
  }

  setProposedJoinRole(role: 'CLIENT' | 'DRIVER') {
    this.proposedJoinRole = role;
  }

  refreshRideAndBookings() {
    this.getRideDetails();
  }

  cancelMyBookings() {
    if (!this.user || this.cancellingBooking) return;

    const myBookings = this.bookings.filter(
      booking => booking.passenger === this.user.id && booking.status !== 'CANCELLED'
    );
    if (myBookings.length === 0) return;

    const confirmed = window.confirm(`Cancel your ${myBookings.length} booked seat(s) for this ride?`);
    if (!confirmed) return;

    this.cancellingBooking = true;
    this.errorMessage = null;

    const requests = myBookings.map(booking => this.service.cancelBooking(booking.id));
    forkJoin(requests).subscribe({
      next: () => {
        const bookingIds = new Set(myBookings.map(booking => booking.id));
        this.bookings = this.bookings.map(booking =>
          bookingIds.has(booking.id) ? { ...booking, status: 'CANCELLED' } : booking
        );
        this.bookings = this.bookings.filter(booking => booking.status !== 'CANCELLED');
        this.cancellingBooking = false;
      },
      error: () => {
        this.errorMessage = 'Unable to cancel your booking. Please try again.';
        this.cancellingBooking = false;
      }
    });
  }

  cancelRide() {
    if (!this.ride?.id || this.cancellingRide) return;

    const confirmed = window.confirm('Are you sure you want to cancel this ride?');
    if (!confirmed) return;

    this.cancellingRide = true;
    this.errorMessage = null;

    this.service.cancelRide(this.ride.id).subscribe({
      next: (updatedRide) => {
        this.ride = updatedRide || { ...this.ride, status: 'CANCELLED' };
        this.cancellingRide = false;
      },
      error: () => {
        this.errorMessage = 'Unable to cancel this ride. Please try again.';
        this.cancellingRide = false;
      }
    });
  }

  bookRide() {
    if (!this.ride) return;
    if (this.isProposedRide()) {
      if (this.proposedJoinRole === 'DRIVER') {
        this.joinProposalAsDriver();
      } else {
        this.joinProposalAsClient();
      }
      return;
    }

    const seatsToBook = this.selectedSeats;
    if (!seatsToBook || seatsToBook <= 0) return;

    this.loadingBooking = true;

    const bookingsToCreate: any[] = [];

    for (let i = 0; i < seatsToBook; i++) {
      bookingsToCreate.push({
        ride: this.ride.id,
        passenger: this.user?.id,
        status: 'CONFIRMED',
      });
    }

    const bookingRequests = bookingsToCreate.map(b => this.service.createBooking(b));

    forkJoin(bookingRequests).subscribe({
      next: (results) => {
        console.log('Bookings successful', results);

        this.bookings.push(...(results as any[]));

        this.invoiceData = {
          ride: this.ride,
          passenger: this.user?.first_name || this.user?.username,
          seats: seatsToBook,
          pricePerSeat: this.prixFinal(Number(this.ride.price)),
          total: (this.prixFinal(Number(this.ride.price)) * seatsToBook)
        };

        this.showInvoice = true;
        this.selectedSeats = 1;
        this.loadingBooking = false;
        this.refreshRideAndBookings();
      },
      error: (err) => {
        console.error('Error creating bookings', err);
        this.errorMessage = 'Erreur lors de la reservation, veuillez reessayer.';
        this.loadingBooking = false;
      }
    });
  }

  joinProposalAsClient() {
    if (!this.ride || !this.user || this.loadingBooking || this.hasJoinedRide()) return;

    this.loadingBooking = true;
    this.errorMessage = null;

    const payload = {
      ride: this.ride.id,
      passenger: this.user.id,
      status: 'PENDING',
    };

    this.service.createBooking(payload).subscribe({
      next: (booking) => {
        this.bookings = [...this.bookings, booking];
        this.loadingBooking = false;
        this.refreshRideAndBookings();

        // Keep proposal status in background to avoid blocking UI state.
        this.service.patchRide(this.ride!.id, { status: 'PROPOSED' }).subscribe({
          next: (updatedRide) => {
            this.ride = updatedRide || { ...this.ride, status: 'PROPOSED' };
          },
          error: (err) => {
            console.error('Error forcing ride status to PROPOSED', err);
            this.errorMessage = 'Booking created but unable to keep ride as PROPOSED.';
          }
        });
      },
      error: (err) => {
        console.error('Error joining proposal as client', err);
        this.errorMessage = 'Unable to join this proposal as client.';
        this.loadingBooking = false;
      }
    });
  }

  async notifyJoinedUsersForNewRide(newRide: any) {
    if (!this.ride || !this.user) return;

    try {
      const joinedUserIds = Array.from(new Set(
        this.bookings
          .filter((booking: any) => booking.status !== 'CANCELLED' && booking.status !== 'CLOSED')
          .map((booking: any) => booking.passenger)
      ));

      const recipientIds = Array.from(new Set([
        ...joinedUserIds,
        this.ride.proposer,
      ].filter((id: any) => !!id))).filter((id: any) => id !== this.user?.id);

      if (recipientIds.length === 0) return;

      const title = `New ride available: ${newRide.from_city} -> ${newRide.to_city}`;
      const tripLink = `/details-trip/${newRide.share_code || newRide.id}`;
      const message = `A driver created a new ride from your proposal. Departure: ${newRide.departure_date} at ${newRide.departure_time}. Price: ${newRide.price} BIF. Open this trip: ${tripLink}`;

      const requests = recipientIds.map((recipientId: number) =>
        this.service.createNotification({
          recipient: recipientId,
          title,
          message,
          notification_type: 'RIDE_AVAILABLE',
        })
      );

      await firstValueFrom(forkJoin(requests));
    } catch (error) {
      console.error('Unable to send new-ride notifications', error);
    }
  }

  async joinProposalAsDriver() {
    if (!this.ride || !this.user || this.loadingBooking) return;
    if (!this.proposedDriverSeats || this.proposedDriverSeats <= 0) return;
    if (!this.proposedDriverDepartureTime) return;
    if (!this.proposedDriverPrice || this.proposedDriverPrice <= 0) return;

    this.loadingBooking = true;
    this.errorMessage = null;

    let createdRide: any | null = null;
    try {
      const ridePayload = {
        from_city: this.ride.from_city,
        to_city: this.ride.to_city,
        departure_date: this.ride.departure_date,
        departure_time: this.proposedDriverDepartureTime,
        price: this.proposedDriverPrice,
        available_seats: this.proposedDriverSeats,
        distance_km: this.ride.distance_km,
        additional_info: this.ride.additional_info || null,
        vehicule: this.ride.vehicule || 'To be defined',
        note: this.ride.note || null,
        driver: this.user.id,
        proposer: this.ride.proposer || null,
        status: 'OPEN',
      };

      createdRide = await firstValueFrom(this.service.createRide(ridePayload));
    } catch (err) {
      console.error('Error joining proposal as driver', err);
      this.errorMessage = 'Unable to create ride from proposal.';
    } finally {
      this.loadingBooking = false;
    }

    if (createdRide?.id) {
      await this.notifyJoinedUsersForNewRide(createdRide);
      this.router.navigate(['/home']);
    }
  }

  goHome() {
    this.showInvoice = false;
    this.router.navigate(['/home']);
  }

  shareRideLink() {
    if (!isPlatformBrowser(this.platformId) || !this.ride) return;

    const shareCode = this.ride?.share_code || this.currentRideShareCode;
    if (!shareCode) return;

    const shareUrl = `${window.location.origin}/details-trip/${encodeURIComponent(shareCode)}`;
    const title = `${this.ride.from_city} -> ${this.ride.to_city}`;
    const text = `Trip details: ${title}`;

    const nav: any = navigator;
    if (nav?.share) {
      nav.share({ title, text, url: shareUrl })
        .then(() => {
          this.shareMessage = 'Link shared.';
        })
        .catch(() => {
          // User cancellation is expected here.
        });
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.shareMessage = 'Link copied to clipboard.';
      }).catch(() => {
        this.shareMessage = `Copy this link: ${shareUrl}`;
      });
      return;
    }

    this.shareMessage = `Copy this link: ${shareUrl}`;
  }

  downloadInvoice() {
    if (!this.invoiceData) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const leftMargin = 20;
    let y = 20;

    const logo = new Image();
    logo.src = '/logo_tugo.png';
    logo.onload = () => {
      doc.addImage(logo, 'PNG', leftMargin, y, 30, 30);

      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Facture Tugo', 105, y + 15, { align: 'center' });

      y += 35;

      const now = new Date();
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, leftMargin, y);

      y += 10;

      doc.setTextColor(0);
      doc.text(`Passenger: ${this.invoiceData.passenger}`, leftMargin, y);
      doc.text(`Seats reserved: ${this.invoiceData.seats}`, 120, y);
      y += 10;

      doc.text(`Ride: ${this.invoiceData.ride.from_city} -> ${this.invoiceData.ride.to_city}`, leftMargin, y);
      doc.text(`Departure: ${this.invoiceData.ride.departure_date} at ${this.invoiceData.ride.departure_time}`, 120, y);
      y += 10;

      doc.text(`Price / seat: ${this.invoiceData.pricePerSeat.toFixed(2)} BIF`, leftMargin, y);
      doc.setFontSize(14);
      doc.setTextColor(255, 114, 0);
      doc.text(`Total: ${this.invoiceData.total.toFixed(2)} BIF`, 120, y);
      y += 15;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Please be on time for your ride.', leftMargin, y);
      y += 5;
      doc.text('Thank you for choosing Tugo!', leftMargin, y);

      doc.save(`Invoice_${this.invoiceData.ride.id}_${this.invoiceData.passenger}.pdf`);
    };
  }
}
