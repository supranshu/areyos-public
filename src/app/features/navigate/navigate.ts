import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NavigationStore } from './services/navigation-store';
import { FloorSwitcher } from '../components/floor-switcher/floor-switcher';
import { RouteSummary } from '../components/route-summary/route-summary';
import { FloorPlanViewer } from '../components/floor-plan-viewer/floor-plan-viewer';
import { DestinationSelector } from '../components/destination-selector/destination-selector';
import { LocationBanner } from '../components/location-banner/location-banner';

@Component({
  selector: 'app-navigate',
  imports: [LocationBanner, DestinationSelector, FloorPlanViewer, RouteSummary, FloorSwitcher],
  providers: [NavigationStore], // fresh state per page instance/visit
  templateUrl: './navigate.html',
  styleUrl: './navigate.scss',
})
export class Navigate {
  private readonly activatedRoute = inject(ActivatedRoute);
  protected readonly store = inject(NavigationStore);

  private readonly code = toSignal(
    this.activatedRoute.paramMap.pipe(map((params) => params.get('code'))),
    { initialValue: null }
  );

  constructor() {
    effect(() => {
      const code = this.code();
      if (code) this.store.startFromQrCode(code);
    });
  }
}