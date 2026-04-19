import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { FlowFieldEntry } from "@/types/conditionV2"

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

export interface AutomationWorkflow {
  id: number
  name: string
  description: string | null
  triggerType: "ad_click" | "website" | "direct_wa" | "manual"
  triggerConfig: Record<string, unknown>
  isActive: boolean
  debugMode: boolean
  disabledReason: string | null
  createdAt: string
  updatedAt: string
}

// ── Execution Log Types ─────────────────────────────────────────────────────

interface DecisionEntry {
  field_key: string
  raw_value: string | null
  normalized_value: string | null
  operator: string
  expected_value: string
  result: "TRUE" | "FALSE" | "FAILED"
  failed_reason?: string
}

interface ConditionLog {
  id: number
  nodeId: string | null
  schemaVersion: string | null
  logic: string | null
  durationMs: number | null
  decisions: DecisionEntry[]
  finalResult: string
  failedReason: string | null
  branchTaken: string | null
  createdAt: string
}

export interface ExecutionWithLogs {
  id: number
  workflowId: number
  phoneNumber: string
  status: string
  startedAt: string
  completedAt: string | null
  conditionLogs: ConditionLog[]
}

export interface AutomationNode {
  id: number
  workflowId: number
  parentNodeId: number | null
  nodeType: "trigger" | "action" | "branch" | "condition"
  position: number
  config: Record<string, unknown>
  children?: AutomationNode[]
}

export interface WorkflowWithNodes extends AutomationWorkflow {
  nodes: AutomationNode | null
}

// ── List / CRUD Hook ──────────────────────────────────────────────────────────

export function useAutomations() {
  const qc = useQueryClient()

  const query = useQuery<AutomationWorkflow[], Error>({
    queryKey: ["automations"],
    queryFn: () => apiJSON<AutomationWorkflow[]>("/api/automations"),
  })

  const createMutation = useMutation<
    AutomationWorkflow,
    Error,
    { name: string; description?: string; triggerType: string; triggerConfig?: Record<string, unknown> }
  >({
    mutationFn: body =>
      apiJSON<AutomationWorkflow>("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  })

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: id =>
      apiJSON(`/api/automations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  })

  const toggleMutation = useMutation<
    AutomationWorkflow,
    Error,
    { id: number; isActive: boolean }
  >({
    mutationFn: ({ id, isActive }) =>
      apiJSON<AutomationWorkflow>(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  })

  return {
    workflows: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    createWorkflow: createMutation.mutateAsync,
    deleteWorkflow: deleteMutation.mutateAsync,
    toggleWorkflow: (id: number, isActive: boolean) =>
      toggleMutation.mutateAsync({ id, isActive }),
  }
}

// ── Single Workflow + Nodes Hook ──────────────────────────────────────────────

export function useAutomation(id: number) {
  const qc = useQueryClient()

  const query = useQuery<WorkflowWithNodes, Error>({
    queryKey: ["automation", id],
    queryFn: async () => {
      const res = await apiJSON<{ workflow: AutomationWorkflow; tree: AutomationNode | null }>(`/api/automations/${id}`)
      return { ...res.workflow, nodes: res.tree }
    },
    enabled: id > 0,
  })

  const saveNodesMutation = useMutation<
    { success: boolean },
    Error,
    { tempId: string; parentTempId: string | null; nodeType: string; position: number; config: Record<string, unknown> }[]
  >({
    mutationFn: nodes =>
      apiJSON<{ success: boolean }>(`/api/automations/${id}/nodes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation", id] }),
  })

  const updateWorkflowMutation = useMutation<
    AutomationWorkflow,
    Error,
    Partial<Pick<AutomationWorkflow, "name" | "description" | "isActive" | "debugMode" | "triggerConfig">>
  >({
    mutationFn: body =>
      apiJSON<AutomationWorkflow>(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation", id] })
      qc.invalidateQueries({ queryKey: ["automations"] })
    },
  })

  return {
    workflow: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    saveNodes: saveNodesMutation.mutateAsync,
    savingNodes: saveNodesMutation.isPending,
    updateWorkflow: updateWorkflowMutation.mutateAsync,
  }
}

// ── Execution Logs Hook ─────────────────────────────────────────────────────

export interface ExecutionRun {
  id: number
  workflowId: number
  phoneNumber: string
  status: string
  currentNodeId: number | null
  startedAt: string
  completedAt: string | null
  conditionLogs: Array<{
    logic: string | null
    durationMs: number | null
    decisions: any[]
    finalResult: string
    failedReason: string | null
    branchTaken: string | null
  }>
  stepStatuses: Record<number, "completed" | "waiting" | "pending" | "skipped">
}

export interface WorkflowNode {
  id: number
  nodeType: string
  parentNodeId: number | null
  position: number
  config: Record<string, unknown>
}

export type MessageStats = Record<string, { sent: number; delivered: number; read: number; failed: number }>

export function useExecutionLogs(workflowId: number) {
  const query = useQuery<{ runs: ExecutionRun[]; nodes: WorkflowNode[]; messageStats: MessageStats }, Error>({
    queryKey: ["automation-runs", workflowId],
    queryFn: async () => {
      const res = await apiJSON<{ runs: ExecutionRun[]; nodes: WorkflowNode[]; messageStats?: MessageStats } | ExecutionRun[]>(`/api/automations/${workflowId}/runs`)
      if (Array.isArray(res)) return { runs: res as any, nodes: [], messageStats: {} }
      return { ...res, messageStats: res.messageStats ?? {} }
    },
    enabled: workflowId > 0,
    refetchInterval: 30_000,
  })

  return {
    runs: query.data?.runs ?? [],
    nodes: query.data?.nodes ?? [],
    messageStats: query.data?.messageStats ?? {},
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  }
}

// ── Helper Hooks for Templates / Campaigns / Flows ────────────────────────────

export function useTemplates() {
  const query = useQuery<{ name: string; status: string; language: string }[], Error>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await apiJSON<{ data: { name: string; status: string; language: string }[] }>("/api/templates")
      return res.data ?? []
    },
  })
  return { templates: query.data ?? [], loading: query.isLoading }
}

