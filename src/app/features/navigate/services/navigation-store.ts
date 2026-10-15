import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, of, tap } from 'rxjs';
import { VisitorApiService, apiErrorMessage } from '../../../core/services/visitor-api';
import { PublicFloorResponse } from '../../../core/models/api.models';
import {
  Venue,
  StartPoint,
  Destination,
  RouteView,
  FloorPlanMeta,
  toRouteView,
  toStartPoint,
  toVenue,
} from '../models/navigation.models';
import { buildRouteSteps } from '../models/route-steps';

export type NavigationPhase =
  | 'idle'
  | 'resolving-qr'
  | 'loading-venue-data'
  | 'ready' // map + "you are here", pick a destination
  | 'calculating-route'
  | 'route-ready' // route preview, "Start Navigation"
  | 'navigating' // turn-by-turn
  | 'arrived'
  | 'complete' // journey finished, home screen
  | 'error';

interface StoredSession {
  sessionId: string;
  code: string;
}

const SESSION_STORAGE_KEY = 'areyos.session';

// Scoped to the feature (provided per-component, not providedIn: 'root') so
// every QR scan starts with clean state instead of a stale previous visit.
@Injectable()
export class NavigationStore implements OnDestroy {
  private readonly api = inject(VisitorApiService);
  /** Code as typed in the URL, for retry. */
  private lastCode: string | null = null;
  /** Canonical code returned by the backend (it upper-cases codes), used to key the stored session. */
  private qrCode: string | null = null;

  /**
   * Visitor session, used only for analytics (SESSION_STARTED / JOURNEY_COMPLETED).
   * Navigation never waits on it and keeps working if these calls fail.
   */
  private readonly _sessionId = signal<string | null>(null);
  readonly sessionId = this._sessionId.asReadonly();

  private readonly _phase = signal<NavigationPhase>('idle');
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _routeError = signal<string | null>(null);
  private readonly _venue = signal<Venue | null>(null);
  private readonly _startPoint = signal<StartPoint | null>(null);
  private readonly _floors = signal<PublicFloorResponse[]>([]);
  private readonly _destinations = signal<Destination[]>([]);
  private readonly _selectedDestination = signal<Destination | null>(null);
  private readonly _route = signal<RouteView | null>(null);
  private readonly _stepIndex = signal(0);
  private readonly _floorPlans = signal<Map<number, FloorPlanMeta>>(new Map());
  private readonly _floorsWithoutPlan = signal<Set<number>>(new Set());
  /** Floor id → image URL: a blob: URL once downloaded, or the direct URL if the download failed. */
  private readonly _floorImages = signal<Map<number, string>>(new Map());
  private readonly loadingImages = new Set<number>();
  private readonly _activeFloorId = signal<number | null>(null);

  readonly phase = this._phase.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  /** A route failure (e.g. no path) is shown inline; the visitor can pick another destination. */
  readonly routeError = this._routeError.asReadonly();
  readonly venue = this._venue.asReadonly();
  readonly startPoint = this._startPoint.asReadonly();
  readonly floors = this._floors.asReadonly();
  readonly destinations = this._destinations.asReadonly();
  readonly selectedDestination = this._selectedDestination.asReadonly();
  readonly route = this._route.asReadonly();
  readonly stepIndex = this._stepIndex.asReadonly();
  readonly activeFloorId = this._activeFloorId.asReadonly();

  readonly activeFloor = computed(() => this._floors().find((f) => f.id === this._activeFloorId()) ?? null);

  readonly activeFloorPlan = computed(() => {
    const floorId = this._activeFloorId();
    return floorId != null ? this._floorPlans().get(floorId) ?? null : null;
  });

  /** Null while the image is still downloading, so the viewer keeps its "Loading floor plan…" placeholder. */
  readonly activeFloorImageUrl = computed(() => {
    const plan = this.activeFloorPlan();
    return plan ? this._floorImages().get(plan.floorId) ?? null : null;
  });

  readonly activeFloorHasNoPlan = computed(() => {
    const floorId = this._activeFloorId();
    return floorId != null && this._floorsWithoutPlan().has(floorId);
  });

  /** Only the route points on the floor currently being viewed. */
  readonly visibleRoutePoints = computed(() => {
    const route = this._route();
    const floorId = this._activeFloorId();
    if (!route || floorId == null) return [];
    return route.points.filter((p) => p.floorId === floorId);
  });

  readonly steps = computed(() => {
    const route = this._route();
    const destination = this._selectedDestination();
    return route && destination ? buildRouteSteps(route, destination.name) : [];
  });

