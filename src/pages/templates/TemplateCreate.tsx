import React from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Plus, Trash2, Image, Video, File, FileText, Phone, ExternalLink, MessageSquare, Copy, GitBranch, Loader2, Save, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useCreateTemplate, TEMPLATE_LANGUAGES, type TemplateComponent, type TemplateButton, type CarouselCard } from "@/hooks/useTemplateManagement"
import { useToast } from "@/hooks/use-toast"

// ── Template Type Selection ─────────────────────────────────────────────────

type TemplateType = "text" | "media" | "carousel"

const TEMPLATE_TYPES = [
  { value: "text" as const, label: "Text", icon: <FileText className="w-5 h-5" />, desc: "Text with optional header & buttons" },
  { value: "media" as const, label: "Media", icon: <Image className="w-5 h-5" />, desc: "Image/Video/Document header + text" },
  { value: "carousel" as const, label: "Carousel", icon: <Copy className="w-5 h-5" />, desc: "Multi-card swipeable carousel" },
]

// ── Flow type for Meta flows ───────────────────────────────────────────────

interface MetaFlow {
  id: string
  name: string
  status: string
  categories?: string[]
}

// ── Flow Selector (dropdown) ───────────────────────────────────────────────

function FlowSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (flowId: string) => void
}) {
  const [flows, setFlows] = React.useState<MetaFlow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [fetched, setFetched] = React.useState(false)

  React.useEffect(() => {
    if (fetched) return
    setLoading(true)
    fetch("/api/templates/flows", { credentials: "include" })
      .then(r => r.json())
      .then((d: any) => {
        setFlows(d.data ?? [])
        setFetched(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fetched])

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 sm:h-8 px-3 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading flows...
      </div>
    )
  }

  if (flows.length === 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground">No flows found in your WABA account.</p>
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Enter Flow ID manually" className="h-10 sm:h-8 text-xs" />
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-10 sm:h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      <option value="">Select a flow...</option>
      {flows.map(f => (
        <option key={f.id} value={f.id}>
          {f.name} {f.status !== "PUBLISHED" ? `(${f.status})` : ""} — {f.id}
        </option>
      ))}
    </select>
  )
}

// ── Button Editor ───────────────────────────────────────────────────────────

function ButtonEditor({
  buttons,
  onChange,
  maxButtons = 3,
}: {
  buttons: TemplateButton[]
  onChange: (buttons: TemplateButton[]) => void
  maxButtons?: number
}) {
  const addButton = (type: TemplateButton["type"]) => {
    if (buttons.length >= maxButtons) return
    const newBtn: TemplateButton = { type, text: "" }
    if (type === "URL") newBtn.url = ""
    if (type === "PHONE_NUMBER") newBtn.phone_number = ""
    onChange([...buttons, newBtn])
  }

  const updateButton = (i: number, patch: Partial<TemplateButton>) => {
    const updated = buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b)
    onChange(updated)
  }

  const removeButton = (i: number) => onChange(buttons.filter((_, idx) => idx !== i))

  const buttonTypeIcon = (type: string) => {
    switch (type) {
      case "URL": return <ExternalLink className="w-3 h-3" />
      case "PHONE_NUMBER": return <Phone className="w-3 h-3" />
      case "QUICK_REPLY": return <MessageSquare className="w-3 h-3" />
      case "FLOW": return <GitBranch className="w-3 h-3" />
      case "COPY_CODE": return <Copy className="w-3 h-3" />
      default: return null
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">Buttons</label>
        <span className="text-[10px] text-muted-foreground">{buttons.length}/{maxButtons}</span>
      </div>

      {buttons.map((btn, i) => (
        <div key={i} className="rounded-md border p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            {buttonTypeIcon(btn.type)}
            <Badge variant="outline" className="text-[10px]">{btn.type.replace("_", " ")}</Badge>
            <button onClick={() => removeButton(i)} className="ml-auto text-muted-foreground hover:text-red-600">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <Input value={btn.text} onChange={e => updateButton(i, { text: e.target.value })} placeholder="Button text" className="h-10 sm:h-8 text-xs" />
          {btn.type === "URL" && (
            <Input value={btn.url ?? ""} onChange={e => updateButton(i, { url: e.target.value })} placeholder="https://example.com/{{1}}" className="h-10 sm:h-8 text-xs" />
          )}
          {btn.type === "PHONE_NUMBER" && (
            <Input value={btn.phone_number ?? ""} onChange={e => updateButton(i, { phone_number: e.target.value })} placeholder="+919217737756" className="h-10 sm:h-8 text-xs" />
          )}
          {btn.type === "FLOW" && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground">Select Flow</label>
              <FlowSelector
                value={btn.flow_id ?? ""}
                onChange={flowId => updateButton(i, { flow_id: flowId })}
              />
              <Input value={btn.navigate_screen ?? ""} onChange={e => updateButton(i, { navigate_screen: e.target.value })} placeholder="Navigate screen (optional)" className="h-10 sm:h-8 text-xs" />
            </div>
          )}
        </div>
      ))}

      {buttons.length < maxButtons && (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => addButton("URL")} className="text-[10px] px-3 py-2 sm:px-2 sm:py-1 rounded border hover:bg-gray-50 flex items-center gap-1 min-h-[44px] sm:min-h-0">
            <ExternalLink className="w-3 h-3" /> URL
          </button>
          <button onClick={() => addButton("PHONE_NUMBER")} className="text-[10px] px-3 py-2 sm:px-2 sm:py-1 rounded border hover:bg-gray-50 flex items-center gap-1 min-h-[44px] sm:min-h-0">
            <Phone className="w-3 h-3" /> Phone
          </button>
          <button onClick={() => addButton("QUICK_REPLY")} className="text-[10px] px-3 py-2 sm:px-2 sm:py-1 rounded border hover:bg-gray-50 flex items-center gap-1 min-h-[44px] sm:min-h-0">
            <MessageSquare className="w-3 h-3" /> Quick Reply
          </button>
          <button onClick={() => addButton("FLOW")} className="text-[10px] px-3 py-2 sm:px-2 sm:py-1 rounded border hover:bg-gray-50 flex items-center gap-1 min-h-[44px] sm:min-h-0">
            <GitBranch className="w-3 h-3" /> Flow
          </button>
        </div>
      )}
    </div>
  )
}

