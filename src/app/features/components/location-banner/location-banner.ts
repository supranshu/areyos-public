import { Component, input, output } from '@angular/core';
import { StartPoint, Venue } from '../../navigate/models/navigation.models';
import { floorCode } from '../../navigate/models/destination-icons';

/** Bottom sheet on the map screen: welcome message, current location and the search entry point. */
@Component({
  selector: 'app-location-banner',
  imports: [],
  templateUrl: './location-banner.html',
  styleUrl: './location-banner.scss',
})
export class LocationBanner {
  readonly venue = input.required<Venue>();
  readonly startPoint = input.required<StartPoint>();
  readonly search = output<void>();

  readonly floorCode = floorCode;
}
