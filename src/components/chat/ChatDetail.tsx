import React, { useEffect, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, MoreVertical, Search, Send, Paperclip, Smile, Mic, Image as ImageIcon, Video, FileText, X, User, ChevronRight, AlertCircle, Loader2, UploadCloud } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { MessageBubble } from "./MessageBubble"
import type { Message, Conversation } from "../../lib/api-client"
import { CustomerProfileDrawer } from "./CustomerProfileDrawer"
import { TemplatePickerModal } from "./TemplatePickerModal"

// ── Date divider helpers (WhatsApp-style) ────────────────────────────────
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function shouldShowDateDivider(messages: Message[], index: number): boolean {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].timestamp as any)
  const curr = new Date(messages[index].timestamp as any)
  return !isSameDay(prev, curr)
}

function formatDateDivider(ts: any): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)

  if (isSameDay(d, today)) return "TODAY"
  if (isSameDay(d, yesterday)) return "YESTERDAY"

  const daysDiff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase()
  }
  // Older — show full date like "11 APRIL 2026"
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }).toUpperCase()
}

interface ChatDetailProps {
  phoneNumber: string;
  messages: Message[];
  conversation?: Conversation;
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface PendingFile {
  file: File;
  preview: string | null;
  caption: string;
}

export function ChatDetail({ phoneNumber, messages, conversation, isLoading, onRefresh }: ChatDetailProps) {
  const [_, setLocation] = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [uploadAccept, setUploadAccept] = useState("*/*")

  const displayName = conversation?.contactName || phoneNumber

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [text])

  async function sendText() {
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch("/api/send/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, text: trimmed }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error ?? "Send failed")
      setText("")
      onRefresh?.()
    } catch (e: any) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  async function sendFile() {
    if (!pendingFile) return
    setSending(true)
    setSendError(null)
    try {
      const form = new FormData()
      form.append("phoneNumber", phoneNumber)
      form.append("file", pendingFile.file)
      if (pendingFile.caption.trim()) form.append("caption", pendingFile.caption.trim())

      const res = await fetch("/api/send/media/upload", { method: "POST", body: form })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      setPendingFile(null)
      onRefresh?.()
    } catch (e: any) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendText()
    }
  }

  function openFilePicker(accept: string) {
    setUploadAccept(accept)
    setShowAttachMenu(false)
    setSendError(null)
    // trigger on next tick so accept is applied
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const isImage = file.type.startsWith("image/")
    const preview = isImage ? URL.createObjectURL(file) : null
    setPendingFile({ file, preview, caption: "" })
  }

