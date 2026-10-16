import { Component, computed, input, output, signal } from '@angular/core';
import { Destination, StartPoint, Venue } from '../../navigate/models/navigation.models';
import { PlaceIcon, floorCode, placeIcon } from '../../navigate/models/destination-icons';

interface QuickPick {
  label: string;
  icon: PlaceIcon;
  destination: Destination;
}

/** Common needs, in the order they're offered. Matched on the icon picked from the destination name. */
const QUICK_PICKS: { icon: string; label: string }[] = [
  { icon: 'wc', label: 'Restrooms' },
  { icon: 'support_agent', label: 'Help desk' },
  { icon: 'restaurant', label: 'Food' },
  { icon: 'local_pharmacy', label: 'Pharmacy' },
  { icon: 'meeting_room', label: 'Exit' },
  { icon: 'local_atm', label: 'ATM' },
  { icon: 'local_parking', label: 'Parking' },
];
const MAX_PICKS = 4;
const SWIPE_THRESHOLD_PX = 18;

/** Map screen card: where the visitor is, the search entry point and one-tap shortcuts to common places. */
@Component({
  selector: 'app-location-banner',
  imports: [],
  templateUrl: './location-banner.html',
  styleUrl: './location-banner.scss',
})
export class LocationBanner {
  readonly venue = input.required<Venue>();
  readonly startPoint = input.required<StartPoint>();
  readonly destinations = input<Destination[]>([]);
  readonly search = output<void>();
  readonly destinationSelected = output<Destination>();

  readonly floorCode = floorCode;

  /** Collapsed: only the handle and the search pill stay visible, giving the map more room. */
  readonly collapsed = signal(false);

  private dragStartY: number | null = null;
  private swiped = false;

  toggle(): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    this.collapsed.update((c) => !c);
  }

  /** Swipe the handle down to collapse, up to expand; a plain tap toggles. */
  onHandleDown(event: PointerEvent): void {
    this.dragStartY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onHandleUp(event: PointerEvent): void {
    if (this.dragStartY === null) return;
    const dy = event.clientY - this.dragStartY;
    this.dragStartY = null;
    if (Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
    this.swiped = true;
    this.collapsed.set(dy > 0);
  }

  /**
   * For each common category present in the venue, the closest match (same floor first).
   * Remaining slots go to the nearest other places (this floor first).
   */
  readonly picks = computed<QuickPick[]>(() => {
    const start = this.startPoint();
    const candidates = this.destinations()
      .filter((d) => d.nodeId !== start.nodeId)
      .map((d) => ({ d, icon: placeIcon(d.name) }));

    const distance = (d: Destination) =>
      d.floorId === start.floorId ? Math.hypot(d.x - start.x, d.y - start.y) : Number.POSITIVE_INFINITY;

    const picks: QuickPick[] = [];
    for (const { icon, label } of QUICK_PICKS) {
      const matches = candidates.filter((c) => c.icon.icon === icon);
      if (matches.length === 0) continue;
      const nearest = matches.reduce((best, c) => (distance(c.d) < distance(best.d) ? c : best));
      picks.push({ label, icon: nearest.icon, destination: nearest.d });
      if (picks.length === MAX_PICKS) return picks;
    }

    const picked = new Set(picks.map((p) => p.destination.nodeId));
    const nearby = candidates
      .filter((c) => !picked.has(c.d.nodeId))
      .sort((a, b) => distance(a.d) - distance(b.d) || 0)
      .slice(0, MAX_PICKS - picks.length);
    return [...picks, ...nearby.map((c) => ({ label: c.d.name, icon: c.icon, destination: c.d }))];
  });
}
