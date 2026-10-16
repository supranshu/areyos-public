/**
 * Navigation steps: one step per floor leg. A leg runs from where the visitor enters a floor to where
 * they leave it (stairs / lift / ramp) or reach the destination — e.g. "Entrance → Stairs", then
 * "Stairs → Nurse Station". The map draws each leg's full path, so per-turn steps aren't needed.
 * There is no live positioning; the visitor confirms each leg.
 */
import { RoutePoint, RouteView } from './navigation.models';

export type StepKind = 'leg' | 'final';

export interface RouteStep {
  kind: StepKind;
  /** Index into RouteView.points where this leg starts (where the blue dot sits). */
  anchorIndex: number;
  anchor: RoutePoint;
  /** Where this leg ends: a floor-change node, or the destination. */
  target: RoutePoint;
  title: string;
  detail: string;
  /** Material icon ligature for the step. */
  icon: string;
  /** Label for the button that confirms this leg is done. */
  doneLabel: string;
  /** Rough minutes left from the start of this leg to the destination, scaled from the backend ETA. */
  minutesLeft: number;
}

function distance(a: RoutePoint, b: RoutePoint): number {
  return a.floorId === b.floorId ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
}

function connector(point: RoutePoint): { noun: string; icon: string } {
  switch (point.type) {
    case 'ELEVATOR':
      return { noun: 'lift', icon: 'elevator' };
    case 'RAMP':
      return { noun: 'ramp', icon: 'trending_up' };
    default:
      return { noun: 'stairs', icon: 'stairs' };
  }
}

export function buildRouteSteps(route: RouteView, destinationName: string): RouteStep[] {
  const points = route.points;
  if (points.length === 0) return [];

  // Distance remaining from each point to the end (same-floor segments only; floor changes have no geometry).
  const remaining = new Array<number>(points.length).fill(0);
  for (let i = points.length - 2; i >= 0; i--) {
    remaining[i] = remaining[i + 1] + distance(points[i], points[i + 1]);
  }
  const total = remaining[0] || 1;
  const minutesLeft = (i: number) => Math.max(1, Math.ceil((remaining[i] / total) * route.eta));
  const floorNumber = new Map(route.floors.map((f) => [f.floorId, f.floorNumber]));

  // Split into legs at every floor change.
  const legStarts = [0];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].floorId !== points[i + 1].floorId) legStarts.push(i + 1);
  }

  return legStarts.map((start, legIndex) => {
    const isFinal = legIndex === legStarts.length - 1;
    const end = isFinal ? points.length - 1 : legStarts[legIndex + 1] - 1;
    const anchor = points[start];
    const target = points[end];

    if (isFinal) {
      return {
        kind: 'final' as const,
        anchorIndex: start,
        anchor,
        target,
        title: `Walk to ${destinationName}`,
        detail: `Follow the blue line on ${anchor.floorName}`,
        icon: 'directions_walk',
        doneLabel: "I've arrived",
        minutesLeft: minutesLeft(start),
      };
    }

    const next = points[end + 1];
    const { noun, icon } = connector(target);
    const up = (floorNumber.get(next.floorId) ?? 0) > (floorNumber.get(target.floorId) ?? 0);
    return {
      kind: 'leg' as const,
      anchorIndex: start,
      anchor,
      target,
      title: `Walk to ${target.name}`,
      detail: `Then take the ${noun} ${up ? 'up' : 'down'} to ${next.floorName}`,
      icon,
      doneLabel: `I'm on ${next.floorName}`,
      minutesLeft: minutesLeft(start),
    };
  });
}
