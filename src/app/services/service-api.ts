import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject,Injectable } from '@angular/core';
import { Observable, of, tap, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { jwtDecode as jwt_decode } from 'jwt-decode';
import { User } from '../models/user.model';
import { Router } from '@angular/router';

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

   constructor(private router: Router) { }

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

  // getToken(): any | null {
  //   if (typeof window === 'undefined') {
  //       console.warn('Window is undefined - running on server-side');
  //       return null; // Environnement de serveur
  //   }

  //   const token = localStorage.getItem('token');
  //   console.log('Retrieved token from local storage:', token);

  //   if (!token) {
  //       console.warn('No token found in local storage');
  //       this.router.navigate(['/login']);
  //       return null;
  //   }

  //   // Vérifier si le token est expiré
  //   if (this.isAccessTokenExpired(token)) {
  //     console.log('le token est expire');
  //       return this.refreshToken().pipe(
  //           switchMap(():any => {
  //               // Une fois le token rafraîchi, retourner le nouveau token
  //               const newToken = localStorage.getItem('token');
  //               console.log('le new token:', newToken);
  //               if (!newToken) {
  //                 this.router.navigate(['/login']); // Redirection si le nouveau token n'est pas trouvé
  //                 return null;
  //               }
  //               console.log('new token:',newToken);
  //               return of(newToken); // Retourner le nouveau token
  //           }),
  //           catchError((err):any => {
  //               console.log('Error refreshing token:', err);
  //               this.router.navigate(['/login']);
  //               return null; // Retourner null en cas d'échec du rafraîchissement
  //           })
  //       );
  //   }
  //   console.log('Token is valid, returning existing token:',token);
  //   return token; // Retourne le token existant s'il n'est pas expiré
  // }

  getToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  }

  getRefreshToken(): string | null {
    return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  }

  isAccessTokenExpired(token: string): boolean {
    // Décodage du token (généralement au format JWT)
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Vérification de l'expiration
    const expirationTime = payload.exp * 1000; // Convertir en millisecondes
    return Date.now() >= expirationTime; // Renvoie true si le token est expiré
}

  // getRefreshToken(): string | null {
  //   // return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  //   if (typeof window === 'undefined') {
  //       console.warn('Window is undefined - running on server-side');
  //       return null; // Environnement de serveur
  //   }
  //   const refreshToken = localStorage.getItem('refresh_token');
  //   if (!refreshToken) {
  //       console.warn('No refresh token found in local storage');
  //   }
  //   return refreshToken;
  // }

  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
        this.router.navigate(['/login']); // Redirection si pas de token
        return throwError(() => new Error('No refresh token found'));
      }

      console.log('refreshToken:',refreshToken);
    // return this.http.post<{ access: string }>(`${this.refreshUrl}`, { refresh: refreshToken }).pipe(
    //   tap(response => {
    //     console.log('Response from refresh token API:', response);
    //     localStorage.setItem('token', response.access);
    //   }),
    //   map(() => {}),
    //   catchError(err => {
    //     console.error('Error refreshing token:', err);
    //     this.router.navigate(['/login']);
    //     return throwError(() => new Error('Error refreshing token'));
    //   })
    // );
    return this.http.post<{ access: string }>(this.refreshUrl, { refresh: refreshToken })
    .pipe(tap(response => {
      this.token = response.access;
      localStorage.setItem('token', this.token);
      console.log('Token refreshed successfully:', response.access);
    }),catchError(err => {
        console.error('Error refreshing token:', err);
        this.router.navigate(['/login']); // Redirigez vers la page de connexion si l'erreur se produit
        return throwError(() => new Error('Error refreshing token'));
    })
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
    } catch (error) {
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
     return this.http.post<any>(this.registerUrl, data).pipe(
      catchError(error => {
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
    return this.http.patch<any>(`${this.driverUrl}${driveId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.patch<any>(`${this.driverUrl}${driveId}/`, data, { headers: newHeaders });
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

  patchRide(rideId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.patch<any>(`${this.rideUrl}${rideId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.patch<any>(`${this.rideUrl}${rideId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  cancelRide(rideId: number): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.patch<any>(`${this.rideUrl}${rideId}/`, { status: 'CANCELLED' }, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.patch<any>(`${this.rideUrl}${rideId}/`, { status: 'CANCELLED' }, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  getRideDetails(rideId: number): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<any>(`${this.rideUrl}${rideId}/`, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.get<any>(`${this.rideUrl}${rideId}/`, { headers: newHeaders });
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
    return this.http.get<any>(`${this.bookingUrl}`, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.get<any>(`${this.bookingUrl}`, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
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

  patchBooking(bookingId: number, data: any): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.patch<any>(`${this.bookingUrl}${bookingId}/`, data, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.patch<any>(`${this.bookingUrl}${bookingId}/`, data, { headers: newHeaders });
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  cancelBooking(bookingId: number): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token found'));
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.patch<any>(`${this.bookingUrl}${bookingId}/`, { status: 'CANCELLED' }, { headers }).pipe(
      catchError(error => {
        if (error.status === 401) {
          return this.refreshToken().pipe(
            switchMap(() => {
              const newToken = this.getToken();
              if (!newToken) return throwError(() => new Error('Token refresh failed'));
              const newHeaders = new HttpHeaders({ Authorization: `Bearer ${newToken}` });
              return this.http.patch<any>(`${this.bookingUrl}${bookingId}/`, { status: 'CANCELLED' }, { headers: newHeaders });
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
