import { Component, inject, input, output, signal } from '@angular/core';
import { ThemeService } from '../../../core/services/theme';

/** Floating glass bar over the map: venue + floor on the left, search and menu on the right. */
@Component({
  selector: 'app-top-bar',
  template: `
    <header class="top-bar glass">
      <img class="top-bar__logo" src="logo.png" alt="Areyos" width="36" height="36" />
      <div class="top-bar__text">
        <p class="top-bar__venue">{{ venueName() ?? 'Areyos' }}</p>
        @if (floorName()) {
          <p class="top-bar__floor">{{ floorName() }}</p>
        }
      </div>

      <button type="button" class="icon-btn" aria-label="Find a destination" (click)="find.emit()">
        <span class="mi">search</span>
      </button>
      <button
        type="button"
        class="icon-btn"
        [attr.aria-expanded]="menuOpen()"
        aria-haspopup="menu"
        aria-label="More options"
        (click)="menuOpen.set(!menuOpen())"
      >
        <span class="mi">{{ menuOpen() ? 'close' : 'more_horiz' }}</span>
      </button>

      @if (menuOpen()) {
        <div class="top-bar__backdrop" (click)="menuOpen.set(false)"></div>
        <nav class="top-bar__menu glass" role="menu" (keydown.escape)="menuOpen.set(false)">
          <button type="button" role="menuitem" (click)="choose(find)">
            <span class="mi">search</span>Find a destination
          </button>
          <button type="button" role="menuitem" (click)="choose(scan)">
            <span class="mi">qr_code_scanner</span>Scan another QR code
          </button>
          <button type="button" role="menuitem" (click)="toggleTheme()">
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
      gap: 4px;
      height: 60px;
      padding: 0 6px 0 12px;
      border-radius: var(--radius-lg);
      animation: bar-in 0.4s var(--ease-out) both;
    }
    .top-bar__logo {
      flex-shrink: 0;
      margin-right: 8px;
      border-radius: 24%;
    }
    .top-bar__text {
      flex: 1;
      min-width: 0;
    }
    .top-bar__venue {
      font-weight: 650;
      font-size: 0.98rem;
      letter-spacing: -0.015em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .top-bar__floor {
      font-size: 0.78rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .top-bar__backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
    }
    .top-bar__menu {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      z-index: 41;
      min-width: 240px;
      padding: 6px;
      border-radius: 20px;
      background: var(--glass-strong);
      box-shadow: inset 0 1px 0 var(--glass-edge), var(--shadow-lg);
      transform-origin: top right;
      animation: menu-in 0.2s var(--ease-out);
    }
    .top-bar__menu button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 48px;
      padding: 0 14px;
      border: 0;
      border-radius: 14px;
      background: none;
      color: var(--ink);
      font-size: 0.95rem;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
    }
    .top-bar__menu button:hover {
      background: var(--fill-hover);
    }
    .top-bar__menu .mi {
      color: var(--accent-ink);
      font-size: 21px;
    }

    @keyframes bar-in {
      from { opacity: 0; transform: translateY(-10px); }
    }
    @keyframes menu-in {
      from { opacity: 0; transform: scale(0.94) translateY(-4px); }
    }
  `,
})
export class TopBar {
  protected readonly theme = inject(ThemeService);

  readonly venueName = input<string | null>(null);
  /** Floor currently shown on the map. */
  readonly floorName = input<string | null>(null);
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
