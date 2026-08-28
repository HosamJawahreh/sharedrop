/** Subtle UI sounds via Web Audio — no asset files, respects reduced-motion. */

type SoundKind =
  | 'connecting'
  | 'connected'
  | 'transfer_start'
  | 'transfer_tick'
  | 'transfer_complete'
  | 'transfer_failed'
  | 'incoming'

let audioContext: AudioContext | null = null
let primed = false

function prefersReducedFeedback(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getAudioContext(): AudioContext | null {
  if (prefersReducedFeedback()) return null
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioContext) audioContext = new Ctx()
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

/** Resume audio context after first user gesture (required by browsers). */
export function primeFlowAudio(): void {
  if (primed) return
  primed = true
  const ctx = getAudioContext()
  if (ctx?.state === 'suspended') {
    void ctx.resume()
  }
}

function playTone(
  frequency: number,
  durationMs: number,
  options?: { type?: OscillatorType; volume?: number; delayMs?: number },
): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const volume = options?.volume ?? 0.06
  const type = options?.type ?? 'sine'
  const startAt = ctx.currentTime + (options?.delayMs ?? 0) / 1000
  const duration = durationMs / 1000

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

function playChord(frequencies: number[], durationMs: number, volume = 0.05): void {
  frequencies.forEach((frequency, index) => {
    playTone(frequency, durationMs, { volume, delayMs: index * 45 })
  })
}

export function playFlowSound(kind: SoundKind): void {
  switch (kind) {
    case 'connecting':
      playTone(330, 140, { volume: 0.04, type: 'triangle' })
      playTone(415, 160, { volume: 0.035, type: 'triangle', delayMs: 80 })
      break
    case 'connected':
      playChord([392, 523, 659], 260, 0.05)
      break
    case 'transfer_start':
      playTone(440, 100, { volume: 0.055 })
      playTone(554, 130, { volume: 0.045, delayMs: 75 })
      playTone(659, 150, { volume: 0.04, delayMs: 150 })
      break
    case 'transfer_tick':
      playTone(520, 55, { volume: 0.028, type: 'triangle' })
      break
    case 'transfer_complete':
      playChord([523, 659, 784], 320, 0.06)
      playTone(988, 200, { volume: 0.035, delayMs: 180 })
      break
    case 'transfer_failed':
      playTone(196, 200, { type: 'triangle', volume: 0.05 })
      playTone(147, 240, { type: 'triangle', volume: 0.04, delayMs: 120 })
      break
    case 'incoming':
      playTone(587, 110, { volume: 0.055 })
      playTone(740, 150, { volume: 0.045, delayMs: 95 })
      break
  }
}
