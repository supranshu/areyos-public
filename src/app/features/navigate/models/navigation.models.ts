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

export interface JourneyDestination {
  nodeId: number;
  name: string;
  floorId: number;
  floorName: string;
}

export interface CurrentJourney {
  sessionId: string;
  status: 'ACTIVE' | 'COMPLETED' | string;
  venueId: number;
  venueName: string;
  currentPoint: StartPoint;
  destination: JourneyDestination | null;
  resumable: boolean;
}

export interface QrResolveResponse {
  sessionId: string;
  hasActiveJourney: boolean;
  venue: Venue;
  startPoint: StartPoint;
  activeJourney: CurrentJourney | null;
}

export interface CompleteJourneyResponse {
  sessionId: string;
  status: 'COMPLETED' | string;
  venueId: number;
  venueName: string;
  resumable: boolean;
}