import { Component, output, signal } from '@angular/core';

/** Landing screen: scan the QR code with the camera (primary) or type the code (fallback). */
@Component({
  selector: 'app-home-screen',
  template: `
    <div class="home">
      <div class="home__hero">
        <span class="home__chip"><span class="live-dot"></span>Indoor navigation</span>
        <h1 class="home__title">Find your way,<br /><span>indoors.</span></h1>
        <p class="home__lead">Scan the Areyos QR code near you to see where you are and get step-by-step directions.</p>
      </div>

      <div class="home__actions">
        <button type="button" class="home__scan" (click)="scan.emit()">
          <span class="home__viewfinder" aria-hidden="true">
            <span class="mi">qr_code_2</span>
            <span class="home__scanline"></span>
          </span>
          <span class="home__scan-text">
            <strong>Scan QR code</strong>
            <span>Opens your camera</span>
          </span>
          <span class="mi home__scan-go" aria-hidden="true">arrow_forward</span>
        </button>

        <div class="home__divider"><span>or enter the code</span></div>

        <form class="home__code" (submit)="submit($event)">
          <label class="sr-only" for="qr-code">QR code</label>
          <input
            id="qr-code"
            class="mono"
            type="text"
            placeholder="AREYOS-2-…"
            autocapitalize="characters"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="go"
            [value]="code()"
            (input)="code.set($any($event.target).value)"
          />
          <button type="submit" class="home__code-go" aria-label="Open this code" [disabled]="!code().trim()">
            <span class="mi">arrow_forward</span>
          </button>
        </form>

        <p class="home__foot"><span class="mi">verified_user</span>No app or sign-in needed</p>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
    }
    .home {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    /* ---------- hero ---------- */
    .home__hero {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 16px;
      min-height: 220px;
      padding-bottom: 8px;
    }
    .home__chip {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      height: 30px;
      padding: 0 12px 0 11px;
      border-radius: 999px;
      background: var(--glass);
      border: 1px solid var(--line);
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-2);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
    }
    .home__title {
      font-size: clamp(2.5rem, 11vw, 3.25rem);
      font-weight: 650;
      line-height: 1.02;
      letter-spacing: -0.045em;
      color: var(--ink);
    }
    .home__title span {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .home__lead {
      max-width: 34ch;
      font-size: 1.02rem;
      line-height: 1.5;
      color: var(--ink-2);
    }

    /* ---------- actions ---------- */
    .home__actions {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .home__scan {
      position: relative;
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
      min-height: 96px;
      padding: 16px 18px 16px 16px;
      border: 0;
      border-radius: var(--radius-xl);
      background: var(--accent-gradient);
      color: #fff;
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        0 18px 40px -16px var(--accent-glow);
      transition: transform 0.18s var(--ease-out), filter 0.18s ease;
    }
    .home__scan::after {
      /* soft sheen */
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 90% at 0% 0%, rgba(255, 255, 255, 0.22), transparent 55%);
      pointer-events: none;
    }
    .home__scan:hover {
      filter: brightness(1.06);
    }
    .home__scan:active {
      transform: scale(0.98);
    }
    .home__scan:focus-visible {
      outline-offset: 3px;
    }

    .home__viewfinder {
      position: relative;
      width: 64px;
      height: 64px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.16);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
      overflow: hidden;
    }
    .home__viewfinder .mi {
      font-size: 36px;
    }
    .home__scanline {
      position: absolute;
      left: 8px;
      right: 8px;
      top: 0;
      height: 2px;
      border-radius: 2px;
      background: #fff;
      box-shadow: 0 0 12px 2px rgba(255, 255, 255, 0.8);
      animation: scanline 2.4s var(--ease-out) infinite;
    }

    .home__scan-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .home__scan-text strong {
      font-size: 1.2rem;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    .home__scan-text span {
      font-size: 0.88rem;
      opacity: 0.82;
    }
    .home__scan-go {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      font-size: 22px;
    }

    .home__divider {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-size: 0.82rem;
    }
    .home__divider::before,
    .home__divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--line-strong);
    }

    .home__code {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 60px;
      padding: 6px 6px 6px 18px;
      border-radius: 20px;
      background: var(--glass);
      border: 1px solid var(--line-strong);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
      transition: border-color 0.16s ease, box-shadow 0.16s ease;
    }
    .home__code:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-soft);
    }
    .home__code input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      color: var(--ink);
      font-size: 16px; /* 16px keeps iOS from zooming on focus */
      letter-spacing: 0.02em;
      outline: none;
    }
    .home__code input::placeholder {
      color: var(--muted);
      opacity: 0.8;
    }
    .home__code-go {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 15px;
      background: var(--ink);
      color: var(--bg);
      cursor: pointer;
      transition: opacity 0.16s ease, transform 0.16s var(--ease-out);
    }
    .home__code-go:disabled {
      opacity: 0.2;
      cursor: not-allowed;
    }
    .home__code-go:active:not(:disabled) {
      transform: scale(0.94);
    }

    .home__foot {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: var(--muted);
      font-size: 0.8rem;
    }
    .home__foot .mi {
      font-size: 16px;
    }

    @keyframes scanline {
      0% { transform: translateY(8px); opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 1; }
      100% { transform: translateY(56px); opacity: 0; }
    }
  `,
})
export class HomeScreen {
  readonly scan = output<void>();
  readonly submitCode = output<string>();

  readonly code = signal('');

  submit(event: Event): void {
    event.preventDefault();
    const code = this.code().trim();
    if (code) this.submitCode.emit(code);
  }
}
