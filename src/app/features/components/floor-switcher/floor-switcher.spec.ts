import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FloorSwitcher } from './floor-switcher';

describe('FloorSwitcher', () => {
  let component: FloorSwitcher;
  let fixture: ComponentFixture<FloorSwitcher>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloorSwitcher],
    }).compileComponents();

    fixture = TestBed.createComponent(FloorSwitcher);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
