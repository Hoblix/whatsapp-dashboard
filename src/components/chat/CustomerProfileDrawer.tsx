import React, { useState, useEffect } from "react"
import { X, Save, User, Phone, Mail, Tag, FileText, Loader2 } from "lucide-react"
import type { Conversation } from "../../lib/api-client"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface CustomerProfileDrawerProps {
  open: boolean
  onClose: () => void
  phoneNumber: string
  conversation?: Conversation
}

export function CustomerProfileDrawer({ open, onClose, phoneNumber, conversation }: CustomerProfileDrawerProps) {
  const [name, setName] = useState(conversation?.contactName ?? "")
  const [email, setEmail] = useState((conversation as any)?.email ?? "")
  const [notes, setNotes] = useState((conversation as any)?.notes ?? "")
  const [tags, setTags] = useState((conversation as any)?.tags ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync when conversation changes
  useEffect(() => {
    if (conversation) {
      setName(conversation.contactName ?? "")
      setEmail((conversation as any).email ?? "")
      setNotes((conversation as any).notes ?? "")
      setTags((conversation as any).tags ?? "")
    }
  }, [conversation])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${phoneNumber}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName: name, email, notes, tags }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const displayName = name || phoneNumber
  const firstMsg = conversation?.createdAt
    ? new Date(conversation.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 z-20 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={cn(
        "absolute top-0 right-0 h-full w-full sm:w-[360px] bg-white z-30 flex flex-col shadow-2xl transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="h-[60px] bg-wa-teal text-white flex items-center px-4 gap-3 shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/15 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-base">Customer Profile</h2>
        </div>

        {/* Avatar + Phone */}
        <div className="flex flex-col items-center py-6 bg-slate-50 border-b border-border">
          <Avatar fallback={displayName} className="w-20 h-20 text-2xl mb-3" />
          <p className="font-bold text-lg text-foreground">{displayName}</p>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
            <Phone className="w-3.5 h-3.5" />
            <span>+{phoneNumber}</span>
          </div>
          {firstMsg && (
            <p className="text-xs text-muted-foreground mt-1">Contact since {firstMsg}</p>
          )}
          <div className="flex gap-3 mt-3 text-xs text-center">
            <div className="bg-white rounded-xl px-4 py-2 border border-border shadow-sm">
              <div className="font-bold text-wa-teal text-lg">{conversation?.unreadCount ?? 0}</div>
              <div className="text-muted-foreground">Unread</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
              <User className="w-3.5 h-3.5" /> Display Name
            </label>
            <input
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wa-teal/30 bg-white"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input
              type="email"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wa-teal/30 bg-white"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
              <Tag className="w-3.5 h-3.5" /> Tags
            </label>
            <input
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wa-teal/30 bg-white"
              placeholder="vip, order, support"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated tags</p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
              <FileText className="w-3.5 h-3.5" /> Notes
            </label>
            <textarea
              rows={4}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wa-teal/30 bg-white resize-none"
              placeholder="Internal notes about this customer…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Save */}
        <div className="p-4 border-t border-border bg-white shrink-0">
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              "w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
              saved
                ? "bg-green-500 text-white"
                : "bg-wa-teal hover:bg-wa-teal-dark text-white disabled:opacity-60"
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Profile"}
          </button>
        </div>
      </div>
    </>
  )
}
