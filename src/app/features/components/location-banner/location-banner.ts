import { Component, input } from '@angular/core';
import { StartPoint, Venue } from '../../navigate/models/navigation.models';


@Component({
  selector: 'app-location-banner',
  imports: [],
  templateUrl: './location-banner.html',
  styleUrl: './location-banner.scss',
})
export class LocationBanner {
  readonly venue = input.required<Venue>();
  readonly startPoint = input.required<StartPoint>();
}