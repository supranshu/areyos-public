import { Component, inject, input, output, signal } from '@angular/core';
import { BrandMark } from '../brand-mark/brand-mark';
import { ThemeService } from '../../../core/services/theme';

@Component({
  selector: 'app-top-bar',
  imports: [BrandMark],
  template: `
    <header class="top-bar">
      <app-brand-mark [size]="30" [subtitle]="venueName()" />
      <button
        type="button"
        class="top-bar__menu-btn"
        [attr.aria-expanded]="menuOpen()"
        aria-label="Menu"
        (click)="menuOpen.set(!menuOpen())"
      >
        <span class="mi">{{ menuOpen() ? 'close' : 'menu' }}</span>
      </button>

      @if (menuOpen()) {
        <div class="top-bar__backdrop" (click)="menuOpen.set(false)"></div>
        <nav class="top-bar__menu">
          <button type="button" (click)="choose(find)"><span class="mi">search</span>Find a destination</button>
          <button type="button" (click)="choose(scan)"><span class="mi">qr_code_scanner</span>Scan another QR code</button>
          <button type="button" (click)="toggleTheme()">
            <span class="mi">{{ theme.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
            {{ theme.theme() === 'dark' ? 'Light mode' : 'Dark mode' }}
          </button>
        </nav>
      }
    </header>
  `,
  styles: `
    .top-bar {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: calc(10px + env(safe-area-inset-top)) 16px 10px;
      background: var(--surface-raised);
      box-shadow: 0 1px 0 var(--hairline), 0 4px 16px rgba(10, 10, 10, 0.06);
    }
    .top-bar__menu-btn {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 12px;
      background: transparent;
      color: var(--ink);
      cursor: pointer;
    }
    .top-bar__menu-btn:hover {
      background: var(--paper-tint);
    }
    .top-bar__backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
    }
    .top-bar__menu {
      position: absolute;
      right: 12px;
      top: calc(100% + 6px);
      z-index: 41;
      min-width: 230px;
      padding: 6px;
      border-radius: 14px;
      background: var(--surface-raised);
      box-shadow: 0 12px 32px rgba(10, 10, 10, 0.18);
      border: 1px solid var(--hairline);
      animation: menu-in 0.15s ease-out;
    }
    .top-bar__menu button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 12px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--ink);
      font-size: 0.92rem;
      text-align: left;
      cursor: pointer;
    }
    .top-bar__menu button:hover {
      background: var(--paper-tint);
    }
    .top-bar__menu .mi {
      color: var(--brand-blue);
      font-size: 20px;
    }
    @keyframes menu-in {
      from { opacity: 0; transform: translateY(-4px); }
    }
  `,
})
export class TopBar {
  protected readonly theme = inject(ThemeService);

  readonly venueName = input<string | null>(null);
  readonly find = output<void>();
  readonly scan = output<void>();

  readonly menuOpen = signal(false);

  choose(action: { emit: () => void }): void {
    this.menuOpen.set(false);
    action.emit();
  }

  toggleTheme(): void {
    this.theme.toggle();
    this.menuOpen.set(false);
  }
}
