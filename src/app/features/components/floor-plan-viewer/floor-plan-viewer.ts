import { Component, computed, input } from '@angular/core';
import { Destination, FloorPlanMeta, RoutePoint, StartPoint } from '../../navigate/models/navigation.models';


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

  // Native image pixel space — makes x/y from the API usable as SVG coords directly.
  readonly viewBox = computed(() => {
    const plan = this.floorPlan();
    return plan ? `0 0 ${plan.width} ${plan.height}` : '0 0 1 1';
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

  // Intermediate junction/elevator points — start & destination get distinct markers instead.
  readonly waypoints = computed(() =>
    this.routePoints().filter(
      (p) => p.type !== 'DESTINATION' && p.nodeId !== this.startPoint()?.nodeId
    )
  );
}