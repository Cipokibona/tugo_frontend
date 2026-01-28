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

  filteredRides: any[] = [];
  filters = {
    from: '',
    to: '',
    date: null,
  };

  constructor(private service: ServiceApi, private router: Router) {}

  ngOnInit() {
    this.getRides();
  }

  transform(data: string) : string {
    if (!data) return data; // Verifie si la donnée est vide ou null
    return data.charAt(0).toUpperCase() + data.slice(1);
  }

  getRides(){
    this.loading = true;
    this.service.getRides().subscribe({
      next: (data: any) => {
        this.rides = data;
        this.ridesOpen = this.rides.filter(ride => ride.status === 'OPEN');
        this.loading = false;
        console.log('Rides loaded:', this.rides);
      },
      error: (error: any) => {
        this.errorPage = error.detail;
        this.loading = false;
        console.error('Error loading rides:', error);
      }
    });
  }

}
