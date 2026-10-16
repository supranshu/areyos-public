import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { FloorPlanMeta, RoutePoint } from '../../navigate/models/navigation.models';

/** A point on a floor plan, in the plan image's pixel coordinates. */
export interface MapPoint {
  floorId: number;
  x: number;
  y: number;
  nodeId?: number;
}

/** Where the route leaves or enters this floor (stairs / lift / ramp). Tapping it jumps to the other floor. */
export interface MapTransition extends MapPoint {
  label: string;
  icon: string;
  targetFloorId: number;
}

/** A tappable place marker (destination) on the map. */
export interface MapPoi extends MapPoint {
  nodeId: number;
  name: string;
  icon: string;
  color: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const FOCUS_SCALE = 2.2;
const FOCUS_ANIMATION_MS = 1200;

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

/** Corner radius for the drawn route, as a fraction of the plan's larger side. */
const CORNER_RADIUS_RATIO = 0.012;

/** Polyline with each interior corner rounded by a quadratic curve (radius capped at half of either leg). */
function roundedPath(points: { x: number; y: number }[], radius: number): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 0.5) {
      d += ` L ${cur.x},${cur.y}`;
      continue;
    }
    const ax = cur.x - ((cur.x - prev.x) / inLen) * r;
    const ay = cur.y - ((cur.y - prev.y) / inLen) * r;
    const bx = cur.x + ((next.x - cur.x) / outLen) * r;
    const by = cur.y + ((next.y - cur.y) / outLen) * r;
    d += ` L ${ax},${ay} Q ${cur.x},${cur.y} ${bx},${by}`;
  }
  if (points.length > 1) {
    const last = points[points.length - 1];
    d += ` L ${last.x},${last.y}`;
  }
  return d;
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
  /** Blue "you" dot. Only drawn when it is on the floor being shown. */
  readonly youAreHere = input<MapPoint | null>(null);
  /** Optional callout next to the blue dot (e.g. "You are here" + place name). */
  readonly youAreHereLabel = input<string | null>(null);
  readonly destination = input<MapPoi | null>(null);
  readonly routePoints = input<RoutePoint[]>([]);
  readonly pois = input<MapPoi[]>([]);
  readonly transitions = input<MapTransition[]>([]);
  /**
   * How the view frames things when the blue dot or route changes:
   * - `fit`: show the whole route on this floor (plus the blue dot / destination), north-up
   * - `follow`: zoom onto the blue dot, rotated so the route ahead points up
   * - `none`: leave the view alone
   */
  readonly focusMode = input<'none' | 'follow' | 'fit'>('none');
  /** Space covered by overlays (header / bottom sheet), so focusing centers on the visible part. */
  readonly topInset = input<number>(0);
  readonly bottomInset = input<number>(0);
  readonly placeholder = input<string>('Loading floor plan…');

  readonly poiSelected = output<number>();
  readonly floorJump = output<number>();

  private readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly stageSize = signal({ width: 0, height: 0 });

  // --- pan/zoom state ---
  private readonly scale = signal(1);
  private readonly rotation = signal(0);
  private readonly translateX = signal(0);
  private readonly translateY = signal(0);

  readonly canvasTransform = computed(
    () =>
      `translate(${this.translateX()}px, ${this.translateY()}px) rotate(${this.rotation()}deg) scale(${this.scale()})`
  );
  readonly isZoomed = computed(() => this.scale() > 1.01 || Math.abs(this.rotation()) > 0.5);

  /** Keeps HTML markers upright and at a constant size while the canvas rotates/zooms. */
  readonly markerCounterTransform = computed(
    () => `rotate(${-this.rotation()}deg) scale(${1 / this.scale()})`
  );

  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance = 0;
  private lastPinchAngle = 0;
  private lastPinchMidpoint: { x: number; y: number } | null = null;
  private lastPanPoint: { x: number; y: number } | null = null;

  readonly viewBox = computed(() => {
    const plan = this.floorPlan();
    return plan ? `0 0 ${plan.width} ${plan.height}` : '0 0 1 1';
  });

  /**
   * The image is letterboxed inside the stage (object-fit: contain), and the SVG overlay uses
   * preserveAspectRatio "meet", so both share this mapping from plan pixels to stage pixels.
   */
  private readonly contentBox = computed(() => {
    const plan = this.floorPlan();
    const { width, height } = this.stageSize();
    if (!plan || !width || !height || !plan.width || !plan.height) return null;
    const k = Math.min(width / plan.width, height / plan.height);
    return { k, offsetX: (width - plan.width * k) / 2, offsetY: (height - plan.height * k) / 2 };
  });

  /**
   * Vertical offset of the unzoomed view: moves the plan from the middle of the screen to the middle of the
   * part not covered by the top bar / bottom sheet, without pushing its top edge under the top bar.
   */
  private readonly homeOffsetY = computed(() => {
    const box = this.contentBox();
    const plan = this.floorPlan();
    const { height } = this.stageSize();
    if (!box || !plan) return 0;
    const top = this.topInset();
    const visibleCenter = top + (height - top - this.bottomInset()) / 2;
    const raise = visibleCenter - height / 2;
    return Math.max(raise, Math.min(0, top - box.offsetY));
  });

  toStage(point: { x: number; y: number }): { left: number; top: number } {
    const box = this.contentBox();
    if (!box) return { left: 0, top: 0 };
    return { left: box.offsetX + point.x * box.k, top: box.offsetY + point.y * box.k };
  }

  private onThisFloor<T extends MapPoint>(point: T | null): T | null {
    const plan = this.floorPlan();
    return point && plan && point.floorId === plan.floorId ? point : null;
  }

  readonly youOnThisFloor = computed(() => this.onThisFloor(this.youAreHere()));
  readonly destinationOnThisFloor = computed(() => this.onThisFloor(this.destination()));
  readonly poisOnThisFloor = computed(() => {
    const plan = this.floorPlan();
    const destinationId = this.destination()?.nodeId;
    return plan ? this.pois().filter((p) => p.floorId === plan.floorId && p.nodeId !== destinationId) : [];
  });

  readonly waypoints = computed(() => {
    const you = this.youAreHere()?.nodeId;
    const destination = this.destination()?.nodeId;
    return this.routePoints().filter(
      (p) => !p.bend && p.nodeId !== you && p.nodeId !== destination && p.type !== 'DESTINATION'
    );
  });

  // --- route draw + flow animation ---
  readonly pathD = computed(() => {
    const plan = this.floorPlan();
    const radius = plan ? Math.max(plan.width, plan.height) * CORNER_RADIUS_RATIO : 0;
    return roundedPath(this.routePoints(), radius);
  });

  readonly transitionsOnThisFloor = computed(() => {
    const plan = this.floorPlan();
    return plan ? this.transitions().filter((t) => t.floorId === plan.floorId) : [];
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
    // Track the stage size (it changes with viewport, orientation and when the map first appears).
    effect((onCleanup) => {
      const stage = this.stageRef()?.nativeElement;
      if (!stage) return;
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        this.stageSize.set({ width, height });
      });
      observer.observe(stage);
      onCleanup(() => observer.disconnect());
    });

    // Reset the view whenever the floor changes.
    effect(() => {
      this.floorPlan();
      this.resetView();
    });

    // Keep the unzoomed view centered in the visible area as the stage or overlays resize (e.g. sheet collapsed).
    effect(() => {
      const offsetY = this.homeOffsetY();
      if (untracked(this.isZoomed)) return;
      this.translateX.set(0);
      this.translateY.set(offsetY);
    });

    // Re-frame whenever the blue dot, route, floor or available space changes.
    effect(() => {
      const mode = this.focusMode();
      const you = this.youOnThisFloor();
      const box = this.contentBox();
      this.routePoints();
      this.destinationOnThisFloor();
      this.topInset();
      this.bottomInset();
      if (mode === 'none' || !box) return;
      if (mode === 'fit') {
        queueMicrotask(() => this.fitToRoute());
      } else if (you) {
        queueMicrotask(() => this.zoomToPoint(you.x, you.y, this.routeHeadingRotation(you)));
      }
    });

    // Restart the draw + flow animation whenever the visible route changes.
    effect(() => {
      this.pathD();
      queueMicrotask(() => this.startRouteAnimation());
    });

    this.destroyRef.onDestroy(() => {
      this.stopRouteAnimation();
      this.stopFocusAnimation();
    });
  }

  jumpToFloor(event: Event, floorId: number): void {
    event.stopPropagation();
    this.floorJump.emit(floorId);
  }

  selectPoi(event: Event, nodeId: number): void {
    event.stopPropagation();
    this.poiSelected.emit(nodeId);
  }

  /** Recenter button: re-applies the current framing (or focuses the blue dot / whole floor when idle). */
  recenter(): void {
    if (this.focusMode() === 'fit') {
      this.fitToRoute();
      return;
    }
    const you = this.youOnThisFloor();
    if (you) {
      this.zoomToPoint(you.x, you.y, this.focusMode() === 'follow' ? this.routeHeadingRotation(you) : 0);
    } else {
      this.resetZoom();
    }
  }

  /** Zoom so the route on this floor, the blue dot and the destination all fit in the visible area. */
  private fitToRoute(): void {
    const stage = this.stageRef()?.nativeElement;
    if (!stage || !this.contentBox()) return;

    const targets: { x: number; y: number }[] = [...this.routePoints()];
    const you = this.youOnThisFloor();
    const destination = this.destinationOnThisFloor();
    if (you) targets.push(you);
    if (destination) targets.push(destination);
    if (targets.length === 0) {
      this.resetView();
      return;
    }

    const stagePoints = targets.map((p) => this.toStage(p));
    const minX = Math.min(...stagePoints.map((p) => p.left));
    const maxX = Math.max(...stagePoints.map((p) => p.left));
    const minY = Math.min(...stagePoints.map((p) => p.top));
    const maxY = Math.max(...stagePoints.map((p) => p.top));

    const padding = 56; // room for markers and labels around the route
    const extraTop = 40; // floor-change bubbles sit above their node
    const availableW = Math.max(1, stage.clientWidth - padding * 2);
    const availableH = Math.max(1, stage.clientHeight - this.topInset() - this.bottomInset() - padding * 2 - extraTop);
    const fit = Math.min(availableW / Math.max(1, maxX - minX), availableH / Math.max(1, maxY - minY));
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(fit, FOCUS_SCALE * 1.4)));

    const centerX = stage.clientWidth / 2;
    const centerY = this.topInset() + extraTop / 2 + (stage.clientHeight - this.topInset() - this.bottomInset() - extraTop) / 2;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    this.animateToView(scale, 0, centerX - midX * scale, centerY - midY * scale);
  }

  private startRouteAnimation(): void {
    this.stopRouteAnimation();
    const pathEl = this.routeLineRef()?.nativeElement;
    if (!pathEl || !this.pathD()) return;

    this.pathLength = pathEl.getTotalLength();
    this.drawStartTime = performance.now();
    this.lastFrameTime = this.drawStartTime;
    this.flowOffset = 0;

    // With "reduce motion" on, the route appears at once and the arrows sit still along it.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const drawDurationMs = reduceMotion
      ? 1
      : Math.min(MAX_DRAW_MS, Math.max(MIN_DRAW_MS, this.pathLength * DRAW_MS_PER_UNIT));
    const flowSpeed = reduceMotion ? 0 : FLOW_SPEED;
    const bobAmplitude = reduceMotion ? 0 : ARROW_BOB_AMPLITUDE;

    const tick = (now: number) => {
      const deltaSec = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      const drawT = Math.min(1, (now - this.drawStartTime) / drawDurationMs);
      const revealLength = easeOutCubic(drawT) * this.pathLength;

      // Reveal the path by shrinking the dash-offset toward 0.
      pathEl.style.strokeDasharray = `${this.pathLength}`;
      pathEl.style.strokeDashoffset = `${this.pathLength - revealLength}`;

      // Keep advancing so arrows keep moving after the line is fully drawn.
      this.flowOffset = this.pathLength > 0 ? (this.flowOffset + flowSpeed * deltaSec) % this.pathLength : 0;

      const arrows = this.arrowRefs();
      const spacing = this.pathLength / ARROW_COUNT;

      for (let i = 0; i < arrows.length; i++) {
        const el = arrows[i].nativeElement;
        const distance = this.pathLength > 0 ? (this.flowOffset + i * spacing) % this.pathLength : 0;

        // Hide arrows ahead of how far the line has been drawn so far.
        if (distance > revealLength || this.pathLength === 0) {
          el.style.opacity = '0';
          continue;
        }

        const point = pathEl.getPointAtLength(distance);
        const ahead = pathEl.getPointAtLength(Math.min(this.pathLength, distance + 1));
        const angleDeg = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI;

        el.style.opacity = '1';
        const bob = Math.sin(now * ARROW_BOB_SPEED + i * 1.7) * bobAmplitude;
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

  // --- pan/zoom ---

  resetView(): void {
    this.stopFocusAnimation();
    this.scale.set(1);
    this.rotation.set(0);
    this.translateX.set(0);
    this.translateY.set(untracked(this.homeOffsetY));
  }

  /** Reset-zoom button: animate back to the whole floor, north-up. */
  resetZoom(): void {
    this.animateToView(1, 0, 0, this.homeOffsetY());
  }

  private zoomToPoint(x: number, y: number, rotation: number): void {
    const stage = this.stageRef()?.nativeElement;
    if (!stage || stage.clientWidth === 0 || stage.clientHeight === 0 || !this.contentBox()) return;

    const { left: pointX, top: pointY } = this.toStage({ x, y });
    // Center of the part of the map that isn't covered by the header / bottom sheet.
    const centerX = stage.clientWidth / 2;
    const centerY = this.topInset() + (stage.clientHeight - this.topInset() - this.bottomInset()) / 2;

    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.animateToView(
      FOCUS_SCALE,
      rotation,
      centerX - (cos * pointX - sin * pointY) * FOCUS_SCALE,
      centerY - (sin * pointX + cos * pointY) * FOCUS_SCALE
    );
  }

  /** Rotation that makes the route leaving `origin` point up the screen. */
  private routeHeadingRotation(origin: MapPoint): number {
    const points = this.routePoints();
    if (points.length === 0) return 0;

    const startIndex = Math.max(0, points.findIndex((p) => p.nodeId === origin.nodeId));
    const next = points
      .slice(startIndex)
      .find((point) => Math.hypot(point.x - origin.x, point.y - origin.y) > 0.5);
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
      const eased = easeOutCubic(progress);
      this.scale.set(startScale + (targetScale - startScale) * eased);
      this.rotation.set(startRotation + rotationDelta * eased);
      this.translateX.set(startX + (targetX - startX) * eased);
      this.translateY.set(startY + (targetY - startY) * eased);
      this.clampTranslate();

      this.focusAnimationFrameId = progress < 1 ? requestAnimationFrame(tick) : null;
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
    // Let taps on place markers through as clicks.
    if ((event.target as HTMLElement).closest('.floor-plan-viewer__poi, .floor-plan-viewer__transition, .floor-plan-viewer__controls')) return;

    this.stopFocusAnimation();
    this.stageRef()?.nativeElement.setPointerCapture(event.pointerId);
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
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, this.scale() * factor);
  }

  onDoubleClick(event: MouseEvent): void {
    this.stopFocusAnimation();
    const rect = this.stageRef()!.nativeElement.getBoundingClientRect();
    this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, this.isZoomed() ? 1 : 2.5);
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
    return { x: (p1.x + p2.x) / 2 - rect.left, y: (p1.y + p2.y) / 2 - rect.top };
  }

  private normalizedAngleDelta(angle: number): number {
    return ((((angle + 180) % 360) + 360) % 360) - 180;
  }

  private zoomAt(px: number, py: number, newScale: number): void {
    this.transformAt(px, py, Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale)), this.rotation());
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
    // Allow panning content out from under the header / bottom sheet.
    const top = this.topInset();
    const bottom = this.bottomInset();
    const nextX =
      maxContentX - minContentX >= w
        ? Math.min(-minContentX, Math.max(w - maxContentX, this.translateX()))
        : (w - minContentX - maxContentX) / 2;
    const nextY =
      maxContentY - minContentY >= h
        ? Math.min(-minContentY + top, Math.max(h - maxContentY - bottom, this.translateY()))
        : (h - minContentY - maxContentY) / 2;

    this.translateX.set(nextX);
    this.translateY.set(nextY);
  }
}
