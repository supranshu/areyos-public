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
const START_FOCUS_SCALE = 2.5;
const FOCUS_ANIMATION_MS = 1500;

// --- route animation tuning ---
const ARROW_COUNT = 4;
const FLOW_SPEED = 55; // viewBox units/sec that arrows travel along the route
const MIN_DRAW_MS = 1800;
const MAX_DRAW_MS = 5000;
const DRAW_MS_PER_UNIT = 7;
const ARROW_BOB_AMPLITUDE = 1.2;
const ARROW_BOB_SPEED = 0.008;

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
  private readonly rotation = signal(0);
  private readonly translateX = signal(0);
  private readonly translateY = signal(0);

  readonly canvasTransform = computed(
    () =>
      `translate(${this.translateX()}px, ${this.translateY()}px) rotate(${this.rotation()}deg) scale(${this.scale()})`
  );
  readonly isZoomed = computed(() => this.scale() > 1 || this.rotation() !== 0);

  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance = 0;
  private lastPinchAngle = 0;
  private lastPinchMidpoint: { x: number; y: number } | null = null;
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
  private focusAnimationFrameId: number | null = null;
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

    // Focus the route entry point after a destination produces a visible route
    // or when switching to another floor of that route.
    effect(() => {
      const hasDestination = this.destination() !== null;
      const routePoints = this.routePoints();
      const focusPoint = this.startMarkerOnThisFloor() ?? routePoints[0];
      if (!hasDestination || !focusPoint) return;

      queueMicrotask(() => this.zoomToPoint(focusPoint.x, focusPoint.y, this.routeHeadingRotation()));
    });

    // Restart the draw + flow animation whenever the visible route changes
    // (new destination selected, or switching to a different floor of the route).
    effect(() => {
      this.pathD(); // dependency
      // wait a frame so the viewChild ref reflects the just-updated `d` attribute
      queueMicrotask(() => this.startRouteAnimation());
    });

    this.destroyRef.onDestroy(() => {
      this.stopRouteAnimation();
      this.stopFocusAnimation();
    });
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
        const bob = Math.sin(now * ARROW_BOB_SPEED + i * 1.7) * ARROW_BOB_AMPLITUDE;
        el.style.transform = `translate(${point.x}px, ${point.y + bob}px) rotate(${angleDeg}deg) scale(${0.96 + Math.sin(now * 0.006 + i) * 0.025})`;
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
    this.stopFocusAnimation();
    this.scale.set(1);
    this.rotation.set(0);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  private zoomToPoint(x: number, y: number, rotation: number): void {
    const stage = this.stageRef()?.nativeElement;
    const plan = this.floorPlan();
    if (!stage || !plan || stage.clientWidth === 0 || stage.clientHeight === 0) return;

    const pointX = (x / plan.width) * stage.clientWidth;
    const pointY = (y / plan.height) * stage.clientHeight;
    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.animateToView(
      START_FOCUS_SCALE,
      rotation,
      stage.clientWidth / 2 - (cos * pointX - sin * pointY) * START_FOCUS_SCALE,
      stage.clientHeight / 2 - (sin * pointX + cos * pointY) * START_FOCUS_SCALE
    );
  }

  private routeHeadingRotation(): number {
    const start = this.startMarkerOnThisFloor();
    const points = this.routePoints();
    const origin = start ?? points[0];
    if (!origin) return 0;

    const next = points.find(
      (point) => Math.hypot(point.x - origin.x, point.y - origin.y) > 0.5
    );
    if (!next) return 0;

    const heading = (Math.atan2(next.y - origin.y, next.x - origin.x) * 180) / Math.PI;
    return this.normalizedAngleDelta(-90 - heading);
  }

  private animateToView(targetScale: number, targetRotation: number, targetX: number, targetY: number): void {
    this.stopFocusAnimation();
    const startTime = performance.now();
    const startScale = this.scale();
    const startRotation = this.rotation();
    const rotationDelta = this.normalizedAngleDelta(targetRotation - startRotation);
    const startX = this.translateX();
    const startY = this.translateY();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / FOCUS_ANIMATION_MS);
      const easedProgress = easeOutCubic(progress);
      this.scale.set(startScale + (targetScale - startScale) * easedProgress);
      this.rotation.set(startRotation + rotationDelta * easedProgress);
      this.translateX.set(startX + (targetX - startX) * easedProgress);
      this.translateY.set(startY + (targetY - startY) * easedProgress);
      this.clampTranslate();

      if (progress < 1) {
        this.focusAnimationFrameId = requestAnimationFrame(tick);
      } else {
        this.focusAnimationFrameId = null;
      }
    };

    this.focusAnimationFrameId = requestAnimationFrame(tick);
  }

  private stopFocusAnimation(): void {
    if (this.focusAnimationFrameId !== null) {
      cancelAnimationFrame(this.focusAnimationFrameId);
      this.focusAnimationFrameId = null;
    }
  }

  onPointerDown(event: PointerEvent): void {
    this.stopFocusAnimation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 1) {
      this.lastPanPoint = { x: event.clientX, y: event.clientY };
    } else if (this.activePointers.size === 2) {
      this.lastPinchDistance = this.currentPointerDistance();
      this.lastPinchAngle = this.currentPointerAngle();
      this.lastPinchMidpoint = this.currentPointerMidpoint();
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
      this.lastPinchMidpoint = null;
    }
  }

  onWheel(event: WheelEvent): void {
    this.stopFocusAnimation();
    event.preventDefault();
    const rect = this.stageRef()!.nativeElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomAt(px, py, this.scale() * factor);
  }

  onDoubleClick(event: MouseEvent): void {
    this.stopFocusAnimation();
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
    const angle = this.currentPointerAngle();
    const angleDelta = this.normalizedAngleDelta(angle - this.lastPinchAngle);
    const midpoint = this.lastPinchMidpoint;

    if (midpoint) {
      this.translateX.update((x) => x + midX - midpoint.x);
      this.translateY.update((y) => y + midY - midpoint.y);
    }

    this.transformAt(midX, midY, this.scale() * (distance / this.lastPinchDistance), this.rotation() + angleDelta);
    this.lastPinchDistance = distance;
    this.lastPinchAngle = angle;
    this.lastPinchMidpoint = { x: midX, y: midY };
  }

  private currentPointerDistance(): number {
    const [p1, p2] = [...this.activePointers.values()];
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  private currentPointerAngle(): number {
    const [p1, p2] = [...this.activePointers.values()];
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  }

  private currentPointerMidpoint(): { x: number; y: number } {
    const [p1, p2] = [...this.activePointers.values()];
    const rect = this.stageRef()!.nativeElement.getBoundingClientRect();
    return {
      x: (p1.x + p2.x) / 2 - rect.left,
      y: (p1.y + p2.y) / 2 - rect.top,
    };
  }

  private normalizedAngleDelta(angle: number): number {
    return ((angle + 180) % 360 + 360) % 360 - 180;
  }

  private zoomAt(px: number, py: number, newScale: number): void {
    const s1 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    this.transformAt(px, py, s1, this.rotation());
  }

  private transformAt(px: number, py: number, newScale: number, newRotation: number): void {
    const s0 = this.scale();
    const rotation0 = (this.rotation() * Math.PI) / 180;
    const cos0 = Math.cos(rotation0);
    const sin0 = Math.sin(rotation0);

    const relativeX = px - this.translateX();
    const relativeY = py - this.translateY();
    const contentX = (cos0 * relativeX + sin0 * relativeY) / s0;
    const contentY = (-sin0 * relativeX + cos0 * relativeY) / s0;
    const rotation1 = (newRotation * Math.PI) / 180;
    const cos1 = Math.cos(rotation1);
    const sin1 = Math.sin(rotation1);

    this.scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale)));
    this.rotation.set(newRotation);
    this.translateX.set(px - (cos1 * contentX - sin1 * contentY) * this.scale());
    this.translateY.set(py - (sin1 * contentX + cos1 * contentY) * this.scale());
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
    const angle = (this.rotation() * Math.PI) / 180;
    const cos = Math.cos(angle) * s;
    const sin = Math.sin(angle) * s;
    const corners = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: 0, y: h },
      { x: w, y: h },
    ];
    const xs = corners.map(({ x, y }) => cos * x - sin * y);
    const ys = corners.map(({ x, y }) => sin * x + cos * y);
    const minContentX = Math.min(...xs);
    const maxContentX = Math.max(...xs);
    const minContentY = Math.min(...ys);
    const maxContentY = Math.max(...ys);
    const nextX = maxContentX - minContentX >= w
      ? Math.min(-minContentX, Math.max(w - maxContentX, this.translateX()))
      : (w - minContentX - maxContentX) / 2;
    const nextY = maxContentY - minContentY >= h
      ? Math.min(-minContentY, Math.max(h - maxContentY, this.translateY()))
      : (h - minContentY - maxContentY) / 2;

    this.translateX.set(nextX);
    this.translateY.set(nextY);
  }
}