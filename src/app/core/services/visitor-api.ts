import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  QrResolveResponse,
  Destination,
  RouteResponse,
  FloorPlanMeta,
  CurrentJourney,
  CompleteJourneyResponse,
} from '../../features/navigate/models/navigation.models';
import { environment } from '../../../environment/environment.prod';

@Injectable({ providedIn: 'root' })
export class VisitorApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.visitorApiBaseUrl;

resolveQrCode(code: string, sessionId?: string | null): Observable<QrResolveResponse> {
  const headers = sessionId ? new HttpHeaders({ 'X-Session-Id': sessionId }) : undefined;
  return this.http.get<QrResolveResponse>(
    `${this.baseUrl}/qr/${encodeURIComponent(code)}`,
    { headers }
  );
}

// Renamed from the old GET-with-query-params version to a session-scoped POST
calculateRoute(sessionId: string, destinationNodeId: number): Observable<RouteResponse> {
  return this.http.post<RouteResponse>(
    `${this.baseUrl}/sessions/${sessionId}/route`,
    { destinationNodeId }
  );
}

getCurrentJourney(sessionId: string): Observable<CurrentJourney> {
  return this.http.get<CurrentJourney>(`${this.baseUrl}/sessions/${sessionId}`);
}

updateLocation(sessionId: string, nodeId: number): Observable<RouteResponse> {
  return this.http.post<RouteResponse>(
    `${this.baseUrl}/sessions/${sessionId}/location`,
    { nodeId }
  );
}

completeJourney(sessionId: string): Observable<CompleteJourneyResponse> {
  return this.http.post<CompleteJourneyResponse>(
    `${this.baseUrl}/sessions/${sessionId}/complete`,
    null
  );
}

  getDestinations(venueId: number): Observable<Destination[]> {
    return this.http.get<Destination[]>(`${this.baseUrl}/venues/${venueId}/destinations`);
  }


  getFloorPlanMeta(floorId: number): Observable<FloorPlanMeta> {
    return this.http.get<FloorPlanMeta>(`${this.baseUrl}/floors/${floorId}/floor-plan`);
  }

  /** Used directly as an <img [src]> — no need to route binary bytes through HttpClient. */
  getFloorPlanImageUrl(floorId: number): string {
    return `${this.baseUrl}/floors/${floorId}/floor-plan/image`;
  }
}