export function useCampaigns() {
  const query = useQuery<{ id: string; name: string; status: string }[], Error>({
    queryKey: ["ads-campaigns"],
    queryFn: async () => {
      const res = await apiJSON<{ data: { id: string; name: string; status: string }[] }>("/api/ads/campaigns")
      return res.data ?? []
    },
  })
  return { campaigns: query.data ?? [], loading: query.isLoading }
}

export function useCampaignAds(campaignId: string | null) {
  const query = useQuery<{ id: string; name: string; status: string }[], Error>({
    queryKey: ["ads-campaign-ads", campaignId],
    queryFn: async () => {
      const res = await apiJSON<{ data: { id: string; name: string; status: string }[] }>(`/api/ads/campaigns/${campaignId}/ads`)
      return res.data ?? []
    },
    enabled: !!campaignId,
  })
  return { ads: query.data ?? [], loading: query.isLoading }
}

export function useTenants() {
  const query = useQuery<{ id: number | string; name: string }[], Error>({
    queryKey: ["tenants"],
    queryFn: () => apiJSON<{ id: number | string; name: string }[]>("/api/flows/tenants"),
  })
  return { tenants: query.data ?? [], loading: query.isLoading }
}

export function useTenantFlows(tenantId: string | number | null) {
  const query = useQuery<{ id: number; name: string; slug: string }[], Error>({
    queryKey: ["tenant-flows", tenantId],
    queryFn: () => apiJSON<{ id: number; name: string; slug: string }[]>(`/api/flows/tenants/${tenantId}/flows`),
    enabled: !!tenantId,
  })
  return { flows: query.data ?? [], loading: query.isLoading }
}

// ── Flow Schema Sync Hook ────────────────────────────────────────────────────

export function useFlowSchema() {
  const mutation = useMutation({
    mutationFn: (flowId: string) =>
      apiJSON<{ fields: FlowFieldEntry[]; flow_version: string; fields_count: number; synced_at: string }>(
        `/api/flows/${flowId}/sync`,
        { method: "POST" }
      ),
  })

  return {
    syncSchema: mutation.mutateAsync,
    fields: mutation.data?.fields ?? [],
    flowVersion: mutation.data?.flow_version ?? null,
    syncedAt: mutation.data?.synced_at ?? null,
    syncing: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

// ── Enriched Templates Hook ──────────────────────────────────────────────────

export interface EnrichedTemplate {
  name: string
  flow_id: string | null
  components?: Array<{
    type: string
    text?: string
    format?: string
    buttons?: Array<{ type: string; text?: string; flow_id?: string; url?: string }>
    example?: { body_text?: string[][] }
  }>
}

export function useEnrichedTemplates() {
  const query = useQuery<EnrichedTemplate[], Error>({
    queryKey: ["templates-enriched"],
    queryFn: async () => {
      const res = await apiJSON<{ data: EnrichedTemplate[] }>("/api/templates/enriched")
      return res.data ?? []
    },
  })
  return {
    templates: query.data ?? [],
    loading: query.isLoading,
  }
}
