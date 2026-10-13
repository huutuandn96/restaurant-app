// Máy dùng chung đã ghi danh để đăng nhập PIN (SPEC §4.1). Token chỉ lưu trên máy này.
export type StaffDevice = { id: number; name: string; token: string; lock_minutes: number | null }

const KEY = 'staff-device'

export function loadDevice(): StaffDevice | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StaffDevice) : null
  } catch {
    return null
  }
}

export function saveDevice(d: StaffDevice | null) {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode */
  }
}
