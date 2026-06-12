/**
 * Map (M) — world chart baked sim-side (biome parchment, roads), towns always
 * marked, dungeons only once discovered. Indoors it becomes the local automap
 * drawn from the cell's room rectangles.
 */

import { useEffect, useRef } from 'react';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

const SIZE = 480;

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-yaw); // world yaw → map rotation (north up)
  ctx.fillStyle = '#ff9a3c';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function MapWindow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useUi((s) => s.questVersion);
  const local = gameApi().getLocalMap();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);

    if (local) {
      // ----- interior automap: room rectangles, hand-inked ----------------------
      ctx.fillStyle = '#11403426';
      const xs = local.rooms.flatMap((r) => [r.x0, r.x1]);
      const zs = local.rooms.flatMap((r) => [r.z0, r.z1]);
      const minX = Math.min(...xs) - 4;
      const maxX = Math.max(...xs) + 4;
      const minZ = Math.min(...zs) - 4;
      const maxZ = Math.max(...zs) + 4;
      const span = Math.max(maxX - minX, maxZ - minZ);
      const sc = SIZE / span;
      const ox = (SIZE - (maxX - minX) * sc) / 2;
      const oz = (SIZE - (maxZ - minZ) * sc) / 2;
      const mx = (x: number): number => ox + (x - minX) * sc;
      const mz = (z: number): number => oz + (z - minZ) * sc;
      for (const r of local.rooms) {
        ctx.fillStyle = 'rgba(95, 162, 133, 0.14)';
        ctx.strokeStyle = 'rgba(95, 162, 133, 0.55)';
        ctx.lineWidth = 1;
        ctx.fillRect(mx(r.x0), mz(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
        ctx.strokeRect(mx(r.x0), mz(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
      }
      drawPlayer(ctx, mx(local.player.x), mz(local.player.z), local.player.yaw);
      return;
    }

    // ----- world chart ----------------------------------------------------------
    const data = gameApi().getMapData();
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const m = (v: number): number => (v / data.sizeM) * SIZE;
      // Discovered dungeons: small ember diamonds.
      for (const d of data.dungeons) {
        ctx.save();
        ctx.translate(m(d.x), m(d.z));
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#c25f1d';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.strokeRect(-3, -3, 6, 6);
        ctx.restore();
      }
      // Towns: bone squares + names.
      ctx.font = '10px "Iowan Old Style", Palatino, Georgia, serif';
      ctx.textAlign = 'center';
      for (const t of data.towns) {
        ctx.fillStyle = '#e8e0cf';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(m(t.x) - 3, m(t.z) - 3, 6, 6);
        ctx.strokeRect(m(t.x) - 3, m(t.z) - 3, 6, 6);
        ctx.fillStyle = '#e8e0cf';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(t.name, m(t.x), m(t.z) - 7);
        ctx.fillText(t.name, m(t.x), m(t.z) - 7);
        ctx.lineWidth = 1;
      }
      if (!data.player.interior) drawPlayer(ctx, m(data.player.x), m(data.player.z), data.player.yaw);
    };
    img.src = data.url;
  }, [local !== null]);

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ padding: 'var(--sp-5)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: SIZE }}>
          <PixelHeading text={local ? local.label.toUpperCase() : 'VETHMOOR'} scale={2} color="#5fa285" tracking={2} />
          <span className="vm-label">{local ? 'local survey' : 'the Ashen March'}</span>
        </div>
        <hr className="vm-rule" />
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="vm-pix"
          style={{ width: SIZE, height: SIZE, border: '1px solid var(--edge-bright)', background: 'var(--iron-0)' }}
        />
        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Close (M)
          </button>
        </div>
      </div>
    </div>
  );
}
