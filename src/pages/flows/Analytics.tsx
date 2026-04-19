import React from "react"
import { useParams, useLocation } from "wouter"
import { AlertCircle, RefreshCw, BarChart3 } from "lucide-react"
import { FlowsLayout } from "./FlowsLayout"
import { useTenants, useTenantAnalytics, type FlowTenant } from "@/hooks/useFlows"
import { cn } from "@/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtShortDate(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

function fmtDateTime(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  })
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color
}: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white border rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <p className={cn("text-2xl font-bold tracking-tight truncate", color)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-[#128C7E]">{payload[0].value} submission{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { tenantId: tenantIdStr } = useParams<{ tenantId: string }>()
  const [, setLocation] = useLocation()
  const tenantId = parseInt(tenantIdStr ?? "", 10)

  const { tenants } = useTenants()
  const tenant: FlowTenant | undefined = tenants.find(t => t.id === tenantId)

  const { analytics, loading, error, refetch } = useTenantAnalytics(
    isNaN(tenantId) ? null : tenantId
  )

  if (isNaN(tenantId)) {
    return (
      <FlowsLayout tab="analytics">
        <div className="text-center py-12 text-muted-foreground text-sm">
          Invalid tenant ID. <button onClick={() => setLocation("/flows/tenants")} className="text-[#128C7E] underline">Back to tenants</button>
        </div>
      </FlowsLayout>
    )
  }

  const topFlow = analytics?.flowStats.reduce(
    (best, f) => (!best || f.submissions > best.submissions ? f : best),
    null as typeof analytics.flowStats[0] | null
  )

  // Fill any missing days in the last 30 for the chart
  const chartData = React.useMemo(() => {
    if (!analytics) return []
    const map = new Map(analytics.dailyCounts.map(d => [d.day, d.submissions]))
    const days: { date: string; submissions: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ date: fmtShortDate(key), submissions: map.get(key) ?? 0 })
    }
    return days
  }, [analytics])

  // Avg daily volume over last 30 days
  const avgDaily = React.useMemo(() => {
    if (!chartData.length) return 0
    const total = chartData.reduce((s, d) => s + d.submissions, 0)
    return (total / 30).toFixed(1)
  }, [chartData])

  return (
    <FlowsLayout tab="analytics" tenantId={tenantId} tenantName={tenant?.name}>
      <div className="p-4 space-y-5">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Analytics</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 border rounded-lg px-3 py-1.5 transition-colors bg-white"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && !analytics && (
          <div className="text-sm text-muted-foreground text-center py-8">Loading analytics…</div>
        )}

        {analytics && (
          <>
            {/* KPI cards — row 1 */}
            <div className="flex gap-3">
              <KpiCard
                label="Total Submissions"
                value={analytics.totalSubmissions.toLocaleString()}
                sub="all time"
                color="text-[#128C7E]"
              />
              <KpiCard
                label="Avg Daily (30d)"
                value={avgDaily}
                sub="submissions / day"
                color="text-blue-600"
              />
              <KpiCard
                label="Active Flows"
                value={analytics.flowStats.filter(f => f.isActive).length}
                sub={`of ${analytics.flowStats.length} total`}
                color="text-foreground"
              />
            </div>

            {/* KPI cards — row 2 */}
            {topFlow && (
              <div className="flex gap-3">
                <KpiCard
                  label="Top Flow"
                  value={topFlow.submissions.toLocaleString()}
                  sub={topFlow.name}
                  color="text-purple-600"
                />
                {topFlow.completionRate !== null && (
                  <KpiCard
                    label="Top Flow Completion"
                    value={`${topFlow.completionRate}%`}
                    sub={`${topFlow.inits} inits → ${topFlow.submissions} completions`}
                    color={topFlow.completionRate >= 70 ? "text-green-600" : topFlow.completionRate >= 40 ? "text-amber-600" : "text-red-500"}
                  />
                )}
              </div>
            )}

            {/* Daily bar chart */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">Daily Submissions (Last 30 Days)</p>
              {chartData.every(d => d.submissions === 0) ? (
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm">No submissions in the last 30 days</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      interval={6}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="submissions" fill="#128C7E" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Per-flow table */}
            {analytics.flowStats.length > 0 && (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-semibold">Flow Breakdown</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Flow</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Inits</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Completions</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analytics.flowStats
                        .sort((a, b) => b.submissions - a.submissions)
                        .map(f => (
                          <tr key={f.flowId} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-foreground">{f.name}</p>
                              <p className="text-muted-foreground font-mono">{f.slug}</p>
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                              {f.inits.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium">
                              {f.submissions.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {f.completionRate !== null ? (
                                <span className={cn(
                                  "font-semibold",
                                  f.completionRate >= 70 ? "text-green-600"
                                  : f.completionRate >= 40 ? "text-amber-600"
                                  : "text-red-500"
                                )}>
                                  {f.completionRate}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                f.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                              )}>
                                {f.isActive ? "Active" : "Off"}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent submissions */}
            {analytics.recentSubmissions.length > 0 && (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-semibold">Recent Submissions</p>
                  <p className="text-xs text-muted-foreground">Latest 10 across all flows</p>
                </div>
                <div className="divide-y">
                  {analytics.recentSubmissions.map(sub => {
                    const flow = analytics.flowStats.find(f => f.flowId === sub.flowId)
                    return (
                      <div key={sub.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {sub.waPhone ? `+${sub.waPhone}` : `Submission #${sub.id}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {flow?.name ?? `Flow #${sub.flowId}`}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground shrink-0">
                          {fmtDateTime(sub.completedAt)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </FlowsLayout>
  )
}