  readonly currentStep = computed(() => this.steps()[this._stepIndex()] ?? null);
  readonly isLastStep = computed(() => this._stepIndex() >= this.steps().length - 1);

  /** Where the blue dot goes: the QR location, the current step while navigating, or the destination on arrival. */
  readonly youAreHere = computed(() => {
    const phase = this._phase();
    if (phase === 'navigating') {
      const step = this.currentStep();
      if (step) return { floorId: step.anchor.floorId, x: step.anchor.x, y: step.anchor.y, nodeId: step.anchor.nodeId };
    }
    if (phase === 'arrived') {
      const dest = this._selectedDestination();
      if (dest) return { floorId: dest.floorId, x: dest.x, y: dest.y, nodeId: dest.nodeId };
    }
    const start = this._startPoint();
    return start ? { floorId: start.floorId, x: start.x, y: start.y, nodeId: start.nodeId } : null;
  });

  readonly isLoading = computed(() =>
    (['resolving-qr', 'loading-venue-data', 'calculating-route'] as NavigationPhase[]).includes(this._phase())
  );

  /** Entry point: kicks off the whole flow from a scanned QR code. */
  startFromQrCode(code: string): void {
    this.lastCode = code;
    this._phase.set('resolving-qr');
    this._errorMessage.set(null);
    this._routeError.set(null);

    this.api.resolveQrCode(code).subscribe({
      next: (qr) => {
        const venue = toVenue(qr);
        const startPoint = toStartPoint(qr);
        this._venue.set(venue);
        this._startPoint.set(startPoint);
        this._activeFloorId.set(startPoint.floorId);
        this.qrCode = qr.code;
        this.loadVenueData(venue.id, startPoint);
      },
      error: (err) =>
        this.fail(
          apiErrorMessage(err) === 'QR point is inactive'
            ? 'This QR code is no longer active. Please scan another one nearby.'
            : 'This QR code could not be recognized. Please rescan and try again.'
        ),
    });
  }

  retry(): void {
    if (this.lastCode) this.startFromQrCode(this.lastCode);
  }

  selectDestination(destination: Destination): void {
    const venue = this._venue();
    const startPoint = this._startPoint();
    if (!venue || !startPoint) return;

    this._selectedDestination.set(destination);
    this._phase.set('calculating-route');
    this._route.set(null);
    this._routeError.set(null);
    this._stepIndex.set(0);

    // A previous journey was completed: picking a new destination starts a new one.
    if (!this._sessionId() && this.qrCode) {
      this.resumeOrStartSession(this.qrCode, venue.id, startPoint.nodeId);
    }

    if (destination.nodeId === startPoint.nodeId) {
      this._routeError.set(`You're already at ${destination.name}.`);
      this._selectedDestination.set(null);
      this._phase.set('ready');
      return;
    }

    this.api.calculateRoute(venue.id, startPoint.nodeId, destination.nodeId).subscribe({
      next: (route) => this.applyRoute(toRouteView(route)),
      error: (err) => {
        this._routeError.set(apiErrorMessage(err) ?? 'Could not calculate a route to this destination.');
        this._selectedDestination.set(null);
        this._phase.set('ready');
      },
    });
  }

  selectDestinationById(nodeId: number): void {
    const destination = this._destinations().find((d) => d.nodeId === nodeId);
    if (destination) this.selectDestination(destination);
  }

  private applyRoute(route: RouteView): void {
    const startPoint = this._startPoint();

    forkJoin(route.floors.map((f) => this.ensureFloorPlanLoaded(f.floorId))).subscribe({
      next: () => {
        this._route.set(route);
        if (startPoint) this._activeFloorId.set(startPoint.floorId);
        this._phase.set('route-ready');
      },
      error: () => {
        this._routeError.set('Could not load the floor plans for this route.');
        this._selectedDestination.set(null);
        this._phase.set('ready');
      },
    });
  }

  startNavigation(): void {
    if (!this._route()) return;
    this._stepIndex.set(0);
    this._phase.set('navigating');
    this.followCurrentStepFloor();
  }

  nextStep(): void {
    if (this.isLastStep()) {
      this.markArrived();
      return;
    }
    this._stepIndex.update((i) => i + 1);
    this.followCurrentStepFloor();
  }

  previousStep(): void {
    if (this._stepIndex() === 0) return;
    this._stepIndex.update((i) => i - 1);
    this.followCurrentStepFloor();
  }

  /** "End" during navigation: back to the route preview. */
  endNavigation(): void {
    this._stepIndex.set(0);
    const startPoint = this._startPoint();
    if (startPoint) this._activeFloorId.set(startPoint.floorId);
    this._phase.set('route-ready');
  }

