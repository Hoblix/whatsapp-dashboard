import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

const BASE = ""

async function apiJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, { credentials: "include", ...init })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any
    throw new Error(data?.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS" | "CAROUSEL"
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION"
  text?: string
  buttons?: TemplateButton[]
  cards?: CarouselCard[]
  example?: {
    header_handle?: string[]
    body_text?: string[][]
  }
}

export interface TemplateButton {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY" | "FLOW" | "COPY_CODE"
  text: string
  url?: string
  phone_number?: string
  flow_id?: string
  flow_action?: string
  navigate_screen?: string
  example?: string[]
}

export interface CarouselCard {
  components: TemplateComponent[]
}

export interface Template {
  id: string
  name: string
  status: string
  language: string
  category: string
  components: TemplateComponent[]
  quality_score?: { score: string }
}

export interface CreateTemplatePayload {
  name: string
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  language: string
  components: TemplateComponent[]
  allow_category_change?: boolean
  mediaSourceUrl?: string
  mediaSourceType?: string
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useAllTemplates() {
  const query = useQuery<Template[], Error>({
    queryKey: ["all-templates"],
    queryFn: async () => {
      const res = await apiJSON<{ data: Template[] }>("/api/templates")
      return res.data ?? []
    },
  })
  return {
    templates: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  }
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation<{ success: boolean; id: string; status: string }, Error, CreateTemplatePayload>({
    mutationFn: (payload) =>
      apiJSON("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-templates"] })
      qc.invalidateQueries({ queryKey: ["templates"] })
    },
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (name) =>
      apiJSON(`/api/templates/${encodeURIComponent(name)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-templates"] })
      qc.invalidateQueries({ queryKey: ["templates"] })
    },
  })
}

// ── Languages ───────────────────────────────────────────────────────────────

export const TEMPLATE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "en_US", label: "English (US)" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "pt_BR", label: "Portuguese (BR)" },
  { code: "ar", label: "Arabic" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ms", label: "Malay" },
  { code: "ru", label: "Russian" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh_CN", label: "Chinese (Simplified)" },
]
