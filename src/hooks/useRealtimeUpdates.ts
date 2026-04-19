import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"

/**
 * Connects to the worker WebSocket and invalidates React Query caches when
 * the webhook fires. Replaces 3-second polling with push-based updates.
 *
 * Auto-reconnects on disconnect with exponential backoff.
 */
export function useRealtimeUpdates() {
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${protocol}//${window.location.host}/api/ws`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          // Invalidate caches based on event type
          if (data.type === "inbound_message") {
            qc.invalidateQueries({ queryKey: ["/api/conversations"] })
            if (data.phoneNumber) {
              qc.invalidateQueries({ queryKey: [`/api/conversations/${data.phoneNumber}`] })
            }
          } else if (data.type === "message_status") {
            qc.invalidateQueries({ queryKey: ["/api/conversations"] })
            if (data.recipientId) {
              qc.invalidateQueries({ queryKey: [`/api/conversations/${data.recipientId}`] })
            }
          }
        } catch {}
      }

      ws.onclose = () => {
        if (cancelled) return
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        reconnectAttempts.current++
        setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      wsRef.current?.close()
    }
  }, [qc])
}
