import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Navigate } from './navigate';

describe('Navigate', () => {
  let component: Navigate;
  let fixture: ComponentFixture<Navigate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navigate],
    }).compileComponents();

    fixture = TestBed.createComponent(Navigate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
