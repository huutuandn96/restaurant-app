import { useQuery } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { useAuth } from '../../shared/auth'

export const useToken = () => useAuth((s) => s.token!)

// GET có token, key bắt đầu bằng 'manage' để realtime invalidate một lần
export function useManageQuery<T>(key: unknown[], path: string, enabled = true) {
  const token = useToken()
  return useQuery({ queryKey: ['manage', ...key], queryFn: () => api<T>(path, { token }), enabled })
}

export const inputBase =
  'rounded-xl bg-white px-3 py-2.5 text-[16px] outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-brand-500 sm:text-sm'
export const inputCls = `${inputBase} w-full`
export const btnPrimary = 'rounded-xl bg-brand-500 px-4 py-2.5 font-semibold text-white active:scale-[0.99] disabled:opacity-60'
export const btnGhost = 'rounded-xl bg-white px-4 py-2.5 font-semibold text-stone-700 ring-1 ring-stone-200 active:bg-stone-50'
export const card = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200'

export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
