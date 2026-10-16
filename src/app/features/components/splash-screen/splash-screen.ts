import { Component, inject, input } from '@angular/core';
import { BrandMark } from '../brand-mark/brand-mark';
import { ThemeService } from '../../../core/services/theme';

/**
 * Full-screen branded page (home, loading, error, journey complete): soft aurora + blueprint grid
 * backdrop, brand bar on top, content projected into the middle.
 */
@Component({
  selector: 'app-splash-screen',
  imports: [BrandMark],
  template: `
    <section class="splash">
      <div class="splash__backdrop" aria-hidden="true">
        <div class="splash__aurora"></div>
        <div class="splash__grid"></div>
      </div>

      <header class="splash__top">
        <app-brand-mark [size]="30" />
        <button
          type="button"
          class="icon-btn"
          [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          (click)="theme.toggle()"
        >
          <span class="mi">{{ theme.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
        </button>
      </header>

      <main class="splash__body" [class.splash__body--fill]="fill()">
        @if (busy()) {
          <div class="splash__orbit" role="progressbar" aria-label="Loading">
            <img src="logo.png" alt="" width="56" height="56" />
          </div>
        }
        <ng-content />
      </main>
    </section>
  `,
  styles: `
    .splash {
      position: relative;
      isolation: isolate;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      padding: calc(12px + var(--safe-top)) 20px calc(24px + var(--safe-bottom));
      overflow: hidden;
      background: var(--bg);
    }

    .splash__backdrop {
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
    }
    .splash__aurora {
      position: absolute;
      inset: -20% -40% auto;
      height: 75%;
      background:
        radial-gradient(40% 50% at 30% 40%, var(--accent-glow), transparent 70%),
        radial-gradient(35% 45% at 72% 30%, color-mix(in srgb, var(--signal) 30%, transparent), transparent 70%);
      opacity: 0.55;
      filter: blur(20px);
      animation: aurora-drift 18s ease-in-out infinite alternate;
    }
    .splash__grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(var(--line) 1px, transparent 1px),
        linear-gradient(90deg, var(--line) 1px, transparent 1px);
      background-size: 36px 36px;
      background-position: center top;
      -webkit-mask-image: radial-gradient(ellipse 85% 55% at 50% 22%, #000 20%, transparent 72%);
      mask-image: radial-gradient(ellipse 85% 55% at 50% 22%, #000 20%, transparent 72%);
    }

    .splash__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: min(100%, 440px);
      margin: 0 auto;
      min-height: 48px;
    }

    .splash__body {
      flex: 1;
      width: min(100%, 400px);
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px 0 8px;
      text-align: center;
      color: var(--ink-2);
      animation: body-in 0.5s var(--ease-out) both;
    }
    .splash__body--fill {
      align-items: stretch;
      justify-content: stretch;
      text-align: left;
    }

    .splash__orbit {
      position: relative;
      width: 116px;
      height: 116px;
      display: grid;
      place-items: center;
      margin-bottom: 12px;
    }
    .splash__orbit::before,
    .splash__orbit::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
    }
    .splash__orbit::before {
      border: 1px solid var(--line-strong);
    }
    .splash__orbit::after {
      background: conic-gradient(from 0deg, transparent 0 62%, var(--accent) 100%);
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
      animation: orbit 1.1s linear infinite;
    }
    .splash__orbit img {
      border-radius: 24%;
      box-shadow: 0 12px 28px -10px var(--accent-glow);
      animation: breathe 2.2s ease-in-out infinite;
    }

    @keyframes aurora-drift {
      to { transform: translate3d(6%, 4%, 0) scale(1.08); }
    }
    @keyframes orbit {
      to { transform: rotate(360deg); }
    }
    @keyframes breathe {
      50% { transform: scale(0.94); }
    }
    @keyframes body-in {
      from { opacity: 0; transform: translateY(10px); }
    }
  `,
})
export class SplashScreen {
  protected readonly theme = inject(ThemeService);

  /** Shows the spinning orbit around the logo (loading states). */
  readonly busy = input(false);
  /** Lets the projected content lay itself out over the full height instead of being centered. */
  readonly fill = input(false);
}
