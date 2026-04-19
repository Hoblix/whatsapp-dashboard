import React from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Activity, Webhook, ShieldCheck, Copy, CheckCircle2, Database, Download, RefreshCw, History, AlertCircle, Bell, BellOff, BellRing, LogOut, Users, UserPlus, Trash2, Crown, Key, RotateCw, ExternalLink, X, Shield, ShieldAlert, ToggleLeft, ToggleRight, Plus } from "lucide-react"
import { ApiReference } from "@/components/settings/ApiReference"
import { useGetStats, useListBackups, useCreateBackup } from "../lib/api-client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import { useAuth } from "@/context/AuthContext"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface AllowedUser {
  id: number
  phoneNumber: string
  role: string
  addedBy: string | null
  createdAt: string
}

function useAdminUsers(enabled: boolean) {
  const [users, setUsers] = React.useState<AllowedUser[]>([])
  const [loading, setLoading] = React.useState(false)

  const fetchUsers = React.useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/admin/users`, { credentials: "include" })
      if (res.ok) setUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [enabled])

  React.useEffect(() => { fetchUsers() }, [fetchUsers])

  const addUser = async (phoneNumber: string) => {
    const res = await fetch(`${BASE}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phoneNumber }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to add user")
    await fetchUsers()
  }

  const removeUser = async (phone: string) => {
    const res = await fetch(`${BASE}/api/admin/users/${encodeURIComponent(phone)}`, {
      method: "DELETE",
      credentials: "include",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to remove user")
    await fetchUsers()
  }

  return { users, loading, addUser, removeUser, refetch: fetchUsers }
}

interface ApiKeyInfo {
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
}

function useApiKey() {
  const [apiKey, setApiKey] = React.useState<ApiKeyInfo | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [regenerating, setRegenerating] = React.useState(false)
  const [newKeyRevealed, setNewKeyRevealed] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLoading(true)
    fetch(`${BASE}/api/api-key`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setApiKey(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const regenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch(`${BASE}/api/admin/api-key/regenerate`, { method: "POST", credentials: "include" })
      if (res.ok) {
        const data = await res.json() as { newKey: string; keyPrefix: string }
        setApiKey(prev => prev ? { ...prev, keyPrefix: data.keyPrefix, createdAt: new Date().toISOString(), lastUsedAt: null } : null)
        setNewKeyRevealed(data.newKey)
      }
    } finally {
      setRegenerating(false)
    }
  }

  return { apiKey, loading, regenerate, regenerating, newKeyRevealed, clearNewKey: () => setNewKeyRevealed(null) }
}

interface IpEntry {
  id: number
  ip: string
  label: string | null
  enabled: boolean
  addedBy: string | null
  createdAt: string
}

function useIpAllowlist(enabled: boolean) {
  const [entries, setEntries] = React.useState<IpEntry[]>([])
  const [loading, setLoading] = React.useState(false)

  const fetchEntries = React.useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/admin/ip-allowlist`, { credentials: "include" })
      if (res.ok) setEntries(await res.json())
    } finally {
      setLoading(false)
    }
  }, [enabled])

  React.useEffect(() => { fetchEntries() }, [fetchEntries])

  const addEntry = async (ip: string, label: string) => {
    const res = await fetch(`${BASE}/api/admin/ip-allowlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ip, label: label || undefined }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to add IP")
    await fetchEntries()
  }

  const removeEntry = async (id: number) => {
    const res = await fetch(`${BASE}/api/admin/ip-allowlist/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? "Failed to remove IP")
    }
    await fetchEntries()
  }

  const toggleEntry = async (id: number, enabled: boolean) => {
    const res = await fetch(`${BASE}/api/admin/ip-allowlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ enabled }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? "Failed to update IP")
    }
    await fetchEntries()
  }

  return { entries, loading, addEntry, removeEntry, toggleEntry, refetch: fetchEntries }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