// ── Carousel Card Editor ────────────────────────────────────────────────────

function CarouselCardEditor({
  card,
  index,
  mediaFormat,
  onChange,
  onRemove,
}: {
  card: { header_url: string; body: string; buttons: TemplateButton[] }
  index: number
  mediaFormat: "IMAGE" | "VIDEO"
  onChange: (card: typeof card) => void
  onRemove: () => void
}) {
  return (
    <Card className="p-4 sm:p-3 border-l-4 border-l-indigo-400 w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">Card {index + 1}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-red-600">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <label className="text-[11px] text-muted-foreground">{mediaFormat === "IMAGE" ? "Image" : "Video"} URL</label>
          <Input
            value={card.header_url}
            onChange={e => onChange({ ...card, header_url: e.target.value })}
            placeholder={mediaFormat === "IMAGE" ? "https://example.com/image.jpg" : "https://example.com/video.mp4"}
            className="h-10 sm:h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Body <span className="text-[9px]">(max 160 chars)</span></label>
          <textarea
            value={card.body}
            onChange={e => onChange({ ...card, body: e.target.value.slice(0, 160) })}
            placeholder="Card description..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[50px] resize-none"
            maxLength={160}
          />
          <p className="text-[9px] text-muted-foreground text-right">{card.body.length}/160</p>
        </div>
        <ButtonEditor
          buttons={card.buttons}
          onChange={btns => onChange({ ...card, buttons: btns })}
          maxButtons={2}
        />
      </div>
    </Card>
  )
}

// ── Main Create Page ────────────────────────────────────────────────────────

