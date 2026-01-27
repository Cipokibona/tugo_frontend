import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject,Injectable } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { jwtDecode as jwt_decode } from 'jwt-decode';
import { User } from '../models/user.model';

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

  private userUrl = `${this.url}users/`;
  private driverUrl = `${this.url}drivers-profiles/`;

  private rideUrl = `${this.url}rides/`;
  private bookingUrl = `${this.url}bookings/`;

  private conversationUrl = `${this.url}conversations/`;
  private messageUrl = `${this.url}messages/`;

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

  getToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  }

  getRefreshToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  }

  refreshToken(): Observable<void> {
  const refreshToken = this.getRefreshToken();
  if (!refreshToken) return throwError(() => new Error('No refresh token found'));

  return this.http.post<{ access: string }>(`${this.url}token/refresh/`, { refresh: refreshToken }).pipe(
    tap(response => {
      localStorage.setItem('token', response.access);
    }),
    map(() => {})
  );
}

  // getTotal():Observable<any> {
  //   const token = this.getToken();
  //   if (!token) {
  //     return throwError(() => new Error('No token found'));
  //   }
  //   const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  //   return this.http.get<any>(`${this.enterpriseUrl}`, { headers });
  // }

  // USERS
  getUser(): Observable<any> {
  const token = this.getToken();
  if (!token) return throwError(() => new Error('No token found'));

  let decoded: any;
  try {
    decoded = jwt_decode(token);
  } catch {
    return throwError(() => new Error('Invalid token'));
  }

  const userId = decoded.user_id; // ou selon le champ de ton token
  if (!userId) return throwError(() => new Error('User ID not found in token'));

  const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

  return this.http.get(`${this.userUrl}${userId}/`, { headers }).pipe(
    catchError(error => {
      if (error.status === 401) {
        return this.refreshToken().pipe(
          switchMap(() => {
            const newToken = this.getToken();
            if (!newToken) return throwError(() => new Error('Token refresh failed'));
            const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
            return this.http.get(`${this.userUrl}${userId}/`, { headers: newHeaders });
          })
        );
      }
      return throwError(() => error);
    })
  );
}

  getUsers(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.userUrl}`, { headers });
  }

  createUser(data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(this.registerUrl, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.post<any>(this.registerUrl, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  updateUser(userId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.userUrl}${userId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.put<any>(`${this.userUrl}${userId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  deactivateUser(userId: number,data:any){
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.patch<User>(`${this.userUrl}${userId}/`, data , { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.patch<User>(`${this.userUrl}${userId}/`, data , { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // DRIVERS PROFILES
  getDriver(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.driverUrl}`, { headers });
  }

  createDriver(data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(this.driverUrl, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.post<any>(this.driverUrl, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  updateDriver(driveId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.driverUrl}${driveId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.put<any>(`${this.driverUrl}${driveId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // RIDES
  getRides(): Observable<any> {
    const token = this.getToken();
    console.log('Retrieved token:', token);
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.rideUrl}`, { headers });
  }

  createRide(data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(this.rideUrl, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.post<any>(this.rideUrl, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  updateRide(rideId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.rideUrl}${rideId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.put<any>(`${this.rideUrl}${rideId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // BOOKINGS
  getBookings(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.bookingUrl}`, { headers });
  }

  createBooking(data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(this.bookingUrl, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.post<any>(this.bookingUrl, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  updateBooking(bookingId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.bookingUrl}${bookingId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.put<any>(`${this.bookingUrl}${bookingId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // CONVERSATIONS
  getConversations(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.conversationUrl}`, { headers });
  }

  createConversation(data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(this.conversationUrl, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.post<any>(this.conversationUrl, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  updateConversation(conversationId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.conversationUrl}${conversationId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.put<any>(`${this.conversationUrl}${conversationId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // MESSAGES
  getMessages(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.messageUrl}`, { headers });
  }

  createMessage(data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(this.messageUrl, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.post<any>(this.messageUrl, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  updateMessage(messageId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.messageUrl}${messageId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.put<any>(`${this.messageUrl}${messageId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

}
