export interface Taxi {
  id: number;
  driver: number;
  driver_username?: string;
  license_plate_number: string;
  vehicle_model: string;
  number_of_seats: number;
  image?: string;
  color?: string;
  vehicle_year?: number;
  additional_details?: string;
  latitude?: number;
  longitude?: number;
  location_label?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
