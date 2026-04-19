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

export interface FlowTenant {
  id: number
  name: string
  slug: string
  wabaId: string
  phoneNumberId: string
  createdBy: string | null
  createdAt: string
  activePublicKey: {
    id: number
    publicKeyPem: string
    createdAt: string
    metaKeyId: string | null
    metaRegisteredAt: string | null
  } | null
  flowCount: number
  metaKeyRegistration?: { success: boolean; metaKeyId?: string; error?: string }
}

export interface FlowDef {
  id: number
  tenantId: number
  metaFlowId: string | null
  name: string
  slug: string
  description: string | null
  isActive: boolean
  createdAt: string
  submissionCount: number
}

export interface FlowSubmission {
  id: number
  flowId: number
  tenantId: number
  waPhone: string | null
  flowToken: string | null
  screenResponses: Record<string, unknown>
  completedAt: string
  createdAt: string
}

export interface TenantAnalytics {
  totalSubmissions: number
  dailyCounts: { day: string; submissions: number }[]
  flowStats: {
    flowId: number
    name: string
    slug: string
    isActive: boolean
    submissions: number
    inits: number
    completionRate: number | null
  }[]
  recentSubmissions: FlowSubmission[]
}

export interface FlowAnalytics {
  submissions: number
  inits: number
  completionRate: number | null
  dailyCounts: { day: string; submissions: number }[]
  topScreens: { screenName: string | null; views: number }[]
}

export interface SubmissionsPage {
  total: number
  page: number
  limit: number
  submissions: FlowSubmission[]
}

// ── Tenants ───────────────────────────────────────────────────────────────────