export default function TemplateCreate() {
  const [, navigate] = useLocation()
  const createMutation = useCreateTemplate()
  const { toast } = useToast()

  // Basic info
  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("MARKETING")
  const [language, setLanguage] = React.useState("en")
  const [templateType, setTemplateType] = React.useState<TemplateType>("text")

  // Header
  const [headerFormat, setHeaderFormat] = React.useState<"TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE">("NONE")
  const [headerText, setHeaderText] = React.useState("")
  const [headerMediaUrl, setHeaderMediaUrl] = React.useState("")

  // Body
  const [bodyText, setBodyText] = React.useState("")

  // Footer
  const [footerText, setFooterText] = React.useState("")

  // Buttons
  const [buttons, setButtons] = React.useState<TemplateButton[]>([])

  // Carousel
  const [carouselFormat, setCarouselFormat] = React.useState<"IMAGE" | "VIDEO">("IMAGE")
  const [carouselBodyText, setCarouselBodyText] = React.useState("")
  const [carouselCards, setCarouselCards] = React.useState<Array<{ header_url: string; body: string; buttons: TemplateButton[] }>>([
    { header_url: "", body: "", buttons: [] },
    { header_url: "", body: "", buttons: [] },
  ])

  // Media URL import for carousel
  const [mediaUrlsText, setMediaUrlsText] = React.useState("")
  const [instagramUrl, setInstagramUrl] = React.useState("")
  const [fetchingInstagram, setFetchingInstagram] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(false)

  const autoFillCarouselCards = () => {
    const urls = mediaUrlsText
      .split("\n")
      .map(u => u.trim())
      .filter(u => u.length > 0)
    if (urls.length === 0) {
      toast({ title: "No URLs found", description: "Paste one URL per line", variant: "destructive" })
      return
    }
    const newCards = urls.slice(0, 10).map(url => ({
      header_url: url,
      body: "",
      buttons: [] as TemplateButton[],
    }))
    setCarouselCards(newCards)
    setMediaUrlsText("")
    toast({ title: `Created ${newCards.length} cards from URLs` })
  }

  const fetchInstagramImages = async () => {
    if (!instagramUrl.trim()) return
    setFetchingInstagram(true)
    try {
      const res = await fetch("/api/templates/fetch-instagram", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: instagramUrl }),
      })
      const data = await res.json() as any
      if (data.error) {
        toast({ title: "Could not fetch images", description: data.error, variant: "destructive" })
        return
      }
      if (data.images?.length > 0) {
        const newCards = data.images.slice(0, 10).map((url: string) => ({
          header_url: url,
          body: "",
          buttons: [] as TemplateButton[],
        }))
        setCarouselCards(newCards)
        setInstagramUrl("")
        toast({ title: `Imported ${newCards.length} images from Instagram` })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setFetchingInstagram(false)
    }
  }

  const addCarouselCard = () => {
    if (carouselCards.length >= 10) return
    setCarouselCards([...carouselCards, { header_url: "", body: "", buttons: [] }])
  }

  const removeCarouselCard = (i: number) => {
    if (carouselCards.length <= 2) return
    setCarouselCards(carouselCards.filter((_, idx) => idx !== i))
  }

  // Count params in text
  const countParams = (text: string) => (text.match(/\{\{\d+\}\}/g) ?? []).length

  // Build components payload — accepts overrides for uploaded handles
  const buildComponents = (opts?: {
    resolvedCards?: typeof carouselCards
    resolvedHeaderMediaUrl?: string
  }): TemplateComponent[] => {
    const cards = opts?.resolvedCards ?? carouselCards
    const mediaUrl = opts?.resolvedHeaderMediaUrl ?? headerMediaUrl

    if (templateType === "carousel") {
      const components: TemplateComponent[] = []

      // Body text above carousel
      if (carouselBodyText.trim()) {
        const bodyComp: TemplateComponent = { type: "BODY", text: carouselBodyText }
        const paramCount = countParams(carouselBodyText)
        if (paramCount > 0) {
          bodyComp.example = { body_text: [Array.from({ length: paramCount }, (_, i) => `Example ${i + 1}`)] }
        }
        components.push(bodyComp)
      }

      // Carousel component
      components.push({
        type: "CAROUSEL",
        cards: cards.map(card => ({
          components: [
            {
              type: "HEADER",
              format: carouselFormat,
              example: { header_handle: [card.header_url] },
            },
            {
              type: "BODY",
              text: card.body,
              ...(countParams(card.body) > 0 ? {
                example: { body_text: [Array.from({ length: countParams(card.body) }, (_, i) => `Example ${i + 1}`)] }
              } : {}),
            },
            ...(card.buttons.length > 0 ? [{
              type: "BUTTONS" as const,
              buttons: card.buttons,
            }] : []),
          ],
        })),
      })

      return components
    }

    // Standard template (text or media)
    const components: TemplateComponent[] = []

    // Header
    if (headerFormat === "TEXT" && headerText.trim()) {
      const headerComp: TemplateComponent = { type: "HEADER", format: "TEXT", text: headerText }
      const paramCount = countParams(headerText)
      if (paramCount > 0) {
        headerComp.example = { header_handle: [Array.from({ length: paramCount }, (_, i) => `Example ${i + 1}`).join(", ")] }
      }
      components.push(headerComp)
    } else if (headerFormat !== "NONE" && headerFormat !== "TEXT" && mediaUrl.trim()) {
      components.push({
        type: "HEADER",
        format: headerFormat,
        example: { header_handle: [mediaUrl] },
      })
    }

    // Body (required)
    if (bodyText.trim()) {
      const bodyComp: TemplateComponent = { type: "BODY", text: bodyText }
      const paramCount = countParams(bodyText)
      if (paramCount > 0) {
        bodyComp.example = { body_text: [Array.from({ length: paramCount }, (_, i) => `Example ${i + 1}`)] }
      }
      components.push(bodyComp)
    }

    // Footer
    if (footerText.trim()) {
      components.push({ type: "FOOTER", text: footerText })
    }

    // Buttons
    if (buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map(b => {
          const btn: any = { type: b.type, text: b.text }
          if (b.type === "URL" && b.url) {
            btn.url = b.url
            if (b.url.includes("{{1}}")) btn.example = [b.url.replace("{{1}}", "example")]
          }
          if (b.type === "PHONE_NUMBER" && b.phone_number) btn.phone_number = b.phone_number
          if (b.type === "FLOW") {
            btn.flow_id = b.flow_id
            btn.flow_action = "navigate"
            if (b.navigate_screen) btn.navigate_screen = b.navigate_screen
          }
          return btn
        }),
      })
    }

    return components
  }

  // Upload a media URL to get a Meta handle
  const uploadMedia = async (url: string, mediaType: string): Promise<string> => {
    const res = await fetch("/api/templates/upload-media", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, type: mediaType }),
    })
    const data = await res.json() as any
    if (!res.ok) throw new Error(data.error ?? "Upload failed")
    return data.handle
  }

  const [uploading, setUploading] = React.useState(false)

  const [submitting, setSubmitting] = React.useState(false)

  // Submit
  const handleSubmit = async () => {
    if (submitting || uploading) return
    setSubmitting(true)
    try {
      await doSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  const doSubmit = async () => {
    if (!name.trim()) { toast({ title: "Template name is required", variant: "destructive" }); return }
    if (!bodyText.trim() && templateType !== "carousel") { toast({ title: "Body text is required", variant: "destructive" }); return }

    // Validate carousel cards have buttons
    if (templateType === "carousel") {
      const missingButtons = carouselCards.some(card => card.buttons.length === 0)
      if (missingButtons) {
        toast({ title: "Each carousel card must have at least one button", variant: "destructive" })
        return
      }
    }

    try {
      let resolvedCards = carouselCards
      let resolvedHeaderMediaUrl = headerMediaUrl
      // Remember the ORIGINAL URL (before upload) so we can save it in our DB for future sends
      const originalMediaSourceUrl = headerMediaUrl

      // For carousel and media templates, upload media URLs to get Meta handles
      if (templateType === "carousel") {
        setUploading(true)
        toast({ title: "Uploading media...", description: "Converting image URLs to Meta handles" })

        const updatedCards = [...carouselCards]
        for (let i = 0; i < updatedCards.length; i++) {
          const card = updatedCards[i]
          if (card.header_url && !card.header_url.startsWith("h:")) {
            try {
              const handle = await uploadMedia(card.header_url, carouselFormat)
              updatedCards[i] = { ...card, header_url: handle }
            } catch (err: any) {
              toast({ title: `Failed to upload image for card ${i + 1}`, description: err.message, variant: "destructive" })
              setUploading(false)
              return
            }
          }
        }
        resolvedCards = updatedCards
        setCarouselCards(updatedCards)
        setUploading(false)
      } else if (headerFormat !== "NONE" && headerFormat !== "TEXT" && headerMediaUrl.trim() && !headerMediaUrl.startsWith("h:")) {
        setUploading(true)
        toast({ title: "Uploading media...", description: "Converting URL to Meta handle" })
        try {
          const handle = await uploadMedia(headerMediaUrl, headerFormat)
          resolvedHeaderMediaUrl = handle
          setHeaderMediaUrl(handle)
        } catch (err: any) {
          toast({ title: "Failed to upload header media", description: err.message, variant: "destructive" })
          setUploading(false)
          return
        }
        setUploading(false)
      }

      const components = buildComponents({ resolvedCards, resolvedHeaderMediaUrl })

      // If this is a standard media template (not carousel), pass the original source URL
      // so the backend saves it for future sends (Meta's CDN URLs expire)
      const mediaSourcePayload = (templateType !== "carousel" && headerFormat !== "NONE" && headerFormat !== "TEXT" && originalMediaSourceUrl && !originalMediaSourceUrl.startsWith("4:"))
        ? { mediaSourceUrl: originalMediaSourceUrl, mediaSourceType: headerFormat }
        : {}

      const result = await createMutation.mutateAsync({
        name: name.trim().toLowerCase().replace(/\s+/g, "_"),
        category,
        language,
        components,
        allow_category_change: true,
        ...mediaSourcePayload,
      } as any)
      toast({ title: `Template created! Status: ${result.status}` })
      navigate("/templates")
    } catch (err: any) {
      setUploading(false)
      toast({ title: "Error creating template", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-[#128C7E] px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/templates")} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-base">Create Template</h1>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || uploading || submitting}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-0 h-11 sm:h-9 px-4 sm:px-3 ml-auto gap-1.5 min-w-[44px]"
          >
            {(createMutation.isPending || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {uploading ? "Uploading…" : "Submit"}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic Info */}
        <Card className="p-3 space-y-3">
          <h2 className="text-sm font-semibold">Basic Info</h2>
          <div>
            <label className="text-[11px] text-muted-foreground">Template Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="my_template_name"
              className="h-10 sm:h-9 text-sm"
            />
            <p className="text-[9px] text-muted-foreground mt-0.5">Lowercase, underscores only</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full h-10 sm:h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Language</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full h-10 sm:h-9 rounded-md border border-input bg-background px-2 text-sm">
                {TEMPLATE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* Template Type */}
        <Card className="p-3 space-y-3">
          <h2 className="text-sm font-semibold">Template Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TEMPLATE_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setTemplateType(t.value)}
                className={`rounded-lg border-2 p-3 min-h-[44px] text-center transition-colors ${
                  templateType === t.value ? "border-[#128C7E] bg-[#128C7E]/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`mx-auto mb-1 ${templateType === t.value ? "text-[#128C7E]" : "text-gray-400"}`}>
                  {t.icon}
                </div>
                <p className="text-xs font-medium">{t.label}</p>
                <p className="text-[9px] text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Standard Template Content */}
        {templateType !== "carousel" && (
          <>
            {/* Header */}
            <Card className="p-3 space-y-3">
              <h2 className="text-sm font-semibold">Header <span className="text-[10px] text-muted-foreground font-normal">(optional)</span></h2>
              <div className="flex gap-1.5 flex-wrap">
                {(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setHeaderFormat(f)}
                    className={`text-[11px] px-2.5 py-2 sm:py-1.5 rounded-md border transition-colors min-h-[44px] sm:min-h-0 ${
                      headerFormat === f ? "border-[#128C7E] bg-[#128C7E]/5 text-[#128C7E]" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {f === "NONE" ? "None" : f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              {headerFormat === "TEXT" && (
                <div>
                  <Input value={headerText} onChange={e => setHeaderText(e.target.value.slice(0, 60))} placeholder="Header text (max 60 chars)" className="h-10 sm:h-8 text-xs" />
                  <p className="text-[9px] text-muted-foreground text-right">{headerText.length}/60</p>
                </div>
              )}
              {headerFormat !== "NONE" && headerFormat !== "TEXT" && (
                <Input value={headerMediaUrl} onChange={e => setHeaderMediaUrl(e.target.value)} placeholder={`${headerFormat.toLowerCase()} URL (for example)`} className="h-10 sm:h-8 text-xs" />
              )}
            </Card>

            {/* Body */}
            <Card className="p-3 space-y-2">
              <h2 className="text-sm font-semibold">Body <span className="text-xs text-red-500">*</span></h2>
              <textarea
                value={bodyText}
                onChange={e => setBodyText(e.target.value.slice(0, 1024))}
                placeholder={"Hello {{1}}! Welcome to our service.\n\nUse {{1}}, {{2}} for dynamic content."}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none"
                maxLength={1024}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>{countParams(bodyText)} variables</span>
                <span>{bodyText.length}/1024</span>
              </div>
            </Card>

            {/* Footer */}
            <Card className="p-3 space-y-2">
              <h2 className="text-sm font-semibold">Footer <span className="text-[10px] text-muted-foreground font-normal">(optional)</span></h2>
              <Input value={footerText} onChange={e => setFooterText(e.target.value.slice(0, 60))} placeholder="Footer text (max 60 chars)" className="h-10 sm:h-8 text-xs" />
            </Card>

            {/* Buttons */}
            <Card className="p-3">
              <ButtonEditor buttons={buttons} onChange={setButtons} maxButtons={10} />
            </Card>
          </>
        )}

        {/* Carousel Content */}
        {templateType === "carousel" && (
          <>
            {/* Carousel Body Text */}
            <Card className="p-3 space-y-2">
              <h2 className="text-sm font-semibold">Carousel Text <span className="text-[10px] text-muted-foreground font-normal">(appears above cards)</span></h2>
              <textarea
                value={carouselBodyText}
                onChange={e => setCarouselBodyText(e.target.value.slice(0, 1024))}
                placeholder="Check out our latest offerings! {{1}}"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
              />
            </Card>

            {/* Carousel Media Format */}
            <Card className="p-3 space-y-2">
              <h2 className="text-sm font-semibold">Card Media Type</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setCarouselFormat("IMAGE")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 min-h-[44px] rounded-md border-2 transition-colors ${
                    carouselFormat === "IMAGE" ? "border-[#128C7E] bg-[#128C7E]/5 text-[#128C7E]" : "border-gray-200"
                  }`}
                >
                  <Image className="w-4 h-4" /> Image
                </button>
                <button
                  onClick={() => setCarouselFormat("VIDEO")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 sm:py-2.5 min-h-[44px] rounded-md border-2 transition-colors ${
                    carouselFormat === "VIDEO" ? "border-[#128C7E] bg-[#128C7E]/5 text-[#128C7E]" : "border-gray-200"
                  }`}
                >
                  <Video className="w-4 h-4" /> Video
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground">All cards must use the same media type</p>
            </Card>

            {/* Import from Instagram */}
            <Card className="p-4 sm:p-3 space-y-2 border-2 border-pink-300 bg-pink-50/30">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-pink-500" />
                <h2 className="text-sm font-semibold">Import from Instagram</h2>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Paste an Instagram post URL to auto-import all carousel images.
              </p>
              <div className="flex gap-2">
                <Input
                  value={instagramUrl}
                  onChange={e => setInstagramUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/ABC123..."
                  className="h-10 sm:h-8 text-xs flex-1"
                />
                <Button
                  onClick={fetchInstagramImages}
                  disabled={fetchingInstagram || !instagramUrl.trim()}
                  size="sm"
                  className="min-h-[40px] sm:min-h-0 gap-1 bg-pink-500 hover:bg-pink-600 text-white shrink-0"
                >
                  {fetchingInstagram ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                  Fetch
                </Button>
              </div>
            </Card>

            {/* Or paste URLs manually */}
            <Card className="p-4 sm:p-3 space-y-2 border-dashed border-2 border-indigo-300 bg-indigo-50/30">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-semibold">Or Paste Media URLs</h2>
              </div>
              <p className="text-[10px] text-muted-foreground">
                One URL per line — direct image/video URLs.
              </p>
              <textarea
                value={mediaUrlsText}
                onChange={e => setMediaUrlsText(e.target.value)}
                placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg\nhttps://example.com/image3.jpg"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[80px] resize-none"
              />
              <Button
                onClick={autoFillCarouselCards}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 gap-1.5 border-indigo-300 text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="w-3 h-3" /> Auto-fill Cards
              </Button>
            </Card>

            {/* Carousel Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Cards ({carouselCards.length}/10)</h2>
                {carouselCards.length < 10 && (
                  <Button onClick={addCarouselCard} size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Card
                  </Button>
                )}
              </div>
              {carouselCards.map((card, i) => (
                <CarouselCardEditor
                  key={i}
                  card={card}
                  index={i}
                  mediaFormat={carouselFormat}
                  onChange={updated => {
                    const next = [...carouselCards]
                    next[i] = updated
                    setCarouselCards(next)
                  }}
                  onRemove={() => removeCarouselCard(i)}
                />
              ))}
            </div>
          </>
        )}

        {/* Preview Section */}
        <Card className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Preview</h2>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-[#128C7E] font-medium"
            >
              {showPreview ? "Hide" : "Show"} Preview
            </button>
          </div>
          {showPreview && (
            <div className="bg-[#e5ddd5] rounded-lg p-4 max-w-[320px] mx-auto">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Header preview */}
                {templateType !== "carousel" && headerFormat !== "NONE" && (
                  <div className="bg-gray-100 p-3 text-center">
                    {headerFormat === "TEXT" && <p className="text-sm font-semibold">{headerText || "Header text"}</p>}
                    {headerFormat === "IMAGE" && (
                      headerMediaUrl ? <img src={headerMediaUrl} alt="Header" className="w-full h-32 object-cover rounded" /> : <div className="h-32 flex items-center justify-center text-gray-400"><Image className="w-8 h-8" /></div>
                    )}
                    {headerFormat === "VIDEO" && <div className="h-32 flex items-center justify-center text-gray-400"><Video className="w-8 h-8" /></div>}
                    {headerFormat === "DOCUMENT" && <div className="h-16 flex items-center justify-center gap-2 text-gray-500"><File className="w-5 h-5" /><span className="text-xs">Document</span></div>}
                  </div>
                )}
                {/* Body preview */}
                <div className="p-3">
                  <p className="text-sm whitespace-pre-wrap">{
                    templateType === "carousel"
                      ? (carouselBodyText || "Carousel text here...")
                      : (bodyText || "Your message body here...")
                  }</p>
                </div>
                {/* Footer preview */}
                {footerText && templateType !== "carousel" && (
                  <div className="px-3 pb-2">
                    <p className="text-[10px] text-gray-500">{footerText}</p>
                  </div>
                )}
                {/* Buttons preview */}
                {templateType !== "carousel" && buttons.length > 0 && (
                  <div className="border-t divide-y">
                    {buttons.map((btn, i) => (
                      <div key={i} className="text-center py-2 text-sm text-[#128C7E] font-medium">
                        {btn.text || `Button ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Carousel cards preview */}
              {templateType === "carousel" && carouselCards.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                  {carouselCards.map((card, i) => (
                    <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden shrink-0 w-[200px]">
                      {card.header_url ? (
                        <img src={card.header_url} alt={`Card ${i + 1}`} className="w-full h-24 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <div className="h-24 bg-gray-100 flex items-center justify-center text-gray-400">
                          <Image className="w-6 h-6" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-xs">{card.body || `Card ${i + 1} body`}</p>
                      </div>
                      {card.buttons.length > 0 && (
                        <div className="border-t">
                          {card.buttons.map((btn, j) => (
                            <div key={j} className="text-center py-1.5 text-xs text-[#128C7E] font-medium">
                              {btn.text || "Button"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[9px] text-gray-500 text-right mt-1">Preview — actual rendering may vary</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
