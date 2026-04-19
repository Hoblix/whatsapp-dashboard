/**
 * FlowScreensPanel — Screens & Routing configuration UI.
 *
 * Renders inside a side Sheet (full-width on mobile), opened from a flow card.
 * Mobile-first design: all tap targets ≥ 44px, stacked layouts on small screens,
 * minimum 12px fonts, no content hidden behind sm: breakpoints.
 */

import React from "react"
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  AlertCircle, GitBranch, ArrowUp, ArrowDown, Star, Loader2
} from "lucide-react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  useFlowScreens, useFlowRules,
  type FlowDef, type FlowScreen, type FlowRoutingRule,
} from "@/hooks/useFlows"

// ── Constants ─────────────────────────────────────────────────────────────────

const OPERATORS = [
  { value: "eq",       label: "= equals" },
  { value: "neq",      label: "≠ not equals" },
  { value: "contains", label: "∋ contains" },
  { value: "gt",       label: "> greater than" },
  { value: "lt",       label: "< less than" },
  { value: "exists",   label: "∃ exists (non-empty)" },
]

// ── Screen ID validation ──────────────────────────────────────────────────────

const SCREEN_ID_RE = /^[A-Za-z0-9_-]+$/

function validateScreenId(id: string): string | null {
  if (!id.trim()) return "Screen ID is required"
  if (!SCREEN_ID_RE.test(id.trim()))
    return "Screen ID may only contain letters, digits, underscores, and hyphens"
  return null
}

// ── JSON textarea helpers ─────────────────────────────────────────────────────

function tryParseJson(s: string): { ok: true; val: Record<string, unknown> } | { ok: false; err: string } {
  if (!s.trim()) return { ok: true, val: {} }
  try {
    const parsed = JSON.parse(s)
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
      return { ok: false, err: "Must be a JSON object ({})" }
    }
    return { ok: true, val: parsed }
  } catch (e: any) {
    return { ok: false, err: e.message }
  }
}

// ── Shared input classes ──────────────────────────────────────────────────────

const lbl = "block text-xs font-medium text-muted-foreground mb-1.5"
const inp = "w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40 bg-white"

// ── ScreenDialog ──────────────────────────────────────────────────────────────

interface ScreenFormData {
  screenId: string
  label: string
  isFirst: boolean
  defaultNextScreen: string
  initDataStr: string
}

interface ScreenDialogProps {
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  initial?: Partial<ScreenFormData>
  onSubmit: (d: ScreenFormData) => Promise<void>
}

const EMPTY_SCREEN: ScreenFormData = {
  screenId: "", label: "", isFirst: false, defaultNextScreen: "", initDataStr: "",
}

