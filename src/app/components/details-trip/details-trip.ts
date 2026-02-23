import { Component, OnInit } from '@angular/core';
import { ServiceApi } from '../../services/service-api';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-details-trip',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './details-trip.html',
  styleUrl: './details-trip.scss',
})
export class DetailsTrip implements OnInit {
  ride: any | null = null;
  user: any | null = null;
  currentRideId: number | null = null;

  bookings: any[] = [];

  loading = false;
  loadingBooking = false;
  cancellingBooking = false;
  cancellingRide = false;
  errorPage: any | null = null;
  errorMessage: string | null = null;

  selectedSeats = 1;

  showInvoice = false;
  invoiceData: any = null;

  today: Date = new Date();

  constructor(
    private service: ServiceApi,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit() {
    const rideId = Number(this.router.url.split('/').pop());
    this.currentRideId = Number.isNaN(rideId) ? null : rideId;

    this.getUser();
    this.getRideDetails();
    this.getBookings();
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
    if (!this.currentRideId) return;

    this.loading = true;
    this.service.getRideDetails(this.currentRideId).subscribe({
      next: ride => {
        this.ride = ride;
        this.loading = false;
        console.log('Details de la course', this.ride);
      },
      error: err => {
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

  get userBookedSeatsCount(): number {
    if (!this.user) return 0;
    return this.bookings.filter(
      booking => booking.passenger === this.user.id && booking.status !== 'CANCELLED'
    ).length;
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
    if (!this.ride || !this.selectedSeats || this.selectedSeats <= 0) return;

    this.loadingBooking = true;

    const bookingsToCreate: any[] = [];

    for (let i = 0; i < this.selectedSeats; i++) {
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
          seats: this.selectedSeats,
          pricePerSeat: this.prixFinal(Number(this.ride.price)),
          total: (this.prixFinal(Number(this.ride.price)) * this.selectedSeats)
        };

        this.showInvoice = true;
        this.selectedSeats = 1;
        this.loadingBooking = false;
      },
      error: (err) => {
        console.error('Error creating bookings', err);
        this.errorMessage = 'Erreur lors de la reservation, veuillez reessayer.';
        this.loadingBooking = false;
      }
    });
  }

  goHome() {
    this.showInvoice = false;
    this.router.navigate(['/home']);
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
