import { Component, ElementRef, afterNextRender, computed, input, output, signal, viewChild } from '@angular/core';
import { Destination, StartPoint } from '../../navigate/models/navigation.models';
import { PlaceIcon, minutesFor, placeIcon } from '../../navigate/models/destination-icons';

interface DestinationRow {
  destination: Destination;
  icon: PlaceIcon;
  /** Straight-line walking estimate; only known on the visitor's own floor. */
  minutes: number | null;
}

interface FloorGroup {
  floorId: number;
  floorName: string;
  isHere: boolean;
  rows: DestinationRow[];
}

/** Full-screen destination search (rendered only while open). Results are grouped by floor, visitor's floor first. */
@Component({
  selector: 'app-destination-selector',
  imports: [],
  templateUrl: './destination-selector.html',
  styleUrl: './destination-selector.scss',
})
export class DestinationSelector {
  readonly destinations = input.required<Destination[]>();
  readonly startPoint = input<StartPoint | null>(null);
  readonly destinationSelected = output<Destination>();
  readonly closed = output<void>();

  readonly searchTerm = signal('');
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly groups = computed<FloorGroup[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const start = this.startPoint();
    const groups = new Map<number, FloorGroup>();

    for (const destination of this.destinations()) {
      if (destination.nodeId === start?.nodeId) continue;
      if (term && !destination.name.toLowerCase().includes(term) && !destination.floorName.toLowerCase().includes(term)) {
        continue;
      }
      const isHere = start?.floorId === destination.floorId;
      let group = groups.get(destination.floorId);
      if (!group) {
        group = { floorId: destination.floorId, floorName: destination.floorName, isHere, rows: [] };
        groups.set(destination.floorId, group);
      }
      group.rows.push({
        destination,
        icon: placeIcon(destination.name),
        minutes: isHere && start ? minutesFor(Math.hypot(destination.x - start.x, destination.y - start.y)) : null,
      });
    }

    for (const group of groups.values()) {
      group.rows.sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0) || a.destination.name.localeCompare(b.destination.name));
    }
    return [...groups.values()].sort((a, b) => Number(b.isHere) - Number(a.isHere));
  });

  readonly resultCount = computed(() => this.groups().reduce((n, g) => n + g.rows.length, 0));

  constructor() {
    afterNextRender(() => this.inputRef()?.nativeElement.focus());
  }

  clear(): void {
    this.searchTerm.set('');
    this.inputRef()?.nativeElement.focus();
  }

  /** Enter picks the result when the search narrows to exactly one place. */
  chooseOnlyResult(): void {
    const groups = this.groups();
    if (this.resultCount() === 1) this.choose(groups[0].rows[0].destination);
  }

  choose(destination: Destination): void {
    this.destinationSelected.emit(destination);
  }
}
