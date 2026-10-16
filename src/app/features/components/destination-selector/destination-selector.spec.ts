import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DestinationSelector } from './destination-selector';

describe('DestinationSelector', () => {
  let component: DestinationSelector;
  let fixture: ComponentFixture<DestinationSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinationSelector],
    }).compileComponents();

    fixture = TestBed.createComponent(DestinationSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
