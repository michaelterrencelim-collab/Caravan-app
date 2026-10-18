import { HttpInterceptorFn } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { apiEndpoint } from './api-endpoint';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  let headers = request.headers;
  const token = localStorage.getItem('auth_token');
  if (token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || /^https?:\/\//i.test(request.url)) {
    return next(request.clone({ headers, withCredentials: true }));
  }

  const url = apiEndpoint(request.url);
  return next(request.clone({ url, headers, withCredentials: true }));
};
