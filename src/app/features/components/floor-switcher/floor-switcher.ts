import { Component, input, output } from '@angular/core';

export interface RouteFloorOption {
  floorId: number;
  floorName: string;
}

@Component({
  selector: 'app-floor-switcher',
  imports: [],
  templateUrl: './floor-switcher.html',
  styleUrl: './floor-switcher.scss',
})
export class FloorSwitcher {
  readonly floors = input.required<RouteFloorOption[]>();
  readonly activeFloorId = input<number | null>(null);
  readonly floorSelected = output<number>();
}