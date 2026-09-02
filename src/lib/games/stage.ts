/**
 * Motor de render partilhado pelos jogos de crash (Aviator e Fish Crash).
 *
 * Estritamente visual: recebe o estado da ronda e o multiplicador já alinhados
 * ao relógio do servidor e desenha-os. Nunca decide resultados, pagamentos ou
 * saldos — essa autoridade é sempre do servidor.
 */

export type StageStatus = "WAITING" | "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

export type StageState = {
  status: StageStatus;
  multiplier: number;
};

export type StageTheme = {
  /** "air" → fumo e turbulência. "water" → bolhas, caustics e poeira suspensa. */
  medium: "air" | "water";
  /** Imagem de cenário (parallax + zoom suave). */
  background: string;
  /** Sprite realista da personagem (avião ou peixe). */
  character: string;
  /** Largura desenhada do sprite, em px lógicos, a 1x de escala. */
  characterWidth: number;
  /** Inclinação base do sprite, em radianos (arte já orientada). */
  characterTilt: number;
  /** Cores da curva do multiplicador. */
  line: string;
  lineSoft: string;
  glow: string;
  crashLine: string;
  crashGlow: string;
  /** Tinta do brilho ambiente do cenário. */
  ambient: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: "trail" | "ambient";
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Arranca o loop de render num canvas. Devolve a função de limpeza.
 */
export function startStage(
  canvas: HTMLCanvasElement,
  theme: StageTheme,
  getState: () => StageState,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let width = 0;
  let height = 0;
  let dpr = 1;
  let quality = 1; // 0..1 — reduz partículas em ecrãs pequenos

  const bg = new Image();
  bg.decoding = "async";
  bg.src = theme.background;
  const hero = new Image();
  hero.decoding = "async";
  hero.src = theme.character;

  const particles: Particle[] = [];
  const ambient: Particle[] = [];

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, width < 480 ? 1.75 : 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    quality = width < 420 ? 0.45 : width < 760 ? 0.7 : 1;

    ambient.length = 0;
    const count = Math.round((theme.medium === "water" ? 46 : 30) * quality);
    for (let i = 0; i < count; i += 1) ambient.push(spawnAmbient());
  };

  function spawnAmbient(): Particle {
    if (theme.medium === "water") {
      const size = 1.2 + Math.random() * 4.2;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 6,
        vy: -(8 + size * 5),
        life: 1,
        maxLife: 1,
        size,
        kind: "ambient",
      };
    }
    const size = 0.6 + Math.random() * 1.6;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: -(24 + Math.random() * 40),
      vy: (Math.random() - 0.5) * 8,
      life: 1,
      maxLife: 1,
      size,
      kind: "ambient",
    };
  }

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // Estado animado (interpolado) — nunca usado para decidir dinheiro.
  let shownMultiplier = 1;
  let flash = 0;
  let shake = 0;
  let crashT = 0;
  let bgPan = 0;
  let last = performance.now();
  let previous: StageStatus | null = null;
  let raf = 0;

  /** Progresso 0..1 da curva em função do multiplicador (escala logarítmica). */
  const progressFor = (m: number) => {
    const p = Math.log(Math.max(1, m)) / Math.log(14);
    return Math.min(0.985, easeOutCubic(Math.min(1, p)) * 0.94);
  };

  const geometry = () => {
    const padX = Math.max(52, width * 0.09);
    const padTop = Math.max(30, height * 0.17);
    const baseY = height - Math.max(46, height * 0.14);

    return {
      x0: padX,
      y0: baseY,
      w: width - padX * 1.9,
      h: baseY - padTop,
    };
  };

  const pointAt = (t: number) => {
    const g = geometry();
    return {
      x: g.x0 + g.w * t,
      y: g.y0 - g.h * Math.pow(t, 1.62),
    };
  };

  const drawBackground = (dt: number, state: StageState) => {
    const zoom = 1.06 + Math.min(0.14, Math.log(Math.max(1, shownMultiplier)) * 0.05);
    bgPan += dt * (state.status === "RUNNING" ? 26 + Math.min(70, shownMultiplier * 9) : 7);

    if (bg.complete && bg.naturalWidth > 0) {
      const scale = Math.max((width / bg.naturalWidth) * zoom, (height / bg.naturalHeight) * zoom);
      const dw = bg.naturalWidth * scale;
      const dh = bg.naturalHeight * scale;
      const driftX = ((bgPan * 0.35) % Math.max(1, dw - width)) * -1;
      ctx.drawImage(bg, driftX - (dw - width) * 0.25, -(dh - height) * 0.5, dw, dh);
    } else {
      ctx.fillStyle = theme.medium === "water" ? "#04121f" : "#0a1428";
      ctx.fillRect(0, 0, width, height);
    }

    // Profundidade: escurecimento nas bordas + brilho ambiente
    const glow = ctx.createRadialGradient(
      width * 0.68,
      height * 0.32,
      8,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.95,
    );
    glow.addColorStop(0, theme.ambient);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.25,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.78,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, theme.medium === "water" ? "rgba(1,8,15,0.85)" : "rgba(2,6,16,0.8)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  };

  const drawAmbient = (dt: number, state: StageState) => {
    const boost = state.status === "RUNNING" ? 1 + Math.min(2.2, shownMultiplier * 0.12) : 1;
    ctx.save();
    for (const p of ambient) {
      p.x += p.vx * dt * boost;
      p.y += p.vy * dt * boost;
      if (theme.medium === "water") {
        p.x += Math.sin((p.y + p.size * 40) / 60) * dt * 12;
        if (p.y < -12) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        ctx.globalAlpha = 0.1 + p.size * 0.055;
        ctx.strokeStyle = "rgba(190,230,255,0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.5;
        ctx.fillStyle = "rgba(220,245,255,0.7)";
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        if (p.x < -14) {
          p.x = width + 12;
          p.y = Math.random() * height;
        }
        ctx.globalAlpha = 0.12 + p.size * 0.14;
        ctx.fillStyle = "rgba(255,244,228,0.9)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const drawCurve = (crashed: boolean, p: number) => {
    if (p <= 0.004) return;
    const g = geometry();
    const head = pointAt(p);
    const line = crashed ? theme.crashLine : theme.line;
    const soft = crashed ? theme.crashGlow : theme.lineSoft;

    const path = new Path2D();
    const steps = Math.round(52 + p * 60);
    for (let i = 0; i <= steps; i += 1) {
      const pt = pointAt((i / steps) * p);
      if (i === 0) path.moveTo(pt.x, pt.y);
      else path.lineTo(pt.x, pt.y);
    }

    // Área preenchida com degradê suave
    const area = new Path2D(path);
    area.lineTo(head.x, g.y0);
    area.lineTo(g.x0, g.y0);
    area.closePath();
    const fill = ctx.createLinearGradient(0, head.y, 0, g.y0);
    fill.addColorStop(0, soft);
    fill.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fill;
    ctx.fill(area);

    // Glow duplo + traço com gradiente
    const stroke = ctx.createLinearGradient(g.x0, g.y0, head.x, head.y);
    stroke.addColorStop(0, soft);
    stroke.addColorStop(1, line);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke;
    ctx.shadowColor = line;
    ctx.shadowBlur = 34;
    ctx.lineWidth = Math.max(7, width * 0.012);
    ctx.globalAlpha = 0.35;
    ctx.stroke(path);
    ctx.shadowBlur = 16;
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(3.4, width * 0.0055);
    ctx.stroke(path);
    ctx.restore();

    // Ponto luminoso pulsante na ponta
    const pulse = 0.65 + Math.sin(performance.now() / 170) * 0.2;
    const dot = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 26 * pulse);
    dot.addColorStop(0, line);
    dot.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = crashed ? Math.max(0, 1 - crashT) : 0.9;
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const emitTrail = (x: number, y: number, scale: number, dt: number, intensity: number) => {
    const amount = Math.max(1, Math.round(intensity * 3 * quality));
    for (let i = 0; i < amount; i += 1) {
      if (theme.medium === "water") {
        const size = 1.4 + Math.random() * 3.4;
        particles.push({
          x: x - 8 * scale + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 12,
          vx: -(30 + Math.random() * 60),
          vy: -(20 + Math.random() * 60),
          life: 1,
          maxLife: 1,
          size: size * scale,
          kind: "trail",
        });
      } else {
        particles.push({
          x: x - 14 * scale + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: -(60 + Math.random() * 90),
          vy: (Math.random() - 0.5) * 40,
          life: 1,
          maxLife: 1,
          size: (7 + Math.random() * 12) * scale,
          kind: "trail",
        });
      }
    }
    void dt;
  };

  const drawTrail = (dt: number, crashed: boolean) => {
    ctx.save();
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-1.6 * dt);
      p.vy *= Math.exp(-1.2 * dt);
      p.life -= dt * (theme.medium === "water" ? 1.1 : 0.8);
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      if (theme.medium === "water") {
        p.size += dt * 2.4;
        ctx.globalAlpha = p.life * 0.5;
        ctx.strokeStyle = crashed ? "rgba(255,170,170,0.9)" : "rgba(200,240,255,0.95)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        p.size += dt * 26;
        const smoke = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        const tint = crashed ? "255,120,90" : "255,230,210";
        smoke.addColorStop(0, `rgba(${tint},${p.life * 0.3})`);
        smoke.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = smoke;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const drawHero = (
    dt: number,
    state: StageState,
    p: number,
    crashed: boolean,
    time: number,
    scale: number,
  ) => {
    const head = pointAt(Math.max(0.045, p));
    const ahead = pointAt(Math.min(1, Math.max(0.05, p) + 0.045));
    const rawAngle = Math.atan2(ahead.y - head.y, ahead.x - head.x);
    // Limitamos a inclinação para o movimento parecer natural em ecrãs estreitos.
    const angle = Math.max(-0.4, Math.min(0.25, rawAngle * 0.55));

    const idle = state.status === "RUNNING" ? 1 : 0.35;
    const bob = Math.sin(time / (theme.medium === "water" ? 520 : 380)) * 6 * idle;
    const roll = Math.sin(time / 900) * 0.035 * idle;

    const flee = crashed ? easeOutCubic(Math.min(1, crashT / 1.1)) : 0;
    const x = head.x + flee * width * 1.15;
    const y = head.y + bob - flee * height * 0.5;

    if (state.status === "RUNNING" || (crashed && flee < 1)) {
      emitTrail(x, y, scale, dt, state.status === "RUNNING" ? 1 : 0.4);
    }

    if (crashed && flee >= 1) return;

    ctx.save();
    ctx.globalAlpha = crashed ? Math.max(0, 1 - flee * 1.15) : 1;
    ctx.translate(x, y);
    ctx.rotate(angle + theme.characterTilt + roll + (crashed ? 0.35 : 0));
    ctx.scale(scale * (crashed ? 1 - flee * 0.35 : 1), scale * (crashed ? 1 - flee * 0.35 : 1));

    if (hero.complete && hero.naturalWidth > 0) {
      const w = theme.characterWidth;
      const h = (hero.naturalHeight / hero.naturalWidth) * w;

      // Halo suave por baixo do sprite para o integrar na cena
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.6);
      halo.addColorStop(0, theme.lineSoft);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha *= 0.85;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = crashed ? Math.max(0, 1 - flee * 1.15) : 1;

      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(hero, -w * 0.52, -h * 0.5, w, h);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      if (theme.medium === "air" && state.status === "RUNNING") {
        // Disco da hélice: blur circular translúcido, sem lâminas visíveis
        const r = h * 0.29;
        ctx.save();
        ctx.translate(w * 0.42, -h * 0.02);
        ctx.rotate(time / 40);
        const disc = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        disc.addColorStop(0, "rgba(255,255,255,0.16)");
        disc.addColorStop(0.62, "rgba(226,232,240,0.09)");
        disc.addColorStop(1, "rgba(226,232,240,0)");
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        for (let i = 0; i < 3; i += 1) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, r * (0.55 + i * 0.18), i * 1.6, i * 1.6 + 2.4);
          ctx.stroke();
        }
        ctx.restore();
      }

    }
    ctx.restore();
  };

  const frame = (now: number) => {
    const rawDt = (now - last) / 1000;
    last = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    const state = getState();

    if (state.status !== previous) {
      if (state.status === "CRASHED") {
        crashT = 0;
        flash = 1;
        shake = 1;
      }
      if (state.status === "BETTING" || state.status === "WAITING") {
        crashT = 0;
        particles.length = 0;
        shownMultiplier = 1;
      }
      previous = state.status;
    }
    if (state.status === "CRASHED") crashT += dt;

    // Amortecimento exponencial (independente da taxa de frames)
    const target = Math.max(1, state.multiplier);
    shownMultiplier += (target - shownMultiplier) * (1 - Math.exp(-14 * dt));
    flash *= Math.exp(-5 * dt);
    shake *= Math.exp(-6 * dt);

    const crashed = state.status === "CRASHED";
    const idlePhase = state.status === "BETTING" || state.status === "WAITING";
    const p = idlePhase ? 0 : progressFor(shownMultiplier);
    const scale = Math.max(0.42, Math.min(1, width / 780));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
    }

    drawBackground(dt, state);
    drawAmbient(dt, state);
    drawTrail(dt, crashed);
    drawCurve(crashed, p);
    drawHero(dt, state, p, crashed, now, scale);

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255,${crashed ? 90 : 220},${crashed ? 70 : 200},${flash * 0.35})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();

    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
  };
}
