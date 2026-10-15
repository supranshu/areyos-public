import { Component, computed, input, output } from '@angular/core';
import { RouteStep } from '../../navigate/models/route-steps';

/** One navigation leg (e.g. Entrance → Stairs). There is no live positioning, so the visitor confirms each leg. */
@Component({
  selector: 'app-instruction-card',
  template: `
    <section class="sheet glass step">
      <div class="step__top">
        <span class="eyebrow">
          @if (total() > 1) {
            Step {{ pad(index() + 1) }} <span class="step__of">/ {{ pad(total()) }}</span>
          } @else {
            Your route
          }
        </span>
        <span class="step__eta">
          <span class="mi">schedule</span>
          <span><span class="mono">{{ step().minutesLeft }}</span> min left</span>
        </span>
      </div>

      <!-- Keyed on the leg, so each new step animates in. -->
      @for (s of current(); track s.anchorIndex) {
        <div class="step__main" aria-live="polite">
          <span class="step__icon mi mi--fill" aria-hidden="true">{{ s.icon }}</span>
          <div class="step__text">
            <h2 class="step__title">{{ s.title }}</h2>
            <p class="step__detail">{{ s.detail }}</p>
          </div>
        </div>
      }

      @if (total() > 1) {
        <div class="step__progress" aria-hidden="true">
          @for (dot of dots(); track $index) {
            <span [class.done]="$index < index()" [class.current]="$index === index()"></span>
          }
        </div>
      }

      <div class="step__actions">
        @if (total() > 1) {
          <button type="button" class="btn-secondary step__back" [disabled]="index() === 0" aria-label="Previous step" (click)="previous.emit()">
            <span class="mi">arrow_back</span>
          </button>
        }
        <button type="button" class="btn-primary step__next" (click)="next.emit()">
          {{ step().doneLabel }}
          <span class="mi">{{ isLast() ? 'flag' : 'arrow_forward' }}</span>
        </button>
      </div>
    </section>
  `,
  styles: `
    .step {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .step__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .step__top .eyebrow {
      color: var(--accent-ink);
    }
    .step__of {
      color: var(--muted);
    }
    .step__eta {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.85rem;
      font-weight: 550;
      color: var(--ink-2);
    }
    .step__eta .mi {
      font-size: 17px;
      color: var(--muted);
    }

    .step__main {
      display: flex;
      align-items: center;
      gap: 16px;
      animation: step-in 0.38s var(--ease-out) both;
    }
    .step__icon {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border-radius: 20px;
      background: var(--accent-gradient);
      color: #fff;
      font-size: 36px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 12px 24px -10px var(--accent-glow);
    }
    .step__text {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .step__title {
      font-size: 1.3rem;
      font-weight: 650;
      line-height: 1.2;
      letter-spacing: -0.025em;
      overflow-wrap: anywhere;
    }
    .step__detail {
      font-size: 0.92rem;
      line-height: 1.4;
      color: var(--ink-2);
    }

    .step__progress {
      display: flex;
      gap: 5px;
    }
    .step__progress span {
      flex: 1;
      height: 4px;
      border-radius: 4px;
      background: var(--line-strong);
      overflow: hidden;
      position: relative;
    }
    .step__progress span::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--accent-gradient);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.45s var(--ease-out);
    }
    .step__progress span.done::after {
      transform: scaleX(1);
    }
    .step__progress span.current::after {
      transform: scaleX(0.5);
    }

    .step__actions {
      display: flex;
      gap: 10px;
    }
    .step__back {
      width: 56px;
      padding: 0;
    }
    .step__next {
      flex: 1;
      min-width: 0;
    }

    @keyframes step-in {
      from { opacity: 0; transform: translateX(14px); }
    }
  `,
})
export class InstructionCard {
  readonly step = input.required<RouteStep>();
  readonly index = input.required<number>();
  readonly total = input.required<number>();
  readonly next = output<void>();
  readonly previous = output<void>();

  readonly current = computed(() => [this.step()]);
  readonly dots = computed(() => Array.from({ length: this.total() }));

  isLast(): boolean {
    return this.index() >= this.total() - 1;
  }

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
