export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown, message: string) {
    super(message)
    this.status = status
    this.data = data
  }
}

type Options = {
  method?: string
  body?: unknown
  token?: string | null // staff / manage JWT
  sessionToken?: string | null // khách (X-Session-Token)
}

// Hook toàn cục khi gặp 401 (staff site dùng để logout)
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn
}

export async function api<T>(path: string, { method = 'GET', body, token, sessionToken }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (sessionToken) headers['X-Session-Token'] = sessionToken

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.()
    const msg = (data as { error?: string } | null)?.error || res.statusText
    throw new ApiError(res.status, data, msg)
  }
  return data as T
}

// Tải file (CSV) có kèm token
export async function download(path: string, token: string, filename: string) {
  const res = await fetch(`/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new ApiError(res.status, null, 'Tải file thất bại')
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// Upload multipart (ảnh món) — không set Content-Type để browser tự thêm boundary
export async function upload<T>(path: string, form: FormData, token: string, method = 'PATCH'): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { method, headers: { Authorization: `Bearer ${token}` }, body: form })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, data, data?.error || res.statusText)
  return data as T
}
