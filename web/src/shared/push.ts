import { api } from './api'

// Web Push cho Staff (SPEC §1.1). Cần HTTPS hoặc localhost; iPhone/iPad cần "Thêm vào màn hình chính".
export type PushState = 'unsupported' | 'insecure' | 'denied' | 'off' | 'on'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return
  navigator.serviceWorker.register('/sw.js', { scope: '/staff' }).catch(() => {})
}

export async function pushState(): Promise<PushState> {
  if (!window.isSecureContext) return 'insecure'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration('/staff')
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

const toKey = (b64: string) => {
  const s = b64.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function enablePush(token: string | null) {
  const cfg = await api<{ enabled: boolean; public_key: string | null }>('/staff/push', { token })
  if (!cfg.enabled || !cfg.public_key) throw new Error('Máy chủ chưa cấu hình push (VAPID)')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Bạn đã không cho phép thông báo')
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/staff' })
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(cfg.public_key) }))
  await api('/staff/push', { method: 'POST', token, body: sub.toJSON() })
}

export async function disablePush(token: string | null) {
  const reg = await navigator.serviceWorker.getRegistration('/staff')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await api('/staff/push', { method: 'DELETE', token, body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}

// Sau khi đăng nhập (kể cả đổi người trên máy dùng chung): gắn subscription sẵn có của máy cho người đang dùng
export async function syncPushOwner(token: string | null) {
  if (!window.isSecureContext || !pushSupported() || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.getRegistration('/staff')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await api('/staff/push', { method: 'POST', token, body: sub.toJSON() }).catch(() => {})
}
