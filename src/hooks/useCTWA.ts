import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import React from "react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

async function apiJSON<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...opts })
  const ct = res.headers.get("content-type") ?? ""
  if (!ct.includes("application/json")) {
    if (res.status === 401) throw new Error("Session expired — please refresh the page")
    if (res.status === 403) throw new Error("Access denied")
    throw new Error(`Server error (HTTP ${res.status}) — please try again`)
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CTWARule {
  id: number
  name: string
  description: string | null
  matchType: "any" | "ad_id" | "source_url_contains"
  matchValue: string | null
  actionType: "template" | "flow"
  actionConfig: Record<string, unknown>
  priority: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CTWAEvent {
  id: number
  conversationId: number
  phoneNumber: string
  adId: string | null
  adSourceUrl: string | null
  adHeadline: string | null
  adBody: string | null
  adMediaType: string | null
  ruleId: number | null
  actionFired: boolean
  rawReferral: Record<string, unknown>
  createdAt: string
}

// ── Rules Hook ────────────────────────────────────────────────────────────────

export function useCTWARules() {
  const qc = useQueryClient()

  const query = useQuery<CTWARule[], Error>({
    queryKey: ["ctwa-rules"],
    queryFn: () => apiJSON<CTWARule[]>("/api/ctwa/rules"),
  })

  const createMutation = useMutation<CTWARule, Error, Omit<CTWARule, "id" | "createdAt" | "updatedAt">>({
    mutationFn: body =>
      apiJSON<CTWARule>("/api/ctwa/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ctwa-rules"] }),
  })

  const updateMutation = useMutation<CTWARule, Error, { id: number; body: Partial<Omit<CTWARule, "id" | "createdAt" | "updatedAt">> }>({
    mutationFn: ({ id, body }) =>
      apiJSON<CTWARule>(`/api/ctwa/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ctwa-rules"] }),
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: id =>
      apiJSON(`/api/ctwa/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ctwa-rules"] }),
  })

  return {
    rules: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    createRule: createMutation.mutateAsync,
    updateRule: (id: number, body: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) =>
      updateMutation.mutateAsync({ id, body }),
    deleteRule: deleteMutation.mutateAsync,
  }
}

// ── Events Hook ───────────────────────────────────────────────────────────────

export function useCTWAEvents(limit = 20) {
  const [offset, setOffset] = React.useState(0)
  const [allEvents, setAllEvents] = React.useState<CTWAEvent[]>([])

  const query = useQuery<{ events: CTWAEvent[]; total: number }, Error>({
    queryKey: ["ctwa-events", limit, offset],
    queryFn: () =>
      apiJSON<{ events: CTWAEvent[]; total: number }>(
        `/api/ctwa/events?limit=${limit}&offset=${offset}`
      ),
  })

  React.useEffect(() => {
    if (query.data) {
      if (offset === 0) {
        setAllEvents(query.data.events)
      } else {
        setAllEvents(prev => [...prev, ...query.data!.events])
      }
    }
  }, [query.data, offset])

  const loadMore = () => {
    setOffset(prev => prev + limit)
  }

  const hasMore = query.data ? offset + limit < query.data.total : false

  return {
    events: allEvents,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    loadMore,
    hasMore,
  }
}
