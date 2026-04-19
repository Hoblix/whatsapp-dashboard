import React from "react"
import { Loader2, CheckCircle2, Clock, Circle, AlertTriangle, ChevronRight, Zap, Send, GitBranch, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useExecutionLogs, type ExecutionRun, type WorkflowNode, type MessageStats } from "@/hooks/useAutomations"

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  return "****" + phone.slice(-4)
}

function humanize(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

const ACTION_LABELS: Record<string, string> = {
  send_template: "Send Template",
  send_flow: "Send Flow",
  send_text: "Send Text",
  wait: "Wait",
}

// ── Status Icon ─────────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case "waiting":
      return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
    case "pending":
      return <Circle className="w-4 h-4 text-gray-300" />
    default:
      return <Circle className="w-4 h-4 text-gray-300" />
  }
}

// ── Node Label ──────────────────────────────────────────────────────────────

function getNodeLabel(node: WorkflowNode): { label: string; sublabel: string } {
  const config = node.config as Record<string, unknown>
  switch (node.nodeType) {
    case "trigger":
      return { label: "Trigger", sublabel: "Ad Click" }
    case "action": {
      const actionType = (config.actionType as string) ?? ""
      return {
        label: ACTION_LABELS[actionType] ?? "Action",
        sublabel: (config.templateName as string) ?? "",
      }
    }
    case "branch":
      return { label: "Branch", sublabel: "Evaluate conditions" }
    case "condition": {
      if ((config.version as number) === 2) {
        const conditions = (config.conditions as Array<{ field_key: string; value: string }>) ?? []
        if (conditions[0]?.value) {
          return { label: `If ${humanize(conditions[0].field_key)}`, sublabel: `= ${humanize(conditions[0].value)}` }
        }
      }
      return { label: "Condition", sublabel: `${config.operator ?? ""} ${config.value ?? ""}` }
    }
    default:
      return { label: node.nodeType, sublabel: "" }
  }
}

// ── Execution Row ───────────────────────────────────────────────────────────

