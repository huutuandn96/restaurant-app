import { useState } from 'react'
import { useAuth } from './auth'
import { unlockAudio } from './notify'
import type { Role } from './types'

type Props = { title: string; subtitle: string; demo: string[]; allowed: Role[] }

// Dùng chung cho Staff site và Manage site
export default function LoginPage({ title, subtitle, demo, allowed }: Props) {
  const login = useAuth((s) => s.login)
  const logout = useAuth((s) => s.logout)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault()
    unlockAudio()
    setLoading(true)
    setError('')
    try {
      const user = await login(creds?.email ?? email, creds?.password ?? password)
      if (!allowed.includes(user.role)) {
        logout()
        setError('Tài khoản không có quyền vào trang này')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-stone-100 to-brand-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-stone-200">
        <div className="text-4xl">🍽️</div>
        <h1 className="mt-2 text-2xl font-extrabold">{title}</h1>
        <p className="text-sm text-stone-500">{subtitle}</p>
        <input
          type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-5 w-full rounded-xl bg-stone-50 px-4 py-3 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-brand-500"
        />
        <input
          type="password" autoComplete="current-password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-3 w-full rounded-xl bg-stone-50 px-4 py-3 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-brand-500"
        />
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        <button disabled={loading} className="mt-4 w-full rounded-xl bg-brand-500 py-3 font-bold text-white active:scale-[0.99] disabled:opacity-60">
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Tài khoản demo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {demo.map((d) => (
              <button
                type="button" key={d} onClick={() => submit(undefined, { email: d, password: 'password' })}
                className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 active:bg-stone-200"
              >
                {d.split('@')[0]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
