import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, setUnauthorizedHandler } from './api'
import type { Role, User } from './types'

type AuthState = {
  user: User | null
  token: string | null
  socketToken: string | null
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

type LoginResponse = { user: User; token: string; socket_token: string }

// Dùng chung cho Staff site và Manage site
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      socketToken: null,
      login: async (email, password) => {
        const res = await api<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } })
        set({ user: res.user, token: res.token, socketToken: res.socket_token })
        return res.user
      },
      logout: () => set({ user: null, token: null, socketToken: null }),
    }),
    { name: 'restaurant-auth' },
  ),
)

setUnauthorizedHandler(() => useAuth.getState().logout())

export const hasRole = (user: User | null, ...roles: Role[]) => !!user && roles.includes(user.role)

export const ROLE_LABEL: Record<Role, string> = {
  waiter: 'Phục vụ',
  kitchen: 'Bếp',
  manager: 'Quản lý',
  owner: 'Chủ',
}
