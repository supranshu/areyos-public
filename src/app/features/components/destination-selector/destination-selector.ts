import { Component, computed, input, output, signal } from '@angular/core';
import { Destination } from '../../navigate/models/navigation.models';


@Component({
  selector: 'app-destination-selector',
  imports: [],
  templateUrl: './destination-selector.html',
  styleUrl: './destination-selector.scss',
})
export class DestinationSelector {
  readonly destinations = input.required<Destination[]>();
  readonly selected = input<Destination | null>(null);
  readonly disabled = input<boolean>(false);
  readonly destinationSelected = output<Destination>();

  readonly searchTerm = signal<string>('');
  readonly isOpen = signal<boolean>(false);

  readonly filteredDestinations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.destinations();
    return term ? list.filter((d) => d.name.toLowerCase().includes(term)) : list;
  });

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.isOpen.set(true);
  }

  onFocus(): void {
    this.isOpen.set(true);
  }

  onBlur(): void {
    setTimeout(() => this.isOpen.set(false), 150);
  }

  choose(destination: Destination): void {
    this.destinationSelected.emit(destination);
    this.searchTerm.set('');
    this.isOpen.set(false);
  }
}