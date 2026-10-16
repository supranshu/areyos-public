import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should initialize the document language and theme from browser preferences', () => {
    const mediaQueryList = {
      matches: true,
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
    } as MediaQueryList;

    spyOn(window, 'matchMedia').and.returnValue(mediaQueryList);
    spyOn(window.navigator, 'language').and.returnValue('ur-PK');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.lang = 'en';

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('ur');
    expect(fixture.componentInstance.currentLanguage()).toBe('ur');
  });
});
