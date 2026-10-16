import { Component, input } from '@angular/core';

/** Areyos logo, optionally with the wordmark and a subtitle line. */
@Component({
  selector: 'app-brand-mark',
  template: `
    <div class="brand" [class.brand--stacked]="stacked()">
      <img class="brand__logo" src="logo.png" alt="" [attr.width]="size()" [attr.height]="size()" />
      @if (wordmark()) {
        <div class="brand__text">
          <span class="brand__name">Areyos</span>
          @if (subtitle()) {
            <span class="brand__subtitle">{{ subtitle() }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .brand--stacked {
      flex-direction: column;
      gap: 12px;
      text-align: center;
    }
    .brand__logo {
      flex-shrink: 0;
      border-radius: 24%;
      box-shadow: 0 8px 20px -8px var(--accent-glow);
    }
    .brand__text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .brand__name {
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: -0.03em;
      color: var(--ink);
      line-height: 1.15;
    }
    .brand--stacked .brand__name {
      font-size: 1.6rem;
    }
    .brand__subtitle {
      font-size: 0.78rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand--stacked .brand__subtitle {
      font-size: 0.9rem;
      white-space: normal;
    }
  `,
})
export class BrandMark {
  readonly size = input(32);
  readonly wordmark = input(true);
  readonly stacked = input(false);
  readonly subtitle = input<string | null>(null);
}
