import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('areyos-public');
  protected readonly theme = signal<'light' | 'dark'>('light');

  ngOnInit(): void {
    this.applyTheme(this.getPreferredTheme());
  }

  protected toggleTheme(): void {
    const nextTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  }

  private getPreferredTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    this.theme.set(theme);
    document.documentElement.dataset['theme'] = theme;
  }
}
