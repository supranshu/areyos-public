import {
  Component,
  DOCUMENT,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {Destination, RoutePoint, FloorPlanMeta, StartPoint } from '../../navigate/models/navigation.models';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
@Component({
  selector: 'app-floor-plan-viewer',
  imports: [],
  templateUrl: './floor-plan-viewer.html',
  styleUrl: './floor-plan-viewer.scss',
})
export class FloorPlanViewer {
  readonly imageUrl = input<string | null>(null);
  readonly floorPlan = input<FloorPlanMeta | null>(null);
  readonly startPoint = input<StartPoint | null>(null);
  readonly destination = input<Destination | null>(null);
  readonly routePoints = input<RoutePoint[]>([]);

  readonly isFullscreen = signal<boolean>(false);
  private readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage');

  // --- pan/zoom state, scoped entirely to this component's canvas ---
  private readonly scale = signal(1);
  private readonly translateX = signal(0);
  private readonly translateY = signal(0);

  readonly canvasTransform = computed(
    () => `translate(${this.translateX()}px, ${this.translateY()}px) scale(${this.scale()})`
  );
  readonly isZoomed = computed(() => this.scale() > 1);

  // gesture bookkeeping — plain fields, not signals, since they're only read during a live gesture
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance = 0;
  private pinchStartScale = 1;
  private lastPanPoint: { x: number; y: number } | null = null;

  readonly viewBox = computed(() => {
    const plan = this.floorPlan();
    return plan ? `0 0 ${plan.width} ${plan.height}` : '0 0 1 1';
  });

  readonly stageAspectRatio = computed(() => {
    const plan = this.floorPlan();
    return plan ? `${plan.width} / ${plan.height}` : '3 / 4';
  });

  readonly routePathPoints = computed(() =>
    this.routePoints().map((p) => `${p.x},${p.y}`).join(' ')
  );

  readonly startMarkerOnThisFloor = computed(() => {
    const sp = this.startPoint();
    const plan = this.floorPlan();
    return sp && plan && sp.floorId === plan.floorId ? sp : null;
  });

  readonly destinationMarkerOnThisFloor = computed(() => {
    const dest = this.destination();
    const plan = this.floorPlan();
    return dest && plan && dest.floorId === plan.floorId ? dest : null;
  });

  readonly waypoints = computed(() =>
    this.routePoints().filter(
      (p) => p.type !== 'DESTINATION' && p.nodeId !== this.startPoint()?.nodeId
    )
  );

  constructor() {
    // Reset zoom whenever the floor changes or fullscreen is toggled —
    // stale pan/zoom carrying over to a new floor/view would be confusing.
    effect(() => {
      this.floorPlan();
      this.isFullscreen();
      this.resetView();
    });
  }

  toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
  }

  resetView(): void {
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  // --- pointer gesture handling ---

  onPointerDown(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 1) {
      this.lastPanPoint = { x: event.clientX, y: event.clientY };
    } else if (this.activePointers.size === 2) {
      this.pinchStartDistance = this.currentPointerDistance();
      this.pinchStartScale = this.scale();
      this.lastPanPoint = null;
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.activePointers.has(event.pointerId)) return;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      this.handlePinch();
    } else if (this.activePointers.size === 1 && this.lastPanPoint) {
      const dx = event.clientX - this.lastPanPoint.x;
      const dy = event.clientY - this.lastPanPoint.y;
      this.lastPanPoint = { x: event.clientX, y: event.clientY };
      this.pan(dx, dy);
    }
  }

  onPointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);

    if (this.activePointers.size === 1) {
      const [remaining] = this.activePointers.values();
      this.lastPanPoint = { ...remaining };
    } else {
      this.lastPanPoint = null;
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.stageRef()!.nativeElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomAt(px, py, this.scale() * factor);
  }

  onDoubleClick(event: MouseEvent): void {
    const rect = this.stageRef()!.nativeElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    this.zoomAt(px, py, this.isZoomed() ? 1 : 2.5);
  }

  private handlePinch(): void {
    const rect = this.stageRef()!.nativeElement.getBoundingClientRect();
    const [p1, p2] = [...this.activePointers.values()];
    const midX = (p1.x + p2.x) / 2 - rect.left;
    const midY = (p1.y + p2.y) / 2 - rect.top;

    const distance = this.currentPointerDistance();
    const ratio = distance / this.pinchStartDistance;
    this.zoomAt(midX, midY, this.pinchStartScale * ratio);
  }

  private currentPointerDistance(): number {
    const [p1, p2] = [...this.activePointers.values()];
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  /** Zooms to newScale while keeping the content under (px, py) visually fixed. */
  private zoomAt(px: number, py: number, newScale: number): void {
    const s0 = this.scale();
    const s1 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

    const contentX = (px - this.translateX()) / s0;
    const contentY = (py - this.translateY()) / s0;

    this.scale.set(s1);
    this.translateX.set(px - contentX * s1);
    this.translateY.set(py - contentY * s1);
    this.clampTranslate();
  }

  private pan(dx: number, dy: number): void {
    if (this.scale() <= MIN_SCALE) return; // nothing to pan when not zoomed in
    this.translateX.update((x) => x + dx);
    this.translateY.update((y) => y + dy);
    this.clampTranslate();
  }

  /** Keeps the content from being dragged/zoomed fully out of the visible stage. */
  private clampTranslate(): void {
    const stage = this.stageRef()?.nativeElement;
    if (!stage) return;

    const s = this.scale();
    const w = stage.clientWidth;
    const h = stage.clientHeight;

    const minX = w * (1 - s);
    const minY = h * (1 - s);

    this.translateX.set(Math.min(0, Math.max(minX, this.translateX())));
    this.translateY.set(Math.min(0, Math.max(minY, this.translateY())));
  }
}