function ScreenDialog({ open, onClose, mode, initial, onSubmit }: ScreenDialogProps) {
  const [form, setForm] = React.useState<ScreenFormData>({ ...EMPTY_SCREEN, ...initial })
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [jsonErr, setJsonErr] = React.useState<string | null>(null)
  const [screenIdErr, setScreenIdErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_SCREEN, ...initial })
      setErr(null); setJsonErr(null); setScreenIdErr(null)
    }
  }, [open])

  const onScreenIdChange = (value: string) => {
    setForm(f => ({ ...f, screenId: value }))
    setScreenIdErr(value.trim() ? validateScreenId(value) : null)
  }

  const validateJson = (s: string) => {
    if (!s.trim()) { setJsonErr(null); return }
    const r = tryParseJson(s)
    setJsonErr(r.ok ? null : r.err)
  }

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    const sidErr = validateScreenId(form.screenId)
    if (sidErr) { setScreenIdErr(sidErr); return }
    const r = tryParseJson(form.initDataStr)
    if (!r.ok) { setErr(`Init Data JSON: ${r.err}`); return }
    setSaving(true); setErr(null)
    try { await onSubmit(form); onClose() }
    catch (ex: any) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const hasErrors = !!screenIdErr || !!jsonErr

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle>{mode === "create" ? "Add Screen" : "Edit Screen"}</DialogTitle>
          <DialogDescription>
            A "screen" here maps to one screen inside your WhatsApp Flow (created in Meta's Flow Builder). You only need this for advanced dynamic routing — e.g. showing different screens based on what the user selected.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handle} className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Screen ID */}
          <div>
            <label className={lbl}>Screen name *</label>
            <input
              className={cn(inp, screenIdErr && "border-red-400 focus:ring-red-400/40")}
              value={form.screenId}
              onChange={e => onScreenIdChange(e.target.value)}
              placeholder="WELCOME"
              autoCapitalize="characters"
              autoCorrect="off"
            />
            {screenIdErr
              ? <p className="text-xs text-red-600 mt-1">{screenIdErr}</p>
              : <p className="text-xs text-muted-foreground/60 mt-1">Must exactly match the screen name in your WhatsApp Flow (e.g. WELCOME, CONFIRM_ORDER). Find it in Meta's Flow Builder.</p>
            }
          </div>

          {/* Label */}
          <div>
            <label className={lbl}>Friendly label <span className="font-normal text-muted-foreground/60">(optional, just for you)</span></label>
            <input
              className={inp}
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Welcome Screen"
            />
          </div>

          {/* isFirst toggle */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              role="switch"
              aria-checked={form.isFirst}
              onClick={() => setForm(f => ({ ...f, isFirst: !f.isFirst }))}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors shrink-0",
                form.isFirst ? "bg-[#128C7E]" : "bg-gray-200"
              )}
            >
              <span className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                form.isFirst ? "translate-x-7" : "translate-x-1"
              )} />
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium">Entry screen</p>
              <p className="text-xs text-muted-foreground">This is the first screen shown when someone opens the flow</p>
            </div>
            {form.isFirst && (
              <span className="flex items-center gap-1 text-xs text-[#128C7E] font-medium shrink-0">
                <Star className="w-3.5 h-3.5" /> Entry
              </span>
            )}
          </div>

          {/* Default next screen */}
          <div>
            <label className={lbl}>Default next screen <span className="font-normal text-muted-foreground/60">(optional)</span></label>
            <input
              className={inp}
              value={form.defaultNextScreen}
              onChange={e => setForm(f => ({ ...f, defaultNextScreen: e.target.value }))}
              placeholder="CONFIRMATION"
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">The screen to go to if no routing rule matches. Leave blank to let Meta handle the transition.</p>
          </div>

          {/* Init data JSON */}
          <div>
            <label className={lbl}>
              Pre-fill data <span className="font-normal text-muted-foreground/60">(advanced, optional)</span>
            </label>
            <textarea
              className={cn(inp, "resize-none h-28 font-mono text-xs leading-relaxed", jsonErr && "border-red-400 focus:ring-red-400/40")}
              value={form.initDataStr}
              onChange={e => { setForm(f => ({ ...f, initDataStr: e.target.value })); validateJson(e.target.value) }}
              placeholder={'{\n  "field_name": "default_value"\n}'}
            />
            {jsonErr
              ? <p className="text-xs text-red-600 mt-1">{jsonErr}</p>
              : <p className="text-xs text-muted-foreground/60 mt-1">JSON data to pre-populate flow fields when this screen is shown. Leave blank unless you need this.</p>
            }
          </div>

          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1 pb-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1 h-12 rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || hasErrors}
              className="flex-1 h-12 rounded-xl bg-[#128C7E] hover:bg-[#0a7567] text-white"
            >
              {saving ? "Saving…" : mode === "create" ? "Add Screen" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── RuleDialog ────────────────────────────────────────────────────────────────

interface RuleFormData {
  fieldName: string
  operator: string
  fieldValue: string
  nextScreen: string
  injectDataStr: string
}

interface RuleDialogProps {
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  initial?: Partial<RuleFormData>
  onSubmit: (d: RuleFormData) => Promise<void>
}

const EMPTY_RULE: RuleFormData = {
  fieldName: "", operator: "eq", fieldValue: "", nextScreen: "", injectDataStr: "",
}

function RuleDialog({ open, onClose, mode, initial, onSubmit }: RuleDialogProps) {
  const [form, setForm] = React.useState<RuleFormData>({ ...EMPTY_RULE, ...initial })
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [jsonErr, setJsonErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) { setForm({ ...EMPTY_RULE, ...initial }); setErr(null); setJsonErr(null) }
  }, [open])

  const validateJson = (s: string) => {
    if (!s.trim()) { setJsonErr(null); return }
    const r = tryParseJson(s)
    setJsonErr(r.ok ? null : r.err)
  }

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fieldName.trim()) { setErr("Field name is required"); return }
    if (!form.nextScreen.trim()) { setErr("Next screen is required"); return }
    const r = tryParseJson(form.injectDataStr)
    if (!r.ok) { setErr(`Inject Data JSON: ${r.err}`); return }
    setSaving(true); setErr(null)
    try { await onSubmit(form); onClose() }
    catch (ex: any) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle>{mode === "create" ? "Add Routing Rule" : "Edit Routing Rule"}</DialogTitle>
          <DialogDescription>
            A rule checks a value the user submitted in your WhatsApp Flow, and sends them to a different screen based on it. Rules are checked in order — first match wins.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handle} className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Field name */}
          <div>
            <label className={lbl}>Field to check *</label>
            <input
              className={inp}
              value={form.fieldName}
              onChange={e => setForm(f => ({ ...f, fieldName: e.target.value }))}
              placeholder="user_type"
              autoCorrect="off"
              required
            />
            <p className="text-xs text-muted-foreground/60 mt-1">The name of a field that the user filled in — from your WhatsApp Flow screen.</p>
          </div>

          {/* Operator */}
          <div>
            <label className={lbl}>Condition *</label>
            <select
              className={inp}
              value={form.operator}
              onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}
            >
              {OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>

          {/* Value */}
          {form.operator !== "exists" && (
            <div>
              <label className={lbl}>Compare to value</label>
              <input
                className={inp}
                value={form.fieldValue}
                onChange={e => setForm(f => ({ ...f, fieldValue: e.target.value }))}
                placeholder="premium"
                autoCorrect="off"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">The value to compare against (e.g. "yes", "premium", "18+").</p>
            </div>
          )}

          {/* Next screen */}
          <div>
            <label className={lbl}>Go to screen *</label>
            <input
              className={inp}
              value={form.nextScreen}
              onChange={e => setForm(f => ({ ...f, nextScreen: e.target.value }))}
              placeholder="PREMIUM_OFFER"
              autoCorrect="off"
              required
            />
            <p className="text-xs text-muted-foreground/60 mt-1">The screen name (from Meta's Flow Builder) to show when this rule matches.</p>
          </div>

          {/* Inject data */}
          <div>
            <label className={lbl}>
              Extra data to pass <span className="font-normal text-muted-foreground/60">(advanced, optional)</span>
            </label>
            <textarea
              className={cn(inp, "resize-none h-24 font-mono text-xs leading-relaxed", jsonErr && "border-red-400 focus:ring-red-400/40")}
              value={form.injectDataStr}
              onChange={e => { setForm(f => ({ ...f, injectDataStr: e.target.value })); validateJson(e.target.value) }}
              placeholder={'{\n  "offer_tier": "premium"\n}'}
            />
            {jsonErr
              ? <p className="text-xs text-red-600 mt-1">{jsonErr}</p>
              : <p className="text-xs text-muted-foreground/60 mt-1">Optional JSON data to merge into the response when this rule fires. Leave blank in most cases.</p>
            }
          </div>

          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1 pb-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1 h-12 rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !!jsonErr}
              className="flex-1 h-12 rounded-xl bg-[#128C7E] hover:bg-[#0a7567] text-white"
            >
              {saving ? "Saving…" : mode === "create" ? "Add Rule" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  title, description, onConfirm, onClose,
}: {
  title: string
  description: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const { toast } = useToast()
  const [deleting, setDeleting] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const handle = async () => {
    setDeleting(true); setErr(null)
    try { await onConfirm(); onClose() }
    catch (ex: any) {
      setErr(ex.message ?? "Delete failed")
      toast({ title: "Delete failed", description: ex.message, variant: "destructive" })
    }
    finally { setDeleting(false) }
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {err && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <DialogFooter className="flex-row gap-3">
          <Button variant="outline" onClick={onClose} disabled={deleting} className="flex-1 h-12 rounded-xl">Cancel</Button>
          <Button onClick={handle} disabled={deleting} className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white">
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── RulesSection (per screen) ─────────────────────────────────────────────────

function operatorLabel(op: string) {
  return OPERATORS.find(o => o.value === op)?.label ?? op
}

function RulesSection({
  tenantId, flowId, screen,
}: {
  tenantId: number
  flowId: number
  screen: FlowScreen
}) {
  const { toast } = useToast()
  const { rules, loading, error, createRule, updateRule, deleteRule, reorderRules } =
    useFlowRules(tenantId, flowId, screen.id)

  const [addRuleOpen, setAddRuleOpen] = React.useState(false)
  const [editRule, setEditRule] = React.useState<FlowRoutingRule | null>(null)
  const [deleteRule_, setDeleteRule] = React.useState<FlowRoutingRule | null>(null)
  const [reordering, setReordering] = React.useState(false)

  const moveRule = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= rules.length) return
    const newOrder = [...rules]
    ;[newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]]
    setReordering(true)
    try { await reorderRules(newOrder.map(r => r.id)) }
    catch (e: any) { toast({ title: "Reorder failed", description: e.message, variant: "destructive" }) }
    finally { setReordering(false) }
  }

  if (loading) return (
    <div className="text-xs text-muted-foreground px-4 py-3 flex items-center gap-2 bg-gray-50/60 border-t">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading rules…
    </div>
  )

  if (error) return (
    <div className="text-xs text-red-600 px-4 py-3 bg-gray-50/60 border-t">{error}</div>
  )

  return (
    <div className="bg-gray-50/60 border-t">
      {/* Rule list */}
      {rules.length === 0 ? (
        <div className="px-4 py-3 text-xs text-muted-foreground/70">
          No rules yet. Rules are evaluated in order; if none match, the default next screen is used.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="flex items-start gap-2 px-3 py-3">
              {/* Priority arrows — 44px tap target */}
              <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                <button
                  onClick={() => moveRule(idx, -1)}
                  disabled={idx === 0 || reordering}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-colors"
                  title="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => moveRule(idx, 1)}
                  disabled={idx === rules.length - 1 || reordering}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-colors"
                  title="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>

              {/* Rule content */}
              <div className="flex-1 min-w-0 text-xs py-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs bg-gray-200 text-gray-600 rounded px-1.5 py-0.5 font-mono shrink-0">#{idx + 1}</span>
                  <span className="font-semibold text-foreground font-mono">{rule.fieldName}</span>
                  <span className="text-muted-foreground">{operatorLabel(rule.operator)}</span>
                  {rule.operator !== "exists" && rule.fieldValue && (
                    <span className="font-mono bg-amber-50 text-amber-700 rounded px-1.5 py-0.5 shrink-0">"{rule.fieldValue}"</span>
                  )}
                  <span className="text-muted-foreground shrink-0">→</span>
                  <span className="font-mono font-semibold text-[#128C7E] bg-[#128C7E]/10 rounded px-1.5 py-0.5 shrink-0">{rule.nextScreen}</span>
                </div>
                {rule.injectData && Object.keys(rule.injectData).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                    inject: {JSON.stringify(rule.injectData)}
                  </p>
                )}
              </div>

              {/* Actions — 44px tap targets */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setEditRule(rule)}
                  className="p-2.5 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Edit rule"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => setDeleteRule(rule)}
                  className="p-2.5 rounded-lg hover:bg-red-100 transition-colors"
                  title="Delete rule"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add rule — full tap area */}
      <div className="border-t border-dashed border-gray-200">
        <button
          onClick={() => setAddRuleOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#128C7E] hover:text-[#0a7567] hover:bg-[#128C7E]/5 transition-colors text-left"
        >
          <Plus className="w-4 h-4 shrink-0" /> Add routing rule
        </button>
      </div>

      {/* Dialogs */}
      <RuleDialog
        open={addRuleOpen}
        onClose={() => setAddRuleOpen(false)}
        mode="create"
        onSubmit={async (d) => {
          const r = tryParseJson(d.injectDataStr)
          await createRule({
            fieldName: d.fieldName,
            operator: d.operator,
            fieldValue: d.operator !== "exists" ? d.fieldValue || undefined : undefined,
            nextScreen: d.nextScreen,
            injectData: d.injectDataStr.trim() && r.ok ? r.val : null,
          })
          toast({ title: "Rule added" })
        }}
      />

      {editRule && (
        <RuleDialog
          open
          onClose={() => setEditRule(null)}
          mode="edit"
          initial={{
            fieldName: editRule.fieldName,
            operator: editRule.operator,
            fieldValue: editRule.fieldValue ?? "",
            nextScreen: editRule.nextScreen,
            injectDataStr: editRule.injectData ? JSON.stringify(editRule.injectData, null, 2) : "",
          }}
          onSubmit={async (d) => {
            const r = tryParseJson(d.injectDataStr)
            await updateRule(editRule.id, {
              fieldName: d.fieldName,
              operator: d.operator,
              fieldValue: d.operator !== "exists" ? (d.fieldValue || null) : null,
              nextScreen: d.nextScreen,
              injectData: d.injectDataStr.trim() && r.ok ? r.val : null,
            })
            toast({ title: "Rule updated" })
          }}
        />
      )}

      {deleteRule_ && (
        <DeleteConfirm
          title="Delete routing rule?"
          description={`Rule for "${deleteRule_.fieldName}" ${deleteRule_.operator}${deleteRule_.fieldValue ? ` "${deleteRule_.fieldValue}"` : ""} → "${deleteRule_.nextScreen}" will be permanently removed.`}
          onClose={() => setDeleteRule(null)}
          onConfirm={async () => {
            await deleteRule(deleteRule_.id)
            toast({ title: "Rule deleted" })
          }}
        />
      )}
    </div>
  )
}

// ── ScreenRow ─────────────────────────────────────────────────────────────────

function ScreenRow({
  screen, tenantId, flowId, onEdit, onDelete,
}: {
  screen: FlowScreen
  tenantId: number
  flowId: number
  onEdit: (s: FlowScreen) => void
  onDelete: (s: FlowScreen) => void
}) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
      {/* Screen header */}
      <div className="flex items-center gap-2 px-3">
        {/* Expand button — takes most of the row, full tap target */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-start gap-2 flex-1 min-w-0 text-left py-3"
        >
          <span className="shrink-0 mt-0.5">
            {expanded
              ? <ChevronDown className="w-4 h-4 text-gray-400" />
              : <ChevronRight className="w-4 h-4 text-gray-400" />
            }
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm text-foreground">{screen.screenId}</span>
              {screen.isFirst && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#128C7E] bg-[#128C7E]/10 rounded-full px-2 py-0.5 shrink-0">
                  <Star className="w-3 h-3" /> First
                </span>
              )}
            </div>
            {/* Label + defaultNextScreen visible on all screen sizes */}
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {screen.label && (
                <span className="text-xs text-muted-foreground">{screen.label}</span>
              )}
              {screen.defaultNextScreen && (
                <span className="text-xs text-muted-foreground">
                  default → <span className="font-mono text-foreground">{screen.defaultNextScreen}</span>
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Edit / Delete — 44px tap targets */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => onEdit(screen)}
            className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Edit screen"
          >
            <Pencil className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onDelete(screen)}
            className="p-2.5 rounded-lg hover:bg-red-50 transition-colors"
            title="Delete screen"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Expanded: rules section */}
      {expanded && (
        <RulesSection tenantId={tenantId} flowId={flowId} screen={screen} />
      )}
    </div>
  )
}

