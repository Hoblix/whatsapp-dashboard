import React from "react"
import { useLocation } from "wouter"
import { Plus, Search, Trash2, CheckCircle2, Clock, XCircle, AlertTriangle, FileText, Image, Video, File, Loader2, Send, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAllTemplates, useDeleteTemplate, type Template, type TemplateComponent } from "@/hooks/useTemplateManagement"
import { useToast } from "@/hooks/use-toast"

// ── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" />Approved</Badge>
    case "PENDING":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Clock className="w-3 h-3" />Pending</Badge>
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>
    case "PAUSED":
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1"><AlertTriangle className="w-3 h-3" />Paused</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ── Category Badge ──────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    MARKETING: "bg-purple-100 text-purple-700 border-purple-200",
    UTILITY: "bg-blue-100 text-blue-700 border-blue-200",
    AUTHENTICATION: "bg-gray-100 text-gray-700 border-gray-200",
  }
  return <Badge className={colors[category] ?? ""}>{category}</Badge>
}

// ── Header Type Icon ────────────────────────────────────────────────────────

function HeaderIcon({ components }: { components: Template["components"] }) {
  const header = components?.find(c => c.type === "HEADER")
  if (!header) return <FileText className="w-8 h-8 text-gray-400" />
  switch (header.format) {
    case "IMAGE": return <Image className="w-8 h-8 text-blue-500" />
    case "VIDEO": return <Video className="w-8 h-8 text-purple-500" />
    case "DOCUMENT": return <File className="w-8 h-8 text-red-500" />
    default: return <FileText className="w-8 h-8 text-gray-400" />
  }
}

// ── Helper: extract body params ────────────────────────────────────────────

function extractParams(components: TemplateComponent[]): string[] {
  const all: string[] = []
  for (const comp of components) {
    const text: string = comp.text ?? ""
    const matches = text.matchAll(/\{\{(\d+)\}\}/g)
    for (const m of matches) {
      if (!all.includes(m[1])) all.push(m[1])
    }
  }
  return all.sort((a, b) => Number(a) - Number(b))
}

function getFlowButtons(components: TemplateComponent[]) {
  const buttonsComp = components.find((c) => c.type === "BUTTONS")
  if (!buttonsComp?.buttons) return []
  return buttonsComp.buttons
    .map((btn, idx) => ({ ...btn, idx }))
    .filter((btn) => btn.type === "FLOW")
}

// ── Test Template Modal ────────────────────────────────────────────────────

function getMediaHeader(components: TemplateComponent[]) {
  const header = components?.find(c => c.type === "HEADER")
  if (!header) return null
  if (header.format === "IMAGE" || header.format === "VIDEO" || header.format === "DOCUMENT") {
    return {
      format: header.format,
      url: header.example?.header_handle?.[0] ?? null,
    }
  }
  return null
}

