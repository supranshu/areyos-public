import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, tap } from 'rxjs';
import { VisitorApiService } from '../../../core/services/visitor-api';
import {
  Venue,
  StartPoint,
  Destination,
  RouteResponse,
  FloorPlanMeta,
  CurrentJourney,
} from '../models/navigation.models';

export type NavigationPhase =
  | 'idle'
  | 'resolving-qr'
  | 'loading-venue-data'
  | 'ready'
  | 'calculating-route'
  | 'route-ready'
  | 'error';

// Scoped to the feature (provided per-component, not providedIn: 'root') so
// every QR scan starts with clean state instead of a stale previous visit.
@Injectable()
export class NavigationStore {
  private readonly api = inject(VisitorApiService);
  private lastCode: string | null = null;

  private readonly sessionStorageKey = 'areyos.sessionId';
  private readonly _sessionId = signal<string | null>(this.readSessionId());
  private readonly _journey = signal<CurrentJourney | null>(null);

  readonly sessionId = this._sessionId.asReadonly();
  readonly journey = this._journey.asReadonly();

  private readonly _phase = signal<NavigationPhase>('idle');
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _venue = signal<Venue | null>(null);
  private readonly _startPoint = signal<StartPoint | null>(null);
  private readonly _destinations = signal<Destination[]>([]);
  private readonly _selectedDestination = signal<Destination | null>(null);
  private readonly _route = signal<RouteResponse | null>(null);
  private readonly _floorPlans = signal<Map<number, FloorPlanMeta>>(new Map());
  private readonly _activeFloorId = signal<number | null>(null);

  readonly phase = this._phase.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly venue = this._venue.asReadonly();
  readonly startPoint = this._startPoint.asReadonly();
  readonly destinations = this._destinations.asReadonly();
  readonly selectedDestination = this._selectedDestination.asReadonly();
  readonly route = this._route.asReadonly();
  readonly activeFloorId = this._activeFloorId.asReadonly();

  readonly activeFloorPlan = computed(() => {
    const floorId = this._activeFloorId();
    return floorId != null ? this._floorPlans().get(floorId) ?? null : null;
  });

  // Distinct floors the current route crosses, in visiting order — drives the floor switcher.
  readonly routeFloors = computed(() => {
    const route = this._route();
    if (!route) return [];
    const seen = new Set<number>();
    const floors: { floorId: number; floorName: string }[] = [];
    for (const point of route.points) {
      if (!seen.has(point.floorId)) {
        seen.add(point.floorId);
        floors.push({ floorId: point.floorId, floorName: point.floorName });
      }
    }
    return floors;
  });

  // Only the route points on the floor currently being viewed.
  readonly visibleRoutePoints = computed(() => {
    const route = this._route();
    const floorId = this._activeFloorId();
    if (!route || floorId == null) return [];
    return route.points.filter((p) => p.floorId === floorId);
  });

  readonly isLoading = computed(() =>
    (['resolving-qr', 'loading-venue-data', 'calculating-route'] as NavigationPhase[]).includes(
      this._phase()
    )
  );

  /** Entry point: kicks off the whole flow from a scanned QR code. */
  startFromQrCode(code: string): void {
    this.lastCode = code;
    this._phase.set('resolving-qr');
    this._errorMessage.set(null);

    this.api.resolveQrCode(code, this._sessionId()).subscribe({
      next: (res) => {
        this.setSessionId(res.sessionId);
        this._journey.set(res.activeJourney);
        this._venue.set(res.venue);
        this._startPoint.set(res.startPoint);
        this._activeFloorId.set(res.startPoint.floorId);
        this.loadVenueData(res.venue.id, res.startPoint.floorId);
      },
      error: () => this.fail('This QR code could not be recognized. Please rescan and try again.'),
    });
  }

  retry(): void {
    if (this.lastCode) this.startFromQrCode(this.lastCode);
  }

  selectDestination(destination: Destination): void {
    const sessionId = this._sessionId();
    if (!sessionId) return;

    this._selectedDestination.set(destination);
    this._phase.set('calculating-route');
    this._route.set(null);

    this.api.calculateRoute(sessionId, destination.nodeId).subscribe({
      next: (route) => this.applyRoute(route),
      error: () => this.fail('Could not calculate a route to this destination.'),
    });
  }

  private applyRoute(route: RouteResponse): void {
    this._route.set(route);
    const startPoint = this._startPoint();
    const floorIds = [...new Set(route.points.map((p) => p.floorId))];
    forkJoin(floorIds.map((id) => this.ensureFloorPlanLoaded(id))).subscribe({
      next: () => {
        if (startPoint) this._activeFloorId.set(startPoint.floorId);
        this._phase.set('route-ready');
      },
      error: () => this.fail('Could not load floor plans for this route.'),
    });
  }

  /** Lets the visitor pick a different destination without re-resolving the QR code. */
  clearRoute(): void {
    this._selectedDestination.set(null);
    this._route.set(null);
    const startPoint = this._startPoint();
    if (startPoint) this._activeFloorId.set(startPoint.floorId);
    this._phase.set('ready');
  }

  setActiveFloor(floorId: number): void {
    if (this._floorPlans().has(floorId)) {
      this._activeFloorId.set(floorId);
    }
  }

  getFloorPlanImageUrl(floorId: number): string {
    return this.api.getFloorPlanImageUrl(floorId);
  }

  private loadVenueData(venueId: number, floorId: number): void {
    this._phase.set('loading-venue-data');

    forkJoin({
      destinations: this.api.getDestinations(venueId),
      floorPlan: this.ensureFloorPlanLoaded(floorId),
    }).subscribe({
      next: ({ destinations }) => {
        this._destinations.set(destinations);
        this._phase.set('ready');
      },
      error: () => this.fail('Could not load venue data. Please try again.'),
    });
  }

  private ensureFloorPlanLoaded(floorId: number) {
    const cached = this._floorPlans().get(floorId);
    if (cached) return of(cached);

    return this.api.getFloorPlanMeta(floorId).pipe(
      tap((meta) => {
        const next = new Map(this._floorPlans());
        next.set(floorId, meta);
        this._floorPlans.set(next);
      })
    );
  }

  private fail(message: string): void {
    this._errorMessage.set(message);
    this._phase.set('error');
  }

  private readSessionId(): string | null {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(this.sessionStorageKey);
  }

  private setSessionId(sessionId: string): void {
    this._sessionId.set(sessionId);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(this.sessionStorageKey, sessionId);
  }
}