import { Component, OnInit } from '@angular/core';
import { ServiceApi } from '../../services/service-api';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

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

  user: any | null = null;

  loading = false;
  errorPage: any | null = null;

  activeTab: 'ALL' | 'USER' | 'PROPOSED' = 'ALL';

  filteredRides: any[] = [];
  filters = {
    from: '',
    to: '',
    date: null,
  };

  constructor(private service: ServiceApi, private router: Router) {}

  ngOnInit() {
    this.getUser();
    this.getRides();
  }

  transform(data: string) : string {
    if (!data) return data; // Verifie si la donnée est vide ou null
    return data.charAt(0).toUpperCase() + data.slice(1);
  }

  getUser(){
    this.service.getUser().subscribe({
      next:user=>{
        this.user=user;
        console.log("utilisateur connecte",this.user);
        this.applyRideFilter(); //
      },
      error: err =>console.log("erreur pour l'utilisateur connecte",err)
    })
  }

  getRides(){
    this.loading = true;
    this.service.getRides().subscribe({
      next: (data: any[]) => {
        // this.rides = data || [];

        // uniquement les rides ouverts
        this.filteredRides = data || [];
        this.rides = this.filteredRides.filter(r => r.status === 'OPEN');

        this.applyRideFilter(); // 🔥
        this.loading = false;
        console.log('Rides récupérés avec succès', this.rides);
      },
      error: (error: any) => {
        this.errorPage = error.detail;
        this.loading = false;
        console.error(error);
      }
    });
  }

applyRideFilter() {
  if (!this.user) {
    // this.rides = this.filteredRides.filter(ride => ride.status === 'OPEN');
    this.rides = [];
    return;
  }

  switch (this.activeTab) {

    case 'USER':
      // Mes rides
      this.rides = this.filteredRides.filter(
        ride => ride.driver === this.user.id
      );
      break;

    case 'PROPOSED':
      // Rides des autres
      this.rides = this.filteredRides.filter(
        ride => ride.status === 'PROPOSED'
      );
      break;

    default:
      // Tous
      // this.rides = [...this.filteredRides];
      this.rides = this.filteredRides.filter(ride => ride.status === 'OPEN');
  }
}

isMyRide(ride: any): boolean {
  return this.user && ride.driver === this.user.id;
}


}
