import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject,Injectable } from '@angular/core';
import { tap } from 'rxjs';
interface TokenResponse {
  access: string;
  refresh: string;
}

@Injectable({
  providedIn: 'root',
})
export class ServiceApi {

  private http = inject(HttpClient);
  private url = 'http://127.0.0.1:8000/api/';

  private token: string | null = null;

  private tokenUrl = `${this.url}token/`;
  private refreshUrl = `${this.url}token/refresh/`;
  private registerUrl = `${this.url}register/`;

   constructor() { }

  login(username: string, password: string) {
    return this.http.post<{ access: string; refresh: string }>(this.tokenUrl, { username, password })
      .pipe(tap(response => {
        this.token = response.access;
        localStorage.setItem('token', this.token);
        localStorage.setItem('refresh_token', response.refresh);
      }));
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  }

}

