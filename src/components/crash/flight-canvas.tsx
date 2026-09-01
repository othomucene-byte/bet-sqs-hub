import { useEffect, useRef } from "react";

export type FlightStatus = "WAITING" | "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

type Star = { x: number; y: number; z: number; r: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number };

/**
 * Palco do voo. Puramente visual: recebe o multiplicador já alinhado ao relógio
 * do servidor e desenha-o. Nunca decide resultados.
 */
export function FlightCanvas({
  status,
  multiplier,
  crashMultiplier,
}: {
  status: FlightStatus;
  multiplier: number;
  crashMultiplier: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ status, multiplier, crashMultiplier });
  stateRef.current = { status, multiplier, crashMultiplier };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    const stars: Star[] = [];
    const particles: Particle[] = [];
    let gridOffset = 0;
    let frame = 0;
    let crashProgress = 0;
    let lastStatus: FlightStatus = status;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // Em ecrãs pequenos limitamos o DPR para manter 60fps em telemóveis modestos.
      dpr = Math.min(window.devicePixelRatio || 1, width < 480 ? 1.5 : 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars.length = 0;
      const starCount = width < 480 ? 36 : 70;
      for (let i = 0; i < starCount; i += 1) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: 0.3 + Math.random() * 1.2,
          r: 0.4 + Math.random() * 1.4,
        });
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    /** Curva do voo: progresso 0..1 em função do multiplicador (log). */
    const progressFor = (m: number) => {
      const p = Math.log(Math.max(m, 1)) / Math.log(12);
      return Math.min(0.97, p / (0.35 + p) / 0.74);
    };

    const draw = (time: number) => {
      const { status: st, multiplier: mult, crashMultiplier: crashAt } = stateRef.current;
      const flying = st === "RUNNING";
      const crashed = st === "CRASHED";

      if (st !== lastStatus) {
        if (st === "CRASHED") crashProgress = 0;
        if (st === "BETTING" || st === "WAITING") {
          crashProgress = 0;
          particles.length = 0;
        }
        lastStatus = st;
      }

      ctx.clearRect(0, 0, width, height);

      // Fundo
      const bg = ctx.createRadialGradient(width * 0.62, height * 0.34, 10, width * 0.5, height * 0.5, height * 1.5);
      bg.addColorStop(0, "rgba(23,36,58,0.95)");
      bg.addColorStop(1, "rgba(6,10,18,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Estrelas em parallax — aceleram com o multiplicador
      const speed = flying ? 0.4 + Math.min(mult, 12) * 0.35 : 0.18;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (const s of stars) {
        s.x -= s.z * speed;
        if (s.x < -2) {
          s.x = width + 2;
          s.y = Math.random() * height;
        }
        ctx.globalAlpha = 0.15 + s.z * 0.35;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Grelha em movimento
      const gridStep = width < 480 ? 28 : 40;
      gridOffset = (gridOffset + (flying ? 0.8 + Math.min(mult, 10) * 0.25 : 0.25)) % gridStep;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let x = -gridOffset; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = height + gridOffset; y > 0; y -= gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (flying || crashed) {
        if (crashed) crashProgress = Math.min(1, crashProgress + 0.02);

        const scale = Math.max(0.62, Math.min(1, width / 520));
        const startX = 26 * scale + 6;
        const startY = height - 18 * scale - 6;
        const p = progressFor(crashed ? (crashAt ?? mult) : mult);
        const bob = flying ? Math.sin(time / 260) * 4 : 0;
        const targetX = startX + (width - startX - 46 * scale) * p;
        const targetY = startY - (height - 46 * scale - 18) * p + bob;
        const cx = startX + (targetX - startX) * 0.55;
        const cy = startY;

        const line = crashed ? "rgba(220,38,38,1)" : "rgba(52,211,153,1)";
        const fillTop = crashed ? "rgba(220,38,38,0.3)" : "rgba(52,211,153,0.28)";

        // Área sob a curva
        const area = ctx.createLinearGradient(0, targetY, 0, startY);
        area.addColorStop(0, fillTop);
        area.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cx, cy, targetX, targetY);
        ctx.lineTo(targetX, startY);
        ctx.closePath();
        ctx.fillStyle = area;
        ctx.fill();

        // Traço luminoso
        ctx.save();
        ctx.shadowColor = line;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cx, cy, targetX, targetY);
        ctx.strokeStyle = line;
        ctx.lineWidth = 3.5 * scale;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();

        // Partículas de rasto
        if (flying && frame % 2 === 0) {
          particles.push({
            x: targetX - 14 * scale,
            y: targetY + 4,
            vx: -1.4 - Math.random() * 1.6,
            vy: (Math.random() - 0.5) * 1.1,
            life: 1,
          });
        }
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const pt = particles[i]!;
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.026;
          if (pt.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = pt.life * 0.6;
          ctx.fillStyle = crashed ? "rgba(248,113,113,1)" : "rgba(167,243,208,1)";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.4 * scale * pt.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Avião
        const planeX = crashed ? targetX + crashProgress * (width * 0.9) : targetX;
        const planeY = crashed ? targetY - crashProgress * height * 0.55 : targetY;
        if (!crashed || crashProgress < 1) {
          ctx.save();
          ctx.globalAlpha = crashed ? Math.max(0, 1 - crashProgress * 1.2) : 1;
          ctx.translate(planeX, planeY);
          ctx.rotate(crashed ? -0.5 : -0.22 + Math.sin(time / 300) * 0.03);
          ctx.scale(scale, scale);
          drawPlane(ctx, time);
          ctx.restore();
        }

        if (crashed) {
          ctx.fillStyle = `rgba(220,38,38,${Math.max(0, 0.35 - crashProgress * 0.35)})`;
          ctx.fillRect(0, 0, width, height);
        }
      }

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    let raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />;
}

/** Avião vetorial com hélice a girar. */
function drawPlane(ctx: CanvasRenderingContext2D, time: number) {
  // Cauda
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(-16, -1);
  ctx.lineTo(-24, -11);
  ctx.lineTo(-13, -2);
  ctx.closePath();
  ctx.fill();

  // Asa
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-15, 13);
  ctx.lineTo(4, 2);
  ctx.closePath();
  ctx.fill();

  // Fuselagem
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Janelas
  ctx.fillStyle = "#0f172a";
  for (let i = -6; i <= 6; i += 6) {
    ctx.beginPath();
    ctx.arc(i, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nariz
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.ellipse(16, 0, 4, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hélice
  const spin = (time / 22) % (Math.PI * 2);
  ctx.strokeStyle = "rgba(226,232,240,0.85)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(20, -8 * Math.cos(spin));
  ctx.lineTo(20, 8 * Math.cos(spin));
  ctx.stroke();
}
