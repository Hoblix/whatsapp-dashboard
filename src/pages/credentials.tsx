import React from "react"
import { ArrowLeft, Key, Eye, EyeOff, Save, Loader2, Check, AlertCircle, Shield } from "lucide-react"
import { useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface CredentialItem {
  key: string
  label: string
  category: string
  description: string
  maskedValue: string
  isSet: boolean
  updatedAt: string | null
  updatedBy: string | null
}

interface CredentialCategory {
  id: string
  label: string
  items: CredentialItem[]
}

export default function CredentialsPage() {
  const [, navigate] = useLocation()
  const { toast } = useToast()
  const [categories, setCategories] = React.useState<CredentialCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState("")
  const [showValue, setShowValue] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/credentials", { credentials: "include" })
      const data = await res.json() as any
      setCategories(data.categories ?? [])
    } catch {
      toast({ title: "Failed to load credentials", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchCredentials() }, [])

  const handleSave = async (key: string) => {
    if (!editValue.trim()) {
      toast({ title: "Value cannot be empty", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/credentials/${encodeURIComponent(key)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: editValue }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      toast({ title: "Credential saved", description: `${key} updated successfully` })
      setEditingKey(null)
      setEditValue("")
      setShowValue(false)
      fetchCredentials()
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValue("")
    setShowValue(false)
  }

  const categoryIcons: Record<string, string> = {
    whatsapp: "💬",
    meta_ads: "📢",
    push: "🔔",
    auth: "🔐",
    integrations: "🔗",
    encryption: "🛡️",
    general: "⚙️",
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-[#128C7E] px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/settings")} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-white/80" />
          <h1 className="text-white font-semibold text-base">API Credentials</h1>
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
        <p className="text-xs text-amber-800">
          Values are encrypted with AES-256-GCM before storage. Only masked previews are shown.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No credential definitions found.
          </div>
        ) : (
          categories.map((cat) => (
            <Card key={cat.id} className="overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b flex items-center gap-2">
                <span className="text-base">{categoryIcons[cat.id] ?? "⚙️"}</span>
                <h2 className="text-sm font-semibold text-slate-700">{cat.label}</h2>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {cat.items.filter((i) => i.isSet).length}/{cat.items.length} configured
                </Badge>
              </div>
              <div className="divide-y">
                {cat.items.map((item) => (
                  <div key={item.key} className="px-4 py-3">
                    {editingKey === item.key ? (
                      /* Edit mode */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700">{item.label}</label>
                          <button
                            onClick={() => setShowValue(!showValue)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{item.description}</p>
                        <Input
                          type={showValue ? "text" : "password"}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={`Enter ${item.label.toLowerCase()}`}
                          className="h-9 text-sm font-mono"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(item.key)}
                            disabled={saving}
                            className="h-8 gap-1.5 bg-[#128C7E] hover:bg-[#0e7a6e]"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancel} className="h-8">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                            {item.isSet ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-muted-foreground">
                              {item.isSet ? item.maskedValue : "Not configured"}
                            </span>
                            {item.updatedAt && (
                              <span className="text-[9px] text-muted-foreground">
                                Updated {new Date(item.updatedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingKey(item.key)
                            setEditValue("")
                            setShowValue(false)
                          }}
                          className="h-7 text-xs shrink-0"
                        >
                          <Key className="w-3 h-3 mr-1" />
                          {item.isSet ? "Update" : "Set"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
