import { HttpInterceptorFn } from '@angular/common/http';

export const httpCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  // Clone the request and add withCredentials: true for session cookies
  const clonedReq = req.clone({
    withCredentials: true
  });

  return next(clonedReq);
};
