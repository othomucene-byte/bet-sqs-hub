import { useEffect, useRef } from "react";

import fishSprite from "@/assets/fish-sprite.png.asset.json";

export type FishStatus = "WAITING" | "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

const GREEN = "#27e58a";
const YELLOW = "#ffe14c";

type Bubble = { x: number; y: number; r: number; speed: number; drift: number };

/**
 * Palco do Fish Crash: curva neon, peixe vetorial e bolhas.
 * Só animação — nenhum valor de jogo é decidido aqui.
 */
export function FishCanvas({
  status,
  multiplier,
}: {
  status: FishStatus;
  multiplier: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ status, multiplier });
  stateRef.current = { status, multiplier };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const bubbles: Bubble[] = Array.from({ length: 26 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.5 + Math.random() * 4,
      speed: 0.02 + Math.random() * 0.05,
      drift: Math.random() * Math.PI * 2,
    }));

    const sprite = new Image();
    sprite.src = fishSprite.url;

    let raf = 0;
    let time = 0;
    let crashT = 0;


    const draw = () => {
      const { status: st, multiplier: m } = stateRef.current;
      time += 1 / 60;
      if (st === "CRASHED") crashT += 1 / 60;
      else crashT = 0;

      ctx.clearRect(0, 0, width, height);

      // Bolhas de fundo
      for (const b of bubbles) {
        b.y -= b.speed / 60;
        if (b.y < -0.05) {
          b.y = 1.05;
          b.x = Math.random();
        }
        const px = b.x * width + Math.sin(time + b.drift) * 8;
        const py = b.y * height;
        ctx.beginPath();
        ctx.arc(px, py, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120, 200, 255, 0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const padX = width * 0.06;
      const padY = height * 0.12;
      const baseY = height - padY * 0.7;
      const usableW = width - padX * 1.4;
      const usableH = height - padY * 2;

      // Progresso visual (assintótico) a partir do multiplicador do servidor
      const p = Math.min(1, Math.log(Math.max(1, m)) / Math.log(12));
      const ease = st === "BETTING" || st === "WAITING" ? 0 : p;

      const pointAt = (t: number) => ({
        x: padX + usableW * t,
        y: baseY - usableH * Math.pow(t, 1.55),
      });

      if (ease > 0.001) {
        const steps = 90;
        const grad = ctx.createLinearGradient(padX, baseY, padX + usableW * ease, baseY - usableH);
        grad.addColorStop(0, YELLOW);
        grad.addColorStop(1, GREEN);

        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const pt = pointAt((i / steps) * ease);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.shadowColor = GREEN;
        ctx.shadowBlur = 22;
        ctx.globalAlpha = st === "CRASHED" ? Math.max(0.25, 1 - crashT) : 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Peixe na ponta da curva
      const head = pointAt(Math.max(0.02, ease));
      const ahead = pointAt(Math.min(1, Math.max(0.06, ease) + 0.04));
      const angle = Math.atan2(ahead.y - head.y, ahead.x - head.x);
      const bob = Math.sin(time * 3) * (st === "RUNNING" ? 5 : 2.5);
      const scale = Math.max(0.55, Math.min(1, width / 620));
      const flee = st === "CRASHED" ? crashT * crashT * 900 : 0;

      ctx.save();
      ctx.translate(head.x + flee, head.y + bob - flee * 0.35);
      ctx.rotate(st === "CRASHED" ? angle - 0.5 : angle - 0.35);
      ctx.scale(scale, scale);
      drawFish(ctx, time);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-[2] h-full w-full" />;
}

/** Peixe vetorial: dorso azul, ventre laranja, barbatanas verdes. */
function drawFish(ctx: CanvasRenderingContext2D, time: number) {
  const wag = Math.sin(time * 9) * 0.28;

  // Cauda
  ctx.save();
  ctx.translate(-52, 0);
  ctx.rotate(wag);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-22, -26, -38, -16);
  ctx.quadraticCurveTo(-26, 0, -38, 18);
  ctx.quadraticCurveTo(-20, 26, 0, 0);
  ctx.fillStyle = "#1b46c8";
  ctx.fill();
  ctx.restore();

  // Barbatana dorsal
  ctx.beginPath();
  ctx.moveTo(-30, -14);
  ctx.quadraticCurveTo(-18, -40, 4, -26);
  ctx.quadraticCurveTo(-8, -16, -30, -14);
  ctx.fillStyle = "#2255e0";
  ctx.fill();

  // Barbatana inferior (verde-limão)
  ctx.beginPath();
  ctx.moveTo(-14, 16);
  ctx.quadraticCurveTo(-6, 34, 14, 22);
  ctx.quadraticCurveTo(2, 14, -14, 16);
  ctx.fillStyle = "#9ade3a";
  ctx.fill();

  // Corpo
  ctx.beginPath();
  ctx.moveTo(-54, 0);
  ctx.quadraticCurveTo(-34, -24, 6, -22);
  ctx.quadraticCurveTo(44, -20, 58, 2);
  ctx.quadraticCurveTo(42, 22, 4, 22);
  ctx.quadraticCurveTo(-32, 22, -54, 0);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, -22, 0, 22);
  body.addColorStop(0, "#2f6bff");
  body.addColorStop(0.45, "#1f4fd8");
  body.addColorStop(0.55, "#ff9a2b");
  body.addColorStop(1, "#ffc44d");
  ctx.fillStyle = body;
  ctx.shadowColor = "rgba(39,229,138,0.55)";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Boca aberta
  ctx.beginPath();
  ctx.moveTo(44, -6);
  ctx.quadraticCurveTo(60, -2, 58, 6);
  ctx.quadraticCurveTo(48, 6, 44, -6);
  ctx.fillStyle = "#1a1a2e";
  ctx.fill();

  // Olho
  ctx.beginPath();
  ctx.arc(30, -10, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(32, -10, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = "#08131f";
  ctx.fill();
}
