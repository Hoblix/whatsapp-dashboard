import React from "react"
import {
  Plus, Pencil, Trash2, AlertCircle, Megaphone, Play, Pause, Loader2,
} from "lucide-react"
import { CTWALayout } from "./CTWALayout"
import { useCTWARules, type CTWARule } from "@/hooks/useCTWA"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// ── Constants ───────────────────────────────────────────────────────────────

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "")

const MATCH_TYPE_LABELS: Record<string, string> = {
  any: "Match Any Ad",
  ad_id: "Match Ad ID",
  source_url_contains: "Source URL Contains",
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  template: "Send Template",
  flow: "Trigger Flow",
}

const PRIORITY_BY_MATCH: Record<string, number> = {
  ad_id: 0,
  source_url_contains: 10,
  any: 100,
}

// ── Types ───────────────────────────────────────────────────────────────────

interface TemplateItem {
  name: string
  status: string
  language: string
  category: string
  components: any[]
}

interface Tenant {
  id: number | string
  name: string
}

interface FlowItem {
  id: number
  name: string
  slug: string
  metaFlowId: string
  isActive: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/** Extract body parameter placeholders like {{1}}, {{2}} from template components */
function extractBodyParams(components: any[]): string[] {
  if (!Array.isArray(components)) return []
  const bodyComp = components.find((c: any) => c.type === "BODY" || c.type === "body")
  if (!bodyComp?.text) return []
  const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g)
  if (!matches) return []
  // Deduplicate and sort
  return [...new Set(matches)].sort() as string[]
}

/** Check if template has a flow button component */
function hasFlowButton(components: any[]): boolean {
  if (!Array.isArray(components)) return false
  return components.some((c: any) =>
    c.type === "BUTTONS" &&
    Array.isArray(c.buttons) &&
    c.buttons.some((b: any) => b.type === "FLOW")
  )
}

/** Build components JSON from template + parameter values */
function buildComponents(template: TemplateItem | null, paramValues: Record<string, string>): any[] {
  if (!template) return []
  const params = extractBodyParams(template.components)
  if (params.length === 0) return []

  const bodyParams = params.map((p, i) => ({
    type: "text",
    text: paramValues[p] || "",
  }))

  return [
    {
      type: "body",
      parameters: bodyParams,
    },
  ]
}

// ── API Hooks ───────────────────────────────────────────────────────────────

