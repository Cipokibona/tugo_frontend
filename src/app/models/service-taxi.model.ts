import { Taxi } from './taxi.model';

export interface ServiceTaxi {
  id: number;
  taxi?: number;
  taxi_details?: Taxi;
  client?: number;
  client_username?: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date?: string;
  pickup_time?: string;
  price?: number;
  distance_km?: number;
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}