function TestTemplateModal({
  template,
  onClose,
}: {
  template: Template
  onClose: () => void
}) {
  const { toast } = useToast()
  const [phone, setPhone] = React.useState("")
  const [params, setParams] = React.useState<Record<string, string>>({})
  const [paramTypes, setParamTypes] = React.useState<Record<string, "text" | "date" | "time">>({})
  const [flowTokens, setFlowTokens] = React.useState<Record<number, string>>({})
  const [mediaUrl, setMediaUrl] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [loadingContext, setLoadingContext] = React.useState(false)

  const paramNums = extractParams(template.components)
  const flowBtns = getFlowButtons(template.components)
  const bodyText = template.components?.find(c => c.type === "BODY")?.text ?? ""
  const mediaHeader = getMediaHeader(template.components)

  // Time slots (keep in sync with backend reschedule handler)
  const TIME_SLOTS = [
    { id: "10-11", label: "10:00 AM – 11:00 AM" },
    { id: "11-12", label: "11:00 AM – 12:00 PM" },
    { id: "12-13", label: "12:00 PM – 1:00 PM" },
    { id: "14-15", label: "2:00 PM – 3:00 PM" },
    { id: "15-16", label: "3:00 PM – 4:00 PM" },
    { id: "16-17", label: "4:00 PM – 5:00 PM" },
    { id: "17-18", label: "5:00 PM – 6:00 PM" },
  ]

  // Auto-fetch the stored media URL for this template (from our DB, not Meta's expired CDN)
  React.useEffect(() => {
    if (!mediaHeader) return
    fetch(`/api/templates/by-name/${encodeURIComponent(template.name)}/media-url`, { credentials: "include" })
      .then(r => r.json())
      .then((d: any) => {
        if (d.mediaUrl) setMediaUrl(d.mediaUrl)
      })
      .catch(() => {})
  }, [template.name, mediaHeader])

  // Load booking context for this phone — called when user clicks "Load from booking"
  async function loadFromBooking() {
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length < 10) {
      toast({ title: "Enter phone number first", variant: "destructive" })
      return
    }
    setLoadingContext(true)
    try {
      const res = await fetch(`/api/send/booking-context/${cleaned}`, { credentials: "include" })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error ?? "Lookup failed")

      // Pre-fill params in convention order: {{1}} name, {{2}} date, {{3}} slot, {{4}} phone
      const next: Record<string, string> = {}
      if (paramNums.includes("1") && data.name) next["1"] = data.name
      if (paramNums.includes("2") && data.bookedDateFormatted) next["2"] = data.bookedDateFormatted
      if (paramNums.includes("3") && data.bookedSlotLabel) next["3"] = data.bookedSlotLabel
      if (paramNums.includes("4") && data.phoneNumber) next["4"] = `+${data.phoneNumber}`
      setParams((p) => ({ ...p, ...next }))
      toast({ title: "Booking data loaded", description: `Pre-filled ${Object.keys(next).length} parameter(s)` })
    } catch (err: any) {
      toast({ title: "Couldn't load booking", description: err.message, variant: "destructive" })
    } finally {
      setLoadingContext(false)
    }
  }

  async function handleSend() {
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length < 11 || cleaned.length > 15) {
      toast({ title: "Invalid phone number", description: "Enter full number with country code (e.g. 919876543210)", variant: "destructive" })
      return
    }

    if (mediaHeader && !mediaUrl.trim()) {
      toast({ title: `${mediaHeader.format.toLowerCase()} URL required`, description: "Paste a direct, permanent URL to the media file", variant: "destructive" })
      return
    }

    setSending(true)
    try {
      const components: any[] = []

      // Media header component — uses the URL the user provided
      if (mediaHeader && mediaUrl.trim()) {
        const mediaType = mediaHeader.format.toLowerCase()
        components.push({
          type: "header",
          parameters: [{
            type: mediaType,
            [mediaType]: { link: mediaUrl.trim() },
          }],
        })
      }

      if (paramNums.length > 0) {
        components.push({
          type: "body",
          parameters: paramNums.map((n) => {
            let text = params[n] ?? `{{${n}}}`
            if (paramTypes[n] === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
              text = new Date(text + "T00:00:00").toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })
            }
            return { type: "text", text }
          }),
        })
      }

      for (const btn of flowBtns) {
        components.push({
          type: "button",
          sub_type: "flow",
          index: String(btn.idx),
          parameters: [{
            type: "action",
            action: { flow_token: flowTokens[btn.idx] || `test-${Date.now()}` },
          }],
        })
      }

      const res = await fetch("/api/send/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: cleaned,
          templateName: template.name,
          languageCode: template.language,
          components: components.length > 0 ? components : undefined,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error ?? "Send failed")

      toast({ title: "Test sent!", description: `Template "${template.name}" sent to +${cleaned}` })
      onClose()
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md mx-4 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-sm">Test Template</h2>
            <p className="text-xs text-muted-foreground">{template.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Preview */}
          <div className="bg-slate-50 border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Preview</p>
            <p className="text-sm whitespace-pre-wrap">{bodyText || "No body text"}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="outline" className="text-[10px]">{template.language}</Badge>
              <Badge variant="outline" className="text-[10px]">{template.category}</Badge>
              {flowBtns.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                  <Zap className="w-2.5 h-2.5" /> Flow
                </span>
              )}
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Phone Number (with country code)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 919876543210"
              className="h-9 text-sm"
            />
          </div>

          {/* Media URL (IMAGE/VIDEO/DOCUMENT headers) — auto-filled from stored template source */}
          {mediaHeader && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                {mediaHeader.format === "IMAGE" ? "Image" : mediaHeader.format === "VIDEO" ? "Video" : "Document"} URL
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder={mediaHeader.format === "IMAGE" ? "https://example.com/image.jpg" : mediaHeader.format === "VIDEO" ? "https://example.com/video.mp4" : "https://example.com/doc.pdf"}
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {mediaUrl ? "Auto-filled from template. Override if needed." : "Direct permanent URL — Meta CDN URLs expire."}
              </p>
            </div>
          )}

          {/* Load from Booking button — prefills params from DB */}
          {paramNums.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingContext || !phone.trim()}
              onClick={loadFromBooking}
              className="w-full h-8 text-xs gap-1.5 border-dashed"
            >
              {loadingContext ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Load from booking data
            </Button>
          )}

          {/* Body Parameters */}
          {paramNums.map((num) => {
            const type = paramTypes[num] ?? "text"
            const setType = (t: "text" | "date" | "time") => setParamTypes((p) => ({ ...p, [num]: t }))
            return (
              <div key={num}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">
                    Parameter {`{{${num}}}`}
                  </label>
                  <div className="flex gap-0.5 text-[10px]">
                    {(["text", "date", "time"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`px-1.5 py-0.5 rounded border ${
                          type === t
                            ? "bg-[#128C7E] text-white border-[#128C7E]"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {type === "date" ? (
                  <>
                    <Input
                      type="date"
                      value={params[num]?.match(/^\d{4}-\d{2}-\d{2}$/) ? params[num] : ""}
                      onChange={(e) => setParams((p) => ({ ...p, [num]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                    {params[num]?.match(/^\d{4}-\d{2}-\d{2}$/) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Will send as: <strong>{new Date(params[num] + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>
                      </p>
                    )}
                  </>
                ) : type === "time" ? (
                  <select
                    value={params[num] ?? ""}
                    onChange={(e) => setParams((p) => ({ ...p, [num]: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Pick a time slot...</option>
                    {TIME_SLOTS.map((s) => (
                      <option key={s.id} value={s.label}>{s.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={params[num] ?? ""}
                    onChange={(e) => setParams((p) => ({ ...p, [num]: e.target.value }))}
                    placeholder={`Value for {{${num}}}`}
                    className="h-9 text-sm"
                  />
                )}
              </div>
            )
          })}

          {/* Flow token inputs */}
          {flowBtns.map((btn) => (
            <div key={btn.idx} className="bg-purple-50 border border-purple-100 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs font-medium text-purple-800">Flow: "{btn.text}"</span>
              </div>
              <Input
                value={flowTokens[btn.idx] ?? ""}
                onChange={(e) => setFlowTokens((t) => ({ ...t, [btn.idx]: e.target.value }))}
                placeholder="Flow token (optional)"
                className="h-9 text-sm bg-white"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t shrink-0">
          <Button
            onClick={handleSend}
            disabled={sending || !phone.trim()}
            className="w-full bg-[#128C7E] hover:bg-[#0e7a6e] text-white gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : "Send Test"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Template Card ───────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onDelete,
  onTest,
}: {
  template: Template
  onDelete: (name: string) => void
  onTest: (template: Template) => void
}) {
  const [, navigate] = useLocation()
  const body = template.components?.find(c => c.type === "BODY")?.text ?? ""
  const hasCarousel = template.components?.some(c => c.type === "CAROUSEL")
  const buttonCount = template.components?.find(c => c.type === "BUTTONS")?.buttons?.length ?? 0

  return (
    <Card className="p-3 hover:shadow-md transition-shadow">
      <div className="flex gap-3">
        <div className="shrink-0 flex items-start pt-1">
          <HeaderIcon components={template.components} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">{template.name}</h3>
            <div className="flex items-center gap-0.5 shrink-0">
              {template.status === "APPROVED" && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTest(template) }}
                  className="text-muted-foreground hover:text-[#128C7E] p-1"
                  title="Send test message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(template.name) }}
                className="text-muted-foreground hover:text-red-600 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{body || "No body text"}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={template.status} />
            <CategoryBadge category={template.category} />
            <Badge variant="outline" className="text-[10px]">{template.language}</Badge>
            {hasCarousel && <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600">Carousel</Badge>}
            {buttonCount > 0 && <Badge variant="outline" className="text-[10px]">{buttonCount} CTA</Badge>}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Main List Page ──────────────────────────────────────────────────────────

export default function TemplateList() {
  const [, navigate] = useLocation()
  const { templates, loading, error, refetch } = useAllTemplates()
  const deleteMutation = useDeleteTemplate()
  const { toast } = useToast()
  const [search, setSearch] = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState<string>("all")
  const [filterCategory, setFilterCategory] = React.useState<string>("all")
  const [testTemplate, setTestTemplate] = React.useState<Template | null>(null)

  const filtered = React.useMemo(() => {
    let result = templates
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t => t.name.toLowerCase().includes(q))
    }
    if (filterStatus !== "all") {
      result = result.filter(t => t.status === filterStatus)
    }
    if (filterCategory !== "all") {
      result = result.filter(t => t.category === filterCategory)
    }
    return result
  }, [templates, search, filterStatus, filterCategory])

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone and the name can't be reused for 30 days.`)) return
    try {
      await deleteMutation.mutateAsync(name)
      toast({ title: `Template "${name}" deleted` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  // Stats
  const stats = React.useMemo(() => {
    const s = { total: templates.length, approved: 0, pending: 0, rejected: 0 }
    for (const t of templates) {
      if (t.status === "APPROVED") s.approved++
      else if (t.status === "PENDING") s.pending++
      else if (t.status === "REJECTED") s.rejected++
    }
    return s
  }, [templates])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-[#128C7E] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-white font-semibold text-base">Templates</h1>
          <Button
            onClick={() => navigate("/templates/create")}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-0 h-9 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 py-2 border-b overflow-x-auto">
        <div className="text-center px-3 py-1.5 rounded-md bg-gray-50 min-w-[60px]">
          <p className="text-sm font-bold">{stats.total}</p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </div>
        <div className="text-center px-3 py-1.5 rounded-md bg-green-50 min-w-[60px]">
          <p className="text-sm font-bold text-green-600">{stats.approved}</p>
          <p className="text-[9px] text-green-600/70">Approved</p>
        </div>
        <div className="text-center px-3 py-1.5 rounded-md bg-amber-50 min-w-[60px]">
          <p className="text-sm font-bold text-amber-600">{stats.pending}</p>
          <p className="text-[9px] text-amber-600/70">Pending</p>
        </div>
        <div className="text-center px-3 py-1.5 rounded-md bg-red-50 min-w-[60px]">
          <p className="text-sm font-bold text-red-600">{stats.rejected}</p>
          <p className="text-[9px] text-red-600/70">Rejected</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-4 py-2 space-y-2 border-b">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1"
          >
            <option value="all">All status</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1"
          >
            <option value="all">All categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
        </div>
      </div>

      {/* Template List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-600">{error}</p>
            <Button onClick={() => refetch()} size="sm" variant="outline" className="mt-2">Retry</Button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No templates found</p>
          </div>
        )}
        {filtered.map(t => (
          <TemplateCard key={t.id} template={t} onDelete={handleDelete} onTest={setTestTemplate} />
        ))}
      </div>

      {/* Test Template Modal */}
      {testTemplate && (
        <TestTemplateModal template={testTemplate} onClose={() => setTestTemplate(null)} />
      )}
    </div>
  )
}
