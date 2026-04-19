import React, { useState, useEffect, useRef } from "react"
import { Copy, CheckCircle2, Menu, X, ExternalLink, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const BASE_URL = typeof window !== "undefined"
  ? `https://${window.location.host}`
  : "https://whatsapp-dashboard-9lb.pages.dev"

const PRIMARY = "#128C7E"

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "errors", label: "Errors" },
  {
    id: "endpoints", label: "Endpoints", children: [
      { id: "send-text", label: "Send Text" },
      { id: "send-media", label: "Send Media" },
      { id: "send-media-upload", label: "Upload & Send" },
      { id: "send-template", label: "Send Template" },
      { id: "send-interactive", label: "Send Interactive" },
    ]
  },
  { id: "interactive-types", label: "Interactive Types" },
  { id: "template-components", label: "Template Components" },
  { id: "webhooks", label: "Webhooks" },
]

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) })
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [ids])
  return active
}

const ALL_IDS = NAV.flatMap(n => n.children ? [n.id, ...n.children.map(c => c.id)] : [n.id])

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-300 bg-gray-950 my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-400 font-mono">{lang}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
        </button>
      </div>
      <pre className="px-4 py-4 overflow-x-auto text-sm leading-6">
        <code className="text-green-300 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  )
}

function JsonBlock({ data }: { data: object }) {
  const [copied, setCopied] = useState(false)
  const str = JSON.stringify(data, null, 2)
  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-300 bg-gray-950 my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-400 font-mono">json</span>
        <button
          onClick={() => { navigator.clipboard.writeText(str); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
        </button>
      </div>
      <pre className="px-4 py-4 overflow-x-auto text-sm leading-6">
        <code className="text-blue-200 font-mono whitespace-pre">{str}</code>
      </pre>
    </div>
  )
}

function Badge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    POST: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    GET:  "bg-blue-50 text-blue-700 border border-blue-200",
  }
  return (
    <span className={cn("text-xs font-bold font-mono px-2 py-0.5 rounded", colors[method] ?? "bg-gray-100 text-gray-700")}>
      {method}
    </span>
  )
}

function Endpoint({ id, method, path, summary, description, children }: {
  id: string; method: string; path: string; summary: string; description?: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      <div className="flex items-center gap-3 mb-2">
        <Badge method={method} />
        <code className="text-lg font-mono text-gray-900">{path}</code>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{summary}</h2>
      {description && <p className="text-gray-600 mb-6 leading-relaxed">{description}</p>}
      {children}
    </section>
  )
}

