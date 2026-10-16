import { Component, ElementRef, WritableSignal, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NavigationStore } from './services/navigation-store';
import { Destination } from './models/navigation.models';
import { placeIcon } from './models/destination-icons';
import { FloorSwitcher } from '../components/floor-switcher/floor-switcher';
import { RouteSummary } from '../components/route-summary/route-summary';
import { FloorPlanViewer, MapPoi, MapTransition } from '../components/floor-plan-viewer/floor-plan-viewer';
import { DestinationSelector } from '../components/destination-selector/destination-selector';
import { LocationBanner } from '../components/location-banner/location-banner';
import { TopBar } from '../components/top-bar/top-bar';
import { SplashScreen } from '../components/splash-screen/splash-screen';
import { InstructionCard } from '../components/instruction-card/instruction-card';
import { QrScanner } from '../components/qr-scanner/qr-scanner';
import { HomeScreen } from '../components/home-screen/home-screen';

const DESKTOP_QUERY = '(min-width: 860px)';

@Component({
  selector: 'app-navigate',
  imports: [
    LocationBanner,
    DestinationSelector,
    FloorPlanViewer,
    RouteSummary,
    FloorSwitcher,
    TopBar,
    SplashScreen,
    InstructionCard,
    QrScanner,
    HomeScreen,
  ],
  providers: [NavigationStore], // fresh state per page instance/visit
  templateUrl: './navigate.html',
  styleUrl: './navigate.scss',
})
export class Navigate {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(NavigationStore);

  private readonly code = toSignal(this.activatedRoute.paramMap.pipe(map((params) => params.get('code'))), {
    initialValue: null,
  });

  readonly searchOpen = signal(false);
  readonly scannerOpen = signal(false);

  // Heights of the overlays above/below the map, so the map can center things in the visible area.
  private readonly topRef = viewChild<ElementRef<HTMLElement>>('topOverlay');
  private readonly bottomRef = viewChild<ElementRef<HTMLElement>>('bottomOverlay');
  readonly topInset = signal(0);
  readonly bottomInset = signal(0);

  /**
   * Floor-change markers: where the route leaves a floor ("Stairs ↑ First floor") and where it
   * arrives on the next one ("From Ground floor"). Tapping either switches the map to the other floor.
   */
  readonly transitions = computed<MapTransition[]>(() => {
    const route = this.store.route();
    if (!route || this.store.phase() === 'arrived') return [];
    const floorNumber = new Map(route.floors.map((f) => [f.floorId, f.floorNumber]));
    const result: MapTransition[] = [];

    route.points.forEach((here, i) => {
      const next = route.points[i + 1];
      if (!next || next.floorId === here.floorId) return;
      const goingUp = (floorNumber.get(next.floorId) ?? 0) > (floorNumber.get(here.floorId) ?? 0);
      const via = here.type === 'ELEVATOR' ? 'Lift' : here.type === 'RAMP' ? 'Ramp' : 'Stairs';
      const icon = here.type === 'ELEVATOR' ? 'elevator' : here.type === 'RAMP' ? 'trending_up' : 'stairs';
      result.push({
        floorId: here.floorId, x: here.x, y: here.y, nodeId: here.nodeId,
        icon, label: `${via} ${goingUp ? '↑' : '↓'} ${next.floorName}`, targetFloorId: next.floorId,
      });
      result.push({
        floorId: next.floorId, x: next.x, y: next.y, nodeId: next.nodeId,
        icon: 'south_west', label: `From ${here.floorName}`, targetFloorId: here.floorId,
      });
    });
    return result;
  });

  readonly destinationPoi = computed<MapPoi | null>(() => {
    const dest = this.store.selectedDestination();
    return dest ? this.toPoi(dest) : null;
  });

  /** Place markers on the map: shown while browsing, hidden during turn-by-turn to keep it clean. */
  readonly pois = computed<MapPoi[]>(() => {
    const phase = this.store.phase();
    if (phase !== 'ready' && phase !== 'route-ready') return [];
    const startId = this.store.startPoint()?.nodeId;
    return this.store
      .destinations()
      .filter((d) => d.nodeId !== startId)
      .map((d) => this.toPoi(d));
  });

  /** Route preview and each navigation leg show the whole path on the floor; arrival zooms onto the destination. */
  readonly focusMode = computed<'none' | 'follow' | 'fit'>(() => {
    const phase = this.store.phase();
    if (phase === 'route-ready' || phase === 'navigating') return 'fit';
    return phase === 'arrived' ? 'follow' : 'none';
  });

  readonly routeFloorIds = computed(() => this.store.route()?.floors.map((f) => f.floorId) ?? []);

  readonly destinationIcon = computed(() => {
    const dest = this.store.selectedDestination();
    return dest ? placeIcon(dest.name) : null;
  });

  constructor() {
    effect(() => {
      const code = this.code();
      if (code) this.store.startFromQrCode(code);
    });

    this.trackHeight(this.topRef, this.topInset, false);
    this.trackHeight(this.bottomRef, this.bottomInset, true);
  }

  openSearch(): void {
    this.store.dismissRouteError();
    this.searchOpen.set(true);
  }

  chooseDestination(destination: Destination): void {
    this.searchOpen.set(false);
    this.store.selectDestination(destination);
  }

  onPoiSelected(nodeId: number): void {
    this.store.selectDestinationById(nodeId);
  }

  /** "Find" on the journey-complete screen. */
  findAnother(): void {
    this.store.clearRoute();
    this.openSearch();
  }

  /** Back to the scan / enter-code screen. A new QR code means a new visit, so the store starts fresh. */
  scanAnother(): void {
    this.router.navigate(['/']);
  }

  onScanned(code: string): void {
    this.scannerOpen.set(false);
    this.openCode(code);
  }

  openCode(code: string): void {
    this.router.navigate(['/qr', code]);
  }

  private toPoi(d: Destination): MapPoi {
    const icon = placeIcon(d.name);
    return { nodeId: d.nodeId, name: d.name, floorId: d.floorId, x: d.x, y: d.y, icon: icon.icon, color: icon.color };
  }

  private trackHeight(ref: () => ElementRef<HTMLElement> | undefined, target: WritableSignal<number>, mobileOnly: boolean): void {
    effect((onCleanup) => {
      const el = ref()?.nativeElement;
      if (!el) {
        target.set(0);
        return;
      }
      const desktop = window.matchMedia(DESKTOP_QUERY);
      const update = () => target.set(mobileOnly && desktop.matches ? 0 : el.offsetHeight);
      const observer = new ResizeObserver(update);
      observer.observe(el);
      desktop.addEventListener('change', update);
      update();
      onCleanup(() => {
        observer.disconnect();
        desktop.removeEventListener('change', update);
      });
    });
  }
}
