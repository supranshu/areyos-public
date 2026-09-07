export type NodeType = 'DESTINATION' | 'JUNCTION' | 'ELEVATOR' | string;

export interface Venue {
  id: number;
  name: string;
  type: string;
}

export interface StartPoint {
  nodeId: number;
  name: string;
  floorId: number;
  floorName: string;
  x: number;
  y: number;
}

export interface QrResolveResponse {
  venue: Venue;
  startPoint: StartPoint;
}

export interface Destination {
  nodeId: number;
  name: string;
  type: NodeType;
  floorId: number;
  floorName: string;
  x: number;
  y: number;
}

export interface RoutePoint {
  nodeId: number;
  name: string;
  type: NodeType;
  floorId: number;
  floorName: string;
  x: number;
  y: number;
}

export interface RouteResponse {
  venueId: number;
  fromNodeId: number;
  toNodeId: number;
  totalDistance: number;
  estimatedTimeMinutes: number;
  points: RoutePoint[];
}

export interface FloorPlanMeta {
  floorId: number;
  floorName: string;
  floorNumber: number;
  storageKey: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
}