import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouteResponse } from '../../navigate/models/navigation.models';

@Component({
  selector: 'app-route-summary',
  imports: [DecimalPipe],
  templateUrl: './route-summary.html',
  styleUrl: './route-summary.scss',
})
export class RouteSummary {
  readonly route = input.required<RouteResponse>();
  readonly clear = output<void>();
  readonly complete = output<void>();
}