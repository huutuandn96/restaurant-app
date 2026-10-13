// Âm thanh + rung khi có sự kiện mới (SPEC §2.3.4)
// Trình duyệt mobile chặn audio tới khi người dùng chạm màn hình → gọi unlockAudio() trong 1 handler click.

let ctx: AudioContext | null = null

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

export const audioUnlocked = () => ctx?.state === 'running'

type Tone = 'new' | 'ready' | 'alert'

const PATTERNS: Record<Tone, number[]> = {
  new: [880, 1175], // 2 nốt đi lên: đơn mới
  ready: [660, 880, 1320], // 3 nốt: món sẵn sàng
  alert: [440, 440], // 2 nốt trầm: hết món / gọi nhân viên
}

export function beep(tone: Tone = 'new') {
  if (!ctx || ctx.state !== 'running') return
  const start = ctx.currentTime
  PATTERNS[tone].forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = start + i * 0.18
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(t)
    osc.stop(t + 0.17)
  })
}

export function vibrate(pattern: number | number[] = [120, 60, 120]) {
  navigator.vibrate?.(pattern)
}

export function notify(tone: Tone = 'new') {
  beep(tone)
  vibrate(tone === 'alert' ? [200, 100, 200] : [120, 60, 120])
}