function useTemplates() {
  const [templates, setTemplates] = React.useState<TemplateItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${BASE}/api/templates`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch templates (${r.status})`)
        return r.json()
      })
      .then(json => {
        setTemplates(Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { templates, loading, error }
}

function useCampaigns() {
  const [campaigns, setCampaigns] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  React.useEffect(() => {
    setLoading(true)
    fetch(`${BASE}/api/ads/campaigns`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setCampaigns(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return { campaigns, loading }
}

function useCampaignAds(campaignId: string | null) {
  const [ads, setAds] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  React.useEffect(() => {
    if (!campaignId) { setAds([]); return }
    setLoading(true)
    fetch(`${BASE}/api/ads/campaigns/${campaignId}/ads`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAds(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [campaignId])
  return { ads, loading }
}

function useTenants() {
  const [tenants, setTenants] = React.useState<Tenant[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    setLoading(true)
    fetch(`${BASE}/api/flows/tenants`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch tenants (${r.status})`)
        return r.json()
      })
      .then(json => setTenants(Array.isArray(json) ? json : []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false))
  }, [])

  return { tenants, loading }
}

function useTenantFlows(tenantId: string | null) {
  const [flows, setFlows] = React.useState<FlowItem[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!tenantId) {
      setFlows([])
      return
    }
    setLoading(true)
    fetch(`${BASE}/api/flows/tenants/${tenantId}/flows`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch flows (${r.status})`)
        return r.json()
      })
      .then(json => {
        const all: FlowItem[] = Array.isArray(json) ? json : []
        setFlows(all.filter(f => f.isActive))
      })
      .catch(() => setFlows([]))
      .finally(() => setLoading(false))
  }, [tenantId])

  return { flows, loading }
}

// ── Rule Form ───────────────────────────────────────────────────────────────

interface RuleFormData {
  name: string
  description: string
  matchType: "any" | "ad_id" | "source_url_contains"
  matchValue: string
  actionType: "template" | "flow"
  // template fields
  templateName: string
  languageCode: string
  components: string
  // flow fields
  flowDbId: string
  metaFlowId: string
  tenantId: string
  ctaText: string
  messageBody: string
  header: string
  flowToken: string
  // common
  priority: string
  isActive: boolean
  // parameter values for template body params
  paramValues: Record<string, string>
}

const EMPTY_FORM: RuleFormData = {
  name: "",
  description: "",
  matchType: "any",
  matchValue: "",
  actionType: "template",
  templateName: "",
  languageCode: "en",
  components: "[]",
  flowDbId: "",
  metaFlowId: "",
  tenantId: "",
  ctaText: "",
  messageBody: "",
  header: "",
  flowToken: "",
  priority: "100",
  isActive: true,
  paramValues: {},
}

function ruleToForm(rule: CTWARule): RuleFormData {
  const cfg = rule.actionConfig ?? {}
  return {
    name: rule.name,
    description: rule.description ?? "",
    matchType: rule.matchType,
    matchValue: rule.matchValue ?? "",
    actionType: rule.actionType,
    templateName: (cfg as any).templateName ?? "",
    languageCode: (cfg as any).languageCode ?? "en",
    components: JSON.stringify((cfg as any).components ?? [], null, 2),
    flowDbId: String((cfg as any).flowDbId ?? ""),
    metaFlowId: (cfg as any).metaFlowId ?? "",
    tenantId: "",
    ctaText: (cfg as any).ctaText ?? "",
    messageBody: (cfg as any).messageBody ?? "",
    header: (cfg as any).header ?? "",
    flowToken: (cfg as any).flowToken ?? "",
    priority: String(rule.priority),
    isActive: rule.isActive,
    paramValues: {},
  }
}

function formToPayload(form: RuleFormData, selectedTemplate: TemplateItem | null) {
  let actionConfig: Record<string, unknown> = {}
  if (form.actionType === "template") {
    const components = buildComponents(selectedTemplate, form.paramValues)
    actionConfig = {
      templateName: form.templateName,
      languageCode: form.languageCode,
      components,
    }
  } else {
    actionConfig = {
      flowDbId: form.flowDbId ? Number(form.flowDbId) : undefined,
      metaFlowId: form.metaFlowId || undefined,
      ctaText: form.ctaText || undefined,
      messageBody: form.messageBody || undefined,
      header: form.header || undefined,
      flowToken: form.flowToken || undefined,
    }
  }
  return {
    name: form.name,
    description: form.description || null,
    matchType: form.matchType,
    matchValue: form.matchType === "any" ? null : form.matchValue || null,
    actionType: form.actionType,
    actionConfig,
    priority: PRIORITY_BY_MATCH[form.matchType] ?? 0,
    isActive: form.isActive,
  }
}

// ── Rule Dialog ─────────────────────────────────────────────────────────────

interface RuleDialogProps {
  open: boolean
  onClose: () => void
  initial?: RuleFormData
  onSubmit: (payload: ReturnType<typeof formToPayload>) => Promise<unknown>
  mode: "create" | "edit"
}

function RuleDialog({ open, onClose, initial, onSubmit, mode }: RuleDialogProps) {
  const [form, setForm] = React.useState<RuleFormData>({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  // API data
  const { templates, loading: templatesLoading, error: templatesError } = useTemplates()
  const { tenants, loading: tenantsLoading } = useTenants()
  const { flows, loading: flowsLoading } = useTenantFlows(form.tenantId || null)
  const { campaigns, loading: campaignsLoading } = useCampaigns()

  // Ad-ID cascade state
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string | null>(null)
  const [manualAdEntry, setManualAdEntry] = React.useState(false)
  const { ads, loading: adsLoading } = useCampaignAds(selectedCampaignId)

  // Selected campaign/ad names for preview
  const selectedCampaignName = React.useMemo(
    () => campaigns.find(c => String(c.id) === selectedCampaignId)?.name ?? null,
    [campaigns, selectedCampaignId]
  )
  const selectedAdName = React.useMemo(
    () => ads.find(a => String(a.id) === form.matchValue)?.name ?? null,
    [ads, form.matchValue]
  )

  // Selected template object
  const selectedTemplate = React.useMemo(
    () => templates.find(t => t.name === form.templateName) ?? null,
    [templates, form.templateName]
  )

  // Body parameters for selected template
  const bodyParams = React.useMemo(
    () => selectedTemplate ? extractBodyParams(selectedTemplate.components) : [],
    [selectedTemplate]
  )

  React.useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...initial })
      setErr(null)
      setSelectedCampaignId(null)
      setManualAdEntry(false)
    }
  }, [open])

  // Auto-set priority when match type changes
  React.useEffect(() => {
    setForm(f => ({ ...f, priority: String(PRIORITY_BY_MATCH[f.matchType] ?? 0) }))
  }, [form.matchType])

  const set = <K extends keyof RuleFormData>(k: K, v: RuleFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const setParam = (key: string, value: string) =>
    setForm(f => ({ ...f, paramValues: { ...f.paramValues, [key]: value } }))

  const handleSelectTemplate = (name: string) => {
    const tpl = templates.find(t => t.name === name)
    setForm(f => ({
      ...f,
      templateName: name,
      languageCode: tpl?.language ?? "en",
      paramValues: {},
    }))
  }

  const handleSelectFlow = (flowId: string) => {
    const flow = flows.find(f => String(f.id) === flowId)
    setForm(f => ({
      ...f,
      flowDbId: flowId,
      metaFlowId: flow?.metaFlowId ?? "",
    }))
  }

  const handleActionTypeChange = (val: "template" | "flow") => {
    setForm(f => ({
      ...f,
      actionType: val,
      templateName: "",
      languageCode: "en",
      components: "[]",
      paramValues: {},
      flowDbId: "",
      metaFlowId: "",
      tenantId: "",
      ctaText: "",
      messageBody: "",
      header: "",
      flowToken: "",
    }))
  }

  // Validation
  const isValid = React.useMemo(() => {
    if (!form.name.trim()) return false
    if (form.matchType !== "any" && !form.matchValue.trim()) return false
    if (form.actionType === "template" && !form.templateName) return false
    if (form.actionType === "flow" && (!form.flowDbId || !form.ctaText.trim() || !form.messageBody.trim())) return false
    return true
  }, [form])

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await onSubmit(formToPayload(form, selectedTemplate))
      onClose()
    } catch (ex: any) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  // Preview text
  const previewText = React.useMemo(() => {
    let matchLabel: string
    if (form.matchType === "any") {
      matchLabel = "any ad"
    } else if (form.matchType === "ad_id") {
      if (selectedAdName && selectedCampaignName) {
        matchLabel = `ad "${selectedAdName}" from campaign "${selectedCampaignName}"`
      } else {
        matchLabel = `ad ID "${form.matchValue || '...'}"`
      }
    } else {
      matchLabel = `URL containing "${form.matchValue || '...'}"`
    }

    const actionLabel = form.actionType === "template"
      ? `send template "${form.templateName || '...'}"`
      : `trigger flow "${flows.find(f => String(f.id) === form.flowDbId)?.name || '...'}"`

    return `When someone clicks ${matchLabel}, automatically ${actionLabel}`
  }, [form, flows, selectedAdName, selectedCampaignName])

  const labelCls = "block text-xs font-medium text-muted-foreground mb-1"
  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
  const selectCls = "w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Rule" : "Edit Rule"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new CTWA automation rule."
              : "Update this automation rule."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-3 pt-1">
          {/* Name */}
          <div>
            <label className={labelCls}>Name *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Welcome from Facebook ad"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={cn(inputCls, "resize-none h-16")}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Optional description..."
            />
          </div>

          {/* Match Type */}
          <div>
            <label className={labelCls}>Match Type *</label>
            <select
              className={selectCls}
              value={form.matchType}
              onChange={e => set("matchType", e.target.value as RuleFormData["matchType"])}
            >
              <option value="any">Match Any Ad</option>
              <option value="ad_id">Match Ad ID</option>
              <option value="source_url_contains">Source URL Contains</option>
            </select>
          </div>

          {/* Match Value -- Source URL Contains */}
          {form.matchType === "source_url_contains" && (
            <div>
              <label className={labelCls}>URL Substring *</label>
              <input
                className={inputCls}
                value={form.matchValue}
                onChange={e => set("matchValue", e.target.value)}
                placeholder="utm_campaign=summer"
                required
              />
            </div>
          )}

          {/* Match Value -- Ad ID (campaign/ad cascade) */}
          {form.matchType === "ad_id" && (
            <div className="space-y-2">
              {/* Manual entry toggle */}
              <div className="flex items-center justify-between">
                <label className={labelCls}>Ad Selection *</label>
                <button
                  type="button"
                  className="text-[11px] text-[#128C7E] hover:underline"
                  onClick={() => {
                    setManualAdEntry(v => !v)
                    set("matchValue", "")
                    setSelectedCampaignId(null)
                  }}
                >
                  {manualAdEntry ? "Select from campaigns" : "Enter Ad ID manually"}
                </button>
              </div>

              {manualAdEntry ? (
                <div>
                  <input
                    className={inputCls}
                    value={form.matchValue}
                    onChange={e => set("matchValue", e.target.value)}
                    placeholder="123456789"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Find this in Meta Ads Manager &rarr; Ad ID column
                  </p>
                </div>
              ) : (
                <>
                  {/* Campaign dropdown */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Campaign</label>
                    {campaignsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading campaigns...
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2">No campaigns found</div>
                    ) : (
                      <select
                        className={selectCls}
                        value={selectedCampaignId ?? ""}
                        onChange={e => {
                          const val = e.target.value
                          if (val === "__manual__") {
                            setManualAdEntry(true)
                            setSelectedCampaignId(null)
                            set("matchValue", "")
                            return
                          }
                          setSelectedCampaignId(val || null)
                          set("matchValue", "")
                        }}
                      >
                        <option value="">Select a campaign...</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name} {c.status === "ACTIVE" ? "(Active)" : `(${c.status})`}
                          </option>
                        ))}
                        <option value="__manual__">-- Manual entry --</option>
                      </select>
                    )}
                  </div>

                  {/* Ad dropdown */}
                  {selectedCampaignId && (
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">Ad</label>
                      {adsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading ads...
                        </div>
                      ) : ads.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2">No ads found for this campaign</div>
                      ) : (
                        <select
                          className={selectCls}
                          value={form.matchValue}
                          onChange={e => set("matchValue", e.target.value)}
                          required
                        >
                          <option value="">Select an ad...</option>
                          {ads.map(a => (
                            <option key={a.id} value={String(a.id)}>
                              {a.name} {a.status === "ACTIVE" ? "(Active)" : `(${a.status})`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Show selected ad info */}
                  {selectedAdName && selectedCampaignName && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Ad: <span className="font-medium text-foreground">{selectedAdName}</span>
                      {" "}from campaign{" "}
                      <span className="font-medium text-foreground">{selectedCampaignName}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action Type */}
          <div>
            <label className={labelCls}>Action Type *</label>
            <select
              className={selectCls}
              value={form.actionType}
              onChange={e => handleActionTypeChange(e.target.value as "template" | "flow")}
            >
              <option value="template">Send Template</option>
              <option value="flow">Trigger Flow</option>
            </select>
          </div>

          {/* ── Template Fields ─────────────────────────────────────────── */}
          {form.actionType === "template" && (
            <>
              <div>
                <label className={labelCls}>Template *</label>
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading templates...
                  </div>
                ) : templatesError ? (
                  <div className="text-xs text-red-500 py-1">{templatesError}</div>
                ) : templates.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No templates found</div>
                ) : (
                  <select
                    className={selectCls}
                    value={form.templateName}
                    onChange={e => handleSelectTemplate(e.target.value)}
                    required
                  >
                    <option value="">Select a template...</option>
                    {templates.map(t => (
                      <option key={`${t.name}-${t.language}`} value={t.name}>
                        {t.name} ({t.language}, {t.category})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Auto-filled language (read-only) */}
              {selectedTemplate && (
                <div>
                  <label className={labelCls}>Language</label>
                  <input
                    className={cn(inputCls, "bg-gray-50 text-muted-foreground")}
                    value={selectedTemplate.language}
                    readOnly
                  />
                </div>
              )}

              {/* Body parameter inputs */}
              {bodyParams.length > 0 && (
                <div className="space-y-2">
                  <label className={labelCls}>Template Parameters</label>
                  {bodyParams.map((param, i) => (
                    <div key={param}>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">
                        Parameter {param}
                      </label>
                      <input
                        className={inputCls}
                        value={form.paramValues[param] ?? ""}
                        onChange={e => setParam(param, e.target.value)}
                        placeholder={`Value for ${param}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Note about flow button if detected */}
              {selectedTemplate && hasFlowButton(selectedTemplate.components) && (
                <p className="text-[11px] text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  This template has a flow button -- it will be auto-configured.
                </p>
              )}
            </>
          )}

          {/* ── Flow Fields ────────────────────────────────────────────── */}
          {form.actionType === "flow" && (
            <>
              {/* Tenant selector */}
              <div>
                <label className={labelCls}>Tenant *</label>
                {tenantsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading tenants...
                  </div>
                ) : tenants.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No tenants found</div>
                ) : (
                  <select
                    className={selectCls}
                    value={form.tenantId}
                    onChange={e => {
                      set("tenantId", e.target.value)
                      set("flowDbId", "")
                      set("metaFlowId", "")
                    }}
                    required
                  >
                    <option value="">Select a tenant...</option>
                    {tenants.map(t => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Flow selector */}
              {form.tenantId && (
                <div>
                  <label className={labelCls}>Flow *</label>
                  {flowsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading flows...
                    </div>
                  ) : flows.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-2">No active flows found</div>
                  ) : (
                    <select
                      className={selectCls}
                      value={form.flowDbId}
                      onChange={e => handleSelectFlow(e.target.value)}
                      required
                    >
                      <option value="">Select a flow...</option>
                      {flows.map(f => (
                        <option key={f.id} value={String(f.id)}>
                          {f.name} ({f.slug})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* CTA Text */}
              <div>
                <label className={labelCls}>CTA Text *</label>
                <input
                  className={inputCls}
                  value={form.ctaText}
                  onChange={e => set("ctaText", e.target.value)}
                  placeholder="Get Started"
                  required
                />
              </div>

              {/* Message Body */}
              <div>
                <label className={labelCls}>Message Body *</label>
                <textarea
                  className={cn(inputCls, "resize-none h-16")}
                  value={form.messageBody}
                  onChange={e => set("messageBody", e.target.value)}
                  placeholder="Thanks for clicking our ad!"
                  required
                />
              </div>

              {/* Header (optional) */}
              <div>
                <label className={labelCls}>Header (optional)</label>
                <input
                  className={inputCls}
                  value={form.header}
                  onChange={e => set("header", e.target.value)}
                  placeholder="Welcome!"
                />
              </div>
            </>
          )}

          {/* Priority (read-only, auto-set) */}
          <div>
            <label className={labelCls}>Priority (auto-set by match type)</label>
            <input
              className={cn(inputCls, "bg-gray-50 text-muted-foreground")}
              value={form.priority}
              readOnly
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ad ID = 0 (highest), URL match = 10, Any = 100 (lowest)
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Active</label>
            <button
              type="button"
              onClick={() => set("isActive", !form.isActive)}
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors",
                form.isActive ? "bg-[#25D366]" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  form.isActive ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {/* Preview */}
          {form.name && (form.templateName || form.flowDbId) && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-muted-foreground border border-dashed">
              <span className="font-medium text-foreground">Preview:</span>{" "}
              {previewText}
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !isValid}
              className="bg-[#128C7E] hover:bg-[#0a7567] text-white"
            >
              {saving ? "Saving..." : mode === "create" ? "Create Rule" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirm Dialog ───────────────────────────────────────────────────

function DeleteDialog({
  open,
  ruleName,
  onConfirm,
  onClose,
}: {
  open: boolean
  ruleName: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [deleting, setDeleting] = React.useState(false)
  const handle = async () => {
    setDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      /* caller shows toast */
    } finally {
      setDeleting(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete "{ruleName}"?</DialogTitle>
          <DialogDescription>
            This will permanently remove this automation rule. Incoming CTWA messages will no longer match against it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function CTWARulesPage() {
  const { rules, loading, error, createRule, updateRule, deleteRule } = useCTWARules()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editRule, setEditRule] = React.useState<CTWARule | null>(null)
  const [deletingRule, setDeletingRule] = React.useState<CTWARule | null>(null)

  const handleToggle = async (rule: CTWARule) => {
    try {
      await updateRule(rule.id, { isActive: !rule.isActive })
      toast({ title: rule.isActive ? "Rule deactivated" : "Rule activated" })
    } catch (e: any) {
      toast({ title: "Failed to toggle", description: e.message, variant: "destructive" })
    }
  }

  const sorted = [...rules].sort((a, b) => a.priority - b.priority)

  return (
    <CTWALayout tab="rules">
      <div className="p-4 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Rules</h2>
            <p className="text-xs text-muted-foreground">
              {rules.length} rule{rules.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#128C7E] hover:bg-[#0a7567] text-white h-8 px-3 text-sm gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Rule
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && rules.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">Loading rules...</div>
        )}

        {/* Empty */}
        {!loading && rules.length === 0 && !error && (
          <div className="text-center py-12 space-y-2">
            <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No rules yet</p>
            <p className="text-xs text-muted-foreground/70">
              Create your first rule to auto-respond to Click-to-WhatsApp ads
            </p>
          </div>
        )}

        {/* Rules list */}
        <div className="space-y-2">
          {sorted.map(rule => (
            <div
              key={rule.id}
              className="border rounded-xl bg-white overflow-hidden shadow-sm"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Active indicator */}
                <button
                  onClick={() => handleToggle(rule)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors shrink-0",
                    rule.isActive ? "bg-[#25D366]" : "bg-gray-300"
                  )}
                  title={rule.isActive ? "Active -- click to deactivate" : "Inactive -- click to activate"}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      rule.isActive ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{rule.name}</span>
                    <span className="text-[10px] bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 font-medium shrink-0">
                      {MATCH_TYPE_LABELS[rule.matchType] ?? rule.matchType}
                    </span>
                    <span className="text-[10px] bg-purple-50 text-purple-600 rounded-full px-2 py-0.5 font-medium shrink-0">
                      {ACTION_TYPE_LABELS[rule.actionType] ?? rule.actionType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>Priority: {rule.priority}</span>
                    {rule.matchValue && (
                      <>
                        <span>·</span>
                        <span className="truncate font-mono text-[11px]">{rule.matchValue}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditRule(rule)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingRule(rule)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              {rule.description && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Dialog */}
      <RuleDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        onSubmit={async payload => {
          await createRule(payload as any)
          toast({ title: "Rule created" })
        }}
      />

      {/* Edit Dialog */}
      <RuleDialog
        open={!!editRule}
        onClose={() => setEditRule(null)}
        mode="edit"
        initial={editRule ? ruleToForm(editRule) : undefined}
        onSubmit={async payload => {
          await updateRule(editRule!.id, payload)
          toast({ title: "Rule updated" })
        }}
      />

      {/* Delete Confirm Dialog */}
      {deletingRule && (
        <DeleteDialog
          open
          ruleName={deletingRule.name}
          onClose={() => setDeletingRule(null)}
          onConfirm={async () => {
            try {
              await deleteRule(deletingRule.id)
              toast({ title: "Rule deleted" })
            } catch (e: any) {
              toast({ title: "Delete failed", description: e.message, variant: "destructive" })
              throw e
            }
          }}
        />
      )}
    </CTWALayout>
  )
}
