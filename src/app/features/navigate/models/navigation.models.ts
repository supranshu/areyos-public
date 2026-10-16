/**
 * UI view models for the navigate feature. Backend DTOs live in core/models/api.models.ts;
 * the mappers below are the only place that converts between the two.
 */
import {
  FloorPlanInfo,
  NodeType,
  PublicDestination,
  PublicQRResponse,
  PublicRouteResponse,
} from '../../../core/models/api.models';

export type { NodeType } from '../../../core/models/api.models';

export interface Venue {
  id: number;
  name: string;
}

/** Where the visitor scanned the QR code. Flattened from PublicQRResponse.startPoint. */
export interface StartPoint {
  nodeId: number;
  name: string;
  type: NodeType;
  floorId: number;
  floorName: string;
  floorNumber: number;
  x: number;
  y: number;
}

export type Destination = PublicDestination;

export type FloorPlanMeta = FloorPlanInfo;

/** One node along the route, tagged with the floor it's on. */
export interface RoutePoint {
  nodeId: number;
  name: string;
  type: NodeType;
  floorId: number;
  floorName: string;
  x: number;
  y: number;
  /**
   * True for an edge bend (a corner along a corridor) rather than a real node.
   * Bends get synthetic negative nodeIds and an empty name.
   */
  bend?: boolean;
}

export interface RouteFloorSummary {
  floorId: number;
  floorName: string;
  floorNumber: number;
}

export interface RouteView {
  venueId: number;
  fromNodeId: number;
  toNodeId: number;
  totalDistance: number;
  eta: number; // rough minutes, computed by the backend
  /** Floors in the order the route visits them. */
  floors: RouteFloorSummary[];
  /** Every node and edge bend on the route, in walking order, across all floors. */
  points: RoutePoint[];
}

export function toVenue(qr: PublicQRResponse): Venue {
  return { id: qr.venue.id, name: qr.venue.name };
}

export function toStartPoint(qr: PublicQRResponse): StartPoint {
  const sp = qr.startPoint;
  return {
    nodeId: sp.nodeId,
    name: sp.name,
    type: sp.type,
    floorId: sp.floor.id,
    floorName: sp.floor.name,
    floorNumber: sp.floor.floorNumber,
    x: sp.x,
    y: sp.y,
  };
}

export function toRouteView(route: PublicRouteResponse): RouteView {
  // The backend emits one segment per contiguous run on a floor, so a route can revisit a floor.
  const floors = new Map<number, RouteFloorSummary>();
  for (const { floorId, floorName, floorNumber } of route.floors) {
    if (!floors.has(floorId)) floors.set(floorId, { floorId, floorName, floorNumber });
  }

  return {
    venueId: route.venueId,
    fromNodeId: route.fromNodeId,
    toNodeId: route.toNodeId,
    totalDistance: route.totalDistance,
    eta: route.eta,
    floors: [...floors.values()],
    points: toRoutePoints(route),
  };
}

/** Flattens floor segments into one walking-order list, expanding each edge's bend points before its node. */
function toRoutePoints(route: PublicRouteResponse): RoutePoint[] {
  const points: RoutePoint[] = [];
  let bendId = 0;
  for (const floor of route.floors) {
    for (const node of floor.path) {
      for (const bend of node.via ?? []) {
        points.push({
          nodeId: --bendId,
          name: '',
          type: 'JUNCTION',
          floorId: floor.floorId,
          floorName: floor.floorName,
          x: bend.x,
          y: bend.y,
          bend: true,
        });
      }
      points.push({
        nodeId: node.nodeId,
        name: node.name,
        type: node.type,
        floorId: floor.floorId,
        floorName: floor.floorName,
        x: node.x,
        y: node.y,
      });
    }
  }
  return points;
}
