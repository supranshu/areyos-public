import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  CreateSessionRequest,
  FloorPlanInfo,
  PageResponse,
  PublicDestination,
  PublicFloorResponse,
  PublicQRResponse,
  PublicRouteResponse,
  PublicVenueResponse,
  SessionResponse,
} from '../models/api.models';
import { environment } from '../../../environment/environment';

/** Pulls the backend's `message` out of an error envelope, if there is one. */
export function apiErrorMessage(err: unknown): string | null {
  return err instanceof HttpErrorResponse ? (err.error?.message ?? null) : null;
}

/**
 * Typed client for /api/v1/public/** (no auth). Every JSON endpoint returns
 * `{ success, message, data }`; these methods unwrap and return `data`.
 */
@Injectable({ providedIn: 'root' })
export class VisitorApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.visitorApiBaseUrl;

  private get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${path}`, { params }).pipe(map((res) => res.data));
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, body).pipe(map((res) => res.data));
  }

  /** GET /qr/{code} — 404 if the code is unknown, inactive, or its venue isn't published. Records a QR_SCAN event. */
  resolveQrCode(code: string): Observable<PublicQRResponse> {
    return this.get(`/qr/${encodeURIComponent(code)}`);
  }

  /** GET /venues?search&page&size — published venues only, always paged (size capped at 50). */
  listVenues(options: { search?: string; page?: number; size?: number } = {}): Observable<PageResponse<PublicVenueResponse>> {
    let params = new HttpParams().set('page', options.page ?? 0).set('size', options.size ?? 20);
    if (options.search) params = params.set('search', options.search);
    return this.get('/venues', params);
  }

  /** GET /venues/{venueId} */
  getVenue(venueId: number): Observable<PublicVenueResponse> {
    return this.get(`/venues/${venueId}`);
  }

  /** GET /venues/{venueId}/floors — ordered by floor number. */
  getFloors(venueId: number): Observable<PublicFloorResponse[]> {
    return this.get(`/venues/${venueId}/floors`);
  }

  /** GET /venues/{venueId}/destinations?search&floorId — active DESTINATION nodes only. */
  getDestinations(venueId: number, options: { search?: string; floorId?: number } = {}): Observable<PublicDestination[]> {
    let params = new HttpParams();
    if (options.search) params = params.set('search', options.search);
    if (options.floorId != null) params = params.set('floorId', options.floorId);
    return this.get(`/venues/${venueId}/destinations`, params);
  }

  /** GET /venues/{venueId}/destinations/{nodeId} */
  getDestination(venueId: number, nodeId: number): Observable<PublicDestination> {
    return this.get(`/venues/${venueId}/destinations/${nodeId}`);
  }

  /** GET /floors/{floorId}/floor-plan — metadata only. */
  getFloorPlanMeta(floorId: number): Observable<FloorPlanInfo> {
    return this.get(`/floors/${floorId}/floor-plan`);
  }

  /** GET /floors/{floorId}/floor-plan/image — public and not enveloped, so it can be used directly as an <img [src]>. */
  getFloorPlanImageUrl(floorId: number): string {
    return `${this.baseUrl}/floors/${floorId}/floor-plan/image`;
  }

  /** GET /routes?venueId&fromNodeId&toNodeId — 404 if no path exists. Records a ROUTE_REQUESTED event. */
  calculateRoute(venueId: number, fromNodeId: number, toNodeId: number): Observable<PublicRouteResponse> {
    const params = new HttpParams()
      .set('venueId', venueId)
      .set('fromNodeId', fromNodeId)
      .set('toNodeId', toNodeId);
    return this.get('/routes', params);
  }

  /** POST /sessions — records SESSION_STARTED. */
  startSession(request: CreateSessionRequest): Observable<SessionResponse> {
    return this.post('/sessions', request);
  }

  /** POST /sessions/{sessionId}/complete — records JOURNEY_COMPLETED. */
  completeSession(sessionId: string): Observable<SessionResponse> {
    return this.post(`/sessions/${encodeURIComponent(sessionId)}/complete`, null);
  }
}
