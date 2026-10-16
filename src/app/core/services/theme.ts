import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'areyos-theme';
/** Matches --bg in styles.scss, so the phone's browser bar blends into the page. */
const BAR_COLOR: Record<Theme, string> = { light: '#f3f5fa', dark: '#05080f' };

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.initialTheme());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
  }

  toggle(): void {
    const next = this._theme() === 'dark' ? 'light' : 'dark';
    this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / storage blocked: the choice just won't be remembered.
    }
  }

  private apply(theme: Theme): void {
    this._theme.set(theme);
    document.documentElement.dataset['theme'] = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', BAR_COLOR[theme]));
  }

  private initialTheme(): Theme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // fall through to the OS preference
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
