import React from "react"
import { Copy, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface ApiReferenceProps {
  apiKey: string
  domain: string
}

interface Tab {
  id: string
  label: string
}

const TABS: Tab[] = [
  { id: "text",        label: "Text" },
  { id: "media",       label: "Media" },
  { id: "template",    label: "Template" },
  { id: "interactive", label: "Interactive" },
  { id: "errors",      label: "Errors" },
]

function CodeBlock({ code, id, copied, onCopy }: { code: string; id: string; copied: string | null; onCopy: (id: string, text: string) => void }) {
  return (
    <div className="relative bg-gray-900 rounded-lg px-3 py-3 overflow-x-auto group">
      <code className="text-xs text-green-400 whitespace-pre font-mono block leading-5">{code}</code>
      <button
        onClick={() => onCopy(id, code)}
        className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
        title="Copy"
      >
        {copied === id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

function Example({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2 border-t bg-gray-50/50">{children}</div>}
    </div>
  )
}

// ── Error reference sub-components ────────────────────────────────────────────

interface ErrorRow {
  code: number
  message: string
  trigger: string
}

interface ErrorGroup {
  title: string
  color: "red" | "orange" | "purple" | "blue" | "gray"
  rows: ErrorRow[]
}

const ERROR_GROUPS: ErrorGroup[] = [
  {
    title: "400 — Bad Request (Validation)",
    color: "orange",
    rows: [
      // Universal
      { code: 400, message: "phoneNumber and text are required",                    trigger: "POST /send/text" },
      { code: 400, message: "phoneNumber, mediaType, and mediaUrl are required",    trigger: "POST /send/media" },
      { code: 400, message: "phoneNumber and file are required",                    trigger: "POST /send/media/upload" },
      { code: 400, message: "phoneNumber and templateName are required",            trigger: "POST /send/template" },
      { code: 400, message: "phoneNumber, type, and body are required",             trigger: "POST /send/interactive" },
      { code: 400, message: "phoneNumber, messageId, and emoji are required",       trigger: "POST /send/reaction" },
      { code: 400, message: "phoneNumber, latitude, and longitude are required",    trigger: "POST /send/location" },
      // Phone format
      { code: 400, message: 'phoneNumber must be 7–15 digits (E.164 without +), got "{value}"', trigger: "All /send/* and profile endpoints" },
      // Field limits
      { code: 400, message: "text exceeds the 4096-character limit (got {n})",      trigger: "POST /send/text" },
      { code: 400, message: "caption exceeds the 1024-character limit (got {n})",   trigger: "POST /send/media" },
      { code: 400, message: "templateName exceeds the 512-character limit (got {n})", trigger: "POST /send/template" },
      { code: 400, message: "body exceeds the 1024-character limit (got {n})",      trigger: "POST /send/interactive" },
      { code: 400, message: "footer exceeds the 60-character limit (got {n})",      trigger: "POST /send/interactive" },
      { code: 400, message: 'button title "{title}" exceeds the 20-character limit (got {n})', trigger: "POST /send/interactive (button type)" },
      // Enum / type errors
      { code: 400, message: "mediaType must be one of: image, video, audio, document",  trigger: "POST /send/media" },
      { code: 400, message: "type must be 'button', 'list', or 'cta_url'",              trigger: "POST /send/interactive" },
      { code: 400, message: "buttons array is required for type 'button'",               trigger: "POST /send/interactive" },
      { code: 400, message: "action object is required for type 'list'",                 trigger: "POST /send/interactive" },
      { code: 400, message: "action object is required for type 'cta_url'",              trigger: "POST /send/interactive" },
      // Location range
      { code: 400, message: "latitude must be a number between -90 and 90",         trigger: "POST /send/location" },
      { code: 400, message: "longitude must be a number between -180 and 180",       trigger: "POST /send/location" },
      // Admin
      { code: 400, message: "phoneNumber is required",                               trigger: "POST /admin/users" },
      { code: 400, message: "Invalid phone number",                                  trigger: "POST /admin/users" },
      { code: 400, message: "ip is required",                                        trigger: "POST /admin/ip-allowlist" },
      { code: 400, message: "Invalid IP address or CIDR range (e.g. 1.2.3.4 or 10.0.0.0/8)", trigger: "POST /admin/ip-allowlist" },
      { code: 400, message: "enabled (boolean) is required",                         trigger: "PATCH /admin/ip-allowlist/:id" },
    ],
  },
  {
    title: "401 — Unauthorized (Authentication)",
    color: "red",
    rows: [
      { code: 401, message: "Not authenticated",   trigger: "Any endpoint — no cookie or Bearer token in the request" },
      { code: 401, message: "Session expired",     trigger: "Any endpoint — the session cookie exists but has expired" },
      { code: 401, message: "Invalid API key",     trigger: "Any endpoint — Bearer token is not recognised in the database" },
    ],
  },
  {
    title: "403 — Forbidden (Authorisation)",
    color: "red",
    rows: [
      { code: 403, message: "IP address {ip} is not on the allowlist. Add it in Settings → API Access → IP Allowlist.", trigger: "Any endpoint using Bearer token auth when the IP allowlist is non-empty" },
      { code: 403, message: "Super admin access required",  trigger: "Any /admin/* endpoint called without super-admin role" },
      { code: 403, message: "Cannot remove super admin",    trigger: "DELETE /admin/users/:phone — target user is a super admin" },
    ],
  },
  {
    title: "404 — Not Found",
    color: "blue",
    rows: [
      { code: 404, message: "Conversation not found",   trigger: "GET /conversations/:phone, PATCH /conversations/:phone/read, GET|PATCH /conversations/:phone/profile" },
      { code: 404, message: "Message not found",        trigger: "GET /messages/:waMessageId/status" },
      { code: 404, message: "User not found",           trigger: "DELETE /admin/users/:phone" },
      { code: 404, message: "Entry not found",          trigger: "PATCH /admin/ip-allowlist/:id, DELETE /admin/ip-allowlist/:id" },
    ],
  },
  {
    title: "409 — Conflict (Duplicate)",
    color: "purple",
    rows: [
      { code: 409, message: "This number is already authorised",    trigger: "POST /admin/users — phone already in the allowed-users list" },
      { code: 409, message: "This IP is already in the allowlist",  trigger: "POST /admin/ip-allowlist — IP already exists (enabled or disabled)" },
    ],
  },
  {
    title: "500 — Internal Server Error",
    color: "gray",
    rows: [
      { code: 500, message: "{WhatsApp API error message}",  trigger: "Any /send/* endpoint — Meta returned an error (e.g. invalid template, unreachable number, rate limit). The exact Meta error string is forwarded." },
      { code: 500, message: "{exception message}",           trigger: "Any endpoint — unhandled server exception (database failure, network timeout, etc.)" },
    ],
  },
  {
    title: "503 — Service Unavailable",
    color: "gray",
    rows: [
      { code: 503, message: "WhatsApp API credentials not configured",  trigger: "All /send/* endpoints — WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID environment variables are missing on the server" },
    ],
  },
]

const COLOR_MAP = {
  red:    { badge: "bg-red-100 text-red-700",    header: "bg-red-50 border-red-200",    dot: "bg-red-400" },
  orange: { badge: "bg-orange-100 text-orange-700", header: "bg-orange-50 border-orange-200", dot: "bg-orange-400" },
  purple: { badge: "bg-purple-100 text-purple-700", header: "bg-purple-50 border-purple-200", dot: "bg-purple-400" },
  blue:   { badge: "bg-blue-100 text-blue-700",  header: "bg-blue-50 border-blue-200",  dot: "bg-blue-400" },
  gray:   { badge: "bg-gray-100 text-gray-700",  header: "bg-gray-50 border-gray-200",  dot: "bg-gray-400" },
}

function ErrorGroup({ group }: { group: ErrorGroup }) {
  const [open, setOpen] = React.useState(false)
  const c = COLOR_MAP[group.color]
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className={cn("w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors", open ? c.header : "hover:bg-gray-50")}
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-xs font-semibold text-gray-800">{group.title}</span>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", c.badge)}>
            {group.rows.length} {group.rows.length === 1 ? "case" : "cases"}
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        </div>
      </button>
      {open && (
        <div className="divide-y border-t">
          {group.rows.map((row, i) => (
            <div key={i} className="px-3 py-2.5 flex gap-2.5 items-start">
              <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", c.dot)} />
              <div className="space-y-0.5 min-w-0">
                <code className="text-[11px] font-mono text-gray-800 break-words leading-tight block">
                  "{row.message}"
                </code>
                <p className="text-[11px] text-muted-foreground leading-snug">{row.trigger}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function ApiReference({ apiKey, domain }: ApiReferenceProps) {
  const [activeTab, setActiveTab] = React.useState("text")
  const [copied, setCopied] = React.useState<string | null>(null)

  const onCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const H = `Authorization: Bearer ${apiKey}`
  const CT = `Content-Type: application/json`
  const BASE = `https://${domain}/api`

  const curl = (method: string, path: string, body?: object) => {
    const bodyStr = body ? ` \\\n  -d '${JSON.stringify(body, null, 2).replace(/'/g, "\\'")}'` : ""
    return `curl -X ${method} ${BASE}${path} \\\n  -H "${H}" \\\n  -H "${CT}"${bodyStr}`
  }

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Text ── */}
      {activeTab === "text" && (
        <div className="space-y-2">
          <Example title="Send a text message" description="Plain text with optional preview URL">
            <p className="text-xs text-muted-foreground pt-3">Simple text</p>
            <CodeBlock id="text-simple" copied={copied} onCopy={onCopy} code={curl("POST", "/send/text", {
              phoneNumber: "919XXXXXXXXX",
              text: "Hello from the API!"
            })} />
            <p className="text-xs text-muted-foreground pt-1">With link preview</p>
            <CodeBlock id="text-link" copied={copied} onCopy={onCopy} code={curl("POST", "/send/text", {
              phoneNumber: "919XXXXXXXXX",
              text: "Check this out: https://example.com"
            })} />
          </Example>
        </div>
      )}

      {/* ── Media ── */}
      {activeTab === "media" && (
        <div className="space-y-2">
          <Example title="Send image" description="Image by public URL, with optional caption">
            <p className="text-xs text-muted-foreground pt-3">Image with caption</p>
            <CodeBlock id="media-image" copied={copied} onCopy={onCopy} code={curl("POST", "/send/media", {
              phoneNumber: "919XXXXXXXXX",
              mediaType: "image",
              mediaUrl: "https://example.com/photo.jpg",
              caption: "Check out this photo!"
            })} />
          </Example>
          <Example title="Send video" description="Video by public URL, with optional caption">
            <CodeBlock id="media-video" copied={copied} onCopy={onCopy} code={curl("POST", "/send/media", {
              phoneNumber: "919XXXXXXXXX",
              mediaType: "video",
              mediaUrl: "https://example.com/video.mp4",
              caption: "Watch this!"
            })} />
          </Example>
          <Example title="Send document / PDF" description="Document with filename shown to recipient">
            <CodeBlock id="media-doc" copied={copied} onCopy={onCopy} code={curl("POST", "/send/media", {
              phoneNumber: "919XXXXXXXXX",
              mediaType: "document",
              mediaUrl: "https://example.com/invoice.pdf",
              filename: "Invoice_001.pdf"
            })} />
          </Example>
          <Example title="Send audio" description="Audio note (mp3, ogg, etc.)">
            <CodeBlock id="media-audio" copied={copied} onCopy={onCopy} code={curl("POST", "/send/media", {
              phoneNumber: "919XXXXXXXXX",
              mediaType: "audio",
              mediaUrl: "https://example.com/note.mp3"
            })} />
          </Example>
          <Example title="Upload & send a file" description="Upload a local file directly — no need to host it">
            <p className="text-xs text-muted-foreground pt-3">Use multipart/form-data</p>
            <CodeBlock id="media-upload" copied={copied} onCopy={onCopy} code={`curl -X POST ${BASE}/send/media/upload \\
  -H "${H}" \\
  -F "phoneNumber=919XXXXXXXXX" \\
  -F "caption=See attached" \\
  -F "file=@/path/to/your/file.pdf"`} />
          </Example>
        </div>
      )}

      {/* ── Template ── */}
      {activeTab === "template" && (
        <div className="space-y-2">
          <Example title="Basic template" description="Send an approved template with no variable substitution">
            <CodeBlock id="tpl-basic" copied={copied} onCopy={onCopy} code={curl("POST", "/send/template", {
              phoneNumber: "919XXXXXXXXX",
              templateName: "hello_world",
              languageCode: "en_US"
            })} />
          </Example>
          <Example title="Template with body variables" description="Replace {{1}}, {{2}} … placeholders in the body">
            <CodeBlock id="tpl-vars" copied={copied} onCopy={onCopy} code={curl("POST", "/send/template", {
              phoneNumber: "919XXXXXXXXX",
              templateName: "order_confirmation",
              languageCode: "en",
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: "John Doe" },
                    { type: "text", text: "ORD-98765" }
                  ]
                }
              ]
            })} />
          </Example>
          <Example title="Template with image header" description="Template where the header is an image">
            <CodeBlock id="tpl-img-header" copied={copied} onCopy={onCopy} code={curl("POST", "/send/template", {
              phoneNumber: "919XXXXXXXXX",
              templateName: "promo_with_image",
              languageCode: "en",
              components: [
                {
                  type: "header",
                  parameters: [
                    { type: "image", image: { link: "https://example.com/banner.jpg" } }
                  ]
                },
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: "50% OFF" }
                  ]
                }
              ]
            })} />
          </Example>
          <Example title="Template with video header" description="Template where the header is a video">
            <CodeBlock id="tpl-video-header" copied={copied} onCopy={onCopy} code={curl("POST", "/send/template", {
              phoneNumber: "919XXXXXXXXX",
              templateName: "product_demo",
              languageCode: "en",
              components: [
                {
                  type: "header",
                  parameters: [
                    { type: "video", video: { link: "https://example.com/demo.mp4" } }
                  ]
                }
              ]
            })} />
          </Example>
          <Example title="Template with document header" description="Template where the header is a PDF/document">
            <CodeBlock id="tpl-doc-header" copied={copied} onCopy={onCopy} code={curl("POST", "/send/template", {
              phoneNumber: "919XXXXXXXXX",
              templateName: "invoice_template",
              languageCode: "en",
              components: [
                {
                  type: "header",
                  parameters: [
                    { type: "document", document: { link: "https://example.com/invoice.pdf", filename: "Invoice.pdf" } }
                  ]
                },
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: "₹1,250.00" }
                  ]
                }
              ]
            })} />
          </Example>
          <Example title="Template with URL button (CTA)" description="Fill the URL variable in a CTA button">
            <CodeBlock id="tpl-cta-url" copied={copied} onCopy={onCopy} code={curl("POST", "/send/template", {
              phoneNumber: "919XXXXXXXXX",
              templateName: "track_order",
              languageCode: "en",
              components: [
                {
                  type: "body",
                  parameters: [{ type: "text", text: "ORD-12345" }]
                },
                {
                  type: "button",
                  sub_type: "url",
                  index: "0",
                  parameters: [{ type: "text", text: "ORD-12345" }]
                }
              ]
            })} />
          </Example>
          <Example title="Template with OTP (copy-code button)" description="Send an OTP via copy-code button template">
            <CodeBlock id="tpl-otp" copied={copied} onCopy={onCopy} code={curl("POST", "/send/template", {
              phoneNumber: "919XXXXXXXXX",
              templateName: "hoblix_otp_verification",
              languageCode: "en",
              components: [
                {
                  type: "body",
                  parameters: [{ type: "text", text: "483921" }]
                },
                {
                  type: "button",
                  sub_type: "url",
                  index: "0",
                  parameters: [{ type: "text", text: "483921" }]
                }
              ]
            })} />
          </Example>
        </div>
      )}

      {/* ── Interactive ── */}
      {activeTab === "interactive" && (
        <div className="space-y-2">
          <Example title="Reply buttons" description="Up to 3 quick-reply buttons the user can tap">
            <CodeBlock id="int-buttons" copied={copied} onCopy={onCopy} code={curl("POST", "/send/interactive", {
              phoneNumber: "919XXXXXXXXX",
              type: "button",
              body: "Would you like to confirm your appointment?",
              footer: "You can reschedule anytime",
              buttons: [
                { id: "confirm", title: "✅ Confirm" },
                { id: "reschedule", title: "🗓 Reschedule" },
                { id: "cancel", title: "❌ Cancel" }
              ]
            })} />
          </Example>
          <Example title="Reply buttons with image header" description="Add an image above the button message">
            <CodeBlock id="int-buttons-img" copied={copied} onCopy={onCopy} code={curl("POST", "/send/interactive", {
              phoneNumber: "919XXXXXXXXX",
              type: "button",
              header: { type: "image", url: "https://example.com/promo.jpg" },
              body: "Choose your plan:",
              buttons: [
                { id: "basic", title: "Basic — ₹299/mo" },
                { id: "pro", title: "Pro — ₹799/mo" }
              ]
            })} />
          </Example>
          <Example title="List message" description="Scrollable list with sections and rows — good for menus">
            <CodeBlock id="int-list" copied={copied} onCopy={onCopy} code={curl("POST", "/send/interactive", {
              phoneNumber: "919XXXXXXXXX",
              type: "list",
              header: { type: "text", text: "Our Services" },
              body: "Please select a service you need help with:",
              footer: "We'll respond within 2 hours",
              action: {
                button: "View Services",
                sections: [
                  {
                    title: "Support",
                    rows: [
                      { id: "billing", title: "Billing Issue", description: "Invoice, payment, refund" },
                      { id: "technical", title: "Technical Help", description: "App or product issue" }
                    ]
                  },
                  {
                    title: "Sales",
                    rows: [
                      { id: "pricing", title: "Pricing Info", description: "Plans and pricing" },
                      { id: "demo", title: "Book a Demo", description: "Schedule a live demo" }
                    ]
                  }
                ]
              }
            })} />
          </Example>
          <Example title="CTA URL button" description="A single button that opens a website — works for all users">
            <CodeBlock id="int-cta-url" copied={copied} onCopy={onCopy} code={curl("POST", "/send/interactive", {
              phoneNumber: "919XXXXXXXXX",
              type: "cta_url",
              header: { type: "text", text: "Your Order is Ready 🎉" },
              body: "Click below to track your delivery in real time.",
              footer: "Estimated delivery: Today 3–5 PM",
              action: {
                name: "cta_url",
                parameters: {
                  display_text: "Track My Order",
                  url: "https://example.com/track/ORD-12345"
                }
              }
            })} />
          </Example>
          <Example title="CTA URL with video header" description="Video header + a website button">
            <CodeBlock id="int-cta-video" copied={copied} onCopy={onCopy} code={curl("POST", "/send/interactive", {
              phoneNumber: "919XXXXXXXXX",
              type: "cta_url",
              header: { type: "video", url: "https://example.com/product-tour.mp4" },
              body: "Watch the tour and sign up today for 30% off.",
              action: {
                name: "cta_url",
                parameters: {
                  display_text: "Sign Up Now",
                  url: "https://example.com/signup"
                }
              }
            })} />
          </Example>
        </div>
      )}

      {/* ── Errors ── */}
      {activeTab === "errors" && (
        <div className="space-y-3">

          {/* Error envelope */}
          <div className="rounded-lg border bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#128C7E] shrink-0" />
              <p className="text-xs font-semibold text-gray-800">Error Response Shape</p>
            </div>
            <p className="text-xs text-muted-foreground">Every error — regardless of status code — returns a single JSON object:</p>
            <div className="bg-gray-900 rounded-lg px-3 py-2.5">
              <code className="text-xs text-green-400 font-mono whitespace-pre">{`{ "error": "Human-readable description" }`}</code>
            </div>
            <p className="text-xs text-muted-foreground">
              Successful responses return <code className="font-mono bg-gray-200 px-1 rounded text-[10px]">{"{ \"ok\": true, \"waMessageId\": \"wamid.xxx\" }"}</code> for send endpoints,
              or the requested resource object for GET/PATCH endpoints.
            </p>
          </div>

          {/* HTTP code quick-reference */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <p className="text-xs font-semibold text-gray-800">HTTP Status Code Summary</p>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y">
                {[
                  { code: "400", color: "text-orange-600 bg-orange-50", label: "Bad Request",         desc: "Missing required fields, failed validation, or out-of-range values." },
                  { code: "401", color: "text-red-600 bg-red-50",       label: "Unauthorized",        desc: "No credentials supplied, session expired, or API key not recognised." },
                  { code: "403", color: "text-red-600 bg-red-50",       label: "Forbidden",           desc: "Valid credentials but insufficient permissions, or IP not on allowlist." },
                  { code: "404", color: "text-blue-600 bg-blue-50",     label: "Not Found",           desc: "The requested conversation, message, user, or IP entry does not exist." },
                  { code: "409", color: "text-purple-600 bg-purple-50", label: "Conflict",            desc: "Attempted to create a duplicate entry (phone number or IP address)." },
                  { code: "500", color: "text-gray-600 bg-gray-50",     label: "Server Error",        desc: "Unhandled exception or a WhatsApp API error forwarded verbatim." },
                  { code: "503", color: "text-gray-600 bg-gray-50",     label: "Service Unavailable", desc: "WhatsApp credentials missing from server environment variables." },
                ].map(row => (
                  <tr key={row.code} className="hover:bg-gray-50/50">
                    <td className="pl-3 pr-2 py-2 w-12">
                      <span className={cn("font-mono font-bold text-[11px] px-1.5 py-0.5 rounded", row.color)}>{row.code}</span>
                    </td>
                    <td className="pr-2 py-2 w-32 font-medium text-gray-700 whitespace-nowrap">{row.label}</td>
                    <td className="pr-3 py-2 text-muted-foreground leading-snug">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed error catalog */}
          <p className="text-xs font-semibold text-gray-700 px-0.5">Exact error strings by category</p>
          <div className="space-y-2">
            {ERROR_GROUPS.map((group) => (
              <ErrorGroup key={group.title} group={group} />
            ))}
          </div>

          <p className="text-xs text-muted-foreground px-0.5 leading-relaxed">
            Strings in <code className="font-mono bg-gray-100 px-1 rounded text-[10px]">{"{"} curly braces {"}"}</code> are runtime values substituted by the server — e.g.&nbsp;
            <code className="font-mono bg-gray-100 px-1 rounded text-[10px]">{"{value}"}</code> is the actual phone string you sent.
          </p>
        </div>
      )}

      {activeTab !== "errors" && (
        <p className="text-xs text-muted-foreground px-1">
          Replace <code className="font-mono bg-gray-100 px-1 rounded">919XXXXXXXXX</code> with the recipient's number (country code + number, no +). All endpoints require a valid session cookie or the API key shown above.
        </p>
      )}
    </div>
  )
}