  return (
    <div className="flex flex-col h-full bg-wa-bg relative overflow-hidden">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 z-0 opacity-[0.4]"
        style={{
          backgroundImage: `url('${import.meta.env.BASE_URL}images/chat-bg.png')`,
          backgroundSize: "400px",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Header */}
      <div className="h-[60px] bg-slate-50 flex items-center justify-between px-2 sm:px-4 border-b border-border z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            onClick={() => setLocation("/")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-200 lg:hidden text-slate-600 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-80 transition-opacity"
          >
            <Avatar fallback={displayName} className="w-10 h-10 shrink-0" />
            <div className="flex flex-col text-left min-w-0">
              <h2 className="font-semibold text-[15px] leading-tight text-foreground truncate max-w-[150px] sm:max-w-[250px]">
                {displayName}
              </h2>
              <span className="text-xs text-muted-foreground truncate">{phoneNumber}</span>
            </div>
          </button>
        </div>

        <div className="flex items-center text-slate-500 gap-1">
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            title="Customer Profile"
          >
            <User className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 sm:px-8 py-4 z-10 flex flex-col scroll-smooth"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-sm text-sm text-slate-600">
              Loading messages...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-yellow-100/90 text-yellow-800 px-4 py-2 rounded-lg text-sm max-w-sm text-center shadow-sm backdrop-blur">
              Send a message to start the conversation.
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="bg-white/90 backdrop-blur text-slate-600 text-xs px-3 py-1.5 rounded-lg shadow-sm font-medium uppercase tracking-wider">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>

            <div className="text-center mb-6">
              <span className="bg-yellow-100/90 backdrop-blur text-yellow-800 text-[12.5px] px-4 py-2 rounded-lg shadow-sm inline-block max-w-[85%] leading-relaxed">
                Messages are end-to-end encrypted.
              </span>
            </div>

            {messages.map((msg, i) => {
              const showDivider = shouldShowDateDivider(messages, i)
              return (
                <React.Fragment key={msg.id}>
                  {showDivider && (
                    <div className="text-center my-4">
                      <span className="bg-white/90 backdrop-blur text-slate-600 text-[11px] font-medium px-3 py-1 rounded-md shadow-sm inline-block">
                        {formatDateDivider(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <MessageBubble message={msg} />
                </React.Fragment>
              )
            })}
          </>
        )}
      </div>

      {/* Error Banner */}
      {sendError && (
        <div className="z-10 mx-3 mb-1 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{sendError}</span>
          <button onClick={() => setSendError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* File Preview Panel */}
      {pendingFile && (
        <div className="z-10 mx-3 mb-1 bg-white border border-border rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" />
              {pendingFile.file.type.startsWith("image/") ? "Image" : pendingFile.file.type.startsWith("video/") ? "Video" : "Document"}
            </span>
            <span className="text-xs text-slate-400 truncate max-w-[180px]">{pendingFile.file.name}</span>
            <button onClick={() => setPendingFile(null)} className="ml-auto text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {pendingFile.preview && (
            <img
              src={pendingFile.preview}
              alt="preview"
              className="w-full max-h-40 object-contain rounded-lg border border-border mb-2 bg-slate-50"
            />
          )}
          {!pendingFile.file.type.startsWith("audio/") && (
            <input
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal/30 mb-2"
              placeholder="Caption (optional)"
              value={pendingFile.caption}
              onChange={(e) => setPendingFile(p => p ? { ...p, caption: e.target.value } : p)}
            />
          )}
          <button
            onClick={sendFile}
            disabled={sending}
            className="w-full bg-wa-teal hover:bg-wa-teal-dark text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Uploading…" : "Send"}
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={uploadAccept}
        className="hidden"
        onChange={handleFileChosen}
      />

      {/* Attach Menu */}
      {showAttachMenu && (
        <div className="z-20 absolute bottom-[70px] left-3 bg-white rounded-2xl shadow-xl border border-border p-2 flex flex-col gap-1 w-52">
          <button
            onClick={() => openFilePicker("image/*")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-foreground transition-colors"
          >
            <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><ImageIcon className="w-4 h-4" /></div>
            Image
          </button>
          <button
            onClick={() => openFilePicker("video/*")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-foreground transition-colors"
          >
            <div className="p-1.5 bg-red-100 text-red-600 rounded-lg"><Video className="w-4 h-4" /></div>
            Video
          </button>
          <button
            onClick={() => openFilePicker(".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-foreground transition-colors"
          >
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><FileText className="w-4 h-4" /></div>
            Document
          </button>
          <div className="h-px bg-border mx-2 my-1" />
          <button
            onClick={() => { setShowTemplates(true); setShowAttachMenu(false) }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-foreground transition-colors"
          >
            <div className="p-1.5 bg-wa-teal/10 text-wa-teal rounded-lg"><Smile className="w-4 h-4" /></div>
            Template
            <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="min-h-[62px] bg-slate-50 border-t border-border px-3 py-2 flex items-end gap-2 z-10 shrink-0">
        <button
          onClick={() => setShowAttachMenu((v) => !v)}
          className="p-2.5 text-slate-500 hover:text-wa-teal hover:bg-slate-200 rounded-full transition-colors shrink-0"
          title="Attach / Template"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 bg-white border border-border rounded-2xl px-4 py-2 min-h-[40px] flex items-end shadow-sm">
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ minHeight: "24px", maxHeight: "120px" }}
          />
        </div>

        <button
          onClick={text.trim() ? sendText : undefined}
          disabled={!text.trim() || sending}
          className="p-2.5 bg-wa-teal hover:bg-wa-teal-dark text-white rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-default"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : text.trim() ? <Send className="w-5 h-5 ml-0.5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>

      {/* Profile Drawer */}
      <CustomerProfileDrawer
        open={showProfile}
        onClose={() => setShowProfile(false)}
        phoneNumber={phoneNumber}
        conversation={conversation}
      />

      {/* Template Picker */}
      <TemplatePickerModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        phoneNumber={phoneNumber}
        onSent={() => { setShowTemplates(false); onRefresh?.() }}
      />
    </div>
  )
}
