import { Component, input, output } from '@angular/core';
import { floorCode } from '../../navigate/models/destination-icons';

export interface FloorOption {
  id: number;
  name: string;
  floorNumber: number;
}

/** "Ground floor (G) ▾" pill. A native <select> underneath, so it gets the platform picker on phones. */
@Component({
  selector: 'app-floor-switcher',
  imports: [],
  templateUrl: './floor-switcher.html',
  styleUrl: './floor-switcher.scss',
})
export class FloorSwitcher {
  readonly floors = input.required<FloorOption[]>();
  readonly activeFloorId = input<number | null>(null);
  /** Floors the current route passes through get a dot in the label. */
  readonly routeFloorIds = input<number[]>([]);
  readonly floorSelected = output<number>();

  label(floor: FloorOption): string {
    const onRoute = this.routeFloorIds().includes(floor.id) ? ' • on route' : '';
    return `${floor.name} (${floorCode(floor.floorNumber)})${onRoute}`;
  }

  onChange(value: string): void {
    this.floorSelected.emit(Number(value));
  }
}
