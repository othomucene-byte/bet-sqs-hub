/**
 * Roda da Betfcom — desenho e rotação. O setor sorteado vem do servidor;
 * aqui apenas se anima até ele.
 */
import { useEffect, useRef } from "react";

import { WHEEL_LAYOUT } from "@/lib/games/instant.functions";

const SECTORS = WHEEL_LAYOUT.length;
const ARC = (Math.PI * 2) / SECTORS;

function colorFor(multiplier: number): { fill: string; text: string } {
  if (multiplier === 0) return { fill: "#0c1f33", text: "#5f86a6" };
  if (multiplier >= 25) return { fill: "#ffab00", text: "#241300" };
  if (multiplier >= 10) return { fill: "#ff2d46", text: "#ffffff" };
  if (multiplier >= 5) return { fill: "#a855ff", text: "#ffffff" };
  if (multiplier >= 3) return { fill: "#22b8ff", text: "#04202e" };
  if (multiplier >= 2) return { fill: "#00e07a", text: "#02180d" };
  return { fill: "#0f8f5b", text: "#eafff5" };
}

export function WheelCanvas({
  target,
  spinKey,
  onSettled,
}: {
  /** Índice do setor sorteado pelo servidor, ou null enquanto não há jogada. */
  target: number | null;
  /** Muda a cada nova jogada para reiniciar a animação. */
  spinKey: number;
  onSettled?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const draw = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth;
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 10;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    for (let i = 0; i < SECTORS; i += 1) {
      const multiplier = WHEEL_LAYOUT[i]!;
      const tone = colorFor(multiplier);
      const start = i * ARC - Math.PI / 2 - ARC / 2;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, start + ARC);
      ctx.closePath();
      ctx.fillStyle = tone.fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + ARC / 2);
      ctx.fillStyle = tone.text;
      ctx.font = `700 ${Math.max(10, size * 0.045)}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(multiplier === 0 ? "—" : `${multiplier}x`, radius - 10, 0);
      ctx.restore();
    }
    ctx.restore();

    // aro exterior
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,171,0,0.85)";
    ctx.lineWidth = 5;
    ctx.stroke();

    // cubo central
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0a1a2b";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,171,0,0.85)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // ponteiro no topo
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(cx - 10, 22);
    ctx.lineTo(cx + 10, 22);
    ctx.closePath();
    ctx.fillStyle = "#ffab00";
    ctx.fill();
  };

  useEffect(() => {
    draw(angleRef.current);
    const onResize = () => draw(angleRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (target === null) return;
    const from = angleRef.current;
    const base = -(target * ARC);
    const turns = Math.PI * 2 * 6;
    const to = base + turns + Math.ceil((from - base) / (Math.PI * 2)) * Math.PI * 2;
    const duration = 4200;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      angleRef.current = from + (to - from) * eased;
      draw(angleRef.current);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        onSettled?.();
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, target]);

  return <canvas ref={canvasRef} className="mx-auto block aspect-square w-full max-w-[420px]" />;
}
