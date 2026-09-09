import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Destination, FloorPlanMeta, RoutePoint, StartPoint } from '../../navigate/models/navigation.models';


const MIN_SCALE = 1;
const MAX_SCALE = 4;

// --- route animation tuning ---
const ARROW_COUNT = 6;
const FLOW_SPEED = 120; // viewBox units/sec that arrows travel along the route
const MIN_DRAW_MS = 900;
const MAX_DRAW_MS = 2200;
const DRAW_MS_PER_UNIT = 3;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

@Component({
  selector: 'app-floor-plan-viewer',
  imports: [],
  templateUrl: './floor-plan-viewer.html',
  styleUrl: './floor-plan-viewer.scss',
})
export class FloorPlanViewer {
  private readonly destroyRef = inject(DestroyRef);

  readonly imageUrl = input<string | null>(null);
  readonly floorPlan = input<FloorPlanMeta | null>(null);
  readonly startPoint = input<StartPoint | null>(null);
  readonly destination = input<Destination | null>(null);
  readonly routePoints = input<RoutePoint[]>([]);

  readonly isFullscreen = signal<boolean>(false);
  private readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage');

  // --- pan/zoom state (unchanged from before) ---
  private readonly scale = signal(1);
  private readonly translateX = signal(0);
  private readonly translateY = signal(0);

  readonly canvasTransform = computed(
    () => `translate(${this.translateX()}px, ${this.translateY()}px) scale(${this.scale()})`
  );
  readonly isZoomed = computed(() => this.scale() > 1);

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

  // --- route draw + flow animation ---
  readonly pathD = computed(() => {
    const points = this.routePoints();
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  });

  private readonly routeLineRef = viewChild<ElementRef<SVGPathElement>>('routeLine');
  private readonly arrowRefs = viewChildren<ElementRef<SVGGElement>>('arrowRef');
  readonly arrowIndices = Array.from({ length: ARROW_COUNT }, (_, i) => i);

  private animationFrameId: number | null = null;
  private pathLength = 0;
  private drawStartTime = 0;
  private flowOffset = 0;
  private lastFrameTime = 0;

  constructor() {
    // Reset zoom whenever the floor changes or fullscreen is toggled.
    effect((onCleanup) => {
      this.floorPlan();
      this.isFullscreen();
      this.resetView();
      onCleanup(() => {});
    });

    // Restart the draw + flow animation whenever the visible route changes
    // (new destination selected, or switching to a different floor of the route).
    effect(() => {
      this.pathD(); // dependency
      // wait a frame so the viewChild ref reflects the just-updated `d` attribute
      queueMicrotask(() => this.startRouteAnimation());
    });

    this.destroyRef.onDestroy(() => this.stopRouteAnimation());
  }

  private startRouteAnimation(): void {
    this.stopRouteAnimation();
    const pathEl = this.routeLineRef()?.nativeElement;
    if (!pathEl || !this.pathD()) return;

    this.pathLength = pathEl.getTotalLength();
    this.drawStartTime = performance.now();
    this.lastFrameTime = this.drawStartTime;
    this.flowOffset = 0;

    const drawDurationMs = Math.min(
      MAX_DRAW_MS,
      Math.max(MIN_DRAW_MS, this.pathLength * DRAW_MS_PER_UNIT)
    );

    const tick = (now: number) => {
      const deltaSec = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      const drawElapsed = now - this.drawStartTime;
      const drawT = Math.min(1, drawElapsed / drawDurationMs);
      const revealLength = easeOutCubic(drawT) * this.pathLength;

      // Reveal the path by shrinking the dash-offset toward 0.
      pathEl.style.strokeDasharray = `${this.pathLength}`;
      pathEl.style.strokeDashoffset = `${this.pathLength - revealLength}`;

      // Continuously advance the flow offset so arrows keep moving even
      // after the line is fully drawn.
      this.flowOffset = (this.flowOffset + FLOW_SPEED * deltaSec) % this.pathLength;

      const arrows = this.arrowRefs();
      const spacing = this.pathLength / ARROW_COUNT;

      for (let i = 0; i < arrows.length; i++) {
        const el = arrows[i].nativeElement;
        const distance = (this.flowOffset + i * spacing) % this.pathLength;

        // Hide arrows that are ahead of how far the line has drawn so far.
        if (distance > revealLength) {
          el.style.opacity = '0';
          continue;
        }

        const point = pathEl.getPointAtLength(distance);
        const ahead = pathEl.getPointAtLength(Math.min(this.pathLength, distance + 1));
        const angleDeg = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI;

        el.style.opacity = '1';
        el.style.transform = `translate(${point.x}px, ${point.y}px) rotate(${angleDeg}deg)`;
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private stopRouteAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // --- fullscreen + pan/zoom methods (unchanged) ---

  toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
  }

  resetView(): void {
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
  }

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
    if (this.scale() <= MIN_SCALE) return;
    this.translateX.update((x) => x + dx);
    this.translateY.update((y) => y + dy);
    this.clampTranslate();
  }

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