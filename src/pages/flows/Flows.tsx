import React from "react"
import { useParams, useLocation } from "wouter"
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  List, ChevronLeft, ChevronRight, AlertCircle, Workflow,
  Copy, CheckCircle2, GitBranch, Plug
} from "lucide-react"
import { FlowsLayout } from "./FlowsLayout"
import { useTenants, useFlowDefs, useSubmissions, type FlowDef, type FlowTenant, type FlowSubmission } from "@/hooks/useFlows"
import { FlowScreensSheet } from "./FlowScreensPanel"
import { FlowIntegrationsPanel } from "./FlowIntegrationsPanel"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function fmtDateTime(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ── Flow Form Dialog ──────────────────────────────────────────────────────────

interface FlowFormData {
  name: string
  slug: string
  metaFlowId: string
  description: string
}

const EMPTY: FlowFormData = { name: "", slug: "", metaFlowId: "", description: "" }

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

interface FlowDialogProps {
  open: boolean
  onClose: () => void
  initial?: Partial<FlowFormData>
  onSubmit: (d: FlowFormData) => Promise<unknown>
  mode: "create" | "edit"
}

function FlowDialog({ open, onClose, initial, onSubmit, mode }: FlowDialogProps) {
  const [form, setForm] = React.useState<FlowFormData>({ ...EMPTY, ...initial })
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [slugManual, setSlugManual] = React.useState(false)

  React.useEffect(() => {
    if (open) { setForm({ ...EMPTY, ...initial }); setErr(null); setSlugManual(false) }
  }, [open])

  const set = (k: keyof FlowFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value
    setForm(f => {
      const next = { ...f, [k]: value }
      if (k === "name" && !slugManual) next.slug = toSlug(value)
      if (k === "slug") setSlugManual(true)
      return next
    })
  }

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setErr(null)
    try { await onSubmit(form); onClose() }
    catch (ex: any) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const lbl = "block text-xs font-medium text-muted-foreground mb-1"
  const inp = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Flow" : "Edit Flow"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new WhatsApp Flow definition for this tenant."
              : "Update the flow definition fields."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-3 pt-1">
          <div>
            <label className={lbl}>Name *</label>
            <input className={inp} value={form.name} onChange={set("name")} placeholder="Lead Capture" required />
          </div>
          <div>
            <label className={lbl}>Slug (auto-derived if blank)</label>
            <input className={inp} value={form.slug} onChange={set("slug")} placeholder="lead-capture" />
          </div>
          <div>
            <label className={lbl}>Meta Flow ID (optional)</label>
            <input className={inp} value={form.metaFlowId} onChange={set("metaFlowId")} placeholder="1234567890" />
          </div>
          <div>
            <label className={lbl}>Description (optional)</label>
            <textarea
              className={cn(inp, "resize-none h-20")}
              value={form.description}
              onChange={set("description")}
              placeholder="What this flow does…"
            />
          </div>
          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#128C7E] hover:bg-[#0a7567] text-white">
              {saving ? "Saving…" : mode === "create" ? "Create Flow" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

interface DeleteFlowDialogProps {
  flow: FlowDef
  onConfirm: () => Promise<void>
  onClose: () => void
}

function DeleteFlowDialog({ flow, onConfirm, onClose }: DeleteFlowDialogProps) {
  const [deleting, setDeleting] = React.useState(false)
  const handle = async () => {
    setDeleting(true)
    try { await onConfirm(); onClose() }
    catch { /* caller shows toast */ }
    finally { setDeleting(false) }
  }
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete "{flow.name}"?</DialogTitle>
          <DialogDescription>All {flow.submissionCount} submission{flow.submissionCount !== 1 ? "s" : ""} will be permanently removed. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button onClick={handle} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
            {deleting ? "Deleting…" : "Delete Flow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── JSON View Modal ───────────────────────────────────────────────────────────

function SubmissionViewModal({ sub, onClose }: { sub: FlowSubmission; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false)
  const json = JSON.stringify(sub.screenResponses, null, 2)
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submission #{sub.id}</DialogTitle>
          <DialogDescription>
            {sub.waPhone ? `+${sub.waPhone}` : "Anonymous"} · {fmtDateTime(sub.completedAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <pre className="bg-gray-900 text-green-400 text-[11px] font-mono rounded-lg p-4 overflow-auto max-h-80 leading-5">
            {json}
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Submissions Sheet ─────────────────────────────────────────────────────────

interface SubSheetProps {
  tenantId: number
  flow: FlowDef
  onClose: () => void
}

function SubmissionsSheet({ tenantId, flow, onClose }: SubSheetProps) {
  const { data, loading, error, page, setPage } = useSubmissions(tenantId, flow.id)
  const [viewSub, setViewSub] = React.useState<FlowSubmission | null>(null)

  return (
    <>
      <Sheet open onOpenChange={v => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle>{flow.name} — Submissions</SheetTitle>
            <SheetDescription>
              {data ? `${data.total} total submission${data.total !== 1 ? "s" : ""}` : "Loading…"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 m-4 bg-red-50 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {data && data.submissions.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">No submissions yet.</div>
            )}
            {data && data.submissions.length > 0 && (
              <div className="divide-y">
                {data.submissions.map(sub => (
                  <div key={sub.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {sub.waPhone ? `+${sub.waPhone}` : `Submission #${sub.id}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{fmtDateTime(sub.completedAt)}</p>
                    </div>
                    <button
                      onClick={() => setViewSub(sub)}
                      className="shrink-0 text-xs font-medium text-[#128C7E] hover:text-[#0a7567] border border-[#128C7E]/30 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.total > data.limit && (
            <div className="border-t px-5 py-3 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                Page {data.page} of {Math.ceil(data.total / data.limit)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(data.page - 1)}
                  disabled={data.page <= 1 || loading}
                  className="p-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(data.page + 1)}
                  disabled={data.page >= Math.ceil(data.total / data.limit) || loading}
                  className="p-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* JSON View Modal (stacks above the sheet) */}
      {viewSub && <SubmissionViewModal sub={viewSub} onClose={() => setViewSub(null)} />}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const { tenantId: tenantIdStr, flowId: flowIdStr } = useParams<{ tenantId: string; flowId?: string }>()
  const [, setLocation] = useLocation()
  const tenantId = parseInt(tenantIdStr ?? "", 10)

  const { tenants } = useTenants()
  const tenant: FlowTenant | undefined = tenants.find(t => t.id === tenantId)

  const { flows, loading, error, createFlow, updateFlow, deleteFlow } = useFlowDefs(
    isNaN(tenantId) ? null : tenantId
  )
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editFlow, setEditFlow] = React.useState<FlowDef | null>(null)
  const [deletingFlow, setDeletingFlow] = React.useState<FlowDef | null>(null)
  const [toggling, setToggling] = React.useState<number | null>(null)
  const [routingFlow, setRoutingFlow] = React.useState<FlowDef | null>(null)
  const [integrationsFlow, setIntegrationsFlow] = React.useState<FlowDef | null>(null)

  // If a flowId is in the URL, auto-open submissions for that flow
  const flowIdFromUrl = flowIdStr ? parseInt(flowIdStr, 10) : null
  const [subFlow, setSubFlow] = React.useState<FlowDef | null>(null)
  React.useEffect(() => {
    if (flowIdFromUrl && flows.length > 0) {
      const f = flows.find(f => f.id === flowIdFromUrl)
      if (f) setSubFlow(f)
    }
  }, [flowIdFromUrl, flows])

  const endpointOrigin = window.location.origin

  if (isNaN(tenantId)) {
    return (
      <FlowsLayout tab="flows">
        <div className="text-center py-12 text-muted-foreground text-sm">
          Invalid tenant ID. <button onClick={() => setLocation("/flows/tenants")} className="text-[#128C7E] underline">Back to tenants</button>
        </div>
      </FlowsLayout>
    )
  }

  const handleToggle = async (flow: FlowDef) => {
    setToggling(flow.id)
    try {
      await updateFlow(flow.id, { isActive: !flow.isActive })
      toast({ title: `Flow ${flow.isActive ? "deactivated" : "activated"}`, description: flow.name })
    } catch (e: any) {
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" })
    } finally {
      setToggling(null)
    }
  }

  return (
    <FlowsLayout tab="flows" tenantId={tenantId} tenantName={tenant?.name}>
      <div className="p-4 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Flows</h2>
            <p className="text-xs text-muted-foreground">{flows.length} flow{flows.length !== 1 ? "s" : ""}</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#128C7E] hover:bg-[#0a7567] text-white h-8 px-3 text-sm gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Flow
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && flows.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">Loading flows…</div>
        )}

        {!loading && flows.length === 0 && !error && (
          <div className="text-center py-12 space-y-2">
            <Workflow className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No flows yet</p>
            <p className="text-xs text-muted-foreground/70">Create your first flow definition</p>
          </div>
        )}

        {/* Flow cards */}
        <div className="space-y-3">
          {flows.map(flow => {
            const tenantSlug = tenant?.slug ?? ""
            const endpointUrl = `${endpointOrigin}/api/flows/endpoint/${tenantSlug}/${flow.slug}`
            return (
              <div key={flow.id} className="border rounded-xl bg-white overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    flow.isActive ? "bg-green-50" : "bg-gray-100"
                  )}>
                    <Workflow className={cn("w-4 h-4", flow.isActive ? "text-green-600" : "text-gray-400")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{flow.name}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-mono">{flow.slug}</span>
                      <span className={cn(
                        "text-[10px] rounded-full px-2 py-0.5 font-medium",
                        flow.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      )}>
                        {flow.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {flow.submissionCount} submission{flow.submissionCount !== 1 ? "s" : ""}
                      </p>
                      {flow.metaFlowId && (
                        <p className="text-xs text-muted-foreground font-mono">ID: {flow.metaFlowId}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{fmtDate(flow.createdAt)}</p>
                    </div>
                    {flow.description && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{flow.description}</p>
                    )}
                    {/* Endpoint URL */}
                    {tenantSlug && (
                      <div className="flex items-center mt-1.5 text-[11px] text-muted-foreground font-mono gap-1 min-w-0">
                        <span className="truncate">{endpointUrl}</span>
                        <CopyButton text={endpointUrl} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Action row */}
                <div className="border-t bg-gray-50/50 px-4 py-2 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSubFlow(flow)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-white border rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <List className="w-3.5 h-3.5" />
                    Submissions
                  </button>
                  <button
                    onClick={() => setRoutingFlow(flow)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#128C7E] hover:text-[#0a7567] bg-[#128C7E]/10 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    Routing
                  </button>
                  <button
                    onClick={() => setIntegrationsFlow(flow)}
                    className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Plug className="w-3.5 h-3.5" />
                    Integrations
                  </button>
                  <button
                    onClick={() => setEditFlow(flow)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-white border rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(flow)}
                    disabled={toggling === flow.id}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors",
                      flow.isActive
                        ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                        : "text-green-600 bg-green-50 hover:bg-green-100"
                    )}
                  >
                    {flow.isActive
                      ? <><ToggleLeft className="w-3.5 h-3.5" /> Deactivate</>
                      : <><ToggleRight className="w-3.5 h-3.5" /> Activate</>
                    }
                  </button>
                  <button
                    onClick={() => setDeletingFlow(flow)}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 rounded-lg px-3 py-1.5 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Dialog */}
      <FlowDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        onSubmit={async d => {
          await createFlow(d)
          toast({ title: "Flow created", description: d.name })
        }}
      />

      {/* Edit Dialog */}
      <FlowDialog
        open={!!editFlow}
        onClose={() => setEditFlow(null)}
        mode="edit"
        initial={editFlow ? { name: editFlow.name, slug: editFlow.slug, metaFlowId: editFlow.metaFlowId ?? "", description: editFlow.description ?? "" } : undefined}
        onSubmit={async d => {
          await updateFlow(editFlow!.id, d)
          toast({ title: "Flow updated" })
        }}
      />

      {/* Delete Confirm Dialog */}
      {deletingFlow && (
        <DeleteFlowDialog
          flow={deletingFlow}
          onClose={() => setDeletingFlow(null)}
          onConfirm={async () => {
            try {
              await deleteFlow(deletingFlow.id)
              toast({ title: "Flow deleted" })
            } catch (e: any) {
              toast({ title: "Delete failed", description: e.message, variant: "destructive" })
              throw e
            }
          }}
        />
      )}

      {/* Submissions Sheet */}
      {subFlow && (
        <SubmissionsSheet
          tenantId={tenantId}
          flow={subFlow}
          onClose={() => { setSubFlow(null); if (flowIdFromUrl) setLocation(`/flows/tenants/${tenantId}/flows`) }}
        />
      )}

      {/* Screens & Routing Sheet */}
      {routingFlow && (
        <FlowScreensSheet
          tenantId={tenantId}
          flow={routingFlow}
          onClose={() => setRoutingFlow(null)}
        />
      )}

      {/* Integrations Panel */}
      {integrationsFlow && (
        <FlowIntegrationsPanel
          tenantId={tenantId}
          flow={integrationsFlow}
          onClose={() => setIntegrationsFlow(null)}
        />
      )}
    </FlowsLayout>
  )
}
