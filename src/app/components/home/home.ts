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

  getRides(){
    this.loading = true;
    this.service.getRides().subscribe({
      next: (data: any) => {
        this.rides = data;
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