function ExecutionRow({
  run,
  nodes,
  expanded,
  onToggle,
}: {
  run: ExecutionRun
  nodes: WorkflowNode[]
  expanded: boolean
  onToggle: () => void
}) {
  // Build ordered node list (BFS) — handle null/undefined parentNodeId
  const orderedNodes = React.useMemo(() => {
    if (nodes.length === 0) return []
    const root = nodes.find(n => n.parentNodeId === null || n.parentNodeId === undefined)
    if (!root) return nodes // fallback: return all if no root found
    const result: WorkflowNode[] = []
    const queue = [root]
    const visited = new Set<number>()
    while (queue.length > 0) {
      const node = queue.shift()!
      if (visited.has(node.id)) continue
      visited.add(node.id)
      result.push(node)
      const children = nodes.filter(n => n.parentNodeId === node.id).sort((a, b) => a.position - b.position)
      queue.push(...children)
    }
    return result.length > 0 ? result : nodes
  }, [nodes])

  const statusLabel = run.status === "completed" ? "Completed"
    : run.status === "waiting" ? "Waiting for flow response"
    : run.status === "running" ? "Running"
    : run.status === "failed" ? "Failed"
    : run.status

  const statusColor = run.status === "completed" ? "border-green-300 bg-green-50 text-green-700"
    : run.status === "waiting" ? "border-amber-300 bg-amber-50 text-amber-700"
    : run.status === "failed" ? "border-red-300 bg-red-50 text-red-700"
    : "border-gray-300 bg-gray-50 text-gray-700"

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-3 text-left active:bg-muted/50 transition-colors"
      >
        <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(run.startedAt)}</span>
        <Badge variant="outline" className={`text-[10px] ${statusColor}`}>{statusLabel}</Badge>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{maskPhone(run.phoneNumber)}</span>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-3 py-2">
          {/* Step-by-step activity */}
          <div className="space-y-0">
            {orderedNodes.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No step data available for this execution.</p>
            )}
            {orderedNodes.map((node) => {
              const { label, sublabel } = getNodeLabel(node)
              // Handle both string and number keys from JSON
              const statuses = run.stepStatuses as Record<string, string> | undefined
              const stepStatus = statuses?.[String(node.id)] ?? "pending"
              const nodeIcon = node.nodeType === "trigger" ? <Zap className="w-3 h-3" />
                : node.nodeType === "action" ? <Send className="w-3 h-3" />
                : node.nodeType === "branch" ? <GitBranch className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />

              return (
                <div key={node.id} className="flex items-center gap-2 py-1.5">
                  <StepStatusIcon status={stepStatus} />
                  <span className="text-muted-foreground">{nodeIcon}</span>
                  <span className={`text-xs ${stepStatus === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                    {label}
                  </span>
                  {sublabel && (
                    <span className="text-[11px] text-muted-foreground truncate">{sublabel}</span>
                  )}
                  {stepStatus === "waiting" && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[9px] px-1 py-0 ml-auto">
                      Waiting
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>

          {/* Condition logs if any */}
          {run.conditionLogs.length > 0 && (
            <div className="mt-2 pt-2 border-t space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Condition Results</p>
              {run.conditionLogs.map((log, i) => (
                <div key={i} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span>Logic: {log.logic === "and" ? "ALL" : log.logic === "or" ? "ANY" : "N/A"}</span>
                    {log.durationMs != null && <span className="text-muted-foreground">{log.durationMs}ms</span>}
                    {log.finalResult === "TRUE" && <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 text-[9px] px-1 py-0">Pass</Badge>}
                    {log.finalResult === "FALSE" && <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 text-[9px] px-1 py-0">No match</Badge>}
                    {log.finalResult === "FAILED" && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[9px] px-1 py-0">{log.failedReason ?? "Error"}</Badge>}
                  </div>
                  {log.decisions?.map((d: any, j: number) => (
                    <div key={j} className="text-[11px] text-muted-foreground pl-2">
                      {d.field_key}: {d.raw_value ?? "null"} {d.operator} {d.expected_value} → {d.result === "TRUE" ? "✓" : d.result === "FALSE" ? "✗" : "⚠"}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Funnel Summary ──────────────────────────────────────────────────────────

function FunnelSummary({ runs, nodes, fullView = false, messageStats = {} }: { runs: ExecutionRun[]; nodes: WorkflowNode[]; fullView?: boolean; messageStats?: MessageStats }) {
  if (runs.length === 0 || nodes.length === 0) return null

  const orderedNodes = React.useMemo(() => {
    const root = nodes.find(n => n.parentNodeId === null || n.parentNodeId === undefined)
    if (!root) return nodes
    const result: WorkflowNode[] = []
    const queue = [root]
    const visited = new Set<number>()
    while (queue.length > 0) {
      const node = queue.shift()!
      if (visited.has(node.id)) continue
      visited.add(node.id)
      result.push(node)
      queue.push(...nodes.filter(n => n.parentNodeId === node.id).sort((a, b) => a.position - b.position))
    }
    return result.length > 0 ? result : nodes
  }, [nodes])

  const stepCounts = React.useMemo(() => {
    const counts: Record<number, { completed: number; waiting: number }> = {}
    for (const node of orderedNodes) counts[node.id] = { completed: 0, waiting: 0 }
    for (const run of runs) {
      const statuses = run.stepStatuses as Record<string, string> | undefined
      for (const node of orderedNodes) {
        const s = statuses?.[String(node.id)]
        if (s === "completed") counts[node.id].completed++
        else if (s === "waiting") counts[node.id].waiting++
      }
    }
    return counts
  }, [runs, orderedNodes])

  const total = runs.length
  const colors = ["#128C7E", "#22c55e", "#3b82f6", "#eab308", "#22c55e"]

  // Full view — vertical cards for Funnel tab
  if (fullView) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Funnel Overview</h3>
          <span className="text-xs text-muted-foreground">{total} total runs</span>
        </div>
        {orderedNodes.map((node, i) => {
          const { label, sublabel } = getNodeLabel(node)
          const count = stepCounts[node.id]
          if (!count) return null
          const reached = count.completed + count.waiting
          const pct = total > 0 ? Math.round((reached / total) * 100) : 0
          const prevReached = i > 0 ? (stepCounts[orderedNodes[i - 1].id]?.completed ?? 0) + (stepCounts[orderedNodes[i - 1].id]?.waiting ?? 0) : total
          const dropoff = prevReached > 0 && i > 0 ? prevReached - reached : 0
          const color = colors[i % colors.length]

          return (
            <div key={node.id} className="rounded-lg border bg-white overflow-hidden">
              <div className="flex items-stretch">
                {/* Color bar left */}
                <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold" style={{ color }}>{pct}%</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span><strong className="text-foreground">{reached}</strong> reached</span>
                    {count.waiting > 0 && (
                      <span className="text-amber-600"><strong>{count.waiting}</strong> waiting</span>
                    )}
                    {count.completed > 0 && (
                      <span className="text-green-600"><strong>{count.completed}</strong> completed</span>
                    )}
                    {dropoff > 0 && (
                      <span className="text-red-500 ml-auto">-{dropoff} dropped</span>
                    )}
                  </div>

                  {/* Message delivery metrics for action nodes */}
                  {node.nodeType === "action" && (() => {
                    const templateName = (node.config as Record<string, unknown>).templateName as string | undefined
                    const stats = templateName ? messageStats[templateName] : undefined
                    if (!stats) return null
                    const totalMsgs = stats.sent + stats.delivered + stats.read + stats.failed
                    if (totalMsgs === 0) return null
                    return (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Delivery</p>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center rounded-md bg-blue-50 py-1.5">
                            <p className="text-sm font-bold text-blue-600">{totalMsgs}</p>
                            <p className="text-[9px] text-blue-600/70">Sent</p>
                          </div>
                          <div className="text-center rounded-md bg-green-50 py-1.5">
                            <p className="text-sm font-bold text-green-600">{stats.delivered + stats.read}</p>
                            <p className="text-[9px] text-green-600/70">Delivered</p>
                          </div>
                          <div className="text-center rounded-md bg-purple-50 py-1.5">
                            <p className="text-sm font-bold text-purple-600">{stats.read}</p>
                            <p className="text-[9px] text-purple-600/70">Read</p>
                          </div>
                          <div className="text-center rounded-md bg-red-50 py-1.5">
                            <p className="text-sm font-bold text-red-600">{stats.failed}</p>
                            <p className="text-[9px] text-red-600/70">Failed</p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Compact horizontal view for Runs tab header
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <h3 className="text-xs font-semibold">Funnel</h3>
        <span className="text-[10px] text-muted-foreground">{total} runs</span>
      </div>
      <div className="flex overflow-x-auto gap-0 p-0">
        {orderedNodes.map((node, i) => {
          const { label } = getNodeLabel(node)
          const count = stepCounts[node.id]
          if (!count) return null
          const reached = count.completed + count.waiting
          const pct = total > 0 ? Math.round((reached / total) * 100) : 0
          const color = colors[i % colors.length]
          const isLast = i === orderedNodes.length - 1

          return (
            <React.Fragment key={node.id}>
              <div className="flex-1 min-w-[64px] text-center py-2.5 px-1" style={{ borderBottom: `3px solid ${color}` }}>
                <p className="text-lg font-bold leading-none" style={{ color }}>{pct}%</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight truncate">{label}</p>
                <p className="text-[11px] font-medium mt-0.5">
                  {reached}
                  {count.waiting > 0 && <span className="text-amber-500 text-[9px]"> ⏳{count.waiting}</span>}
                </p>
              </div>
              {!isLast && (
                <div className="flex items-center text-gray-300 text-xs shrink-0">›</div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ExecutionLogPanel({ workflowId, showFunnel = true, funnelOnly = false }: { workflowId: number; showFunnel?: boolean; funnelOnly?: boolean }) {
  const { runs, nodes, messageStats, loading, error } = useExecutionLogs(workflowId)
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set())

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">
          No executions yet. Runs appear here after the workflow processes messages.
        </p>
      </div>
    )
  }

  if (funnelOnly) {
    return (
      <div className="p-2">
        <FunnelSummary runs={runs} nodes={nodes} fullView messageStats={messageStats} />
      </div>
    )
  }

  return (
    <div className="space-y-3 p-2">
      {/* Funnel Summary — compact in runs tab */}
      {showFunnel && <FunnelSummary runs={runs} nodes={nodes} messageStats={messageStats} />}

      {/* Individual runs */}
      {runs.map(run => (
        <ExecutionRow
          key={run.id}
          run={run}
          nodes={nodes}
          expanded={expandedIds.has(run.id)}
          onToggle={() => toggleExpanded(run.id)}
        />
      ))}
    </div>
  )
}