function ParamTable({ params }: { params: { name: string; type: string; required?: boolean; description: string }[] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left border-b border-gray-200">
            <th className="px-4 py-3 font-semibold text-gray-700 font-mono">Parameter</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Type</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Required</th>
            <th className="px-4 py-3 font-semibold text-gray-700">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {params.map(p => (
            <tr key={p.name} className="hover:bg-gray-50/70">
              <td className="px-4 py-3 font-mono text-amber-700 whitespace-nowrap">{p.name}</td>
              <td className="px-4 py-3 font-mono text-blue-700 whitespace-nowrap text-xs">{p.type}</td>
              <td className="px-4 py-3">
                {p.required
                  ? <span className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded font-semibold">required</span>
                  : <span className="text-xs text-gray-400">optional</span>
                }
              </td>
              <td className="px-4 py-3 text-gray-600 leading-relaxed">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-800 mt-6 mb-2">{children}</h3>
}

function Divider() {
  return <hr className="border-gray-200 my-12" />
}

export default function DocsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const active = useActiveSection(ALL_IDS)

  useEffect(() => {
    const prev = {
      html: document.documentElement.style.backgroundColor,
      body: document.body.style.backgroundColor,
    }
    document.documentElement.style.backgroundColor = '#ffffff'
    document.body.style.backgroundColor = '#ffffff'
    return () => {
      document.documentElement.style.backgroundColor = prev.html
      document.body.style.backgroundColor = prev.body
    }
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setSidebarOpen(false)
  }

  const Sidebar = () => (
    <nav className="w-64 shrink-0">
      <div className="sticky top-24 overflow-y-auto max-h-[calc(100vh-6rem)] pr-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Documentation</p>
        <ul className="space-y-0.5">
          {NAV.map(item => (
            <li key={item.id}>
              <button
                onClick={() => scrollTo(item.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                  active === item.id
                    ? "bg-[#128C7E]/10 text-[#128C7E] font-semibold"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                {item.label}
              </button>
              {item.children && (
                <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
                  {item.children.map(child => (
                    <li key={child.id}>
                      <button
                        onClick={() => scrollTo(child.id)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors",
                          active === child.id
                            ? "text-[#128C7E] font-semibold"
                            : "text-gray-400 hover:text-gray-900"
                        )}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen text-gray-900" style={{ backgroundColor: '#ffffff' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(v => !v)}
            >
              {sidebarOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: PRIMARY }}>
                <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <span className="font-bold text-gray-900">WhatsApp Dashboard</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">API Reference</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              v1.0
            </span>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="bg-white w-72 border-r border-gray-200 p-6 overflow-y-auto mt-16">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex gap-12">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 max-w-3xl">

          {/* Overview */}
          <section id="overview" className="scroll-mt-24 mb-16">
            <div className="inline-flex items-center gap-2 text-xs text-[#128C7E] font-semibold uppercase tracking-wider mb-4 bg-[#128C7E]/10 border border-[#128C7E]/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#128C7E]" />
              REST API
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">WhatsApp Business API</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              Send WhatsApp messages — text, media, templates, and interactive messages — from any external system. Every call both delivers the message and logs it in your dashboard in real time.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 uppercase shrink-0">Base URL</span>
              <code className="text-[#128C7E] font-mono text-sm flex-1 truncate">{BASE_URL}</code>
              <button
                onClick={() => navigator.clipboard.writeText(BASE_URL)}
                className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </section>

          <Divider />

          {/* Authentication */}
          <section id="authentication" className="scroll-mt-24 mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Authentication</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Every request to a send endpoint must be authenticated. Two methods are supported — use whichever fits your integration.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">API Key <span className="text-xs text-gray-400">(recommended for external systems)</span></p>
                <p className="text-xs text-gray-600 leading-relaxed">Add an <code className="text-amber-700 bg-gray-100 px-1 rounded">Authorization</code> header to every request. Your API key is available in Settings → API Access.</p>
                <CodeBlock lang="http" code={`Authorization: Bearer wad_xxxxxxxxxxxxxx`} />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">Session Cookie <span className="text-xs text-gray-400">(browser / dashboard UI)</span></p>
                <p className="text-xs text-gray-600 leading-relaxed">Logged-in dashboard users are automatically authenticated via a secure httpOnly session cookie. No extra header needed for browser requests.</p>
              </div>
            </div>

            <SectionHeading>Getting your API key</SectionHeading>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm ml-1">
              <li>Log in to the dashboard as the super-admin.</li>
              <li>Go to <strong className="text-gray-900">Settings</strong> → scroll to <strong className="text-gray-900">API Access</strong>.</li>
              <li>Tap the eye icon to reveal the key, then copy it.</li>
              <li>You can regenerate the key at any time — the old key stops working immediately.</li>
            </ol>
          </section>

          <Divider />

          {/* Errors */}
          <section id="errors" className="scroll-mt-24 mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Errors</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Whenever a request fails, the API returns an HTTP error status code <strong className="text-gray-900">and</strong> a JSON body.
              The JSON body always has exactly one field — <code className="text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded text-sm font-mono">error</code> — with a human-readable description of what went wrong.
              This is true for <strong className="text-gray-900">every error status code</strong> listed below, without exception.
            </p>

            {/* Universal error envelope callout */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 mb-6 flex gap-4 items-start">
              <div className="text-amber-500 text-lg mt-0.5 shrink-0">⚠</div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-800">Same JSON shape for every error code</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Whether the server returns a <span className="font-mono font-bold text-rose-600">400</span>, <span className="font-mono font-bold text-rose-600">401</span>, <span className="font-mono font-bold text-rose-600">403</span>, <span className="font-mono font-bold text-rose-600">404</span>, <span className="font-mono font-bold text-rose-600">409</span>, <span className="font-mono font-bold text-rose-600">500</span>, or <span className="font-mono font-bold text-rose-600">503</span>, the response body is always:
                </p>
                <pre className="text-xs font-mono text-green-300 bg-gray-950 rounded-lg px-3 py-2 mt-2 border border-gray-800">
{`{ "error": "Human-readable description of the problem" }`}
                </pre>
                <p className="text-xs text-amber-600 mt-1">
                  Check the HTTP status code to branch your logic, then read <code className="font-mono text-amber-800 font-semibold">error</code> to show or log the reason.
                </p>
              </div>
            </div>

            {/* Status code table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left border-b border-gray-200">
                    <th className="px-4 py-3 font-semibold text-gray-700 w-24">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-28">Name</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">When it happens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { code: "400", name: "Bad Request",         desc: "A required field is missing, a value is the wrong type, or a limit is exceeded (e.g. text too long, invalid phone number)." },
                    { code: "401", name: "Unauthorized",        desc: "No credentials were provided, the session cookie has expired, or the API key is not recognised." },
                    { code: "403", name: "Forbidden",           desc: "Credentials are valid but the action is not permitted — e.g. non-admin calling an admin endpoint, or an IP not on the allowlist." },
                    { code: "404", name: "Not Found",           desc: "The resource you referenced doesn't exist — e.g. a conversation for a number that has never messaged you." },
                    { code: "409", name: "Conflict",            desc: "A duplicate entry was attempted — e.g. adding a phone number or IP address that is already registered." },
                    { code: "500", name: "Server Error",        desc: "An unhandled server exception, or WhatsApp's API returned an error (the exact Meta error message is forwarded in the error field)." },
                    { code: "503", name: "Service Unavailable", desc: "The WhatsApp API credentials (access token or phone number ID) are not set up in the server environment." },
                  ].map(({ code, name, desc }) => (
                    <tr key={code} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-rose-600">{code}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{name}</td>
                      <td className="px-4 py-3 text-gray-600 leading-relaxed">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Examples showing same shape across different codes */}
            <SectionHeading>Error response examples</SectionHeading>
            <p className="text-xs text-gray-500 mb-2">All are different status codes — all return the same <code className="font-mono text-amber-700 bg-amber-50 px-1 rounded">error</code> field.</p>
            <div className="space-y-2">
              {[
                { code: "HTTP 400", labelColor: "text-orange-500", body: '{ "error": "text exceeds the 4096-character limit (got 5100)" }' },
                { code: "HTTP 401", labelColor: "text-red-500",    body: '{ "error": "Invalid API key" }' },
                { code: "HTTP 403", labelColor: "text-red-500",    body: '{ "error": "IP address 203.0.113.42 is not on the allowlist." }' },
                { code: "HTTP 404", labelColor: "text-blue-600",   body: '{ "error": "Conversation not found" }' },
                { code: "HTTP 500", labelColor: "text-gray-500",   body: '{ "error": "Message failed to send because the number is not a WhatsApp account" }' },
              ].map(({ code, labelColor, body }) => (
                <div key={code} className="rounded-xl overflow-hidden border border-gray-300 bg-gray-950">
                  <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${labelColor}`}>{code}</span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-500 font-mono">json</span>
                  </div>
                  <pre className="px-4 py-3 text-sm font-mono text-blue-200 whitespace-pre-wrap">{body}</pre>
                </div>
              ))}
            </div>
          </section>

          <Divider />

          {/* ── SEND TEXT ── */}
          <section id="endpoints" className="scroll-mt-24">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Endpoints</h2>
          </section>

          <Endpoint
            id="send-text"
            method="POST"
            path="/api/send/text"
            summary="Send a text message"
            description="Send a plain text message to any WhatsApp number. The message is delivered immediately and logged in the dashboard."
          >
            <SectionHeading>Request body</SectionHeading>
            <ParamTable params={[
              { name: "phoneNumber", type: "string", required: true, description: "Recipient's WhatsApp number including country code, no + or spaces. E.g. 919876543210" },
              { name: "text", type: "string", required: true, description: "The message text (up to 4096 characters). URLs are automatically turned into previews." },
            ]} />
            <SectionHeading>Example</SectionHeading>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/text \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "text": "Hello from the API! 👋"
  }'`} />
            <SectionHeading>Response</SectionHeading>
            <JsonBlock data={{ ok: true, waMessageId: "wamid.HBgLOTE..." }} />
          </Endpoint>

          <Divider />

          {/* ── SEND MEDIA ── */}
          <Endpoint
            id="send-media"
            method="POST"
            path="/api/send/media"
            summary="Send media by URL"
            description="Send an image, video, audio, or document from a public URL. The file must be publicly reachable — WhatsApp will fetch it directly."
          >
            <SectionHeading>Request body</SectionHeading>
            <ParamTable params={[
              { name: "phoneNumber", type: "string", required: true, description: "Recipient's WhatsApp number including country code." },
              { name: "mediaType", type: '"image" | "video" | "audio" | "document"', required: true, description: "Type of media being sent." },
              { name: "mediaUrl", type: "string", required: true, description: "Publicly accessible URL of the media file." },
              { name: "caption", type: "string", description: 'Optional caption shown below the media. Supported for image, video, and document.' },
              { name: "filename", type: "string", description: 'Filename shown to the recipient. Only for mediaType "document".' },
            ]} />
            <SectionHeading>Image example</SectionHeading>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/media \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "mediaType": "image",
    "mediaUrl": "https://example.com/banner.jpg",
    "caption": "Check out our latest promo! 🎉"
  }'`} />
            <SectionHeading>Document / PDF example</SectionHeading>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/media \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "mediaType": "document",
    "mediaUrl": "https://example.com/invoice.pdf",
    "filename": "Invoice_001.pdf",
    "caption": "Your invoice is attached."
  }'`} />
            <SectionHeading>Response</SectionHeading>
            <JsonBlock data={{ ok: true, waMessageId: "wamid.HBgLOTE..." }} />
          </Endpoint>

          <Divider />

          {/* ── UPLOAD & SEND ── */}
          <Endpoint
            id="send-media-upload"
            method="POST"
            path="/api/send/media/upload"
            summary="Upload & send a file"
            description="Upload a local file directly — no need to host it anywhere first. Uses multipart/form-data. The file is uploaded to WhatsApp's media servers and then sent."
          >
            <SectionHeading>Form fields</SectionHeading>
            <ParamTable params={[
              { name: "phoneNumber", type: "string", required: true, description: "Recipient's WhatsApp number including country code." },
              { name: "file", type: "File (multipart)", required: true, description: "The file to upload and send. MIME type is auto-detected." },
              { name: "caption", type: "string", description: "Optional caption shown below the media." },
            ]} />
            <SectionHeading>Example</SectionHeading>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/media/upload \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -F "phoneNumber=919876543210" \\
  -F "caption=Your invoice is attached." \\
  -F "file=@/path/to/invoice.pdf"`} />
            <SectionHeading>Response</SectionHeading>
            <JsonBlock data={{ ok: true, waMessageId: "wamid.HBgLOTE...", mediaId: "1234567890" }} />
          </Endpoint>

          <Divider />

          {/* ── SEND TEMPLATE ── */}
          <Endpoint
            id="send-template"
            method="POST"
            path="/api/send/template"
            summary="Send a template message"
            description="Send a pre-approved WhatsApp Business template. Templates support variable substitution, media headers, and CTA / quick-reply buttons through the components array."
          >
            <SectionHeading>Request body</SectionHeading>
            <ParamTable params={[
              { name: "phoneNumber", type: "string", required: true, description: "Recipient's WhatsApp number including country code." },
              { name: "templateName", type: "string", required: true, description: "Exact name of the approved template as shown in WhatsApp Business Manager." },
              { name: "languageCode", type: "string", required: true, description: 'Language code of the template. E.g. "en", "en_US", "hi".' },
              { name: "components", type: "array", description: "Variable substitution and button parameters. See Template Components section below." },
            ]} />

            <SectionHeading>Basic template (no variables)</SectionHeading>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/template \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "templateName": "hello_world",
    "languageCode": "en_US"
  }'`} />

            <SectionHeading>Template with body variables</SectionHeading>
            <p className="text-sm text-gray-600 mb-2">Replace <code className="text-amber-700 bg-amber-50 px-1 rounded">{`{{1}}, {{2}}`}</code> … placeholders in the template body.</p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/template \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "templateName": "order_confirmation",
    "languageCode": "en",
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John Doe" },
          { "type": "text", "text": "ORD-98765" }
        ]
      }
    ]
  }'`} />

            <SectionHeading>Template with image header + body variable</SectionHeading>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/template \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "templateName": "promo_with_image",
    "languageCode": "en",
    "components": [
      {
        "type": "header",
        "parameters": [
          { "type": "image", "image": { "link": "https://example.com/banner.jpg" } }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "50% OFF" }
        ]
      }
    ]
  }'`} />

            <SectionHeading>Template with URL button (CTA)</SectionHeading>
            <p className="text-sm text-gray-600 mb-2">Fill in the dynamic URL suffix for a "Visit Website" button.</p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/template \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "templateName": "track_order",
    "languageCode": "en",
    "components": [
      {
        "type": "body",
        "parameters": [{ "type": "text", "text": "ORD-12345" }]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [{ "type": "text", "text": "ORD-12345" }]
      }
    ]
  }'`} />

            <SectionHeading>Response</SectionHeading>
            <JsonBlock data={{ ok: true, waMessageId: "wamid.HBgLOTE..." }} />
          </Endpoint>

          <Divider />

          {/* ── SEND INTERACTIVE ── */}
          <Endpoint
            id="send-interactive"
            method="POST"
            path="/api/send/interactive"
            summary="Send an interactive message"
            description="Send interactive messages with tappable buttons, scrollable lists, or URL CTA buttons. These are native WhatsApp UI elements — no links required."
          >
            <SectionHeading>Common parameters</SectionHeading>
            <ParamTable params={[
              { name: "phoneNumber", type: "string", required: true, description: "Recipient's WhatsApp number including country code." },
              { name: "type", type: '"button" | "list" | "cta_url"', required: true, description: "Interactive message subtype. See Interactive Types below for details." },
              { name: "body", type: "string", required: true, description: "Main message text displayed above the buttons or list." },
              { name: "header", type: "object", description: 'Optional header. Shape: { type: "text"|"image"|"video"|"document", text?: string, url?: string }' },
              { name: "footer", type: "string", description: "Optional small text shown below the buttons." },
              { name: "buttons", type: "array", description: 'For type "button" only. Array of { id, title } — up to 3 buttons.' },
              { name: "action", type: "object", description: 'For type "list" and "cta_url". Raw WhatsApp action object. See examples.' },
            ]} />
          </Endpoint>

          <Divider />

          {/* ── INTERACTIVE TYPES ── */}
          <section id="interactive-types" className="scroll-mt-24 mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Interactive Types</h2>
            <p className="text-gray-600 leading-relaxed mb-8">Detailed examples for each <code className="text-amber-700 bg-amber-50 px-1 rounded text-sm">type</code> value.</p>

            <div className="space-y-12">
              {/* Button */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg">"button"</span>
                  <span className="text-gray-500 text-sm">— Quick-reply buttons (up to 3)</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">Displays up to 3 tappable reply buttons. When the user taps one, their choice is sent back as a message you'll see in the dashboard.</p>
                <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/interactive \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "type": "button",
    "body": "Would you like to confirm your appointment?",
    "footer": "You can reschedule anytime",
    "buttons": [
      { "id": "confirm", "title": "✅ Confirm" },
      { "id": "reschedule", "title": "🗓 Reschedule" },
      { "id": "cancel", "title": "❌ Cancel" }
    ]
  }'`} />
                <p className="text-sm text-gray-600 mt-2 mb-3">With an image header:</p>
                <CodeBlock code={`{
  "phoneNumber": "919876543210",
  "type": "button",
  "header": { "type": "image", "url": "https://example.com/promo.jpg" },
  "body": "Choose your plan:",
  "buttons": [
    { "id": "basic", "title": "Basic — ₹299/mo" },
    { "id": "pro", "title": "Pro — ₹799/mo" }
  ]
}`} lang="json" />
              </div>

              {/* List */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg">"list"</span>
                  <span className="text-gray-500 text-sm">— Scrollable list with sections</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">Opens a full-screen scrollable list when the user taps the button. Great for menus, options, or FAQs. Up to 10 sections, 10 rows each.</p>
                <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/interactive \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "type": "list",
    "header": { "type": "text", "text": "Our Services" },
    "body": "Please select a service you need help with:",
    "footer": "We respond within 2 hours",
    "action": {
      "button": "View Services",
      "sections": [
        {
          "title": "Support",
          "rows": [
            { "id": "billing", "title": "Billing Issue", "description": "Invoice, payment, refund" },
            { "id": "technical", "title": "Technical Help", "description": "App or product issue" }
          ]
        },
        {
          "title": "Sales",
          "rows": [
            { "id": "pricing", "title": "Pricing Info", "description": "Plans and pricing" },
            { "id": "demo", "title": "Book a Demo", "description": "Schedule a live demo" }
          ]
        }
      ]
    }
  }'`} />
                <SectionHeading>action object schema (list)</SectionHeading>
                <ParamTable params={[
                  { name: "action.button", type: "string", required: true, description: "Label on the button that opens the list. Max 20 characters." },
                  { name: "action.sections", type: "array", required: true, description: "Array of section objects." },
                  { name: "section.title", type: "string", description: "Section heading. Required if there are 2+ sections." },
                  { name: "section.rows", type: "array", required: true, description: "Array of row objects." },
                  { name: "row.id", type: "string", required: true, description: "Unique ID for this row — sent back when the user selects it." },
                  { name: "row.title", type: "string", required: true, description: "Row label shown to the user. Max 24 characters." },
                  { name: "row.description", type: "string", description: "Optional subtitle below the row title. Max 72 characters." },
                ]} />
              </div>

              {/* CTA URL */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg">"cta_url"</span>
                  <span className="text-gray-500 text-sm">— Button that opens a website</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">Shows a single button that opens a URL in the user's browser. Works for all users (unlike template CTA buttons, no template approval needed for the URL itself).</p>
                <CodeBlock code={`curl -X POST ${BASE_URL}/api/send/interactive \\
  -H "Authorization: Bearer wad_xxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "919876543210",
    "type": "cta_url",
    "header": { "type": "text", "text": "Your Order is Ready 🎉" },
    "body": "Click below to track your delivery in real time.",
    "footer": "Estimated delivery: Today 3–5 PM",
    "action": {
      "name": "cta_url",
      "parameters": {
        "display_text": "Track My Order",
        "url": "https://example.com/track/ORD-12345"
      }
    }
  }'`} />
                <p className="text-sm text-gray-600 mt-2 mb-3">With a video header:</p>
                <CodeBlock code={`{
  "phoneNumber": "919876543210",
  "type": "cta_url",
  "header": { "type": "video", "url": "https://example.com/tour.mp4" },
  "body": "Watch the tour and sign up for 30% off.",
  "action": {
    "name": "cta_url",
    "parameters": {
      "display_text": "Sign Up Now",
      "url": "https://example.com/signup"
    }
  }
}`} lang="json" />
                <SectionHeading>action object schema (cta_url)</SectionHeading>
                <ParamTable params={[
                  { name: "action.name", type: '"cta_url"', required: true, description: 'Must always be the literal string "cta_url".' },
                  { name: "action.parameters.display_text", type: "string", required: true, description: "Label on the button. E.g. Track My Order." },
                  { name: "action.parameters.url", type: "string", required: true, description: "The URL to open. Must start with https://." },
                ]} />
              </div>
            </div>
          </section>

          <Divider />

          {/* ── TEMPLATE COMPONENTS ── */}
          <section id="template-components" className="scroll-mt-24 mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Template Components</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              The <code className="text-amber-700 bg-amber-50 px-1 rounded text-sm">components</code> array in <code className="text-amber-700 bg-amber-50 px-1 rounded text-sm">/api/send/template</code> maps directly to the WhatsApp Business API component format. Each component targets a named section of the template.
            </p>

            <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left border-b border-gray-200">
                    <th className="px-4 py-3 font-semibold text-gray-700">type</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">sub_type</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">parameters[].type</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Use case</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["header", "—", "text",     "Fill a text variable in the header"],
                    ["header", "—", "image",    "Set the header image (link)"],
                    ["header", "—", "video",    "Set the header video (link)"],
                    ["header", "—", "document", "Set the header document (link + filename)"],
                    ["body",   "—", "text",     "Fill {{1}}, {{2}} … variables in the body"],
                    ["button", "url",        "text",    "Fill the dynamic URL suffix for a CTA button"],
                    ["button", "quick_reply", "payload", "Set the payload for a quick-reply button"],
                  ].map(([type, sub, param, use]) => (
                    <tr key={`${type}-${sub}-${param}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-amber-700">{type}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{sub}</td>
                      <td className="px-4 py-3 font-mono text-[#128C7E]">{param}</td>
                      <td className="px-4 py-3 text-gray-600">{use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SectionHeading>Document header example</SectionHeading>
            <JsonBlock data={{
              type: "header",
              parameters: [
                { type: "document", document: { link: "https://example.com/invoice.pdf", filename: "Invoice.pdf" } }
              ]
            }} />

            <SectionHeading>URL button (index 0)</SectionHeading>
            <JsonBlock data={{
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: "ORD-12345" }]
            }} />
          </section>

          <Divider />

          {/* ── WEBHOOKS ── */}
          <section id="webhooks" className="scroll-mt-24 mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Webhooks (Inbound)</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Incoming WhatsApp messages are received automatically via a webhook that you register with Meta. No action is needed — the dashboard handles this for you.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 uppercase shrink-0">Webhook URL</span>
              <code className="text-[#128C7E] font-mono text-sm flex-1 truncate">{BASE_URL}/api/webhook</code>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left border-b border-gray-200">
                    <th className="px-4 py-3 font-semibold text-gray-700">Method</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Auth required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3"><Badge method="GET" /></td>
                    <td className="px-4 py-3 text-gray-600">WhatsApp verification challenge</td>
                    <td className="px-4 py-3 text-gray-400">No (public)</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3"><Badge method="POST" /></td>
                    <td className="px-4 py-3 text-gray-600">Receive inbound messages & status updates</td>
                    <td className="px-4 py-3 text-gray-400">No (public)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Set this URL in your Meta App → WhatsApp → Configuration → Webhook. Subscribe to the <code className="text-amber-700 bg-amber-50 px-1 rounded">messages</code> field.
            </p>
          </section>

          {/* Footer */}
          <div className="pt-8 pb-16 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-400">
              WhatsApp Business Dashboard API Reference · Built on the{" "}
              <a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-900 underline transition-colors inline-flex items-center gap-1">
                WhatsApp Cloud API <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