  /** Visitor reached the destination: completes the session (JOURNEY_COMPLETED). */
  markArrived(): void {
    const destination = this._selectedDestination();
    if (destination) this._activeFloorId.set(destination.floorId);
    this._phase.set('arrived');

    const sessionId = this._sessionId();
    if (!sessionId) return;
    this._sessionId.set(null);
    this.forgetStoredSession();
    this.api.completeSession(sessionId).subscribe({ error: () => {} });
  }

  /** Arrival acknowledged: show the journey-complete home screen. */
  finishJourney(): void {
    this._phase.set('complete');
  }

  /** Lets the visitor pick a different destination without re-resolving the QR code. */
  clearRoute(): void {
    this._selectedDestination.set(null);
    this._route.set(null);
    this._routeError.set(null);
    this._stepIndex.set(0);
    const startPoint = this._startPoint();
    if (startPoint) this._activeFloorId.set(startPoint.floorId);
    this._phase.set('ready');
  }

  dismissRouteError(): void {
    this._routeError.set(null);
  }

  /** Floor picker: shows any floor of the venue, loading its plan on demand. */
  viewFloor(floorId: number): void {
    this._activeFloorId.set(floorId);
    if (this._floorPlans().has(floorId) || this._floorsWithoutPlan().has(floorId)) return;

    this.ensureFloorPlanLoaded(floorId).subscribe({
      error: () => this._floorsWithoutPlan.update((set) => new Set(set).add(floorId)),
    });
  }

  private followCurrentStepFloor(): void {
    const step = this.currentStep();
    if (step) this._activeFloorId.set(step.anchor.floorId);
  }

  private loadVenueData(venueId: number, startPoint: StartPoint): void {
    this._phase.set('loading-venue-data');

    forkJoin({
      destinations: this.api.getDestinations(venueId),
      floors: this.api.getFloors(venueId),
      floorPlan: this.ensureFloorPlanLoaded(startPoint.floorId),
    }).subscribe({
      next: ({ destinations, floors }) => {
        this._destinations.set([...destinations].sort((a, b) => a.name.localeCompare(b.name)));
        this._floors.set(floors);
        this._phase.set('ready');
        // Analytics only, so it waits until the map is up instead of competing with the requests it needs.
        if (this.qrCode) this.resumeOrStartSession(this.qrCode, venueId, startPoint.nodeId);
      },
      error: () => this.fail('Could not load venue data. Please try again.'),
    });
  }

  private ensureFloorPlanLoaded(floorId: number): Observable<FloorPlanMeta> {
    const cached = this._floorPlans().get(floorId);
    if (cached) return of(cached);

    return this.api.getFloorPlanMeta(floorId).pipe(
      tap((meta) => {
        const next = new Map(this._floorPlans());
        next.set(floorId, meta);
        this._floorPlans.set(next);
        this.loadFloorImage(floorId);
      })
    );
  }

  /** Downloads the plan image in the background; the map shows as soon as it arrives. */
  private loadFloorImage(floorId: number): void {
    if (this._floorImages().has(floorId) || this.loadingImages.has(floorId)) return;
    this.loadingImages.add(floorId);

    const settle = (url: string) => {
      this.loadingImages.delete(floorId);
      this._floorImages.update((map) => new Map(map).set(floorId, url));
    };
    this.api.getFloorPlanImage(floorId).subscribe({
      next: (blob) => settle(URL.createObjectURL(blob)),
      // Let the browser try the plain URL itself; it may still succeed (and caches nothing worse).
      error: () => settle(this.api.getFloorPlanImageUrl(floorId)),
    });
  }

  ngOnDestroy(): void {
    for (const url of this._floorImages().values()) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  }

  /**
   * Reuses the session stored for this QR code (so a page refresh doesn't count as a new visit),
   * otherwise starts a new one. Fire-and-forget: failures only cost an analytics event.
   */
  private resumeOrStartSession(code: string, venueId: number, startNodeId: number): void {
    const stored = this.readStoredSession();
    if (stored && stored.code === code) {
      this._sessionId.set(stored.sessionId);
      return;
    }

    this.api.startSession({ venueId, startNodeId, qrCode: code }).subscribe({
      next: (session) => {
        this._sessionId.set(session.sessionId);
        this.writeStoredSession({ sessionId: session.sessionId, code });
      },
      error: () => {},
    });
  }

  private fail(message: string): void {
    this._errorMessage.set(message);
    this._phase.set('error');
  }

  private readStoredSession(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }

  private writeStoredSession(session: StoredSession): void {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable (private mode etc.) — a refresh will just start a new session.
    }
  }

  private forgetStoredSession(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
