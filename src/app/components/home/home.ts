import { Component, OnInit } from '@angular/core';
import { ServiceApi } from '../../services/service-api';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  rides: any[] = [];
  usersRides: any[] = [];
  proposedRides: any[] = [];
  ridesOpen: any[] = [];

  bookings: any[] = [];
  userBookings: any[] = [];

  user: any | null = null;

  loading = false;
  loadingBookings = false;
  errorPage: any | null = null;
  bookingError: string | null = null;

  activeTab: 'ALL' | 'USER' | 'PROPOSED' = 'ALL';

  filteredRides: any[] = [];
  filters = {
    from: '',
    to: '',
    date: null,
  };

  constructor(
    private service: ServiceApi,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'ALL' || tab === 'USER' || tab === 'PROPOSED') {
      this.activeTab = tab;
    }

    // this.getUser();
    // this.getRides();
    this.loadInitialData();
  }

  loadInitialData() {
    this.loading = true;
    this.loadingBookings = true;

    forkJoin({
      user: this.service.getUser(),
      rides: this.service.getRides(),
      bookings: this.service.getBookings()
    }).subscribe({
      next: ({ user, rides, bookings }) => {

        // ✅ user
        this.user = user;

        // ✅ rides
        this.filteredRides = rides || [];
        this.rides = this.filteredRides.filter(r => r.status === 'OPEN');

        // ✅ bookings
        this.bookings = bookings || [];

        // ✅ mapping seulement quand tout est prêt
        this.mapUserBookingsToRides();
        this.applyRideFilter();

        this.loading = false;
        this.loadingBookings = false;
      },
      error: (error) => {
        if (error?.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        this.errorPage = error?.detail || 'Error loading page';
        this.loading = false;
        this.loadingBookings = false;
      }
    });
  }

  transform(data: string): string {
    if (!data) return data;
    return data.charAt(0).toUpperCase() + data.slice(1);
  }

  getUser() {
    this.service.getUser().subscribe({
      next: user => {
        this.user = user;
        this.applyRideFilter();
        this.getBookingsForCurrentUser();
      },
      error: err => {
        if (err?.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        console.log("erreur pour l'utilisateur connecte", err);
      }
    });
  }

  getRides() {
    this.loading = true;
    this.service.getRides().subscribe({
      next: (data: any[]) => {
        this.filteredRides = data || [];
        this.rides = this.filteredRides.filter(r => r.status === 'OPEN');

        this.applyRideFilter();
        this.mapUserBookingsToRides();
        this.loading = false;
      },
      error: (error: any) => {
        this.errorPage = error.detail;
        this.loading = false;
      }
    });
  }

  getBookingsForCurrentUser() {
    if (!this.user) return;

    this.loadingBookings = true;
    this.bookingError = null;

    this.service.getBookings().subscribe({
      next: (data: any[]) => {
        this.bookings = data || [];
        this.mapUserBookingsToRides();
        this.loadingBookings = false;
      },
      error: (error: any) => {
        this.bookingError = error?.detail || 'Unable to load your bookings';
        this.loadingBookings = false;
      }
    });
  }

  // mapUserBookingsToRides() {
  //   if (!this.user) {
  //     this.userBookings = [];
  //     return;
  //   }

  //   const ridesById = new Map(this.filteredRides.map(ride => [ride.id, ride]));

  //   this.userBookings = this.bookings
  //     .filter(booking => booking.passenger === this.user.id && booking.status !== 'CLOSED')
  //     .map(booking => ({
  //       ...booking,
  //       rideData: ridesById.get(booking.ride) || null,
  //     }));
  // }

  mapUserBookingsToRides() {
    if (!this.user) {
      this.userBookings = [];
      return;
    }

    const ridesById = new Map(this.filteredRides.map(ride => [ride.id, ride]));

    this.userBookings = this.bookings
      .filter(booking => {
        return (
          booking.passenger === this.user.id &&
          booking.status !== 'CLOSED' &&
          booking.status !== 'CANCELLED'
        );
      })
      .map(booking => ({
        ...booking,
        rideData: ridesById.get(booking.ride) || null,
      }));
  }

  applyRideFilter() {
    if (!this.user) {
      this.rides = [];
      return;
    }

    switch (this.activeTab) {
      case 'USER':
        this.rides = this.filteredRides.filter(
          ride => ride.driver === this.user.id && ride.status === 'OPEN'
        );
        break;

      case 'PROPOSED':
        this.rides = this.filteredRides.filter(
          ride => ride.status === 'PROPOSED'
        );
        break;

      default:
        this.rides = this.filteredRides.filter(ride => ride.status === 'OPEN');
    }
  }

  isMyRide(ride: any): boolean {
    return this.user && ride.driver === this.user.id;
  }

  joinedUsersCount(rideId: number): number {
    const joined = this.bookings.filter(
      booking => booking.ride === rideId && booking.status !== 'CANCELLED'
    );
    return new Set(joined.map(booking => booking.passenger)).size;
  }

  hasJoinedProposal(rideId: number): boolean {
    if (!this.user) return false;
    const ride = this.filteredRides.find(r => r.id === rideId);
    const isProposer = ride?.proposer === this.user.id;
    console.log(`User ${this.user.id} checking if joined proposal for ride ${ride?.proposer}: isProposer=${ride?.proposer}`, ride);

    if (ride?.proposer === this.user.id) return true;

    return this.bookings.some(
      booking =>
        booking.ride === rideId &&
        booking.passenger === this.user.id &&
        booking.status !== 'CANCELLED' &&
        booking.status !== 'CLOSED'
    );
  }

  prixFinal(prix: number): number {
    const TVA = 0.18;
    const commissionRate = 0.10;

    const commission = prix * commissionRate;
    const tvaSurCommission = commission * TVA;

    return prix + commission + tvaSurCommission;
  }
}
