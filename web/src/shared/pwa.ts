import { registerServiceWorker } from './push'

// Gắn manifest + meta cài app cho Staff site (SPEC §1.1). index.html dùng chung cho cả 3 site nên chèn động.
export function installStaffPwa() {
  const add = (tag: string, attrs: Record<string, string>) => {
    const sel = Object.entries(attrs).filter(([k]) => k !== 'content' && k !== 'href').map(([k, v]) => `[${k}="${v}"]`).join('')
    if (document.head.querySelector(`${tag}${sel}`)) return
    const el = document.createElement(tag)
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    document.head.appendChild(el)
  }
  add('link', { rel: 'manifest', href: '/manifest-staff.webmanifest' })
  add('link', { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' })
  add('meta', { name: 'theme-color', content: '#1c1917' })
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Staff' })
  registerServiceWorker()
}
