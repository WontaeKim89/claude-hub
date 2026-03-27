import { useState, useEffect, useRef, useCallback } from 'react'

export interface ToolCall {
  name: string
  summary: string
}

export interface MonitorEvent {
  type: 'session_active' | 'session_ended' | 'message' | 'notification'
  session_id: string
  project: string
  project_path?: string
  role?: string
  model?: string
  tools?: ToolCall[]
  text_preview?: string
  timestamp?: number
  // notification fields
  reason?: 'response_complete' | 'needs_input'
  title?: string
  body?: string
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function sendDesktopNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  new Notification(title, {
    body,
    icon: '/icon.svg',
    tag: `claude-hub-${Date.now()}`,
  })
}

export function useMonitorStream() {
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    requestNotificationPermission()

    const es = new EventSource('/api/monitor/stream')
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as MonitorEvent
      event.timestamp = Date.now()

      // notification 이벤트 → 데스크탑 알림
      if (event.type === 'notification' && event.title && event.body) {
        if (notificationsEnabled) {
          sendDesktopNotification(event.title, event.body)
        }
      }

      setEvents(prev => [...prev.slice(-499), event])
    }
    es.onerror = () => {
      setConnected(false)
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [notificationsEnabled])

  const clear = useCallback(() => setEvents([]), [])
  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled(prev => !prev)
  }, [])

  return { events, connected, clear, notificationsEnabled, toggleNotifications }
}
