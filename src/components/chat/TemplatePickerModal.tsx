import React, { useState, useEffect } from "react"
import { X, Send, Loader2, Search, AlertCircle, MessageSquare, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface TemplateComponent {
  type: string
  text?: string
  buttons?: Array<{
    type: string
    text: string
    flow_id?: string
    flow_action?: string
    navigate_screen?: string
    url?: string
    phone_number?: string
  }>
}

interface Template {
  name: string
  status: string
  language: string
  category: string
  components: TemplateComponent[]
}

interface TemplatePickerModalProps {
  open: boolean
  onClose: () => void
  phoneNumber: string
  onSent: () => void
}

export function TemplatePickerModal({ open, onClose, phoneNumber, onSent }: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Template | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})
  const [paramTypes, setParamTypes] = useState<Record<string, "text" | "date" | "time">>({})
  const [flowTokens, setFlowTokens] = useState<Record<number, string>>({})
  const [loadingContext, setLoadingContext] = useState(false)

  const TIME_SLOTS = [
    { id: "10-11", label: "10:00 AM – 11:00 AM" },
    { id: "11-12", label: "11:00 AM – 12:00 PM" },
    { id: "12-13", label: "12:00 PM – 1:00 PM" },
    { id: "14-15", label: "2:00 PM – 3:00 PM" },
    { id: "15-16", label: "3:00 PM – 4:00 PM" },
    { id: "16-17", label: "4:00 PM – 5:00 PM" },
    { id: "17-18", label: "5:00 PM – 6:00 PM" },
  ]

  // Auto-fill params from booking data when a template is selected (phoneNumber is known from chat context)
  useEffect(() => {
    if (!selected) return
    const paramNums = extractParams(selected.components)
    if (paramNums.length === 0) return
    setLoadingContext(true)
    fetch(`/api/send/booking-context/${phoneNumber.replace(/\D/g, "")}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: any) => {
        const next: Record<string, string> = {}
        if (paramNums.includes("1") && d.name) next["1"] = d.name
        if (paramNums.includes("2") && d.bookedDateFormatted) next["2"] = d.bookedDateFormatted
        if (paramNums.includes("3") && d.bookedSlotLabel) next["3"] = d.bookedSlotLabel
        if (paramNums.includes("4") && d.phoneNumber) next["4"] = `+${d.phoneNumber}`
        if (Object.keys(next).length > 0) setParams((p) => ({ ...p, ...next }))
      })
      .catch(() => {})
      .finally(() => setLoadingContext(false))
  }, [selected, phoneNumber])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d: any) => {
        setTemplates(d.data ?? [])
        if (d.error) setError(d.error)
      })
      .catch(() => setError("Could not load templates"))
      .finally(() => setLoading(false))
  }, [open])

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) &&
      t.status === "APPROVED"
  )

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

  function previewText(components: TemplateComponent[]): string {
    const body = components.find((c) => c.type === "BODY")
    return body?.text ?? ""
  }

  function hasFlowButtons(t: Template) {
    return getFlowButtons(t.components).length > 0
  }

  async function send() {
    if (!selected) return
    setSending(true)
    setSendError(null)
    try {
      const paramNums = extractParams(selected.components)
      const components: any[] = []

      // Media header component — auto-filled from template's stored URL
      const headerComp = selected.components.find((c) => c.type === "HEADER")
      const headerUrl = headerComp?.example?.header_handle?.[0]
      if (headerComp && (headerComp.format === "IMAGE" || headerComp.format === "VIDEO" || headerComp.format === "DOCUMENT") && headerUrl) {
        const mediaType = headerComp.format.toLowerCase()
        components.push({
          type: "header",
          parameters: [{
            type: mediaType,
            [mediaType]: { link: headerUrl },
          }],
        })
      }

      // Body parameters ({{1}}, {{2}}, etc.)
      if (paramNums.length > 0) {
        components.push({
          type: "body",
          parameters: paramNums.map((n) => {
            let text = params[n] ?? `{{${n}}}`
            // If this param is typed as date and stored as ISO, format for display
            if (paramTypes[n] === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
              text = new Date(text + "T00:00:00").toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })
            }
            return { type: "text", text }
          }),
        })
      }

      // Flow button components — REQUIRED when template has flow buttons
      const flowBtns = getFlowButtons(selected.components)
      for (const btn of flowBtns) {
        components.push({
          type: "button",
          sub_type: "flow",
          index: String(btn.idx),
          parameters: [
            {
              type: "action",
              action: {
                flow_token: flowTokens[btn.idx] || `token-${Date.now()}`,
              },
            },
          ],
        })
      }

      const res = await fetch("/api/send/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          templateName: selected.name,
          languageCode: selected.language,
          components: components.length > 0 ? components : undefined,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error ?? "Send failed")
      onSent()
    } catch (e: any) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:w-[480px] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <h2 className="font-bold text-base text-foreground">Send Template</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm focus:outline-none"
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Template List or Detail */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div className="p-4 space-y-4">
              <button
                onClick={() => { setSelected(null); setParams({}); setFlowTokens({}); setSendError(null) }}
                className="text-sm text-wa-teal hover:underline"
              >
                ← Back to templates
              </button>

              {/* Preview card */}
              <div className="bg-slate-50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-wa-teal" />
                  <span className="font-semibold text-sm">{selected.name}</span>
                  {hasFlowButtons(selected) && (
                    <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-1 shrink-0">
                      <Zap className="w-3 h-3" /> Flow
                    </span>
                  )}
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">{selected.status}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{previewText(selected.components)}</p>
                <p className="text-xs text-muted-foreground mt-2">Language: {selected.language} · {selected.category}</p>

                {/* Show flow buttons */}
                {getFlowButtons(selected.components).map((btn) => (
                  <div key={btn.idx} className="mt-2 border-t border-dashed pt-2">
                    <p className="text-xs text-purple-700 font-medium">
                      Flow button: "{btn.text}"
                      {btn.navigate_screen && <span className="font-normal text-muted-foreground"> → {btn.navigate_screen}</span>}
                    </p>
                  </div>
                ))}
              </div>

              {/* Auto-fill notice */}
              {loadingContext && (
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading booking data for +{phoneNumber}...
                </div>
              )}

              {/* Body params ({{1}}, {{2}}, etc.) */}
              {extractParams(selected.components).map((num) => {
                const type = paramTypes[num] ?? "text"
                const setType = (t: "text" | "date" | "time") =>
                  setParamTypes((p) => ({ ...p, [num]: t }))
                return (
                  <div key={num}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-600">
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
                                ? "bg-wa-teal text-white border-wa-teal"
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
                        <input
                          type="date"
                          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wa-teal/30"
                          value={params[num]?.match(/^\d{4}-\d{2}-\d{2}$/) ? params[num] : ""}
                          onChange={(e) => setParams((p) => ({ ...p, [num]: e.target.value }))}
                        />
                        {params[num]?.match(/^\d{4}-\d{2}-\d{2}$/) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Will be sent as: <strong>{new Date(params[num] + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>
                          </p>
                        )}
                      </>
                    ) : type === "time" ? (
                      <select
                        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wa-teal/30 bg-white"
                        value={params[num] ?? ""}
                        onChange={(e) => setParams((p) => ({ ...p, [num]: e.target.value }))}
                      >
                        <option value="">Pick a time slot...</option>
                        {TIME_SLOTS.map((s) => (
                          <option key={s.id} value={s.label}>{s.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wa-teal/30"
                        placeholder={`Value for {{${num}}}`}
                        value={params[num] ?? ""}
                        onChange={(e) => setParams((p) => ({ ...p, [num]: e.target.value }))}
                      />
                    )}
                  </div>
                )
              })}

              {/* Flow token inputs */}
              {getFlowButtons(selected.components).map((btn) => (
                <div key={btn.idx} className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-xs font-semibold text-purple-800">Flow Button: "{btn.text}"</span>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Flow Token <span className="font-normal text-slate-400">(optional — your reference ID for this send)</span>
                    </label>
                    <input
                      className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 bg-white"
                      placeholder={`e.g. lead-${Date.now()}`}
                      value={flowTokens[btn.idx] ?? ""}
                      onChange={(e) => setFlowTokens((t) => ({ ...t, [btn.idx]: e.target.value }))}
                      autoCorrect="off"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      This token is passed to your webhook when the user submits the flow, so you can identify which send triggered it. Leave blank to auto-generate.
                    </p>
                  </div>
                </div>
              ))}

              {sendError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {sendError}
                </div>
              )}

              <button
                onClick={send}
                disabled={sending}
                className="w-full py-3 bg-wa-teal hover:bg-wa-teal-dark text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send Template"}
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-wa-teal" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-10 text-center px-6 gap-2">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-sm font-medium text-slate-700">Templates unavailable</p>
              <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Your access token may need the <strong>whatsapp_business_management</strong> permission. Generate a token with this scope in Meta Business Suite → System Users.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-600">
                {query ? "No matching templates found." : "No approved templates found in your WhatsApp account."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((t) => (
                <button
                  key={t.name}
                  onClick={() => { setSelected(t); setParams({}); setFlowTokens({}); setSendError(null) }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-foreground">{t.name}</span>
                    {hasFlowButtons(t) && (
                      <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">
                        <Zap className="w-3 h-3" /> Flow
                      </span>
                    )}
                    <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">{t.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{previewText(t.components)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.language} · {t.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
