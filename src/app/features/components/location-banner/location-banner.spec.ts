import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocationBanner } from './location-banner';

describe('LocationBanner', () => {
  let component: LocationBanner;
  let fixture: ComponentFixture<LocationBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationBanner],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationBanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
