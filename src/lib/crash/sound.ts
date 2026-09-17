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

/** Motor — timbre quente e discreto, filtrado, ao estilo de sala de casino. */
export function startEngine(): void {
  const audio = ensureAudio();
  if (!audio || !master || muted || engine) return;
  const osc = audio.createOscillator();
  const sub = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 620;
  filter.Q.value = 0.6;
  osc.type = "triangle";
  sub.type = "sine";
  osc.frequency.value = 110;
  sub.frequency.value = 55;
  gain.gain.value = 0.0001;
  gain.gain.setTargetAtTime(0.035, audio.currentTime, 0.35);
  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start();
  sub.start();
  engine = { osc, sub, gain };
}

export function updateEngine(multiplier: number): void {
  if (!engine || !ctx) return;
  // Sobe por semitons, não linearmente: soa musical em vez de mecânico.
  const semitones = Math.min(24, Math.log2(Math.max(1, multiplier)) * 7);
  const freq = 110 * Math.pow(2, semitones / 12);
  engine.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.18);
  engine.sub.frequency.setTargetAtTime(freq / 2, ctx.currentTime, 0.18);
  engine.gain.gain.setTargetAtTime(Math.min(0.035 + multiplier * 0.003, 0.075), ctx.currentTime, 0.3);
}

export function stopEngine(): void {
  if (!engine || !ctx) return;
  const { osc, sub, gain } = engine;
  engine = null;
  gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
  const stopAt = ctx.currentTime + 0.45;
  osc.stop(stopAt);
  sub.stop(stopAt);
}

/** Contagem — bloco de madeira curto e seco. */
export function playTick(): void {
  beep({ freq: 1046, toFreq: 880, duration: 0.05, type: "sine", volume: 0.07 });
}

/** Aposta aceite — duas notas ascendentes limpas. */
export function playBet(): void {
  beep({ freq: 523.25, duration: 0.1, type: "sine", volume: 0.14 });
  beep({ freq: 659.25, duration: 0.14, type: "sine", volume: 0.12, delay: 0.08 });
}

/** Levantamento — acorde maior em arpejo, som de sino. */
export function playCashout(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    beep({ freq, duration: 0.5, type: "sine", volume: 0.16 - i * 0.02, delay: i * 0.07 });
    beep({ freq: freq * 2, duration: 0.35, type: "sine", volume: 0.05, delay: i * 0.07 });
  });
}

/** Fim da ronda — nota grave curta com um toque de ar, sem estrondo. */
export function playCrash(): void {
  const audio = ensureAudio();
  if (!audio || !master || muted) return;
  stopEngine();
  const start = audio.currentTime;
  const length = Math.floor(audio.sampleRate * 0.35);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, start);
  filter.frequency.exponentialRampToValueAtTime(160, start + 0.3);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.16, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
  noise.connect(filter).connect(gain).connect(master);
  noise.start(start);
  beep({ freq: 220, toFreq: 110, duration: 0.45, type: "sine", volume: 0.18 });
  beep({ freq: 174.61, duration: 0.5, type: "sine", volume: 0.1, delay: 0.05 });
}

