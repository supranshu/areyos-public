import { Component, DestroyRef, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import type JsQr from 'jsqr';

/** Minimal typing for the native BarcodeDetector (Chrome/Android, Safari 17+ behind support checks). */
interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?(): Promise<string[]>;
} | undefined;

/** Scans every ~150 ms: fast enough to feel instant, light enough for low-end phones. */
const SCAN_INTERVAL_MS = 150;

/**
 * Pulls the Areyos code out of whatever the QR contains: a full link
 * (`https://…/qr/AREYOS-2-F97386F5` or `/navigate/…`) or just the bare code.
 */
export function extractQrCode(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const segments = url.pathname.split('/').filter(Boolean);
    const i = segments.findIndex((s) => s === 'qr' || s === 'navigate');
    const code = i >= 0 ? segments[i + 1] : url.searchParams.get('code');
    return code ? decodeURIComponent(code) : null;
  } catch {
    return /^[\w-]+$/.test(text) ? text : null;
  }
}

type ScannerState = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'invalid';

/** Full-screen camera view that reads a QR code and emits the Areyos code inside it. */
@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.scss',
})
export class QrScanner {
  readonly scanned = output<string>();
  readonly closed = output<void>();

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  readonly state = signal<ScannerState>('starting');
  /** Torch (flashlight) toggle, offered only when the camera supports it — mostly Android Chrome. */
  readonly torchAvailable = signal(false);
  readonly torchOn = signal(false);

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private detector: NativeBarcodeDetector | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private jsQr: typeof JsQr | null = null;
  private done = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    afterNextRender(() => this.start());
  }

  async start(): Promise<void> {
    this.state.set('starting');
    this.done = false;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      this.state.set('unavailable');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      this.state.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      return;
    }
    if (this.done) return this.stop(); // closed while the permission prompt was open

    const video = this.videoRef().nativeElement;
    video.srcObject = this.stream;
    await video.play().catch(() => undefined);
    const capabilities = this.stream.getVideoTracks()[0]?.getCapabilities?.() as { torch?: boolean } | undefined;
    this.torchAvailable.set(!!capabilities?.torch);
    this.detector = await this.createNativeDetector();
    // jsQR is only downloaded on browsers without a native detector (e.g. iOS Safari, Firefox).
    if (!this.detector) this.jsQr ??= (await import('jsqr')).default;
    this.state.set('scanning');
    this.scheduleScan();
  }

  close(): void {
    this.stop();
    this.closed.emit();
  }

  async toggleTorch(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    const on = !this.torchOn();
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      this.torchOn.set(on);
    } catch {
      this.torchAvailable.set(false);
    }
  }

  private async createNativeDetector(): Promise<NativeBarcodeDetector | null> {
    if (typeof BarcodeDetector === 'undefined') return null;
    try {
      const formats = (await BarcodeDetector.getSupportedFormats?.()) ?? ['qr_code'];
      return formats.includes('qr_code') ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    } catch {
      return null;
    }
  }

  private scheduleScan(): void {
    if (this.done) return;
    this.timer = setTimeout(() => this.scanFrame().finally(() => this.scheduleScan()), SCAN_INTERVAL_MS);
  }

  private async scanFrame(): Promise<void> {
    const video = this.videoRef().nativeElement;
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || !video.videoWidth) return;

    const raw = this.detector ? await this.detectNative(video) : this.detectWithJsQr(video);
    if (raw == null || this.done) return;

    const code = extractQrCode(raw);
    if (!code) {
      this.state.set('invalid'); // keeps scanning; the hint tells the visitor it wasn't an Areyos code
      return;
    }
    this.stop();
    navigator.vibrate?.(60);
    this.scanned.emit(code);
  }

  private async detectNative(video: HTMLVideoElement): Promise<string | null> {
    try {
      const codes = await this.detector!.detect(video);
      return codes[0]?.rawValue ?? null;
    } catch {
      this.detector = null; // fall back to jsQR from the next frame on
      if (!this.jsQr) this.jsQr = (await import('jsqr')).default;
      return null;
    }
  }

  private detectWithJsQr(video: HTMLVideoElement): string | null {
    // Downscale large frames: QR detection doesn't need full resolution and it keeps jsQR fast.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    this.canvas ??= document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !this.jsQr) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const result = this.jsQr(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
    return result?.data ?? null;
  }

  private stop(): void {
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.torchOn.set(false);
  }
}
