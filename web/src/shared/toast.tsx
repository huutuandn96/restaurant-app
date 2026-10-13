import { useEffect, useState } from 'react'

type Toast = { id: number; text: string; kind: 'info' | 'error' }
let push: ((t: Toast) => void) | null = null
let seq = 0

export function toast(text: string, kind: Toast['kind'] = 'info') {
  push?.({ id: ++seq, text, kind })
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    push = (t) => {
      setItems((l) => [...l, t].slice(-3))
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== t.id)), 3500)
    }
    return () => {
      push = null
    }
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto flex max-w-md flex-col gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.kind === 'error' ? 'bg-red-600' : 'bg-stone-900/90'}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
