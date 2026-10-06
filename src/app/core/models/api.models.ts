/**
 * Exact shapes of the backend's public API (/api/v1/public/**). See API_CONTRACT.md §4.
 * Keep these 1:1 with the Java DTOs; UI-friendly shapes live in navigation.models.ts.
 */

export type NodeType = 'DESTINATION' | 'JUNCTION' | 'ENTRANCE' | 'ELEVATOR' | 'STAIRS' | 'RAMP';

/** Every JSON response is wrapped in this envelope; null fields are omitted. */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  page: number; // 0-based
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** GET /venues, GET /venues/{venueId} */
export interface PublicVenueResponse {
  id: number;
  name: string;
  type: string;
  address: string;
}

/** GET /venues/{venueId}/floors */
export interface PublicFloorResponse {
  id: number;
  venueId: number;
  name: string;
  floorNumber: number;
}

/** GET /venues/{venueId}/destinations, GET /venues/{venueId}/destinations/{nodeId} */
export interface PublicDestination {
  nodeId: number;
  name: string;
  type: 'DESTINATION';
  floorId: number;
  floorName: string;
  x: number;
  y: number;
}

/** GET /floors/{floorId}/floor-plan */
export interface FloorPlanInfo {
  floorId: number;
  floorName: string;
  floorNumber: number;
  storageKey: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
}

/** GET /qr/{code} */
export interface PublicQRResponse {
  code: string;
  venue: { id: number; name: string };
  startPoint: {
    nodeId: number;
    name: string;
    type: NodeType;
    floor: { id: number; name: string; floorNumber: number };
    x: number;
    y: number;
  };
}

/** A point on a floor plan, in the plan image's pixel coordinates. */
export interface PathPoint {
  x: number;
  y: number;
}

export interface PublicRouteNode {
  nodeId: number;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  /** Edge bend points walked from the previous node of this floor segment to this node. Empty for straight edges. */
  via: PathPoint[];
}

export interface PublicRouteFloor {
  floorId: number;
  floorName: string;
  floorNumber: number;
  path: PublicRouteNode[];
}

/** GET /routes?venueId&fromNodeId&toNodeId */
export interface PublicRouteResponse {
  venueId: number;
  fromNodeId: number;
  toNodeId: number;
  totalDistance: number;
  eta: number; // rough minutes
  floors: PublicRouteFloor[];
}

/** POST /sessions */
export interface CreateSessionRequest {
  venueId: number;
  startNodeId?: number;
  qrCode?: string;
}

/** POST /sessions, POST /sessions/{sessionId}/complete */
export interface SessionResponse {
  sessionId: string;
  venueId: number;
  startNodeId?: number; // omitted on complete
  status: 'ACTIVE' | 'COMPLETED';
}
