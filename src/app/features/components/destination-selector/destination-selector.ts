import { Component, ElementRef, afterNextRender, computed, input, output, signal, viewChild } from '@angular/core';
import { Destination, StartPoint } from '../../navigate/models/navigation.models';
import { PlaceIcon, minutesFor, placeIcon } from '../../navigate/models/destination-icons';

interface DestinationRow {
  destination: Destination;
  icon: PlaceIcon;
  /** "Ground floor • ~2 min" — the time is a straight-line estimate, only shown on the visitor's floor. */
  meta: string;
}

/** Full-screen destination search (rendered only while open). */
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

  readonly rows = computed<DestinationRow[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const start = this.startPoint();
    return this.destinations()
      .filter((d) => d.nodeId !== start?.nodeId)
      .filter((d) => !term || d.name.toLowerCase().includes(term) || d.floorName.toLowerCase().includes(term))
      .map((destination) => {
        const sameFloor = start && start.floorId === destination.floorId;
        const minutes = sameFloor
          ? ` • ~${minutesFor(Math.hypot(destination.x - start.x, destination.y - start.y))} min`
          : '';
        return { destination, icon: placeIcon(destination.name), meta: `${destination.floorName}${minutes}` };
      });
  });

  constructor() {
    afterNextRender(() => this.inputRef()?.nativeElement.focus());
  }

  clear(): void {
    this.searchTerm.set('');
    this.inputRef()?.nativeElement.focus();
  }

  choose(destination: Destination): void {
    this.destinationSelected.emit(destination);
  }
}
