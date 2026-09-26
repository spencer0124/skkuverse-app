/**
 * ZzFX's tone renderer (https://github.com/KilledByAPixel/ZzFX, MIT, Frank
 * Force), ported to render into a buffer once. A tone is ZzFX's own parameter
 * list, so one can be shaped in the ZzFX sound designer and pasted in as is.
 *
 * ZzFX's per-play pitch randomness is left out: the same tone always renders
 * the same samples, and the page spreads the pitch at playback instead.
 */

/** A ZzFX parameter list, in ZzFX's order; a missing entry takes ZzFX's default. */
export type Tone = readonly number[];

/** ZzFX's master volume. */
const MASTER = 0.3;

export function renderTone(tone: Tone, sampleRate: number): Float32Array {
  const [
    toneVolume = 1,
    , // randomness: see above
    toneFrequency = 220,
    toneAttack = 0,
    toneSustain = 0,
    toneRelease = 0.1,
    shape = 0,
    shapeCurve = 1,
    toneSlide = 0,
    toneDeltaSlide = 0,
    tonePitchJump = 0,
    tonePitchJumpTime = 0,
    toneRepeatTime = 0,
    noise = 0,
    toneModulation = 0,
    bitCrush = 0,
    toneDelay = 0,
    sustainVolume = 1,
    toneDecay = 0,
    tremolo = 0,
    filter = 0,
  ] = tone;

  const PI2 = Math.PI * 2;
  const sign = (v: number) => (v < 0 ? -1 : 1);

  let slide = (toneSlide * 500 * PI2) / sampleRate / sampleRate;
  const startSlide = slide;
  let frequency = (toneFrequency * PI2) / sampleRate;
  let startFrequency = frequency;

  // A biquad low-pass (filter > 0) or high-pass (filter < 0), quality 2.
  const w = (PI2 * Math.abs(filter) * 2) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / 2 / 2;
  const a0 = 1 + alpha;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const b0 = (1 + sign(filter) * cos) / 2 / a0;
  const b1 = -(sign(filter) + cos) / a0;
  const b2 = b0;
  let x2 = 0;
  let x1 = 0;
  let y2 = 0;
  let y1 = 0;

  const attack = toneAttack * sampleRate + 9;
  const decay = toneDecay * sampleRate;
  const sustain = toneSustain * sampleRate;
  const release = toneRelease * sampleRate;
  const delay = toneDelay * sampleRate;
  const deltaSlide = (toneDeltaSlide * 500 * PI2) / sampleRate ** 3;
  const modulation = (toneModulation * PI2) / sampleRate;
  const pitchJump = (tonePitchJump * PI2) / sampleRate;
  const pitchJumpTime = tonePitchJumpTime * sampleRate;
  const repeatTime = (toneRepeatTime * sampleRate) | 0;
  const volume = toneVolume * MASTER;

  const length = (attack + decay + sustain + release + delay) | 0;
  const out = new Float32Array(length);
  const crushEvery = (bitCrush * 100) | 0;
  let t = 0;
  let tm = 0;
  let j = 1;
  let r = 0;
  let c = 0;
  let s = 0;

  for (let i = 0; i < length; i++) {
    // A bit-crushed tone holds each sample for `crushEvery` samples.
    if (!crushEvery || !(++c % crushEvery)) {
      // 0 sine, 1 triangle, 2 saw, 3 tan, 4 noise. A shape curve of 0 squares any of them.
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? Math.sin(t ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - ((((2 * t) / PI2) % 2) + 2) % 2
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);

      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        sign(s) *
        Math.abs(s) ** shapeCurve *
        (i < attack
          ? i / attack
          : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
              ? sustainVolume
              : i < length - delay
                ? ((length - i - delay) / release) * sustainVolume
                : 0);

      if (delay) {
        const echo = delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * out[(i - delay) | 0]!) / 2 / volume;
        s = s / 2 + echo;
      }

      if (filter) s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
    }
    out[i] = s * volume;

    const f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
    t += f - f * noise * (1 - (((Math.sin(i) + 1) * 1e9) % 2));

    if (j && ++j > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      j = 0;
    }
    if (repeatTime && !(++r % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      j = j || 1;
    }
  }
  return out;
}
