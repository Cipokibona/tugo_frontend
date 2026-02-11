import { Component, OnInit } from '@angular/core';
import { ServiceApi } from '../../services/service-api';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  errorPage: any | null = null;

  selectedSeats = 1;

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


}
