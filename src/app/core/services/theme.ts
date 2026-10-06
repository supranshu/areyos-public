import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.preferredTheme());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
  }

  toggle(): void {
    this.apply(this._theme() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: Theme): void {
    this._theme.set(theme);
    document.documentElement.dataset['theme'] = theme;
  }

  private preferredTheme(): Theme {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
