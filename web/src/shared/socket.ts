import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { RealtimeEventName, RealtimeEvents } from './types'

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'unauthorized'

type Handlers = { [K in RealtimeEventName]?: (payload: RealtimeEvents[K]) => void }

type Options = {
  handlers: Handlers
  // Gọi khi kết nối lại sau khi rớt mạng → refetch để không bỏ lỡ event
  onReconnect?: () => void
}

/**
 * Kết nối Socket.IO qua Vite proxy (cùng origin, SPEC D8).
 * token: socket_token nhận từ API (login staff / mở session khách).
 */
export function useSocket(token: string | null | undefined, { handlers, onReconnect }: Options): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  // Giữ handler mới nhất mà không phải reconnect mỗi lần render
  const handlersRef = useRef(handlers)
  const reconnectRef = useRef(onReconnect)
  handlersRef.current = handlers
  reconnectRef.current = onReconnect

  useEffect(() => {
    if (!token) {
      setStatus('disconnected')
      return
    }
    const socket: Socket = io({ auth: { token }, transports: ['websocket', 'polling'] })
    let everConnected = false
    setStatus('connecting')

    socket.on('connect', () => {
      setStatus('connected')
      if (everConnected) reconnectRef.current?.()
      everConnected = true
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', (err) => {
      setStatus(err.message === 'unauthorized' ? 'unauthorized' : 'disconnected')
    })
    socket.onAny((event: string, payload: unknown) => {
      const fn = handlersRef.current[event as RealtimeEventName] as ((p: unknown) => void) | undefined
      fn?.(payload)
    })

    // Mobile: quay lại tab sau khi khoá màn hình → refetch
    const onVisible = () => {
      if (document.visibilityState === 'visible' && everConnected) {
        if (!socket.connected) socket.connect()
        reconnectRef.current?.()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      socket.disconnect()
    }
  }, [token])

  return status
}
