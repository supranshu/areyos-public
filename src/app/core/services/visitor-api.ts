import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  QrResolveResponse,
  Destination,
  RouteResponse,
  FloorPlanMeta,
} from '../../features/navigate/models/navigation.models';
import { environment } from '../../../environment/environment.prod';

@Injectable({ providedIn: 'root' })
export class VisitorApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.visitorApiBaseUrl;

  resolveQrCode(code: string): Observable<QrResolveResponse> {
    return this.http.get<QrResolveResponse>(`${this.baseUrl}/qr/${encodeURIComponent(code)}`);
  }

  getDestinations(venueId: number): Observable<Destination[]> {
    return this.http.get<Destination[]>(`${this.baseUrl}/venues/${venueId}/destinations`);
  }

  calculateRoute(venueId: number, fromNodeId: number, toNodeId: number): Observable<RouteResponse> {
    const params = {
      venueId: String(venueId),
      fromNodeId: String(fromNodeId),
      toNodeId: String(toNodeId),
    };
    return this.http.get<RouteResponse>(`${this.baseUrl}/routes`, { params });
  }

  getFloorPlanMeta(floorId: number): Observable<FloorPlanMeta> {
    return this.http.get<FloorPlanMeta>(`${this.baseUrl}/floors/${floorId}/floor-plan`);
  }

  /** Used directly as an <img [src]> — no need to route binary bytes through HttpClient. */
  getFloorPlanImageUrl(floorId: number): string {
    return `${this.baseUrl}/floors/${floorId}/floor-plan/image`;
  }
}