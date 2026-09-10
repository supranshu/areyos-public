import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('areyos-public');
  protected readonly isDarkMode = signal(this.getInitialTheme());

  private readonly document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      const theme = this.isDarkMode() ? 'dark' : 'light';
      this.document.documentElement.dataset['theme'] = theme;
      localStorage.setItem('areyos-theme', theme);
    });
  }

  protected toggleTheme(): void {
    this.isDarkMode.update((isDark) => !isDark);
  }

  private getInitialTheme(): boolean {
    const savedTheme = localStorage.getItem('areyos-theme');
    if (savedTheme) return savedTheme === 'dark';
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