export default function SettingsPage() {
  const [_, setLocation] = useLocation()
  const { user, logout, isSuperAdmin } = useAuth()
  const { data: stats, isLoading: statsLoading } = useGetStats({ query: { refetchInterval: 5000 } })
  const { data: backups = [], isLoading: backupsLoading, refetch: refetchBackups } = useListBackups({ query: { refetchInterval: 10000 } })
  const { mutate: triggerBackup, isPending: backupRunning } = useCreateBackup()
  const { state: notifState, subscribe, unsubscribe } = useNotifications()
  const [copied, setCopied] = React.useState<string | null>(null)
  const { users: allowedUsers, loading: usersLoading, addUser, removeUser } = useAdminUsers(isSuperAdmin)
  const { apiKey, regenerate: regenerateKey, regenerating, newKeyRevealed, clearNewKey } = useApiKey()
  const { entries: ipEntries, loading: ipLoading, addEntry: addIp, removeEntry: removeIp, toggleEntry: toggleIp } = useIpAllowlist(isSuperAdmin)
  const [newPhone, setNewPhone] = React.useState("")
  const [addLoading, setAddLoading] = React.useState(false)
  const [addError, setAddError] = React.useState("")
  const [removeTarget, setRemoveTarget] = React.useState<string | null>(null)
  const [newKeyCopied, setNewKeyCopied] = React.useState(false)
  const [newIp, setNewIp] = React.useState("")
  const [newIpLabel, setNewIpLabel] = React.useState("")
  const [ipAddLoading, setIpAddLoading] = React.useState(false)
  const [ipAddError, setIpAddError] = React.useState("")
  const [ipRemoveTarget, setIpRemoveTarget] = React.useState<number | null>(null)

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCreateBackup = () => {
    triggerBackup(undefined as any, {
      onSuccess: () => refetchBackups(),
    })
  }

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhook` : "https://whatsapp-dashboard-9lb.pages.dev/api/webhook"
  const verifyToken = "whatsapp_webhook_verify_token"

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="h-[60px] bg-wa-teal text-white flex items-center px-4 shadow-md shrink-0 sticky top-0 z-20">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors mr-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg">Settings & Configuration</h1>
      </div>

      <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-5">

        {/* Stats */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Activity className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-foreground">Usage Statistics</h2>
            <button onClick={() => setLocation("/history")} className="ml-auto flex items-center gap-1.5 text-sm text-wa-teal hover:underline">
              <History className="w-4 h-4" /> View History Log
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Msgs", value: stats?.totalMessages ?? 0, color: "text-foreground" },
              { label: "Today", value: stats?.todayMessages ?? 0, color: "text-wa-green" },
              { label: "Inbound", value: stats?.inboundMessages ?? 0, color: "text-blue-600" },
              { label: "Outbound", value: stats?.outboundMessages ?? 0, color: "text-slate-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={cn("text-2xl font-bold", color)}>{statsLoading ? "..." : value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Webhook Config */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Webhook className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-foreground">Meta App Configuration</h2>
          </div>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Go to Meta Developer Dashboard → WhatsApp → Configuration → Edit Webhook and paste these values.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Callback URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-slate-100 rounded-xl text-sm border border-slate-200 text-slate-800 break-all">{webhookUrl}</code>
                <Button variant="outline" size="icon" onClick={() => handleCopy(webhookUrl, "url")} className="shrink-0">
                  {copied === "url" ? <CheckCircle2 className="w-4 h-4 text-wa-green" /> : <Copy className="w-4 h-4 text-slate-500" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Verify Token</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-slate-100 rounded-xl text-sm border border-slate-200 text-slate-800">{verifyToken}</code>
                <Button variant="outline" size="icon" onClick={() => handleCopy(verifyToken, "token")} className="shrink-0">
                  {copied === "token" ? <CheckCircle2 className="w-4 h-4 text-wa-green" /> : <Copy className="w-4 h-4 text-slate-500" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 leading-relaxed">
              <strong>Required webhook fields:</strong> Subscribe to <code>messages</code> (inbound messages + delivery status), <code>message_template_status_update</code> (template approvals), and <code>account_alerts</code> (system issues).
            </div>
          </div>
        </section>


        {/* Encrypted Backups */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Database className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-foreground">Encrypted Daily Backups</h2>
            <button
              onClick={handleCreateBackup}
              disabled={backupRunning}
              className="ml-auto flex items-center gap-1.5 text-sm bg-wa-teal text-white px-3 py-1.5 rounded-lg hover:bg-wa-teal-dark disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", backupRunning && "animate-spin")} />
              {backupRunning ? "Creating..." : "Backup Now"}
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            All conversations and messages are automatically backed up daily at 2:00 AM using AES-256-GCM encryption. You can also trigger a manual backup anytime.
          </p>

          {backupsLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Loading backups...</div>
          ) : backups.length === 0 ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No backups yet. Click "Backup Now" to create your first backup.
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {backups.map((backup) => (
                <div key={backup.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    backup.status === "completed" ? "bg-wa-green" : backup.status === "failed" ? "bg-red-400" : "bg-amber-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{formatDate(backup.createdAt)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {backup.totalConversations} conversations · {backup.totalMessages} messages · {formatBytes(backup.sizeBytes)} · 🔒 AES-256
                    </div>
                    {backup.errorMessage && (
                      <div className="text-xs text-red-500 mt-0.5">{backup.errorMessage}</div>
                    )}
                  </div>
                  {backup.status === "completed" && (
                    <a
                      href={`/api/backups/${backup.id}/download`}
                      download
                      className="flex items-center gap-1 text-xs text-wa-teal hover:text-wa-teal-dark transition-colors shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Push Notifications */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><BellRing className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-foreground">Push Notifications</h2>
            <span className={cn(
              "ml-auto text-xs font-semibold px-2.5 py-1 rounded-full",
              notifState === "subscribed" ? "bg-wa-green/20 text-green-700" :
              notifState === "denied" ? "bg-red-100 text-red-700" :
              notifState === "unsupported" ? "bg-slate-100 text-slate-500" :
              "bg-amber-100 text-amber-700"
            )}>
              {notifState === "subscribed" ? "Enabled" :
               notifState === "denied" ? "Blocked" :
               notifState === "unsupported" ? "Not supported" :
               notifState === "loading" ? "Checking…" : "Disabled"}
            </span>
          </div>

          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Get an instant notification on this device whenever a new WhatsApp message arrives — even when the app is in the background or closed (PWA install required on iOS).
          </p>

          {notifState === "unsupported" && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
              Push notifications are not supported in this browser. Try opening the app in Safari on iOS 16.4+ and installing it to your home screen.
            </div>
          )}

          {notifState === "denied" && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800">
              <BellOff className="w-4 h-4 shrink-0" />
              Notifications have been blocked. Go to your browser's site settings and allow notifications for this site, then reload the page.
            </div>
          )}

          {(notifState === "default" || notifState === "subscribed") && (
            <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                {notifState === "subscribed"
                  ? <Bell className="w-5 h-5 text-wa-green" />
                  : <BellOff className="w-5 h-5 text-slate-400" />}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {notifState === "subscribed" ? "Notifications are on" : "Notifications are off"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {notifState === "subscribed"
                      ? "You'll be notified when a new message arrives on this device."
                      : "Enable to get notified when a new message arrives."}
                  </p>
                </div>
              </div>
              <Button
                onClick={notifState === "subscribed" ? unsubscribe : subscribe}
                variant={notifState === "subscribed" ? "outline" : "default"}
                size="sm"
                className={notifState === "subscribed" ? "" : "bg-wa-teal hover:bg-wa-teal-dark text-white"}
              >
                {notifState === "subscribed" ? "Turn off" : "Enable"}
              </Button>
            </div>
          )}

          {notifState === "loading" && (
            <div className="text-sm text-muted-foreground py-2 text-center">Checking notification status…</div>
          )}
        </section>

        {/* User Management — super admin only */}
        {isSuperAdmin && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Authorised Users</h2>
            <div className="rounded-xl border bg-card overflow-hidden divide-y">

              {/* Add user */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Add a mobile number to grant dashboard access.</p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => { setNewPhone(e.target.value); setAddError("") }}
                    placeholder="e.g. 919876543210"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#128C7E] focus:border-transparent"
                    disabled={addLoading}
                    inputMode="tel"
                  />
                  <Button
                    size="sm"
                    className="bg-[#128C7E] hover:bg-[#0f7a6d] text-white gap-1.5 shrink-0"
                    disabled={addLoading || !newPhone.trim()}
                    onClick={async () => {
                      setAddLoading(true)
                      setAddError("")
                      try {
                        await addUser(newPhone.trim())
                        setNewPhone("")
                      } catch (err: any) {
                        setAddError(err.message)
                      } finally {
                        setAddLoading(false)
                      }
                    }}
                  >
                    <UserPlus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
                {addError && (
                  <p className="text-xs text-red-500">{addError}</p>
                )}
              </div>

              {/* User list */}
              {usersLoading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">Loading…</div>
              ) : allowedUsers.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">No users yet</div>
              ) : (
                allowedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        u.role === "super_admin" ? "bg-amber-100" : "bg-gray-100"
                      )}>
                        {u.role === "super_admin"
                          ? <Crown className="w-4 h-4 text-amber-500" />
                          : <Users className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">+{u.phoneNumber}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {u.role === "super_admin" ? "Super Admin" : "User"}
                          {u.addedBy && u.addedBy !== "system" ? ` · added by +${u.addedBy}` : ""}
                        </p>
                      </div>
                    </div>
                    {u.role !== "super_admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        disabled={removeTarget === u.phoneNumber}
                        onClick={async () => {
                          setRemoveTarget(u.phoneNumber)
                          try { await removeUser(u.phoneNumber) }
                          catch {}
                          finally { setRemoveTarget(null) }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* API Access */}
        <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API Access</h2>
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#128C7E] font-medium hover:underline"
              >
                API Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">API Key</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Use this key to send messages from external systems — one call sends the message and logs it in the dashboard.
                    </p>
                    <a href="/settings/credentials" className="inline-flex items-center gap-1 text-xs text-[#128C7E] font-medium hover:underline mt-1">
                      <Shield className="w-3 h-3" /> Manage API Credentials (WhatsApp, Meta Ads, Push, etc.)
                    </a>
                  </div>
                </div>

                {/* Key display — key is hashed server-side and cannot be retrieved; prefix is shown for identification */}
                {apiKey ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border">
                      <code className="flex-1 text-xs font-mono text-gray-700 truncate select-all">
                        {apiKey.keyPrefix}{"•".repeat(40)}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Key is stored securely. To use it, regenerate — the full key is shown once.
                      {apiKey.lastUsedAt ? ` Last used: ${formatDate(apiKey.lastUsedAt)}` : ""}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">Loading…</div>
                )}

                {/* API Reference */}
                {apiKey && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">API Reference:</p>
                    <ApiReference apiKey="YOUR_API_KEY" domain={window.location.host} />
                  </div>
                )}

                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                    disabled={regenerating}
                    onClick={async () => {
                      if (!confirm("Regenerate API key? The old key will stop working immediately.")) return
                      await regenerateKey()
                    }}
                  >
                    <RotateCw className={cn("w-4 h-4", regenerating && "animate-spin")} />
                    {regenerating ? "Regenerating…" : "Regenerate Key"}
                  </Button>
                )}

                {/* One-time new key reveal modal */}
                {newKeyRevealed && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">New API Key</h3>
                        <button onClick={clearNewKey} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-medium">
                        Copy this key now — it will not be shown again.
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 border rounded-xl px-3 py-2">
                        <code className="flex-1 text-xs font-mono text-gray-800 break-all select-all">{newKeyRevealed}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(newKeyRevealed)
                            setNewKeyCopied(true)
                            setTimeout(() => setNewKeyCopied(false), 2000)
                          }}
                          className="text-gray-400 hover:text-gray-600 shrink-0"
                        >
                          {newKeyCopied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                      <Button
                        className="w-full bg-[#128C7E] hover:bg-[#0f7a6d] text-white"
                        onClick={clearNewKey}
                      >
                        Done — I've copied my key
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

        {/* IP Allowlist — super admin only */}
        {isSuperAdmin && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">IP Allowlist</h2>
            <div className="rounded-xl border bg-card overflow-hidden divide-y">

              {/* Info banner */}
              <div className="px-4 py-3 flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-[#128C7E]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-[#128C7E]" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">API Key IP Restrictions</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    When the list is non-empty, <span className="font-medium">Bearer token</span> requests are only accepted from the listed IPs or CIDR ranges.
                    Dashboard sessions (cookie-based) are never restricted.
                  </p>
                </div>
              </div>

              {/* Empty-list warning */}
              {!ipLoading && ipEntries.length === 0 && (
                <div className="px-4 py-2.5 flex items-center gap-2 bg-amber-50 border-amber-100">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">
                    No IPs added — any IP address can currently use your API key.
                  </p>
                </div>
              )}

              {/* Existing entries */}
              {ipEntries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium truncate">{entry.ip}</p>
                    {entry.label && (
                      <p className="text-xs text-muted-foreground truncate">{entry.label}</p>
                    )}
                  </div>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title={entry.enabled ? "Disable" : "Enable"}
                    onClick={() => toggleIp(entry.id, !entry.enabled).catch(() => {})}
                  >
                    {entry.enabled
                      ? <ToggleRight className="w-5 h-5 text-[#128C7E]" />
                      : <ToggleLeft className="w-5 h-5 text-gray-400" />
                    }
                  </button>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Remove"
                    onClick={async () => {
                      setIpRemoveTarget(entry.id)
                      try { await removeIp(entry.id) } catch { } finally { setIpRemoveTarget(null) }
                    }}
                    disabled={ipRemoveTarget === entry.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add entry form */}
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Add IP or CIDR</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 1.2.3.4 or 10.0.0.0/8"
                    value={newIp}
                    onChange={(e) => { setNewIp(e.target.value); setIpAddError("") }}
                    className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                  <input
                    type="text"
                    placeholder="Label (optional)"
                    value={newIpLabel}
                    onChange={(e) => setNewIpLabel(e.target.value)}
                    className="w-28 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#128C7E]/40"
                  />
                  <Button
                    size="sm"
                    className="bg-[#128C7E] hover:bg-[#0f7a6d] text-white shrink-0"
                    disabled={!newIp.trim() || ipAddLoading}
                    onClick={async () => {
                      setIpAddLoading(true)
                      setIpAddError("")
                      try {
                        await addIp(newIp.trim(), newIpLabel.trim())
                        setNewIp("")
                        setNewIpLabel("")
                      } catch (e: any) {
                        setIpAddError(e.message ?? "Failed to add IP")
                      } finally {
                        setIpAddLoading(false)
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {ipAddError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{ipAddError}
                  </p>
                )}
              </div>

            </div>
          </section>
        )}

        {/* Account */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Account</h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#128C7E]/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#128C7E]" />
                </div>
                <div>
                  <p className="text-sm font-medium">Signed in</p>
                  <p className="text-xs text-muted-foreground">+{user?.phoneNumber}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5"
                onClick={async () => {
                  await logout()
                  setLocation("/login")
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
