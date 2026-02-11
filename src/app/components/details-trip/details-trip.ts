import { Component, OnInit } from '@angular/core';
import { ServiceApi } from '../../services/service-api';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-details-trip',
  imports: [CommonModule, FormsModule],
  templateUrl: './details-trip.html',
  styleUrl: './details-trip.scss',
})
export class DetailsTrip implements OnInit{
  ride: any | null = null;
  user: any | null = null;

  bookings: any[] = [];

  loading = false;
  loadingBooking = false;
  errorPage: any | null = null;
  errorMessage: string | null = null;

  selectedSeats = 1;

  showInvoice = false;       // Flag pour afficher la facture
  invoiceData: any = null;   // Contiendra les infos de la facture

  today: Date = new Date();

  constructor(
    private service: ServiceApi,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit() {
    this.getUser();
    this.getRideDetails();
    this.getBookings();
  }

  getUser(){
    this.service.getUser().subscribe({
      next:user=>{
        this.user=user;
        console.log("utilisateur connecte",this.user);
        // this.applyRideFilter();
      },
      error: err =>console.log("erreur pour l'utilisateur connecte",err)
    })
  }

  getRideDetails(){
    const rideId = this.router.url.split('/').pop(); // Récupère l'ID de la course depuis l'URL
    if (rideId) {
      this.loading = true;
      this.service.getRideDetails(Number(rideId)).subscribe({
        next: ride => {
          this.ride = ride;
          this.loading = false;
          console.log("Détails de la course", this.ride);
        },
        error: err => {
          this.errorPage = "Erreur lors de la récupération des détails de la course";
          this.loading = false;
          console.log("Erreur pour les détails de la course", err);
        }
      });
    }
  }

  getBookings(){
    this.service.getBookings().subscribe({
      next: bookings => {
        this.bookings = bookings.filter((b: any) => b.ride === this.ride?.id);
        console.log("Réservations pour cette course", bookings);
      },
      error: err => {
        console.log("Erreur pour les réservations de la course", err);
      }
    })
  }

  prixFinal(prix: number): number{
    const TVA = 0.18; // 18% de TVA
    const commissionRate = 0.10; // 10% de commission

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

        // Ajouter les bookings localement pour mettre à jour le UI
        this.bookings.push(...bookingsToCreate);
          // Afficher la facture
          // Créer les données pour la facture
        this.invoiceData = {
          ride: this.ride,
          passenger: this.user?.first_name || this.user?.username,
          seats: this.selectedSeats,
          pricePerSeat: this.prixFinal(Number(this.ride.price)),
          total: (this.prixFinal(Number(this.ride.price)) * this.selectedSeats)
        };

        // Afficher la facture
        this.showInvoice = true;

        // Réinitialiser la sélection
        this.selectedSeats = 1;
        this.loadingBooking = false;
      },
      error: (err) => {
        console.error('Error creating bookings', err);
        this.errorMessage = 'Erreur lors de la réservation, veuillez réessayer.';
        this.loadingBooking = false;
      }
    });
  }

  goHome() {
    this.showInvoice = false; // ferme la modal si besoin
    this.router.navigate(['/home']); // redirige vers la home
  }

  downloadInvoice() {
    if (!this.invoiceData) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const leftMargin = 20;
    let y = 20;

    // Ajouter le logo
    const logo = new Image();
    logo.src = '/logo_tugo.png'; // chemin vers ton logo
    logo.onload = () => {
      doc.addImage(logo, 'PNG', leftMargin, y, 30, 30); // x, y, width, height

      // Header text
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Facture Tugo', 105, y + 15, { align: 'center' });

      y += 35;

      // Date et heure
      const now = new Date();
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, leftMargin, y);

      y += 10;

      // Passenger & seats
      doc.setTextColor(0);
      doc.text(`Passenger: ${this.invoiceData.passenger}`, leftMargin, y);
      doc.text(`Seats reserved: ${this.invoiceData.seats}`, 120, y);
      y += 10;

      // Ride & departure
      doc.text(`Ride: ${this.invoiceData.ride.from_city} → ${this.invoiceData.ride.to_city}`, leftMargin, y);
      doc.text(`Departure: ${this.invoiceData.ride.departure_date} at ${this.invoiceData.ride.departure_time}`, 120, y);
      y += 10;

      // Prices
      doc.text(`Price / seat: ${this.invoiceData.pricePerSeat.toFixed(2)} BIF`, leftMargin, y);
      doc.setFontSize(14);
      doc.setTextColor(255, 114, 0); // bleu pour le total
      doc.text(`Total: ${this.invoiceData.total.toFixed(2)} BIF`, 120, y);
      y += 15;

      // Message avertissement + remerciement
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Please be on time for your ride.', leftMargin, y);
      y += 5;
      doc.text('Thank you for choosing Tugo!', leftMargin, y);

      // Sauvegarder le PDF
      doc.save(`Invoice_${this.invoiceData.ride.id}_${this.invoiceData.passenger}.pdf`);
    };
  }


}
