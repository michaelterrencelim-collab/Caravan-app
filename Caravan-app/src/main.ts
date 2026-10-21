import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { addIcons } from 'ionicons';
import {
  add,
  cartOutline,
  cashOutline,
  cardOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  helpCircleOutline,
  homeOutline,
  informationCircleOutline,
  logInOutline,
  logOutOutline,
  person,
  personAddOutline,
  personCircleOutline,
  personOutline,
  receiptOutline,
  remove,
  settingsOutline,
  storefrontOutline,
  trashOutline,
} from 'ionicons/icons';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { apiBaseUrlInterceptor } from './app/services/api-base-url.interceptor';

addIcons({
  add,
  cartOutline,
  cashOutline,
  cardOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  helpCircleOutline,
  homeOutline,
  informationCircleOutline,
  logInOutline,
  logOutOutline,
  person,
  personAddOutline,
  personCircleOutline,
  personOutline,
  receiptOutline,
  remove,
  settingsOutline,
  storefrontOutline,
  trashOutline,
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
  ],
});
