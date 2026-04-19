import React from "react"
import { useParams, useLocation } from "wouter"
import {
  Plus, Pencil, Trash2, RotateCw, Workflow, BarChart3,
  Building2, Copy, CheckCircle2, ChevronRight, AlertCircle, ExternalLink
} from "lucide-react"
import { FlowsLayout } from "./FlowsLayout"
import { useTenants, type FlowTenant } from "@/hooks/useFlows"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex items-center gap-1 ml-1 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
      title="Copy"
    >
      {copied
        ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{label && <span className="text-green-600">Copied!</span>}</>
        : <><Copy className="w-3.5 h-3.5" />{label && <span>{label}</span>}</>}
    </button>
  )
}

// ── Create/Edit Dialog ────────────────────────────────────────────────────────

interface TenantFormData {
  name: string
  slug: string
}

const EMPTY_FORM: TenantFormData = { name: "", slug: "" }

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

interface TenantDialogProps {
  open: boolean
  onClose: () => void
  initial?: Partial<TenantFormData>
  onSubmit: (d: TenantFormData) => Promise<unknown>
  mode: "create" | "edit"
}

function TenantDialog({ open, onClose, initial, onSubmit, mode }: TenantDialogProps) {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
  const [form, setForm] = React.useState<TenantFormData>({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [slugManual, setSlugManual] = React.useState(false)
  const [envInfo, setEnvInfo] = React.useState<{ wabaId: string; phoneNumberId: string; hasAccessToken: boolean } | null>(null)

  React.useEffect(() => {
    if (!open) return
    setErr(null); setSlugManual(false)
    setForm({ ...EMPTY_FORM, ...initial })
    // Fetch env defaults to display in the info row (not for editing)
    fetch(`${BASE}/api/flows/defaults`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setEnvInfo({ wabaId: d.wabaId ?? "", phoneNumberId: d.phoneNumberId ?? "", hasAccessToken: !!d.hasAccessToken }))
      .catch(() => setEnvInfo(null))
  }, [open])

  const set = (k: keyof TenantFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
    try {
      await onSubmit(form)
      onClose()
    } catch (ex: any) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  const label = "block text-xs font-medium text-muted-foreground mb-1"
  const input = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Tenant" : "Edit Tenant"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new WhatsApp Flows tenant. An RSA key pair will be auto-generated."
              : "Update the tenant name or slug."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-3 pt-1">
          <div>
            <label className={label}>Name *</label>
            <input className={input} value={form.name} onChange={set("name")} placeholder="Acme Corp" required />
          </div>
          <div>
            <label className={label}>Slug (auto-derived if blank)</label>
            <input className={input} value={form.slug} onChange={set("slug")} placeholder="acme-corp" />
          </div>

          {/* Read-only credentials from environment — not re-entered by the user */}
          {envInfo && (
            <div className="rounded-lg border border-dashed border-[#128C7E]/40 bg-[#128C7E]/5 px-3 py-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-[#128C7E] uppercase tracking-wide">Credentials from server environment</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div>
                  <span className="text-muted-foreground">WABA ID</span>
                  <p className="font-mono text-foreground truncate">{envInfo.wabaId || <span className="text-red-500">not set</span>}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone Number ID</span>
                  <p className="font-mono text-foreground truncate">{envInfo.phoneNumberId || <span className="text-red-500">not set</span>}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Access Token</span>
                  <p className="font-mono text-foreground">{envInfo.hasAccessToken ? "••••••••  (set)" : <span className="text-red-500">not set</span>}</p>
                </div>
              </div>
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#128C7E] hover:bg-[#0a7567] text-white">
              {saving ? "Saving…" : mode === "create" ? "Create Tenant" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean
  title: string
  description: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

function DeleteDialog({ open, title, description, onConfirm, onClose }: DeleteDialogProps) {
  const [deleting, setDeleting] = React.useState(false)
  const handle = async () => {
    setDeleting(true)
    try { await onConfirm(); onClose() }
    catch { /* caller shows toast */ }
    finally { setDeleting(false) }
  }
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button onClick={handle} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Key Detail Panel ──────────────────────────────────────────────────────────

function KeyPanel({
  tenant,
  onRotate,
  onRegisterMeta,
  registerMetaPending,
}: {
  tenant: FlowTenant
  onRotate: () => Promise<unknown>
  onRegisterMeta: () => Promise<unknown>
  registerMetaPending: boolean
}) {
  const [rotating, setRotating] = React.useState(false)
  const { toast } = useToast()
  const [rotateConfirm, setRotateConfirm] = React.useState(false)

  const handleRotate = async () => {
    setRotating(true)
    try {
      const result: any = await onRotate()
      if (result?.metaKeyRegistration?.success) {
        toast({ title: "Key rotated & registered", description: "New RSA key pair is active and registered with Meta." })
      } else if (result?.metaKeyRegistration?.error) {
        toast({ title: "Key rotated — Meta registration failed", description: result.metaKeyRegistration.error, variant: "destructive" })
      } else {
        toast({ title: "Key rotated", description: "New RSA key pair is now active." })
      }
    } catch (e: any) {
      toast({ title: "Rotation failed", description: e.message, variant: "destructive" })
    } finally {
      setRotating(false); setRotateConfirm(false)
    }
  }

  const handleRegisterMeta = async () => {
    try {
      const result: any = await onRegisterMeta()
      if (result?.metaKeyRegistration?.success) {
        toast({ title: "Registered with Meta", description: `Key successfully uploaded. Asset ID: ${result.metaKeyRegistration.metaKeyId ?? "N/A"}` })
      } else {
        toast({ title: "Meta registration failed", description: result?.metaKeyRegistration?.error ?? "Unknown error", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Meta registration failed", description: e.message, variant: "destructive" })
    }
  }

  const key = tenant.activePublicKey
  const isRegistered = !!(key?.metaKeyId || key?.metaRegisteredAt)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RSA Public Key</p>
        {key && (
          <div className="flex items-center gap-2">
            <CopyButton text={key.publicKeyPem} />
            <button
              onClick={() => setRotateConfirm(true)}
              disabled={rotating}
              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              <RotateCw className={cn("w-3.5 h-3.5", rotating && "animate-spin")} />
              <span>Rotate</span>
            </button>
          </div>
        )}
      </div>

      {key ? (
        <>
          {/* Meta registration status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {isRegistered ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Registered with Meta
                {key.metaKeyId && <span className="text-muted-foreground font-mono">· {key.metaKeyId}</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Not registered with Meta
              </span>
            )}
            {!isRegistered && (
              <button
                onClick={handleRegisterMeta}
                disabled={registerMetaPending}
                className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2 disabled:opacity-50"
              >
                {registerMetaPending ? "Registering…" : "Register now"}
              </button>
            )}
            {isRegistered && (
              <button
                onClick={handleRegisterMeta}
                disabled={registerMetaPending}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium underline underline-offset-2 disabled:opacity-50"
              >
                {registerMetaPending ? "Re-registering…" : "Re-register"}
              </button>
            )}
          </div>

          <pre className="bg-gray-900 text-green-400 text-[10px] font-mono rounded-lg p-3 overflow-x-auto leading-4 max-h-32 overflow-y-auto">
            {key.publicKeyPem}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            Key ID #{key.id} · Created {fmtDate(key.createdAt)}
            {key.metaRegisteredAt && ` · Registered ${fmtDate(key.metaRegisteredAt)}`}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No active key found.</p>
      )}

      <Dialog open={rotateConfirm} onOpenChange={v => !v && setRotateConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rotate RSA Key?</DialogTitle>
            <DialogDescription>
              The old key will be deactivated immediately. Any in-flight Flow sessions using the old key will fail. The new key will be auto-registered with Meta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateConfirm(false)}>Cancel</Button>
            <Button onClick={handleRotate} disabled={rotating} className="bg-amber-600 hover:bg-amber-700 text-white">
              {rotating ? "Rotating…" : "Rotate Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const { tenantId: tenantIdParam } = useParams<{ tenantId?: string }>()
  const [, setLocation] = useLocation()
  const { tenants, loading, error, createTenant, updateTenant, deleteTenant, rotateKey, registerMetaKey, registerMetaKeyPending } = useTenants()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editTenant, setEditTenant] = React.useState<FlowTenant | null>(null)
  const [deletingTenant, setDeletingTenant] = React.useState<FlowTenant | null>(null)

  // Auto-expand tenant from URL param (e.g. /flows/tenants/:tenantId)
  const defaultExpandId = tenantIdParam ? parseInt(tenantIdParam, 10) : null
  const [expanded, setExpanded] = React.useState<number | null>(defaultExpandId)

  // Sync expanded if URL param changes or tenants load
  React.useEffect(() => {
    if (defaultExpandId) setExpanded(defaultExpandId)
  }, [defaultExpandId])

  const endpointOrigin = window.location.origin

  return (
    <FlowsLayout tab="tenants">
      <div className="p-4 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Tenants</h2>
            <p className="text-xs text-muted-foreground">{tenants.length} tenant{tenants.length !== 1 ? "s" : ""}</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#128C7E] hover:bg-[#0a7567] text-white h-8 px-3 text-sm gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Tenant
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
        {loading && tenants.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">Loading tenants…</div>
        )}

        {/* Empty */}
        {!loading && tenants.length === 0 && !error && (
          <div className="text-center py-12 space-y-2">
            <Building2 className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No tenants yet</p>
            <p className="text-xs text-muted-foreground/70">Create your first tenant to get started</p>
          </div>
        )}

        {/* Tenant cards */}
        <div className="space-y-3">
          {tenants.map(t => {
            const endpointBase = `${endpointOrigin}/api/flows/endpoint/${t.slug}/`
            return (
              <div key={t.id} className="border rounded-xl bg-white overflow-hidden shadow-sm">
                {/* Card header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  <div className="w-9 h-9 rounded-full bg-[#128C7E]/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-[#128C7E]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{t.name}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-mono shrink-0">{t.slug}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.flowCount} flow{t.flowCount !== 1 ? "s" : ""} · Created {fmtDate(t.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-gray-400 shrink-0 transition-transform", expanded === t.id && "rotate-90")} />
                </button>

                {/* Expanded detail */}
                {expanded === t.id && (
                  <div className="border-t px-4 py-3 space-y-3 bg-gray-50/50">
                    {/* Endpoint URL */}
                    <div className="border rounded-lg px-3 py-2.5 bg-white">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Endpoint Base URL</p>
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-xs font-mono text-foreground truncate flex-1 bg-gray-50 rounded px-2 py-1">{endpointBase}</code>
                        <CopyButton text={endpointBase} label="Copy" />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Append a flow slug to get the full endpoint URL.</p>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground font-medium">WABA ID</p>
                        <div className="flex items-center font-mono text-foreground">
                          <span className="truncate">{t.wabaId}</span>
                          <CopyButton text={t.wabaId} />
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium">Phone Number ID</p>
                        <div className="flex items-center font-mono text-foreground">
                          <span className="truncate">{t.phoneNumberId}</span>
                          <CopyButton text={t.phoneNumberId} />
                        </div>
                      </div>
                      {t.createdBy && (
                        <div>
                          <p className="text-muted-foreground font-medium">Created By</p>
                          <p className="font-mono">{t.createdBy}</p>
                        </div>
                      )}
                    </div>

                    {/* RSA Key */}
                    <KeyPanel
                      tenant={t}
                      onRotate={() => rotateKey(t.id)}
                      onRegisterMeta={() => registerMetaKey(t.id)}
                      registerMetaPending={registerMetaKeyPending}
                    />

                    {/* Action row */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => setLocation(`/flows/tenants/${t.id}/flows`)}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#128C7E] hover:text-[#0a7567] bg-[#128C7E]/10 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Workflow className="w-3.5 h-3.5" />
                        Manage Flows
                      </button>
                      <button
                        onClick={() => setLocation(`/flows/tenants/${t.id}/analytics`)}
                        className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Analytics
                      </button>
                      <button
                        onClick={() => setEditTenant(t)}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 rounded-lg px-3 py-1.5 transition-colors ml-auto"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingTenant(t)}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Dialog */}
      <TenantDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        onSubmit={async d => {
          await createTenant(d)
          toast({ title: "Tenant created", description: "RSA key pair has been auto-generated." })
        }}
      />

      {/* Edit Dialog */}
      <TenantDialog
        open={!!editTenant}
        onClose={() => setEditTenant(null)}
        mode="edit"
        initial={editTenant ? { name: editTenant.name, slug: editTenant.slug } : undefined}
        onSubmit={async d => {
          await updateTenant(editTenant!.id, d)
          toast({ title: "Tenant updated" })
        }}
      />

      {/* Delete Confirm Dialog */}
      {deletingTenant && (
        <DeleteDialog
          open
          title={`Delete "${deletingTenant.name}"?`}
          description="This will permanently remove all flows, submissions, analytics events, and RSA keys for this tenant. This cannot be undone."
          onClose={() => setDeletingTenant(null)}
          onConfirm={async () => {
            try {
              await deleteTenant(deletingTenant.id)
              toast({ title: "Tenant deleted" })
            } catch (e: any) {
              toast({ title: "Delete failed", description: e.message, variant: "destructive" })
              throw e
            }
          }}
        />
      )}
    </FlowsLayout>
  )
}
