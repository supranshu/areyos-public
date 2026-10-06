import { Component, input, output } from '@angular/core';
import { RouteStep } from '../../navigate/models/route-steps';

/** One navigation leg (e.g. Entrance → Stairs). There is no live positioning, so the visitor confirms each leg. */
@Component({
  selector: 'app-instruction-card',
  template: `
    <section class="sheet instruction" aria-live="polite">
      <div class="instruction__main">
        <span class="instruction__arrow mi">{{ step().icon }}</span>
        <div class="instruction__text">
          <p class="instruction__title">{{ step().title }}</p>
          <p class="instruction__detail">{{ step().detail }}</p>
          <p class="instruction__eta">
            <span class="mi">schedule</span>
            ~{{ step().minutesLeft }} min left
          </p>
        </div>
      </div>

      @if (total() > 1) {
        <div class="instruction__progress" aria-hidden="true">
          @for (dot of dots(); track $index) {
            <span [class.done]="$index <= index()"></span>
          }
        </div>
      }

      <div class="instruction__actions">
        @if (total() > 1) {
          <button type="button" class="btn-ghost" [disabled]="index() === 0" aria-label="Previous step" (click)="previous.emit()">
            <span class="mi">arrow_back</span>
          </button>
        }
        <button type="button" class="btn-primary instruction__next" (click)="next.emit()">
          {{ step().doneLabel }}
          <span class="mi">{{ isLast() ? 'flag' : 'arrow_forward' }}</span>
        </button>
      </div>
    </section>
  `,
  styles: `
    .instruction {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .instruction__main {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .instruction__arrow {
      width: 64px;
      height: 64px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 18px;
      background: var(--brand-tint);
      color: #1854c8;
      font-size: 40px;
      animation: arrow-in 0.3s ease-out;
    }
    .instruction__text p {
      margin: 0;
    }
    .instruction__title {
      font-size: 1.25rem;
      font-weight: 700;
    }
    .instruction__detail {
      font-size: 0.9rem;
      color: var(--slate);
    }
    .instruction__eta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px !important;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .instruction__eta .mi {
      font-size: 16px;
      color: var(--brand-blue);
    }
    .instruction__progress {
      display: flex;
      gap: 4px;
    }
    .instruction__progress span {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background: var(--hairline);
      transition: background-color 0.2s ease;
    }
    .instruction__progress span.done {
      background: #1854c8;
    }
    .instruction__actions {
      display: flex;
      gap: 10px;
    }
    .instruction__actions .btn-ghost {
      height: 52px;
      width: 52px;
      padding: 0;
    }
    .instruction__next {
      flex: 1;
    }
    @keyframes arrow-in {
      from { transform: scale(0.8); opacity: 0; }
    }
  `,
})
export class InstructionCard {
  readonly step = input.required<RouteStep>();
  readonly index = input.required<number>();
  readonly total = input.required<number>();
  readonly next = output<void>();
  readonly previous = output<void>();

  isLast(): boolean {
    return this.index() >= this.total() - 1;
  }

  dots(): number[] {
    return Array.from({ length: this.total() });
  }
}
