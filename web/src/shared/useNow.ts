import { useEffect, useState } from 'react'

// Re-render định kỳ để cập nhật "x phút trước" / đồng hồ chờ của bếp
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
