/**
 * The page's sound effects (src/assets/sfx, cut by scripts/sfx.py), played
 * through Web Audio rather than the app: a key click has to land with the key,
 * and a round trip over the bridge would make it late.
 *
 * iOS opens audio only inside a tap, so nothing plays until `unlockSound()` is
 * called from one (the start button). The session is `ambient`: the ring/silent
 * switch silences it, and music the player has on keeps playing underneath.
 */
import arriveUrl from '../assets/sfx/arrive.mp3';
import finishUrl from '../assets/sfx/finish.mp3';
import key1Url from '../assets/sfx/key1.wav';
import key2Url from '../assets/sfx/key2.wav';
import key3Url from '../assets/sfx/key3.wav';
import slipUrl from '../assets/sfx/slip.wav';
import transferUrl from '../assets/sfx/transfer.mp3';

type Name = 'key' | 'slip' | 'arrive' | 'transfer' | 'finish';

const SOURCES: Record<Name, readonly string[]> = {
  // Three clicks taken in turn, so fast typing is not one sound repeated.
  key: [key1Url, key2Url, key3Url],
  slip: [slipUrl],
  arrive: [arriveUrl],
  transfer: [transferUrl],
  finish: [finishUrl],
};

/** Each sound's level; the files are all normalised to the same peak. */
const LEVEL: Record<Name, number> = { key: 0.35, slip: 0.55, arrive: 0.4, transfer: 0.5, finish: 0.55 };

/** Two changes this close are one key (some IMEs fire twice per press). */
const KEY_GAP_MS = 20;
/** How far a station name's clicks climb, and how fast. */
const KEY_RISE_PER_KEY = 0.012;
const KEY_RISE_MAX = 0.25;

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
  interface Navigator {
    audioSession?: { type: string };
  }
}

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let on = true;
let lastKeyAt = 0;
let lastKey = -1;
const buffers = new Map<string, AudioBuffer>();

function bytesOf(url: string): Promise<ArrayBuffer> {
  // Built, every file is a data URL inside the page, which may not fetch.
  const comma = url.indexOf(',');
  if (url.startsWith('data:') && url.slice(0, comma).endsWith(';base64')) {
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return Promise.resolve(bytes.buffer);
  }
  // Under the dev server they are plain URLs.
  return fetch(url).then((r) => r.arrayBuffer());
}

function load(audio: AudioContext): void {
  for (const url of Object.values(SOURCES).flat()) {
    if (buffers.has(url)) continue;
    bytesOf(url)
      .then((bytes) => audio.decodeAudioData(bytes))
      .then((buffer) => buffers.set(url, buffer))
      .catch(() => {});
  }
}

/** Open audio. Call from inside a tap; calling again is harmless. */
export function unlockSound(): void {
  try {
    if (!ctx) {
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      out = ctx.createGain();
      out.connect(ctx.destination);
      load(ctx);
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  } catch {
    // No sound is a quieter game, never a broken one.
  }
}

export function setSoundOn(value: boolean): void {
  on = value;
}

function play(name: Name, { rate = 1, level = 1, pick = 0 } = {}): void {
  if (!on || !ctx || !out) return;
  // iOS suspends the context when the app goes to the background.
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const buffer = buffers.get(SOURCES[name][pick]!);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = LEVEL[name] * level;
  source.connect(gain).connect(out);
  source.start();
}

export const sfx = {
  /** A key that moves the name on; `step` is how many of its keys are typed. */
  key(step: number) {
    const now = performance.now();
    if (now - lastKeyAt < KEY_GAP_MS) return;
    lastKeyAt = now;
    lastKey = (lastKey + 1) % SOURCES.key.length;
    const rise = Math.min(KEY_RISE_MAX, step * KEY_RISE_PER_KEY);
    play('key', { pick: lastKey, rate: 1 + rise + (Math.random() - 0.5) * 0.06 });
  },
  /** A key that does not: deleting, or typing on past a slip. Lower and softer. */
  keyOff() {
    const now = performance.now();
    if (now - lastKeyAt < KEY_GAP_MS) return;
    lastKeyAt = now;
    lastKey = (lastKey + 1) % SOURCES.key.length;
    play('key', { pick: lastKey, rate: 0.8, level: 0.7 });
  },
  slip: () => play('slip'),
  arrive: () => play('arrive'),
  transfer: () => play('transfer'),
  finish: () => play('finish'),
};
