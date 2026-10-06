import { Component, computed, input, output } from '@angular/core';
import { Destination, RouteView } from '../../navigate/models/navigation.models';
import { placeIcon } from '../../navigate/models/destination-icons';

/** Route preview sheet: destination, time and floors, then "Start Navigation". */
@Component({
  selector: 'app-route-summary',
  imports: [],
  templateUrl: './route-summary.html',
  styleUrl: './route-summary.scss',
})
export class RouteSummary {
  readonly route = input.required<RouteView>();
  readonly destination = input.required<Destination>();
  readonly start = output<void>();
  readonly clear = output<void>();

  readonly icon = computed(() => placeIcon(this.destination().name));
  readonly floorChanges = computed(() => Math.max(0, this.route().floors.length - 1));
}
