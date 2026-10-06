import { Component, input } from '@angular/core';
import { BrandMark } from '../brand-mark/brand-mark';

/** Full-screen branded page (loading, idle, error, journey complete). Content is projected below the logo. */
@Component({
  selector: 'app-splash-screen',
  imports: [BrandMark],
  template: `
    <section class="splash">
      <div class="splash__glow" aria-hidden="true"></div>
      <app-brand-mark [size]="64" [stacked]="true" [subtitle]="tagline()" />
      @if (illustration()) {
        <svg class="splash__art" viewBox="0 0 240 120" aria-hidden="true">
          <g fill="var(--brand-tint)" stroke="#80AAFF" stroke-width="1.5">
            <rect x="20" y="58" width="44" height="52" rx="3" />
            <rect x="70" y="34" width="56" height="76" rx="3" />
            <rect x="132" y="48" width="40" height="62" rx="3" />
            <rect x="178" y="66" width="44" height="44" rx="3" />
          </g>
          <g fill="#80AAFF" opacity="0.7">
            <rect x="80" y="44" width="10" height="8" rx="1" /><rect x="96" y="44" width="10" height="8" rx="1" />
            <rect x="80" y="60" width="10" height="8" rx="1" /><rect x="96" y="60" width="10" height="8" rx="1" />
            <rect x="80" y="76" width="10" height="8" rx="1" /><rect x="142" y="58" width="8" height="8" rx="1" />
            <rect x="154" y="58" width="8" height="8" rx="1" /><rect x="142" y="74" width="8" height="8" rx="1" />
            <rect x="30" y="68" width="8" height="8" rx="1" /><rect x="44" y="68" width="8" height="8" rx="1" />
            <rect x="188" y="76" width="8" height="8" rx="1" /><rect x="202" y="76" width="8" height="8" rx="1" />
          </g>
          <line x1="8" y1="110" x2="232" y2="110" stroke="#80AAFF" stroke-width="1.5" />
          <g class="splash__pin">
            <path d="M120 98c-9-12-15-20-15-28a15 15 0 0 1 30 0c0 8-6 16-15 28Z" fill="#1854C8" />
            <circle cx="120" cy="70" r="6" fill="#fff" />
          </g>
        </svg>
      }
      <div class="splash__content">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    .splash {
      position: relative;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 28px;
      padding: 40px 24px calc(40px + env(safe-area-inset-bottom));
      text-align: center;
      overflow: hidden;
      background: var(--paper);
    }
    .splash__glow {
      position: absolute;
      inset: -30% -30% auto;
      height: 70%;
      background: radial-gradient(closest-side, var(--brand-tint), transparent);
      pointer-events: none;
    }
    .splash__art {
      position: relative;
      width: min(260px, 70vw);
    }
    .splash__pin {
      animation: splash-bounce 1.6s ease-in-out infinite;
    }
    .splash__content {
      position: relative;
      width: min(340px, 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      color: var(--body-gray);
    }
    @keyframes splash-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
  `,
})
export class SplashScreen {
  readonly tagline = input<string | null>('Indoor Navigation for a Better Tomorrow');
  readonly illustration = input(false);
}