export function useTenants() {
  const qc = useQueryClient()

  const query = useQuery<FlowTenant[], Error>({
    queryKey: ["flow-tenants"],
    queryFn: () => apiJSON<FlowTenant[]>("/api/flows/tenants"),
  })

  const createMutation = useMutation<FlowTenant, Error, {
    name: string; slug?: string
  }>({
    mutationFn: body => apiJSON<FlowTenant>("/api/flows/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-tenants"] }),
  })

  const updateMutation = useMutation<FlowTenant, Error, {
    id: number; body: { name?: string; slug?: string }
  }>({
    mutationFn: ({ id, body }) => apiJSON<FlowTenant>(`/api/flows/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-tenants"] }),
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: id => apiJSON(`/api/flows/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-tenants"] }),
  })

  const rotateMutation = useMutation<
    {
      ok: boolean
      newPublicKey: {
        id: number; publicKeyPem: string; createdAt: string
        metaKeyId: string | null; metaRegisteredAt: string | null
      }
      metaKeyRegistration: { success: boolean; metaKeyId?: string; error?: string }
    },
    Error,
    number
  >({
    mutationFn: id => apiJSON(`/api/flows/tenants/${id}/rotate-key`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-tenants"] }),
  })

  const registerMetaKeyMutation = useMutation<
    { ok: boolean; metaKeyRegistration: { success: boolean; metaKeyId?: string; error?: string } },
    Error,
    number
  >({
    mutationFn: id => apiJSON(`/api/flows/tenants/${id}/register-meta-key`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-tenants"] }),
  })

  return {
    tenants: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    createTenant: createMutation.mutateAsync,
    updateTenant: (id: number, body: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) =>
      updateMutation.mutateAsync({ id, body }),
    deleteTenant: deleteMutation.mutateAsync,
    rotateKey: rotateMutation.mutateAsync,
    registerMetaKey: registerMetaKeyMutation.mutateAsync,
    registerMetaKeyPending: registerMetaKeyMutation.isPending,
  }
}

// ── Flow Definitions ──────────────────────────────────────────────────────────

export function useFlowDefs(tenantId: number | null) {
  const qc = useQueryClient()

  const query = useQuery<FlowDef[], Error>({
    queryKey: ["flow-defs", tenantId],
    queryFn: () => apiJSON<FlowDef[]>(`/api/flows/tenants/${tenantId}/flows`),
    enabled: tenantId != null && !isNaN(tenantId),
  })

  const createMutation = useMutation<FlowDef, Error, {
    name: string; slug?: string; metaFlowId?: string; description?: string
  }>({
    mutationFn: body => {
      if (!tenantId) throw new Error("No tenant selected")
      return apiJSON<FlowDef>(`/api/flows/tenants/${tenantId}/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-defs", tenantId] }),
  })

  const updateMutation = useMutation<FlowDef, Error, {
    flowId: number; body: { name?: string; description?: string; isActive?: boolean; metaFlowId?: string }
  }>({
    mutationFn: ({ flowId, body }) => {
      if (!tenantId) throw new Error("No tenant selected")
      return apiJSON<FlowDef>(`/api/flows/tenants/${tenantId}/flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-defs", tenantId] }),
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: flowId => {
      if (!tenantId) throw new Error("No tenant selected")
      return apiJSON(`/api/flows/tenants/${tenantId}/flows/${flowId}`, { method: "DELETE" })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-defs", tenantId] }),
  })

  return {
    flows: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    createFlow: createMutation.mutateAsync,
    updateFlow: (flowId: number, body: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) =>
      updateMutation.mutateAsync({ flowId, body }),
    deleteFlow: deleteMutation.mutateAsync,
  }
}

// ── Tenant Analytics ──────────────────────────────────────────────────────────

export function useTenantAnalytics(tenantId: number | null) {
  const query = useQuery<TenantAnalytics, Error>({
    queryKey: ["tenant-analytics", tenantId],
    queryFn: () => apiJSON<TenantAnalytics>(`/api/flows/tenants/${tenantId}/analytics`),
    enabled: tenantId != null && !isNaN(tenantId),
  })

  return {
    analytics: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  }
}

// ── Per-flow Analytics ────────────────────────────────────────────────────────

export function useFlowAnalytics(tenantId: number | null, flowId: number | null) {
  const query = useQuery<FlowAnalytics, Error>({
    queryKey: ["flow-analytics", tenantId, flowId],
    queryFn: () =>
      apiJSON<FlowAnalytics>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/analytics`
      ),
    enabled: tenantId != null && flowId != null,
  })

  return {
    analytics: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  }
}

// ── Flow Screens ──────────────────────────────────────────────────────────────

export interface FlowScreen {
  id: number
  flowId: number
  tenantId: number
  screenId: string
  label: string | null
  isFirst: boolean
  defaultNextScreen: string | null
  initData: Record<string, unknown> | null
  createdAt: string
}

export interface FlowRoutingRule {
  id: number
  screenDbId: number
  flowId: number
  tenantId: number
  priority: number
  fieldName: string
  operator: string
  fieldValue: string | null
  nextScreen: string
  injectData: Record<string, unknown> | null
  createdAt: string
}

export function useFlowScreens(tenantId: number | null, flowId: number | null) {
  const qc = useQueryClient()
  const key = ["flow-screens", tenantId, flowId]

  const query = useQuery<FlowScreen[], Error>({
    queryKey: key,
    queryFn: () =>
      apiJSON<FlowScreen[]>(`/api/flows/tenants/${tenantId}/flows/${flowId}/screens`),
    enabled: tenantId != null && flowId != null,
  })

  const createMutation = useMutation<FlowScreen, Error, {
    screenId: string
    label?: string
    isFirst?: boolean
    defaultNextScreen?: string
    initData?: Record<string, unknown> | null
  }>({
    mutationFn: body => {
      if (!tenantId || !flowId) throw new Error("Missing ids")
      return apiJSON<FlowScreen>(`/api/flows/tenants/${tenantId}/flows/${flowId}/screens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateMutation = useMutation<FlowScreen, Error, {
    screenDbId: number
    body: {
      screenId?: string
      label?: string
      isFirst?: boolean
      defaultNextScreen?: string | null
      initData?: Record<string, unknown> | null
    }
  }>({
    mutationFn: ({ screenDbId, body }) => {
      if (!tenantId || !flowId) throw new Error("Missing ids")
      return apiJSON<FlowScreen>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/screens/${screenDbId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: screenDbId => {
      if (!tenantId || !flowId) throw new Error("Missing ids")
      return apiJSON(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/screens/${screenDbId}`,
        { method: "DELETE" }
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    screens: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    createScreen: createMutation.mutateAsync,
    updateScreen: (screenDbId: number, body: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) =>
      updateMutation.mutateAsync({ screenDbId, body }),
    deleteScreen: deleteMutation.mutateAsync,
  }
}

export function useFlowRules(
  tenantId: number | null,
  flowId: number | null,
  screenDbId: number | null
) {
  const qc = useQueryClient()
  const key = ["flow-rules", tenantId, flowId, screenDbId]

  const query = useQuery<FlowRoutingRule[], Error>({
    queryKey: key,
    queryFn: () =>
      apiJSON<FlowRoutingRule[]>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/screens/${screenDbId}/rules`
      ),
    enabled: tenantId != null && flowId != null && screenDbId != null,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const createMutation = useMutation<FlowRoutingRule, Error, {
    fieldName: string
    operator: string
    fieldValue?: string
    nextScreen: string
    priority?: number
    injectData?: Record<string, unknown> | null
  }>({
    mutationFn: body => {
      if (!tenantId || !flowId || !screenDbId) throw new Error("Missing ids")
      return apiJSON<FlowRoutingRule>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/screens/${screenDbId}/rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation<FlowRoutingRule, Error, {
    ruleId: number
    body: {
      fieldName?: string
      operator?: string
      fieldValue?: string | null
      nextScreen?: string
      priority?: number
      injectData?: Record<string, unknown> | null
    }
  }>({
    mutationFn: ({ ruleId, body }) => {
      if (!tenantId || !flowId || !screenDbId) throw new Error("Missing ids")
      return apiJSON<FlowRoutingRule>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/screens/${screenDbId}/rules/${ruleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: ruleId => {
      if (!tenantId || !flowId || !screenDbId) throw new Error("Missing ids")
      return apiJSON(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/screens/${screenDbId}/rules/${ruleId}`,
        { method: "DELETE" }
      )
    },
    onSuccess: invalidate,
  })

  const reorderMutation = useMutation<FlowRoutingRule[], Error, number[]>({
    mutationFn: ruleIds => {
      if (!tenantId || !flowId || !screenDbId) throw new Error("Missing ids")
      return apiJSON<FlowRoutingRule[]>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/screens/${screenDbId}/rules/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleIds }),
        }
      )
    },
    onSuccess: (reordered) => qc.setQueryData(key, reordered),
    onSettled: invalidate,
  })

  return {
    rules: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    createRule: createMutation.mutateAsync,
    updateRule: (ruleId: number, body: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) =>
      updateMutation.mutateAsync({ ruleId, body }),
    deleteRule: deleteMutation.mutateAsync,
    reorderRules: reorderMutation.mutateAsync,
  }
}

// ── Integrations ──────────────────────────────────────────────────────────────

export interface FlowIntegration {
  id: number
  flowId: number
  tenantId: number
  type: string
  name: string
  isActive: boolean
  config: Record<string, unknown> // token is masked server-side
  createdAt: string
  updatedAt: string
}

export interface IntegrationMapping {
  id: number
  integrationId: number
  sourceField: string
  targetField: string
  targetFieldType: string | null
  isStatic: boolean
  staticValue: string | null
  createdAt: string
}

export interface NotionDatabase {
  id: string
  title: string
  url: string
}

export interface NotionDatabaseSchema {
  id: string
  title: string
  properties: { name: string; id: string; type: string }[]
}

export function useIntegrations(tenantId: number | null, flowId: number | null) {
  const qc = useQueryClient()

  const query = useQuery<FlowIntegration[], Error>({
    queryKey: ["flow-integrations", tenantId, flowId],
    queryFn: () =>
      apiJSON<FlowIntegration[]>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/integrations`
      ),
    enabled: tenantId != null && flowId != null,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const createMutation = useMutation<FlowIntegration, Error, {
    type: string; name: string; config: Record<string, unknown>
  }>({
    mutationFn: body =>
      apiJSON<FlowIntegration>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/integrations`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-integrations", tenantId, flowId] }),
  })

  const updateMutation = useMutation<FlowIntegration, Error, {
    id: number; body: { name?: string; isActive?: boolean; config?: Record<string, unknown> }
  }>({
    mutationFn: ({ id, body }) =>
      apiJSON<FlowIntegration>(`/api/flows/integrations/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-integrations", tenantId, flowId] }),
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: id => apiJSON(`/api/flows/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-integrations", tenantId, flowId] }),
  })

  return {
    integrations: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    createIntegration: createMutation.mutateAsync,
    updateIntegration: (id: number, body: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) =>
      updateMutation.mutateAsync({ id, body }),
    deleteIntegration: deleteMutation.mutateAsync,
  }
}

export function useMappings(integrationId: number | null) {
  const qc = useQueryClient()

  const query = useQuery<IntegrationMapping[], Error>({
    queryKey: ["flow-integration-mappings", integrationId],
    queryFn: () => apiJSON<IntegrationMapping[]>(`/api/flows/integrations/${integrationId}/mappings`),
    enabled: integrationId != null,
  })

  const saveMutation = useMutation<IntegrationMapping[], Error, Array<{
    sourceField: string; targetField: string; targetFieldType?: string;
    isStatic?: boolean; staticValue?: string;
  }>>({
    mutationFn: body =>
      apiJSON<IntegrationMapping[]>(`/api/flows/integrations/${integrationId}/mappings`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow-integration-mappings", integrationId] }),
  })

  return {
    mappings: query.data ?? [],
    loading: query.isLoading,
    saveMappings: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
  }
}

export async function fetchNotionDatabases(notionToken: string): Promise<NotionDatabase[]> {
  return apiJSON<NotionDatabase[]>(`/api/flows/integrations/notion/databases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notionToken }),
  })
}

export async function fetchNotionDatabaseSchema(integrationId: number): Promise<NotionDatabaseSchema> {
  return apiJSON<NotionDatabaseSchema>(`/api/flows/integrations/${integrationId}/notion/database`)
}

// ── Submissions (lazy, per-flow) ──────────────────────────────────────────────

export function useSubmissions(tenantId: number | null, flowId: number | null) {
  const [page, setPageState] = React.useState(1)

  const query = useQuery<SubmissionsPage, Error>({
    queryKey: ["flow-submissions", tenantId, flowId, page],
    queryFn: () =>
      apiJSON<SubmissionsPage>(
        `/api/flows/tenants/${tenantId}/flows/${flowId}/submissions?page=${page}&limit=20`
      ),
    enabled: tenantId != null && flowId != null,
    placeholderData: prev => prev,
  })

  const setPage = (p: number) => setPageState(p)

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    page,
    setPage,
  }
}
