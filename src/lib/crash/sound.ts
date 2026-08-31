/**
 * Áudio do Crash — sintetizado com Web Audio, sem ficheiros externos.
 * Só corre no browser: todas as funções saem cedo quando não há `window`.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engine: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode } | null = null;
let muted = false;

const STORAGE_KEY = "betfcom.crash.muted";

export function isMuted(): boolean {
  return muted;
}

/** Lê a preferência guardada. Chamar dentro de `useEffect`. */
export function loadMutePreference(): boolean {
  if (typeof window === "undefined") return false;
  muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(value ? 0 : 0.9, ctx.currentTime, 0.05);
  }
  if (value) stopEngine();
}

/** Cria (ou retoma) o contexto. Deve ser chamado a partir de uma interação. */
export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(options: {
  freq: number;
  toFreq?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
}) {
  const audio = ensureAudio();
  if (!audio || !master || muted) return;
  const start = audio.currentTime + (options.delay ?? 0);
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = options.type ?? "sine";
  osc.frequency.setValueAtTime(options.freq, start);
  if (options.toFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.toFreq), start + options.duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.25, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + options.duration + 0.05);
}

/** Motor do avião — som contínuo cuja altura sobe com o multiplicador. */
export function startEngine(): void {
  const audio = ensureAudio();
  if (!audio || !master || muted || engine) return;
  const osc = audio.createOscillator();
  const sub = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sawtooth";
  sub.type = "triangle";
  osc.frequency.value = 90;
  sub.frequency.value = 45;
  gain.gain.value = 0.0001;
  gain.gain.setTargetAtTime(0.06, audio.currentTime, 0.2);
  osc.connect(gain);
  sub.connect(gain);
  gain.connect(master);
  osc.start();
  sub.start();
  engine = { osc, sub, gain };
}

export function updateEngine(multiplier: number): void {
  if (!engine || !ctx) return;
  const freq = Math.min(90 + (multiplier - 1) * 55, 620);
  engine.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
  engine.sub.frequency.setTargetAtTime(freq / 2, ctx.currentTime, 0.08);
  engine.gain.gain.setTargetAtTime(Math.min(0.06 + multiplier * 0.006, 0.14), ctx.currentTime, 0.2);
}

export function stopEngine(): void {
  if (!engine || !ctx) return;
  const { osc, sub, gain } = engine;
  engine = null;
  gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
  const stopAt = ctx.currentTime + 0.35;
  osc.stop(stopAt);
  sub.stop(stopAt);
}

export function playTick(): void {
  beep({ freq: 880, duration: 0.06, type: "square", volume: 0.08 });
}

export function playBet(): void {
  beep({ freq: 420, toFreq: 700, duration: 0.14, type: "triangle", volume: 0.18 });
}

export function playCashout(): void {
  beep({ freq: 660, duration: 0.16, type: "sine", volume: 0.28 });
  beep({ freq: 990, duration: 0.22, type: "sine", volume: 0.22, delay: 0.1 });
  beep({ freq: 1320, duration: 0.3, type: "sine", volume: 0.16, delay: 0.2 });
}

export function playCrash(): void {
  const audio = ensureAudio();
  if (!audio || !master || muted) return;
  stopEngine();
  const start = audio.currentTime;
  const length = Math.floor(audio.sampleRate * 0.6);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, start);
  filter.frequency.exponentialRampToValueAtTime(180, start + 0.55);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.45, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
  noise.connect(filter).connect(gain).connect(master);
  noise.start(start);
  beep({ freq: 200, toFreq: 40, duration: 0.5, type: "sawtooth", volume: 0.2 });
}