// ── FlowScreensSheet (public export) ─────────────────────────────────────────

interface FlowScreensSheetProps {
  tenantId: number
  flow: FlowDef
  onClose: () => void
}

export function FlowScreensSheet({ tenantId, flow, onClose }: FlowScreensSheetProps) {
  const { toast } = useToast()
  const { screens, loading, error, createScreen, updateScreen, deleteScreen } =
    useFlowScreens(tenantId, flow.id)

  const [addScreenOpen, setAddScreenOpen] = React.useState(false)
  const [editScreen, setEditScreen] = React.useState<FlowScreen | null>(null)
  const [deleteScreen_, setDeleteScreen] = React.useState<FlowScreen | null>(null)

  return (
    <>
      {/* Full-width on mobile, capped at xl on larger screens */}
      <Sheet open onOpenChange={v => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="px-4 pt-5 pb-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <GitBranch className="w-4 h-4 text-[#128C7E] shrink-0" />
              <span className="truncate">{flow.name} — Dynamic Routing</span>
            </SheetTitle>
            <SheetDescription className="text-xs leading-relaxed">
              <strong className="font-medium text-foreground">Optional — for advanced flows only.</strong> If your WhatsApp Flow always shows the same screens in the same order, you don't need this. Use it only if you want to show different screens based on what the user selects or fills in.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading && screens.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-10 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading screens…
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && screens.length === 0 && (
              <div className="py-10 space-y-5 px-2">
                <div className="bg-[#128C7E]/5 border border-[#128C7E]/20 rounded-2xl px-4 py-4 space-y-2">
                  <p className="text-sm font-semibold text-[#128C7E]">Do I need to set this up?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Probably not.</strong> Most WhatsApp Flows work without any configuration here — they just run through your screens in the order you set up in Meta's Flow Builder.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Only set this up if you want to <strong className="text-foreground">send users to different screens based on their answers</strong> — for example, showing a "Premium" screen only if the user selected "Yes" on a previous screen.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">How it works:</p>
                  <ol className="space-y-1.5 text-xs text-muted-foreground leading-relaxed list-decimal list-inside">
                    <li>You build your flow screens in <strong className="text-foreground">Meta's WhatsApp Flow Builder</strong></li>
                    <li>Add those same screen names here and configure routing rules between them</li>
                    <li>When a user submits a screen, your rules decide which screen comes next</li>
                  </ol>
                </div>

                <button
                  onClick={() => setAddScreenOpen(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#128C7E] hover:bg-[#0a7567] rounded-xl px-5 py-3.5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Set up dynamic routing
                </button>
              </div>
            )}

            {screens.length > 0 && (
              <>
                {!screens.some(s => s.isFirst) && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>No entry screen set. Edit a screen and turn on "Entry screen" so the flow knows where to start.</span>
                  </div>
                )}

                {screens.map(screen => (
                  <ScreenRow
                    key={screen.id}
                    screen={screen}
                    tenantId={tenantId}
                    flowId={flow.id}
                    onEdit={setEditScreen}
                    onDelete={setDeleteScreen}
                  />
                ))}
              </>
            )}
          </div>

          {/* Footer add button — full-width tap area */}
          {screens.length > 0 && (
            <div className="border-t shrink-0">
              <button
                onClick={() => setAddScreenOpen(true)}
                className="w-full flex items-center gap-2 px-4 py-4 text-sm font-medium text-[#128C7E] hover:text-[#0a7567] hover:bg-[#128C7E]/5 transition-colors text-left"
              >
                <Plus className="w-4 h-4 shrink-0" /> Add screen
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Screen add dialog */}
      <ScreenDialog
        open={addScreenOpen}
        onClose={() => setAddScreenOpen(false)}
        mode="create"
        onSubmit={async (d) => {
          const r = tryParseJson(d.initDataStr)
          await createScreen({
            screenId: d.screenId.trim(),
            label: d.label.trim() || undefined,
            isFirst: d.isFirst,
            defaultNextScreen: d.defaultNextScreen.trim() || undefined,
            initData: d.initDataStr.trim() && r.ok ? r.val : undefined,
          })
          toast({ title: "Screen added", description: d.screenId })
        }}
      />

      {/* Screen edit dialog */}
      {editScreen && (
        <ScreenDialog
          open
          onClose={() => setEditScreen(null)}
          mode="edit"
          initial={{
            screenId: editScreen.screenId,
            label: editScreen.label ?? "",
            isFirst: editScreen.isFirst,
            defaultNextScreen: editScreen.defaultNextScreen ?? "",
            initDataStr: editScreen.initData ? JSON.stringify(editScreen.initData, null, 2) : "",
          }}
          onSubmit={async (d) => {
            const r = tryParseJson(d.initDataStr)
            await updateScreen(editScreen.id, {
              screenId: d.screenId.trim(),
              label: d.label.trim() || undefined,
              isFirst: d.isFirst,
              defaultNextScreen: d.defaultNextScreen.trim() || null,
              initData: d.initDataStr.trim() && r.ok ? r.val : null,
            })
            toast({ title: "Screen updated" })
          }}
        />
      )}

      {/* Screen delete confirm */}
      {deleteScreen_ && (
        <DeleteConfirm
          title={`Delete "${deleteScreen_.screenId}"?`}
          description="All routing rules attached to this screen will also be deleted. This cannot be undone."
          onClose={() => setDeleteScreen(null)}
          onConfirm={async () => {
            await deleteScreen(deleteScreen_.id)
            toast({ title: "Screen deleted" })
          }}
        />
      )}
    </>
  )
}
