import React from "react"
import { useLocation } from "wouter"
import { ArrowLeft, ArrowDownToLine, MessageSquare, Phone, Clock, Filter } from "lucide-react"
import { useGetHistory } from "../lib/api-client"
import { formatWhatsAppTime } from "@/lib/utils"
import { cn } from "@/lib/utils"

export default function HistoryPage() {
  const [_, setLocation] = useLocation()
  const [fromDate, setFromDate] = React.useState("")
  const [toDate, setToDate] = React.useState("")
  const [phoneFilter, setPhoneFilter] = React.useState("")
  const [appliedFilters, setAppliedFilters] = React.useState<{ from?: string; to?: string; phoneNumber?: string }>({})

  const { data: history = [], isLoading, refetch } = useGetHistory(
    { from: appliedFilters.from, to: appliedFilters.to, phoneNumber: appliedFilters.phoneNumber },
    { query: { refetchInterval: 5000 } }
  )

  const applyFilters = () => {
    setAppliedFilters({
      from: fromDate || undefined,
      to: toDate || undefined,
      phoneNumber: phoneFilter || undefined,
    })
  }

  const clearFilters = () => {
    setFromDate("")
    setToDate("")
    setPhoneFilter("")
    setAppliedFilters({})
  }

  const exportCSV = () => {
    const headers = ["ID", "Phone", "Contact", "Direction", "Type", "Message", "Status", "Timestamp"]
    const rows = history.map(h => [
      h.id,
      h.phoneNumber ?? "",
      h.contactName ?? "",
      h.direction,
      h.messageType,
      (h.body ?? "").replace(/,/g, " "),
      h.status ?? "",
      new Date(h.timestamp).toISOString()
    ])
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `message_history_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="h-[60px] bg-wa-teal text-white flex items-center px-4 shadow-md shrink-0 sticky top-0 z-20">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors mr-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Message History Log</h1>
        <button
          onClick={exportCSV}
          disabled={history.length === 0}
          className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowDownToLine className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="max-w-4xl w-full mx-auto p-4 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-wa-teal" />
            <h2 className="font-semibold text-sm text-foreground">Filter Logs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wa-green/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wa-green/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone Number</label>
              <input
                type="text"
                value={phoneFilter}
                placeholder="e.g. 14155551234"
                onChange={e => setPhoneFilter(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-wa-green/40"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={applyFilters}
              className="bg-wa-teal text-white text-sm px-4 py-2 rounded-lg hover:bg-wa-teal-dark transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="text-slate-500 text-sm px-4 py-2 rounded-lg border border-border hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {isLoading ? "Loading..." : `${history.length} message${history.length !== 1 ? "s" : ""}`}
            </span>
            <span className="text-xs text-muted-foreground">Latest 500 — auto-refreshes every 5s</span>
          </div>

          {isLoading && history.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              <MessageSquare className="w-8 h-8 opacity-30" />
              No messages found
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className={cn(
                    "mt-0.5 w-2 h-2 rounded-full shrink-0",
                    entry.direction === "inbound" ? "bg-wa-green" : "bg-blue-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {entry.contactName || entry.phoneNumber}
                      </div>
                      {entry.contactName && (
                        <span className="text-xs text-muted-foreground">{entry.phoneNumber}</span>
                      )}
                      <span className={cn(
                        "text-[11px] font-medium px-1.5 py-0.5 rounded-full",
                        entry.direction === "inbound"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {entry.direction}
                      </span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                        {entry.messageType}
                      </span>
                      {entry.status && (
                        <span className="text-[11px] text-muted-foreground">
                          {entry.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 truncate">{entry.body || `[${entry.messageType}]`}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatWhatsAppTime(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
