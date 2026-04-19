import React from "react"
import { useLocation } from "wouter"
import {
  Plus, Trash2, Loader2, Workflow,
} from "lucide-react"
import { AutomationsLayout } from "./AutomationsLayout"
import {
  useAutomations, useCampaigns, useCampaignAds,
  type AutomationWorkflow,
} from "@/hooks/useAutomations"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

// ── Constants ──────────────────────────────────────────────────────────────────

const TRIGGER_BADGES: Record<string, { label: string; className: string }> = {
  ad_click:   { label: "Ad Click",         className: "bg-orange-100 text-orange-700 border-orange-200" },
  website:    { label: "Website",           className: "bg-blue-100 text-blue-700 border-blue-200" },
  direct_wa:  { label: "Direct WA",         className: "bg-green-100 text-green-700 border-green-200" },
  manual:     { label: "Manual",            className: "bg-gray-100 text-gray-600 border-gray-200" },
}

// ── Create Dialog ──────────────────────────────────────────────────────────────

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const { createWorkflow } = useAutomations()
  const { toast } = useToast()
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [triggerType, setTriggerType] = React.useState<string>("manual")

  // Ad Click fields
  const [campaignId, setCampaignId] = React.useState<string | null>(null)
  const [adId, setAdId] = React.useState<string | null>(null)
  const { campaigns } = useCampaigns()
  const { ads } = useCampaignAds(campaignId)

  // Website fields
  const [sourceUrl, setSourceUrl] = React.useState("")

  const reset = () => {
    setName("")
    setDescription("")
    setTriggerType("manual")
    setCampaignId(null)
    setAdId(null)
    setSourceUrl("")
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const triggerConfig: Record<string, unknown> = {}
      if (triggerType === "ad_click") {
        if (campaignId) triggerConfig.campaignId = campaignId
        if (adId) triggerConfig.adId = adId
      } else if (triggerType === "website") {
        if (sourceUrl) triggerConfig.sourceUrlContains = sourceUrl
      }
      await createWorkflow({
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        triggerConfig,
      })
      toast({ title: "Automation created" })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Automation</DialogTitle>
          <DialogDescription>Set up a new automation workflow.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground">Name *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. New Lead Follow-up"
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="text-sm font-medium text-foreground">Trigger Type</label>
            <select
              value={triggerType}
              onChange={e => { setTriggerType(e.target.value); setCampaignId(null); setAdId(null); setSourceUrl("") }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ad_click">Ad Click</option>
              <option value="website">Website</option>
              <option value="direct_wa">Direct WhatsApp</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* Ad Click config */}
          {triggerType === "ad_click" && (
            <div className="space-y-3 pl-2 border-l-2 border-orange-200">
              <div>
                <label className="text-sm font-medium text-foreground">Campaign</label>
                <select
                  value={campaignId ?? ""}
                  onChange={e => { setCampaignId(e.target.value || null); setAdId(null) }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select campaign...</option>
                  {campaigns.filter(c => c.status === "ACTIVE").map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Website config */}
          {triggerType === "website" && (
            <div className="pl-2 border-l-2 border-blue-200">
              <label className="text-sm font-medium text-foreground">Source URL Contains</label>
              <Input
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="e.g. /pricing"
                className="mt-1"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="bg-[#128C7E] hover:bg-[#075E54] text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirmation Dialog ─────────────────────────────────────────────────

function DeleteDialog({
  workflow,
  onOpenChange,
  onDeleted,
}: {
  workflow: AutomationWorkflow | null
  onOpenChange: (v: boolean) => void
  onDeleted: () => void
}) {
  const { deleteWorkflow } = useAutomations()
  const { toast } = useToast()
  const [deleting, setDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!workflow) return
    setDeleting(true)
    try {
      await deleteWorkflow(workflow.id)
      toast({ title: "Automation deleted" })
      onOpenChange(false)
      onDeleted()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!workflow} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Automation</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{workflow?.name}"? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AutomationsListPage() {
  const [, setLocation] = useLocation()
  const { workflows, loading, error, refetch, toggleWorkflow } = useAutomations()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<AutomationWorkflow | null>(null)

  const handleToggle = async (wf: AutomationWorkflow) => {
    try {
      await toggleWorkflow(wf.id, !wf.isActive)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  return (
    <AutomationsLayout>
      <div className="p-4 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Workflows</h2>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-[#128C7E] hover:bg-[#075E54] text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Automation
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && workflows.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading automations...
          </div>
        )}

        {/* Empty state */}
        {!loading && workflows.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            <Workflow className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              No automations yet. Create your first automation workflow.
            </p>
          </div>
        )}

        {/* Workflow cards */}
        <div className="space-y-3">
          {workflows.map(wf => {
            const badge = TRIGGER_BADGES[wf.triggerType] ?? TRIGGER_BADGES.manual
            return (
              <Card
                key={wf.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLocation(`/automations/${wf.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{wf.name}</h3>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </div>
                    {wf.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{wf.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={wf.isActive}
                      onCheckedChange={() => handleToggle(wf)}
                      onClick={e => e.stopPropagation()}
                      className="data-[state=checked]:bg-[#128C7E]"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(wf) }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Dialogs */}
      <CreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={refetch}
      />
      <DeleteDialog
        workflow={deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onDeleted={refetch}
      />
    </AutomationsLayout>
  )
}
