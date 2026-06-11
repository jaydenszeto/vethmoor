/**
 * Canvas-rendered bitmap heading — the project's display type. Draws the 5×7
 * procedural font at integer device-pixel scale for perfect crispness.
 */

import { memo, useEffect, useRef } from 'react';
import { GLYPH_H, measurePixelText, pixelTextCanvas } from '@/gen/pixelFont';

interface Props {
  text: string;
  /** CSS pixels per font pixel. */
  scale?: number;
  color?: string;
  gradient?: readonly [string, string];
  shadow?: string;
  tracking?: number;
  className?: string;
}

export const PixelHeading = memo(function PixelHeading({
  text,
  scale = 3,
  color,
  gradient,
  shadow = 'rgba(0,0,0,0.55)',
  tracking = 1,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dpr = Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio)));
    const opts: Parameters<typeof pixelTextCanvas>[1] = {
      scale: scale * dpr,
      tracking,
      shadow,
    };
    if (gradient) opts.gradient = gradient;
    else opts.color = color ?? '#e8e0cf';
    const src = pixelTextCanvas(text, opts);
    el.width = src.width;
    el.height = src.height;
    const ctx = el.getContext('2d') as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    el.style.width = `${src.width / dpr}px`;
    el.style.height = `${src.height / dpr}px`;
  }, [text, scale, color, gradient, shadow, tracking]);

  const pad = shadow ? 1 : 0;
  return (
    <canvas
      ref={ref}
      className={`vm-pix ${className ?? ''}`}
      aria-label={text}
      role="img"
      style={{
        width: (measurePixelText(text, tracking) + pad) * scale,
        height: (GLYPH_H + pad) * scale,
      }}
    />
  );
});
