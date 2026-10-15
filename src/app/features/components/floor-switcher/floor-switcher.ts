import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { floorCode } from '../../navigate/models/destination-icons';

export interface FloorOption {
  id: number;
  name: string;
  floorNumber: number;
}

/** Up to this many floors are shown as a button stack; more collapse into a single button that opens a list. */
const MAX_INLINE_FLOORS = 5;

/**
 * Lift-style floor picker, top floor first. Floors on the current route get a dot.
 * Tall buildings get a compact "current floor" button that opens a scrollable floor list instead.
 */
@Component({
  selector: 'app-floor-switcher',
  imports: [],
  templateUrl: './floor-switcher.html',
  styleUrl: './floor-switcher.scss',
  host: {
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
})
export class FloorSwitcher {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly floors = input.required<FloorOption[]>();
  readonly activeFloorId = input<number | null>(null);
  readonly routeFloorIds = input<number[]>([]);
  readonly floorSelected = output<number>();

  readonly sortedFloors = computed(() => [...this.floors()].sort((a, b) => b.floorNumber - a.floorNumber));
  readonly compact = computed(() => this.floors().length > MAX_INLINE_FLOORS);
  readonly activeFloor = computed(() => this.floors().find((f) => f.id === this.activeFloorId()) ?? null);
  /** Some floor other than the one shown is on the route — hint at it on the closed compact button. */
  readonly routeElsewhere = computed(() => this.routeFloorIds().some((id) => id !== this.activeFloorId()));

  readonly open = signal(false);
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  constructor() {
    // Opening the list scrolls the current floor into view.
    effect(() => {
      const list = this.listRef()?.nativeElement;
      const item = list?.querySelector<HTMLElement>('[aria-current="true"]');
      if (list && item) list.scrollTop = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
    });
  }

  code(floor: FloorOption): string {
    return floorCode(floor.floorNumber);
  }

  ariaLabel(floor: FloorOption): string {
    return this.routeFloorIds().includes(floor.id) ? `${floor.name}, on your route` : floor.name;
  }

  select(floor: FloorOption): void {
    this.open.set(false);
    this.floorSelected.emit(floor.id);
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
