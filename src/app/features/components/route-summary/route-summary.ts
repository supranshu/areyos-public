import { Component, computed, input, output } from '@angular/core';
import { Destination, RouteView } from '../../navigate/models/navigation.models';
import { placeIcon } from '../../navigate/models/destination-icons';

/** Route preview card: destination, walk time, floor changes and arrival time, then "Start navigation". */
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
  /** Clock time the visitor would arrive if they set off now, e.g. "2:32 pm" (locale format). */
  readonly arrival = computed(() =>
    new Date(Date.now() + this.route().eta * 60_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  );
}
