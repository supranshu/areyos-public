import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FloorPlanViewer } from './floor-plan-viewer';

describe('FloorPlanViewer', () => {
  let component: FloorPlanViewer;
  let fixture: ComponentFixture<FloorPlanViewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloorPlanViewer],
    }).compileComponents();

    fixture = TestBed.createComponent(FloorPlanViewer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
