import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ServiceApi } from '../services/service-api';

export const adminGuard: CanActivateFn = () => {
  const service = inject(ServiceApi);
  const router = inject(Router);

  return service.getToken() ? true : router.createUrlTree(['/login']);
};
