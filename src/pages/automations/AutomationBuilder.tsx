import React from "react"
import { useLocation, useRoute } from "wouter"
import {
  ArrowLeft, Save, Trash2, Plus, Loader2, GitBranch, Zap,
  Clock, MessageSquare, Send, ChevronDown, Pencil, Check, X,
  RefreshCw, AlertTriangle, CheckCircle2,
} from "lucide-react"
import {
  useAutomation, useTemplates, useTenants, useTenantFlows,
  useFlowSchema, useEnrichedTemplates,
  type AutomationNode, type EnrichedTemplate,
} from "@/hooks/useAutomations"
import { ExecutionLogPanel } from "./ExecutionLogPanel"
import type { FlowFieldEntry, ConditionV2Config, ConditionV2Entry } from "@/types/conditionV2"
import { validateTree, stampSchemaVersion } from "@/lib/validateTree"
import { getConditionConfidence, daysAgo } from "@/lib/conditionConfidence"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// ── Types ──────────────────────────────────────────────────────────────────────

interface TreeNode {
  tempId: string
  parentTempId: string | null
  nodeType: "trigger" | "action" | "branch" | "condition"
  position: number
  config: Record<string, unknown>
  children: TreeNode[]
}

type Action =
  | { type: "SET_TREE"; tree: TreeNode }
  | { type: "ADD_NODE"; parentTempId: string; nodeType: TreeNode["nodeType"]; position: number }
  | { type: "ADD_NODE_WITH_CONFIG"; parentTempId: string; nodeType: TreeNode["nodeType"]; position: number; config: Record<string, unknown> }
  | { type: "UPDATE_NODE"; tempId: string; config: Record<string, unknown> }
  | { type: "DELETE_NODE"; tempId: string }
  | { type: "MOVE_NODE"; tempId: string; newPosition: number }

// ── Helpers ────────────────────────────────────────────────────────────────────

let _counter = 0
function tempId() { return `tmp_${++_counter}_${Date.now()}` }

function cloneTree(node: TreeNode): TreeNode {
  return { ...node, children: node.children.map(cloneTree) }
}

function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.tempId === id) return node
  for (const c of node.children) {
    const found = findNode(c, id)
    if (found) return found
  }
  return null
}

function removeNode(node: TreeNode, id: string): TreeNode {
  return { ...node, children: node.children.filter(c => c.tempId !== id).map(c => removeNode(c, id)) }
}

/** Convert API nodes tree to local TreeNode tree */
function apiToTree(apiNode: AutomationNode): TreeNode {
  return {
    tempId: `api_${apiNode.id}`,
    parentTempId: null, // rebuilt by parent
    nodeType: apiNode.nodeType,
    position: apiNode.position,
    config: apiNode.config,
    children: (apiNode.children ?? [])
      .sort((a, b) => a.position - b.position)
      .map(c => {
        const child = apiToTree(c)
        child.parentTempId = `api_${apiNode.id}`
        return child
      }),
  }
}

/** Flatten tree to array for API */
function flattenTree(
  node: TreeNode,
  parentTempId: string | null = null,
  arr: { tempId: string; parentTempId: string | null; nodeType: string; position: number; config: Record<string, unknown> }[] = []
) {
  arr.push({
    tempId: node.tempId,
    parentTempId,
    nodeType: node.nodeType,
    position: node.position,
    config: node.config,
  })
  node.children.forEach(c => flattenTree(c, node.tempId, arr))
  return arr
}

function makeDefaultTrigger(): TreeNode {
  return {
    tempId: tempId(),
    parentTempId: null,
    nodeType: "trigger",
    position: 0,
    config: {},
    children: [],
  }
}

/** Extract templateName from tree (trigger config or first send_template action) */
function extractTemplateName(node: TreeNode): string | null {
  if (node.config.templateName) return node.config.templateName as string
  if (node.nodeType === "action" && node.config.actionType === "send_template" && node.config.templateName) {
    return node.config.templateName as string
  }
  for (const child of node.children) {
    const found = extractTemplateName(child)
    if (found) return found
  }
  return null
}

// ── Reducer ────────────────────────────────────────────────────────────────────

function treeReducer(state: TreeNode, action: Action): TreeNode {
  switch (action.type) {
    case "SET_TREE":
      return action.tree

    case "ADD_NODE": {
      const tree = cloneTree(state)
      const parent = findNode(tree, action.parentTempId)
      if (!parent) return state
      const newNode: TreeNode = {
        tempId: tempId(),
        parentTempId: action.parentTempId,
        nodeType: action.nodeType,
        position: action.position,
        config: {},
        children: [],
      }
      parent.children.splice(action.position, 0, newNode)
      // Reindex positions
      parent.children.forEach((c, i) => { c.position = i })
      return tree
    }

    case "ADD_NODE_WITH_CONFIG": {
      const tree = cloneTree(state)
      const parent = findNode(tree, action.parentTempId)
      if (!parent) return state
      const newNode: TreeNode = {
        tempId: tempId(),
        parentTempId: action.parentTempId,
        nodeType: action.nodeType,
        position: action.position,
        config: action.config,
        children: [],
      }
      parent.children.splice(action.position, 0, newNode)
      parent.children.forEach((c, i) => { c.position = i })
      return tree
    }

    case "UPDATE_NODE": {
      const tree = cloneTree(state)
      const node = findNode(tree, action.tempId)
      if (!node) return state
      node.config = { ...node.config, ...action.config }
      return tree
    }

    case "DELETE_NODE": {
      return removeNode(cloneTree(state), action.tempId)
    }

    case "MOVE_NODE": {
      // For now, just update position
      const tree = cloneTree(state)
      const node = findNode(tree, action.tempId)
      if (node) node.position = action.newPosition
      return tree
    }

    default:
      return state
  }
}

// ── Trigger Config Labels ──────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  ad_click: "Ad Click",
  website: "Website",
  direct_wa: "Direct WhatsApp",
  text_match: "Text Match",
  manual: "Manual",
}

// ── V2 Condition Helper Components ───────────────────────────────────────────

function LogicToggle({ logic, onChange }: { logic: "and" | "or"; onChange: (v: "and" | "or") => void }) {
  return (
    <div className="flex w-full sm:inline-flex sm:w-auto rounded-md border border-input text-xs">
      <button
        onClick={() => onChange("and")}
        className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1 min-h-[44px] sm:min-h-0 rounded-l-md transition-colors ${
          logic === "and" ? "bg-blue-100 text-blue-700 font-medium" : "text-muted-foreground hover:bg-accent"
        }`}
      >ALL must match</button>
      <button
        onClick={() => onChange("or")}
        className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1 min-h-[44px] sm:min-h-0 rounded-r-md transition-colors ${
          logic === "or" ? "bg-blue-100 text-blue-700 font-medium" : "text-muted-foreground hover:bg-accent"
        }`}
      >ANY can match</button>
    </div>
  )
}

/** Converts snake_case to Title Case for display */
function humanize(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

const selectClass = "h-10 sm:h-8 rounded-md border border-input bg-white px-2 text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"

function ConditionRow({
  entry, index, fields, onChangeEntry, onRemove, canRemove,
}: {
  entry: ConditionV2Entry
  index: number
  fields: FlowFieldEntry[]
  onChangeEntry: (index: number, patch: Partial<ConditionV2Entry>) => void
  onRemove: (index: number) => void
  canRemove: boolean
}) {
  const selectedField = fields.find(f => f.field_key === entry.field_key)

  // Auto-select first field if only one exists and nothing selected
  React.useEffect(() => {
    if (!entry.field_key && fields.length === 1) {
      onChangeEntry(index, { field_key: fields[0].field_key, value: "" })
    }
  }, [fields.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/50 p-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-xs font-medium text-muted-foreground shrink-0">If</span>

        {/* Field picker */}
        <div className="w-full sm:flex-1 sm:min-w-0">
          <select
            value={entry.field_key}
            onChange={e => onChangeEntry(index, { field_key: e.target.value, value: "" })}
            className={`${selectClass} w-full h-10 sm:h-8`}
          >
            <option value="">Select field...</option>
            {fields.map(f => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
          </select>
        </div>

        {/* Operator */}
        <div className="w-full sm:w-auto sm:shrink-0">
          <select
            value={entry.operator}
            onChange={e => onChangeEntry(index, { operator: e.target.value as "eq" | "neq" })}
            className={`${selectClass} w-full h-10 sm:h-8 sm:w-[70px]`}
          >
            <option value="eq">is</option>
            <option value="neq">is not</option>
          </select>
        </div>

        {/* Value picker — proper dropdown with human-readable labels */}
        <div className="w-full sm:flex-1 sm:min-w-0">
          <select
            value={entry.value}
            onChange={e => onChangeEntry(index, { value: e.target.value })}
            className={`${selectClass} w-full h-10 sm:h-8`}
          >
            <option value="">Select value...</option>
            {(selectedField?.values ?? []).map(v => (
              <option key={v} value={v}>{humanize(v)}</option>
            ))}
          </select>
        </div>

        {/* Remove */}
        {canRemove && (
          <button onClick={() => onRemove(index)} className="self-end text-muted-foreground hover:text-red-600 shrink-0 p-2 sm:p-1 min-h-[44px] sm:min-h-0 flex items-center">
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Validation Context ────────────────────────────────────────────────────────

interface ValidationContextValue {
  registerErrors: (branchId: string, isValid: boolean, flowVersion: string | null) => void
  unregisterErrors: (branchId: string) => void
  allValid: boolean
  flowVersion: string | null
}

const ValidationContext = React.createContext<ValidationContextValue>({
  registerErrors: () => {},
  unregisterErrors: () => {},
  allValid: true,
  flowVersion: null,
})

function useValidationProvider() {
  const [branchStates, setBranchStates] = React.useState<Map<string, { isValid: boolean; flowVersion: string | null }>>(new Map())

  const registerErrors = React.useCallback((branchId: string, isValid: boolean, flowVersion: string | null) => {
    setBranchStates(prev => {
      const next = new Map(prev)
      next.set(branchId, { isValid, flowVersion })
      return next
    })
  }, [])

  const unregisterErrors = React.useCallback((branchId: string) => {
    setBranchStates(prev => {
      const next = new Map(prev)
      next.delete(branchId)
      return next
    })
  }, [])

  const allValid = React.useMemo(() => {
    for (const state of branchStates.values()) {
      if (!state.isValid) return false
    }
    return true
  }, [branchStates])

  // Use the latest flowVersion from any branch
  const flowVersion = React.useMemo(() => {
    for (const state of branchStates.values()) {
      if (state.flowVersion) return state.flowVersion
    }
    return null
  }, [branchStates])

  return { registerErrors, unregisterErrors, allValid, flowVersion }
}

// ── Schema Error Context (branch-level) ───────────────────────────────────────

interface SchemaErrorContextValue {
  nodeErrors: Map<string, string[]>
}

const SchemaErrorContext = React.createContext<SchemaErrorContextValue>({
  nodeErrors: new Map(),
})

// ── Intelligence Components ──────────────────────────────────────────────────

function QuickStartSuggestions({
  fields,
  branchId,
  flowId,
  flowVersion,
  dispatch,
  childCount,
}: {
  fields: FlowFieldEntry[]
  branchId: string
  flowId: string | null
  flowVersion: string | null
  dispatch: React.Dispatch<Action>
  childCount: number
}) {
  const enumFields = fields.filter(f => f.values.length > 0)
  if (enumFields.length === 0) return null

  // Create all conditions at once — one per value for a field
  const handleCreateAllRoutes = (field: FlowFieldEntry) => {
    field.values.forEach((value, i) => {
      dispatch({
        type: "ADD_NODE_WITH_CONFIG",
        parentTempId: branchId,
        nodeType: "condition",
        position: childCount + i,
        config: {
          version: 2,
          schema_version: flowVersion ?? "",
          flow_id: flowId ?? "",
          logic: "and",
          conditions: [{ field_key: field.field_key, operator: "eq", value }],
        },
      })
    })
  }

  // Create single condition for one value
  const handleCreateSingle = (field: FlowFieldEntry, value: string) => {
    dispatch({
      type: "ADD_NODE_WITH_CONFIG",
      parentTempId: branchId,
      nodeType: "condition",
      position: childCount,
      config: {
        version: 2,
        schema_version: flowVersion ?? "",
        flow_id: flowId ?? "",
        logic: "and",
        conditions: [{ field_key: field.field_key, operator: "eq", value }],
      },
    })
  }

  return (
    <div className="mt-2 mb-1 space-y-2">
      {enumFields.map(field => (
        <div key={field.field_key}>
          {/* Create all routes at once */}
          <button
            onClick={() => handleCreateAllRoutes(field)}
            className="text-xs px-3 py-2.5 sm:py-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium mb-1.5 min-h-[44px] sm:min-h-0"
          >
            Create all {field.values.length} routes for {field.label}
          </button>
          {/* Or individual values */}
          <div className="flex flex-wrap gap-1">
            {field.values.map(value => (
              <button
                key={value}
                onClick={() => handleCreateSingle(field, value)}
                className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {humanize(value)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StalenessBadge({ syncedAt }: { syncedAt: string | null }) {
  if (!syncedAt) return null

  const days = daysAgo(new Date(syncedAt))

  let text: string
  if (days === 0) text = "Refreshed today"
  else if (days === 1) text = "Refreshed yesterday"
  else text = `Refreshed ${days} days ago`

  let colorClasses: string
  if (days >= 30) {
    colorClasses = "text-red-600 bg-red-50 border-red-200"
  } else if (days >= 7) {
    colorClasses = "text-amber-600 bg-amber-50 border-amber-200"
  } else {
    colorClasses = "text-green-600 bg-green-50 border-green-200"
  }

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${colorClasses}`}>
      {text}
    </span>
  )
}

function ConfidenceIndicator({
  config,
  schemaFields,
  flowVersion,
}: {
  config: Record<string, unknown>
  schemaFields: FlowFieldEntry[]
  flowVersion: string | null
}) {
  if ((config.version as number) !== 2) return null

  const confidence = getConditionConfidence(
    config as unknown as Parameters<typeof getConditionConfidence>[0],
    schemaFields,
    flowVersion,
  )

  if (confidence === "unknown") return null

  if (confidence === "valid") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
        <CheckCircle2 className="w-3 h-3" />
        This rule will work
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
      <AlertTriangle className="w-3 h-3" />
      Response options may have changed
    </span>
  )
}

function SchemaVersionWarning({
  node,
  flowVersion,
  schemaFields,
}: {
  node: TreeNode
  flowVersion: string | null
  schemaFields: FlowFieldEntry[]
}) {
  if (!flowVersion || schemaFields.length === 0) return null

  // Check if any condition child has a mismatched schema_version
  const hasMismatch = node.children.some(child => {
    if (child.nodeType !== "condition") return false
    if ((child.config.version as number) !== 2) return false
    const sv = child.config.schema_version as string | undefined
    return sv != null && sv !== flowVersion
  })

  if (!hasMismatch) return null

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-2 mb-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800">
          Response options updated since last save. Review your rules.
        </p>
      </div>
    </div>
  )
}

// ── Template Parameter Data Sources ─────────────────────────────────────────────

/** Build parameter data sources dynamically from flow schema fields */
function buildParamSources(schemaFields: FlowFieldEntry[]): Array<{ group: string; options: Array<{ value: string; label: string }> }> {
  const flowOptions = schemaFields.length > 0
    ? schemaFields.map(f => ({ value: `{{flow.${f.field_key}}}`, label: `${f.label} (from flow)` }))
    : [{ value: "{{flow.name}}", label: "Name (from flow)" }] // fallback if no schema loaded

  return [
    { group: "Flow Response", options: flowOptions },
    { group: "User Info (WhatsApp)", options: [
      { value: "{{user.name}}", label: "User Name" },
      { value: "{{user.phone}}", label: "Phone Number" },
    ]},
    { group: "Ad Click Data", options: [
      { value: "{{ad.headline}}", label: "Ad Headline" },
      { value: "{{ad.source_url}}", label: "Source URL" },
      { value: "{{ad.campaign_name}}", label: "Campaign Name" },
    ]},
    { group: "Custom", options: [
      { value: "__custom__", label: "Custom text..." },
    ]},
  ]
}

/** Count {{N}} placeholders in template body text */
function countBodyParams(templateComponents: EnrichedTemplate["components"]): number {
  if (!templateComponents) return 0
  const bodyComp = templateComponents.find(c => c.type === "BODY")
  if (!bodyComp?.text) return 0
  const matches = bodyComp.text.match(/\{\{\d+\}\}/g)
  return matches?.length ?? 0
}

/** Get template body text for preview */
function getBodyText(templateComponents: EnrichedTemplate["components"]): string | null {
  if (!templateComponents) return null
  const bodyComp = templateComponents.find(c => c.type === "BODY")
  return bodyComp?.text ?? null
}

/** Check if template has a flow button */
function hasFlowButton(templateComponents: EnrichedTemplate["components"]): boolean {
  if (!templateComponents) return false
  const buttonsComp = templateComponents.find(c => c.type === "BUTTONS")
  return buttonsComp?.buttons?.some(b => b.type.toLowerCase() === "flow") ?? false
}

/** Get header info from template components */
function getHeaderInfo(templateComponents: EnrichedTemplate["components"]): { format: string } | null {
  if (!templateComponents) return null
  const header = templateComponents.find(c => c.type === "HEADER")
  if (!header?.format) return null
  return { format: header.format } // DOCUMENT, IMAGE, VIDEO, TEXT
}

/** Build API-ready components array from parameter mappings */
function buildComponentsPayload(
  paramValues: string[],
  flowId: string | null,
  headerValue?: { type: string; url: string; filename?: string },
): any[] {
  const result: any[] = []

  // Header parameter (DOCUMENT, IMAGE, VIDEO)
  if (headerValue?.url) {
    const mediaType = headerValue.type.toLowerCase() // "document", "image", "video"
    result.push({
      type: "header",
      parameters: [{
        type: mediaType,
        [mediaType]: {
          link: headerValue.url,
          ...(headerValue.filename ? { filename: headerValue.filename } : {}),
        },
      }],
    })
  }

  // Body parameters
  if (paramValues.length > 0) {
    result.push({
      type: "body",
      parameters: paramValues.map(v => ({
        type: "text",
        text: v || "",
      })),
    })
  }

  // Flow button — auto-inject flow_token with user context
  if (flowId) {
    result.push({
      type: "button",
      sub_type: "flow",
      index: "0",
      parameters: [{
        type: "action",
        action: {
          flow_token: '{"wa_id":"{{user.phone}}","name":"{{user.name}}"}',
        },
      }],
    })
  }

  return result
}

/** Template Parameters Editor — maps template {{N}} variables to data sources */
function TemplateParamsEditor({
  templateComponents,
  flowId,
  paramValues,
  savedHeaderValue,
  onUpdateComponents,
  schemaFields,
}: {
  templateComponents: EnrichedTemplate["components"]
  flowId: string | null
  paramValues: string[]
  savedHeaderValue?: { type: string; url: string; filename?: string }
  onUpdateComponents: (components: any[]) => void
  schemaFields?: FlowFieldEntry[]
}) {
  const paramCount = countBodyParams(templateComponents)
  const bodyText = getBodyText(templateComponents)
  const hasFlow = hasFlowButton(templateComponents)
  const headerInfo = getHeaderInfo(templateComponents)
  const PARAM_SOURCES = buildParamSources(schemaFields ?? [])

  // Header media state
  const [headerUrl, setHeaderUrl] = React.useState(savedHeaderValue?.url ?? "")
  const [headerFilename, setHeaderFilename] = React.useState(savedHeaderValue?.filename ?? "")

  if (paramCount === 0 && !hasFlow && !headerInfo) return null

  // Initialize param values if needed
  const values = React.useMemo(() => {
    const vals = [...paramValues]
    while (vals.length < paramCount) vals.push("")
    return vals
  }, [paramValues, paramCount])

  // Track which params use custom text
  const [customMode, setCustomMode] = React.useState<Set<number>>(() => {
    const set = new Set<number>()
    values.forEach((v, i) => {
      if (v && !PARAM_SOURCES.flatMap(g => g.options).some(o => o.value === v)) {
        set.add(i)
      }
    })
    return set
  })

  const buildHeader = () => headerInfo && headerUrl
    ? { type: headerInfo.format.toLowerCase(), url: headerUrl, filename: headerFilename || undefined }
    : undefined

  const handleParamChange = (index: number, value: string) => {
    const newValues = [...values]
    if (value === "__custom__") {
      setCustomMode(prev => new Set(prev).add(index))
      newValues[index] = ""
    } else {
      setCustomMode(prev => { const s = new Set(prev); s.delete(index); return s })
      newValues[index] = value
    }
    onUpdateComponents(buildComponentsPayload(newValues, flowId, buildHeader()))
  }

  const handleCustomText = (index: number, text: string) => {
    const newValues = [...values]
    newValues[index] = text
    onUpdateComponents(buildComponentsPayload(newValues, flowId, buildHeader()))
  }

  const handleHeaderChange = (url: string, filename: string) => {
    setHeaderUrl(url)
    setHeaderFilename(filename)
    const hdr = headerInfo && url
      ? { type: headerInfo.format.toLowerCase(), url, filename: filename || undefined }
      : undefined
    onUpdateComponents(buildComponentsPayload(values, flowId, hdr))
  }

  // Preview: replace {{N}} with mapped values
  const preview = React.useMemo(() => {
    if (!bodyText) return null
    let text = bodyText
    values.forEach((v, i) => {
      const display = v.startsWith("{{") ? `[${PARAM_SOURCES.flatMap(g => g.options).find(o => o.value === v)?.label ?? v}]` : (v || `{{${i + 1}}}`)
      text = text.replace(`{{${i + 1}}}`, display)
    })
    return text
  }, [bodyText, values])

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-700">Template Parameters</span>
        <span className="text-[10px] text-muted-foreground">({paramCount} variable{paramCount !== 1 ? "s" : ""})</span>
      </div>

      {/* Header media (DOCUMENT, IMAGE, VIDEO) */}
      {headerInfo && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground font-medium">
            Header ({headerInfo.format.toLowerCase()})
          </label>
          <Input
            value={headerUrl}
            onChange={e => handleHeaderChange(e.target.value, headerFilename)}
            placeholder={headerInfo.format === "DOCUMENT" ? "PDF or document URL..." : headerInfo.format === "IMAGE" ? "Image URL..." : "Video URL..."}
            className="h-10 sm:h-8 text-xs"
          />
          {headerInfo.format === "DOCUMENT" && (
            <Input
              value={headerFilename}
              onChange={e => handleHeaderChange(headerUrl, e.target.value)}
              placeholder="Filename (e.g., Brochure.pdf)"
              className="h-10 sm:h-8 text-xs"
            />
          )}
          {!headerUrl && (
            <p className="text-[10px] text-amber-600">Required — template won't send without this</p>
          )}
        </div>
      )}

      {/* Parameter mappings */}
      {values.slice(0, paramCount).map((val, i) => (
        <div key={i} className="space-y-1">
          <label className="text-[11px] text-muted-foreground">
            {"{{"}{ i + 1 }{"}}"}
          </label>
          {customMode.has(i) ? (
            <div className="flex gap-1.5">
              <Input
                value={val}
                onChange={e => handleCustomText(i, e.target.value)}
                placeholder="Enter custom text..."
                className="h-10 sm:h-8 text-xs flex-1"
              />
              <button
                onClick={() => {
                  setCustomMode(prev => { const s = new Set(prev); s.delete(i); return s })
                  handleParamChange(i, "")
                }}
                className="text-xs text-muted-foreground hover:text-foreground px-2 sm:px-1 min-h-[44px] sm:min-h-0 flex items-center"
              >
                <X className="w-4 h-4 sm:w-3 sm:h-3" />
              </button>
            </div>
          ) : (
            <select
              value={val}
              onChange={e => handleParamChange(i, e.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="">Select value...</option>
              {PARAM_SOURCES.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>
      ))}

      {/* Flow token info */}
      {hasFlow && flowId && (
        <div className="flex items-center gap-1.5 text-[11px] text-blue-600 bg-blue-50 rounded px-2 py-1.5">
          <GitBranch className="w-3 h-3 shrink-0" />
          <span>Flow token auto-includes user name &amp; phone number</span>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="border-t pt-2">
          <p className="text-[11px] text-muted-foreground mb-1">Preview</p>
          <p className="text-xs bg-white rounded border p-2 leading-relaxed">{preview}</p>
        </div>
      )}
    </div>
  )
}

// ── NodeCard Components ─────────────────────────────────────────────────────────

/** Dynamic multi-value list for trigger config fields */
function TriggerMultiField({
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  label: string
  hint?: string
  placeholder: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  const handleAdd = () => onChange([...values, ""])
  const handleChange = (i: number, v: string) => {
    const next = [...values]
    next[i] = v
    onChange(next)
  }
  const handleRemove = (i: number) => onChange(values.filter((_, idx) => idx !== i))

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground">
          {label} {hint && <span className="text-[10px]">({hint})</span>}
        </label>
        <button
          onClick={handleAdd}
          className="text-[10px] text-blue-600 hover:text-blue-800 min-h-[44px] sm:min-h-0 px-2 sm:px-0"
        >
          + Add
        </button>
      </div>
      {values.length === 0 && (
        <button
          onClick={handleAdd}
          className="w-full h-10 sm:h-7 mt-0.5 rounded-md border border-dashed border-gray-300 text-xs text-muted-foreground hover:border-gray-400 transition-colors"
        >
          + Add {label.toLowerCase()}
        </button>
      )}
      {values.map((val, i) => (
        <div key={i} className="flex gap-1 mt-0.5">
          <Input
            value={val}
            onChange={e => handleChange(i, e.target.value)}
            placeholder={placeholder}
            className="h-10 sm:h-8 text-xs flex-1"
          />
          <button
            onClick={() => handleRemove(i)}
            className="text-muted-foreground hover:text-red-600 px-2 sm:px-1 shrink-0 min-h-[44px] sm:min-h-0 flex items-center"
          >
            <Trash2 className="w-4 h-4 sm:w-3 sm:h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

/** Ad Click trigger config with dynamic multi-value fields */
function TriggerAdClickConfig({
  node,
  onUpdate,
}: {
  node: TreeNode
  onUpdate: (config: Record<string, unknown>) => void
}) {
  // Migrate old single-value config to arrays
  const campaignIds: string[] = Array.isArray(node.config.campaignIds)
    ? (node.config.campaignIds as string[])
    : (node.config.campaignId ? [node.config.campaignId as string] : [])
  const sourceIds: string[] = Array.isArray(node.config.sourceIds)
    ? (node.config.sourceIds as string[])
    : (node.config.sourceId ? [node.config.sourceId as string] : [])
  const textMatches: string[] = Array.isArray(node.config.textMatches)
    ? (node.config.textMatches as string[])
    : (node.config.textMatch ? [node.config.textMatch as string] : [])

  const update = (patch: Record<string, unknown>) => {
    // Remove old single-value keys when using arrays
    const { campaignId, sourceId, textMatch, ...rest } = node.config
    onUpdate({ ...rest, ...patch })
  }

  return (
    <div className="space-y-2.5 ml-0 sm:ml-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="text-[11px] text-muted-foreground">Match logic:</span>
        <LogicToggle
          logic={(node.config.triggerLogic as "and" | "or") ?? "or"}
          onChange={v => update({ ...node.config, triggerLogic: v })}
        />
      </div>

      <TriggerMultiField
        label="Campaign IDs"
        placeholder="Meta campaign ID"
        values={campaignIds}
        onChange={v => update({ ...node.config, campaignIds: v })}
      />

      <TriggerMultiField
        label="Source IDs"
        hint="from referral"
        placeholder="Ad source ID (referral.source_id)"
        values={sourceIds}
        onChange={v => update({ ...node.config, sourceIds: v })}
      />

      <TriggerMultiField
        label="Text Matches"
        hint="message content"
        placeholder="Pre-filled message text from ad"
        values={textMatches}
        onChange={v => update({ ...node.config, textMatches: v })}
      />

      <p className="text-[10px] text-muted-foreground">
        {(node.config.triggerLogic as string) === "and"
          ? "ALL groups must match (at least one value per group)"
          : "ANY match triggers (any campaign ID OR source ID OR text match OR new conversation)"
        }
      </p>
    </div>
  )
}

function TriggerCard({
  node,
  triggerType,
  onUpdate,
}: {
  node: TreeNode
  triggerType: string
  onUpdate: (config: Record<string, unknown>) => void
}) {
  return (
    <Card className="bg-[#128C7E]/10 border-[#128C7E]/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-[#128C7E]" />
        <span className="text-sm font-semibold text-[#075E54]">Trigger</span>
        <Badge variant="outline" className="text-[10px] bg-[#128C7E]/10 text-[#075E54] border-[#128C7E]/30">
          {TRIGGER_LABELS[triggerType] ?? triggerType}
        </Badge>
      </div>

      {/* Ad Click trigger config */}
      {triggerType === "ad_click" && (
        <TriggerAdClickConfig node={node} onUpdate={onUpdate} />
      )}

      {/* Text Match trigger config */}
      {triggerType === "text_match" && (
        <div className="space-y-2 ml-0 sm:ml-6">
          <div>
            <label className="text-[11px] text-muted-foreground">Exact Text</label>
            <Input
              value={(node.config.exactText as string) ?? ""}
              onChange={e => onUpdate({ ...node.config, exactText: e.target.value })}
              placeholder="Exact message to match (e.g. /test_lead_flow)"
              className="h-10 sm:h-8 text-xs mt-0.5"
            />
          </div>
        </div>
      )}

      {/* Website trigger config */}
      {triggerType === "website" && (
        <div className="space-y-2 ml-0 sm:ml-6">
          <div>
            <label className="text-[11px] text-muted-foreground">Source URL Contains</label>
            <Input
              value={(node.config.sourceUrlContains as string) ?? ""}
              onChange={e => onUpdate({ ...node.config, sourceUrlContains: e.target.value })}
              placeholder="URL substring to match"
              className="h-10 sm:h-8 text-xs mt-0.5"
            />
          </div>
        </div>
      )}

      {/* Direct WA / Manual — no config needed */}
      {(triggerType === "direct_wa" || triggerType === "manual") && (
        <p className="text-[10px] text-muted-foreground ml-0 sm:ml-6">
          {triggerType === "direct_wa" ? "Triggers on any direct WhatsApp message (no ad referral)" : "Triggered manually via API"}
        </p>
      )}
    </Card>
  )
}

function ActionCard({
  node,
  onUpdate,
  onDelete,
  dispatch,
}: {
  node: TreeNode
  onUpdate: (config: Record<string, unknown>) => void
  onDelete: () => void
  dispatch: React.Dispatch<Action>
}) {
  const actionType = (node.config.actionType as string) ?? ""
  const { templates } = useTemplates()
  const { templates: enrichedTemplates } = useEnrichedTemplates()
  const { syncSchema, fields: schemaFields, flowVersion, syncedAt, syncing, error: syncError } = useFlowSchema()
  const { tenants } = useTenants()
  const [tenantId, setTenantId] = React.useState<string | number | null>(
    (node.config.tenantId as string | number) ?? null
  )
  const { flows } = useTenantFlows(tenantId)

  // Detect flow_id for selected template
  const selectedTemplate = (node.config.templateName as string) ?? ""
  const flowId = React.useMemo(() => {
    if (!selectedTemplate) return null
    const match = enrichedTemplates.find(t => t.name === selectedTemplate)
    return match?.flow_id ?? null
  }, [selectedTemplate, enrichedTemplates])

  // Auto-sync flow fields when flow template is selected
  const [hasAutoSynced, setHasAutoSynced] = React.useState(false)
  React.useEffect(() => {
    if (flowId && !hasAutoSynced) {
      setHasAutoSynced(true)
      syncSchema(flowId).catch(() => {})
    }
  }, [flowId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if branch already exists as a child
  const hasBranch = node.children.some(c => c.nodeType === "branch")

  // Add smart branch with pre-populated conditions
  const handleAddSmartBranch = () => {
    if (!flowId || !schemaFields.length) return

    // Create branch node
    dispatch({
      type: "ADD_NODE",
      parentTempId: node.tempId,
      nodeType: "branch",
      position: node.children.length,
    })
  }

  const actionIcon = (() => {
    switch (actionType) {
      case "send_template": return <Send className="w-4 h-4 text-green-600" />
      case "send_flow": return <GitBranch className="w-4 h-4 text-blue-600" />
      case "send_text": return <MessageSquare className="w-4 h-4 text-gray-600" />
      case "wait": return <Clock className="w-4 h-4 text-yellow-600" />
      default: return <Zap className="w-4 h-4 text-gray-400" />
    }
  })()

  return (
    <Card className="border-l-4 border-l-green-500 p-3 sm:p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {actionIcon}
          <span className="text-sm font-medium">Action</span>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-7 sm:w-7 text-muted-foreground hover:text-red-600" onClick={onDelete}>
          <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        {/* Action type selector */}
        <select
          value={actionType}
          onChange={e => onUpdate({ actionType: e.target.value, templateName: undefined, flowSlug: undefined, text: undefined, waitMinutes: undefined, tenantId: undefined })}
          className="w-full h-10 sm:h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select action...</option>
          <option value="send_template">Send Template</option>
          <option value="send_flow">Send Flow</option>
          <option value="send_text">Send Text</option>
          <option value="wait">Wait</option>
        </select>

        {/* Send Template */}
        {actionType === "send_template" && (
          <>
            <select
              value={selectedTemplate}
              onChange={e => {
                onUpdate({ templateName: e.target.value })
                setHasAutoSynced(false) // reset so new template auto-syncs
              }}
              className="w-full h-10 sm:h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select template...</option>
              {templates.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>

            {/* Template parameters editor */}
            {selectedTemplate && (() => {
              const tpl = enrichedTemplates.find(t => t.name === selectedTemplate)
              if (!tpl?.components) return null
              // Extract current param values from saved components
              const savedComps = (node.config.components as any[]) ?? []
              const savedBodyComp = savedComps.find((c: any) => c.type === "body")
              const savedParamValues: string[] = (savedBodyComp?.parameters ?? []).map((p: any) => p.text ?? "")
              const savedHeaderComp = savedComps.find((c: any) => c.type === "header")
              const savedHeaderParam = savedHeaderComp?.parameters?.[0]
              const savedHeaderValue = savedHeaderParam ? {
                type: savedHeaderParam.type ?? "document",
                url: savedHeaderParam[savedHeaderParam.type]?.link ?? "",
                filename: savedHeaderParam[savedHeaderParam.type]?.filename ?? "",
              } : undefined
              return (
                <TemplateParamsEditor
                  templateComponents={tpl.components}
                  flowId={flowId}
                  paramValues={savedParamValues}
                  savedHeaderValue={savedHeaderValue}
                  onUpdateComponents={(components) => onUpdate({ components })}
                  schemaFields={schemaFields}
                />
              )
            })()}

            {/* Flow detected — show smart branching prompt */}
            {flowId && !hasBranch && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-blue-800">This template includes a Flow</span>
                </div>
                {syncing ? (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading response options...
                  </div>
                ) : syncError ? (
                  <p className="text-xs text-red-600">{syncError}</p>
                ) : schemaFields.length > 0 ? (
                  <div>
                    <p className="text-xs text-blue-700 mb-2">
                      {schemaFields.length} response {schemaFields.length === 1 ? "field" : "fields"} found. Add smart branching to route users based on their responses.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 sm:h-7 text-xs gap-1.5 bg-white w-full sm:w-auto"
                      onClick={handleAddSmartBranch}
                    >
                      <GitBranch className="w-3 h-3" />
                      Add smart branching
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-blue-600">No response fields detected for this flow.</p>
                )}
              </div>
            )}

            {/* Flow badge if branch already exists */}
            {flowId && hasBranch && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <GitBranch className="w-3 h-3" />
                <span>Smart branching active</span>
                {syncedAt && <StalenessBadge syncedAt={syncedAt} />}
              </div>
            )}
          </>
        )}

        {/* Send Flow */}
        {actionType === "send_flow" && (
          <div className="space-y-2">
            <select
              value={tenantId?.toString() ?? ""}
              onChange={e => { setTenantId(e.target.value); onUpdate({ tenantId: e.target.value, flowSlug: undefined }) }}
              className="w-full h-10 sm:h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select tenant...</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id.toString()}>{t.name}</option>
              ))}
            </select>
            {tenantId && (
              <select
                value={(node.config.flowSlug as string) ?? ""}
                onChange={e => onUpdate({ flowSlug: e.target.value })}
                className="w-full h-10 sm:h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select flow...</option>
                {flows.map(f => (
                  <option key={f.id} value={f.slug}>{f.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Send Text */}
        {actionType === "send_text" && (
          <textarea
            value={(node.config.text as string) ?? ""}
            onChange={e => onUpdate({ text: e.target.value })}
            placeholder="Enter message text..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}

        {/* Wait */}
        {actionType === "wait" && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={(node.config.waitMinutes as number) ?? ""}
              onChange={e => onUpdate({ waitMinutes: parseInt(e.target.value) || 0 })}
              placeholder="Minutes"
              className="h-10 sm:h-8 text-xs w-full sm:w-24"
            />
            <span className="text-xs text-muted-foreground">minutes</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function BranchCard({
  node,
  onUpdate,
  onDelete,
  templateName,
  schemaFields,
  flowId,
  flowVersion,
  syncing,
  syncError,
  syncedAt,
  onSyncSchema,
  hasLoadedOnce,
  dispatch,
}: {
  node: TreeNode
  onUpdate: (config: Record<string, unknown>) => void
  onDelete: () => void
  templateName: string | null
  schemaFields: FlowFieldEntry[]
  flowId: string | null
  flowVersion: string | null
  syncing: boolean
  syncError: string | null
  syncedAt: string | null
  onSyncSchema: () => void
  hasLoadedOnce: boolean
  dispatch: React.Dispatch<Action>
}) {
  // Check if branch has any condition children with non-empty conditions
  const hasConditionsWithContent = node.children.some(child => {
    if (child.nodeType !== "condition") return false
    if ((child.config.version as number) === 2) {
      const conditions = (child.config.conditions as Array<{ field_key: string }>) ?? []
      return conditions.some(c => c.field_key)
    }
    return child.config.operator || child.config.value
  })

  return (
    <Card className="border-l-4 border-l-blue-500 p-3 sm:p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">Branch</span>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-7 sm:w-7 text-muted-foreground hover:text-red-600" onClick={onDelete}>
          <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>
      </div>

      {/* Load / Refresh response options button + Staleness badge */}
      {flowId && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 sm:h-7 text-xs gap-1.5 w-full sm:w-auto"
            onClick={onSyncSchema}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {hasLoadedOnce ? "Refresh response options" : "Load response options"}
          </Button>
          <StalenessBadge syncedAt={syncedAt} />
        </div>
      )}

      {/* Sync error */}
      {syncError && (
        <p className="text-xs text-red-600 mb-2">{syncError}</p>
      )}

      {/* Schema version warning banner */}
      <SchemaVersionWarning node={node} flowVersion={flowVersion} schemaFields={schemaFields} />

      {/* Quick-start suggestions -- only when fields loaded and no conditions with content */}
      {hasLoadedOnce && schemaFields.length > 0 && !hasConditionsWithContent && (
        <QuickStartSuggestions
          fields={schemaFields}
          branchId={node.tempId}
          flowId={flowId}
          flowVersion={flowVersion}
          dispatch={dispatch}
          childCount={node.children.length}
        />
      )}

      {/* Legacy field name input -- only if no flowId (backward compat) */}
      {!flowId && (
        <div className="space-y-2">
          <Input
            value={(node.config.fieldName as string) ?? ""}
            onChange={e => onUpdate({ fieldName: e.target.value })}
            placeholder="Field name (e.g. intent, space_type)"
            className="h-8 text-xs"
          />
          <select
            value={(node.config.source as string) ?? "flow_field"}
            onChange={e => onUpdate({ source: e.target.value })}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="flow_field">Flow Field</option>
            <option value="user_reply">User Reply</option>
          </select>
        </div>
      )}

      {/* Default branch label */}
      <p className="text-xs text-muted-foreground mt-3">Unmatched responses take the default path</p>
    </Card>
  )
}

function ConditionCard({
  node,
  onUpdate,
  onDelete,
  schemaFields,
  flowId,
  flowVersion,
}: {
  node: TreeNode
  onUpdate: (config: Record<string, unknown>) => void
  onDelete: () => void
  schemaFields: FlowFieldEntry[]
  flowId: string | null
  flowVersion: string | null
}) {
  const isV2 = (node.config.version as number) === 2
  const hasSchema = schemaFields.length > 0

  // Auto-upgrade to v2 when schema is available and condition is still v1
  React.useEffect(() => {
    if (hasSchema && !isV2 && flowId && flowVersion) {
      // Upgrade to v2 — v1 default config (operator/value) is not user data worth preserving
      onUpdate({
        version: 2,
        schema_version: flowVersion,
        flow_id: flowId,
        logic: "and",
        conditions: [{ field_key: "", operator: "eq", value: "" }],
      } satisfies ConditionV2Config as unknown as Record<string, unknown>)
    }
  }, [hasSchema, isV2, flowId, flowVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // V2 condition rendering
  if (isV2) {
    const config = node.config as unknown as ConditionV2Config
    const conditions = config.conditions ?? [{ field_key: "", operator: "eq" as const, value: "" }]
    const logic = config.logic ?? "and"

    const updateConditions = (newConditions: ConditionV2Entry[], newLogic?: "and" | "or") => {
      onUpdate({
        version: 2,
        schema_version: flowVersion ?? config.schema_version,
        flow_id: flowId ?? config.flow_id,
        logic: newLogic ?? logic,
        conditions: newConditions,
      } satisfies ConditionV2Config as unknown as Record<string, unknown>)
    }

    const handleChangeEntry = (index: number, patch: Partial<ConditionV2Entry>) => {
      const updated = conditions.map((c, i) => i === index ? { ...c, ...patch } : c)
      updateConditions(updated)
    }

    const handleRemoveEntry = (index: number) => {
      const updated = conditions.filter((_, i) => i !== index)
      updateConditions(updated.length > 0 ? updated : [{ field_key: "", operator: "eq", value: "" }])
    }

    const handleAddEntry = () => {
      updateConditions([...conditions, { field_key: "", operator: "eq", value: "" }])
    }

    // Read validation errors from context
    const { nodeErrors } = React.useContext(SchemaErrorContext)
    const errors = nodeErrors.get(node.tempId) ?? []

    return (
      <Card className="border-l-4 border-l-yellow-500 p-3 sm:p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ChevronDown className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium">Condition</span>
            <Badge variant="outline" className="text-[10px]">v2</Badge>
            <ConfidenceIndicator config={node.config} schemaFields={schemaFields} flowVersion={flowVersion} />
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-7 sm:w-7 text-muted-foreground hover:text-red-600" onClick={onDelete}>
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>

        <div className="space-y-2">
          {/* Logic toggle -- only show when 2+ conditions */}
          {conditions.length >= 2 && (
            <LogicToggle logic={logic} onChange={v => updateConditions(conditions, v)} />
          )}

          {/* Condition rows */}
          {conditions.map((entry, i) => (
            <ConditionRow
              key={i}
              entry={entry}
              index={i}
              fields={schemaFields}
              onChangeEntry={handleChangeEntry}
              onRemove={handleRemoveEntry}
              canRemove={conditions.length > 1}
            />
          ))}

          {/* Inline validation errors */}
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-red-600 mt-1">{err}</p>
          ))}

          {/* Add another condition */}
          <button
            onClick={handleAddEntry}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-0"
          >
            <Plus className="w-3 h-3" />
            Add another condition
          </button>
        </div>
      </Card>
    )
  }

  // Legacy v1 condition -- read-only with badge
  if (node.config.operator || node.config.value) {
    return (
      <Card className="border-l-4 border-l-yellow-500 p-3 opacity-80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ChevronDown className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium">Condition</span>
            <Badge variant="secondary" className="text-[10px]">Legacy condition</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {(node.config.operator as string) ?? "equals"}: {(node.config.value as string) ?? "(empty)"}
        </p>
      </Card>
    )
  }

  // Fresh condition with no schema -- show empty v1 style (editable) so it still works without schema
  return (
    <Card className="border-l-4 border-l-yellow-500 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ChevronDown className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium">Condition</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="space-y-2">
        <select
          value={(node.config.operator as string) ?? "equals"}
          onChange={e => onUpdate({ operator: e.target.value })}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="equals">Equals</option>
          <option value="contains">Contains</option>
          <option value="exists">Exists</option>
          <option value="default">Default</option>
        </select>
        {(node.config.operator as string) !== "default" && (node.config.operator as string) !== "exists" && (
          <Input
            value={(node.config.value as string) ?? ""}
            onChange={e => onUpdate({ value: e.target.value })}
            placeholder="Value..."
            className="h-8 text-xs"
          />
        )}
      </div>
    </Card>
  )
}

// ── Add Node Button ────────────────────────────────────────────────────────────

function AddNodeButton({
  parentId,
  parentNodeType,
  onAdd,
  childCount,
}: {
  parentId: string
  parentNodeType: TreeNode["nodeType"]
  onAdd: (parentTempId: string, nodeType: TreeNode["nodeType"], position: number) => void
  childCount: number
}) {
  const [open, setOpen] = React.useState(false)

  // Inside a branch, can only add conditions
  // Inside a condition or after trigger/action, can add action or branch
  const options: { type: TreeNode["nodeType"]; label: string; icon: React.ReactNode }[] = (() => {
    if (parentNodeType === "branch") {
      return [
        { type: "condition", label: "Add Condition", icon: <ChevronDown className="w-4 h-4" /> },
      ]
    }
    return [
      { type: "action", label: "Add Action", icon: <Zap className="w-4 h-4" /> },
      { type: "branch", label: "Add Branch", icon: <GitBranch className="w-4 h-4" /> },
    ]
  })()

  return (
    <div className="flex justify-center py-2 relative">
      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 sm:h-7 sm:w-7 p-0 rounded-full border-dashed border-gray-300 hover:border-[#128C7E] hover:text-[#128C7E]"
        onClick={() => setOpen(o => !o)}
      >
        <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </Button>
      {open && (
        <div className="absolute top-full mt-1 w-48 sm:w-44 rounded-md border bg-popover p-1 shadow-md z-50">
          {options.map(opt => (
            <button
              key={opt.type}
              onClick={() => {
                onAdd(parentId, opt.type, childCount)
                setOpen(false)
              }}
              className="flex items-center gap-2 w-full px-3 py-3 sm:py-2 text-sm rounded-md hover:bg-accent transition-colors text-left min-h-[44px] sm:min-h-0"
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Branch Node Wrapper (hooks must always be called) ────────────────────────

function BranchNodeWrapper({
  node,
  depth,
  triggerType,
  dispatch,
  templateName,
}: {
  node: TreeNode
  depth: number
  triggerType: string
  dispatch: React.Dispatch<Action>
  templateName: string | null
}) {
  const { syncSchema, fields: schemaFields, flowVersion, syncedAt, syncing, error: syncError } = useFlowSchema()
  const { templates: enrichedTemplates } = useEnrichedTemplates()
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false)
  const validationCtx = React.useContext(ValidationContext)

  // Resolve flowId from templateName via enriched templates
  const flowId = React.useMemo(() => {
    if (!templateName) return null
    const match = enrichedTemplates.find(t => t.name === templateName)
    return match?.flow_id ?? null
  }, [templateName, enrichedTemplates])

  // Compute validation
  const validation = React.useMemo(
    () => validateTree(node, schemaFields, flowVersion),
    [node, schemaFields, flowVersion],
  )

  // Register validation state with page-level context
  React.useEffect(() => {
    validationCtx.registerErrors(node.tempId, validation.isValid, flowVersion)
    return () => validationCtx.unregisterErrors(node.tempId)
  }, [node.tempId, validation.isValid, flowVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load schema on mount when flowId exists and v2 conditions are saved
  const hasV2Children = node.children.some(c => c.nodeType === "condition" && (c.config.version as number) === 2)
  React.useEffect(() => {
    if (flowId && hasV2Children && schemaFields.length === 0 && !syncing && !hasLoadedOnce) {
      syncSchema(flowId).then(() => setHasLoadedOnce(true)).catch(() => {})
    }
  }, [flowId, hasV2Children]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSyncSchema = React.useCallback(async () => {
    if (!flowId) return
    try {
      await syncSchema(flowId)
      setHasLoadedOnce(true)
    } catch {
      // error is captured in syncError
    }
  }, [flowId, syncSchema])

  const onUpdate = (config: Record<string, unknown>) =>
    dispatch({ type: "UPDATE_NODE", tempId: node.tempId, config })

  const onDelete = () =>
    dispatch({ type: "DELETE_NODE", tempId: node.tempId })

  const onAdd = (parentTempId: string, nodeType: TreeNode["nodeType"], position: number) =>
    dispatch({ type: "ADD_NODE", parentTempId, nodeType, position })

  return (
    <SchemaErrorContext.Provider value={{ nodeErrors: validation.nodeErrors }}>
      <div className={depth > 0 ? "pl-1 sm:pl-3" : ""}>
        <div className={depth > 0 ? "border-l-2 border-blue-300 pl-2 sm:pl-3" : ""}>
          {/* Branch card */}
          <div className="py-1">
            <BranchCard
              node={node}
              onUpdate={onUpdate}
              onDelete={onDelete}
              templateName={templateName}
              schemaFields={schemaFields}
              flowId={flowId}
              flowVersion={flowVersion}
              syncing={syncing}
              syncError={syncError}
              syncedAt={syncedAt}
              onSyncSchema={handleSyncSchema}
              hasLoadedOnce={hasLoadedOnce}
              dispatch={dispatch}
            />
          </div>

          {/* Children (conditions) */}
          {node.children
            .sort((a, b) => a.position - b.position)
            .map(child => {
              if (child.nodeType === "condition") {
                return (
                  <div key={child.tempId} className="pl-1 sm:pl-2">
                    <div className="border-l-2 border-yellow-400 pl-2 sm:pl-3">
                      <div className="py-1">
                        <ConditionCard
                          node={child}
                          onUpdate={(config) => dispatch({ type: "UPDATE_NODE", tempId: child.tempId, config })}
                          onDelete={() => dispatch({ type: "DELETE_NODE", tempId: child.tempId })}
                          schemaFields={schemaFields}
                          flowId={flowId}
                          flowVersion={flowVersion}
                        />
                      </div>

                      {/* Render condition's children recursively */}
                      {child.children
                        .sort((a, b) => a.position - b.position)
                        .map(grandChild => (
                          <NodeRenderer
                            key={grandChild.tempId}
                            node={grandChild}
                            depth={Math.min(depth + 1, 2)}
                            triggerType={triggerType}
                            dispatch={dispatch}
                            templateName={templateName}
                          />
                        ))}

                      {/* Add button under condition */}
                      <AddNodeButton
                        parentId={child.tempId}
                        parentNodeType={child.nodeType}
                        onAdd={onAdd}
                        childCount={child.children.length}
                      />
                    </div>
                  </div>
                )
              }
              // Non-condition children under branch (shouldn't happen, but handle gracefully)
              return (
                <NodeRenderer
                  key={child.tempId}
                  node={child}
                  depth={depth + 1}
                  triggerType={triggerType}
                  dispatch={dispatch}
                  templateName={templateName}
                />
              )
            })}

          {/* Add button under branch */}
          <AddNodeButton
            parentId={node.tempId}
            parentNodeType={node.nodeType}
            onAdd={onAdd}
            childCount={node.children.length}
          />
        </div>
      </div>
    </SchemaErrorContext.Provider>
  )
}

// ── Recursive Node Renderer ────────────────────────────────────────────────────

function NodeRenderer({
  node,
  depth,
  triggerType,
  dispatch,
  templateName,
}: {
  node: TreeNode
  depth: number
  triggerType: string
  dispatch: React.Dispatch<Action>
  templateName: string | null
}) {
  // Branch nodes delegate to BranchNodeWrapper (which always calls hooks)
  if (node.nodeType === "branch") {
    return (
      <BranchNodeWrapper
        node={node}
        depth={depth}
        triggerType={triggerType}
        dispatch={dispatch}
        templateName={templateName}
      />
    )
  }

  const onUpdate = (config: Record<string, unknown>) =>
    dispatch({ type: "UPDATE_NODE", tempId: node.tempId, config })

  const onDelete = () =>
    dispatch({ type: "DELETE_NODE", tempId: node.tempId })

  const onAdd = (parentTempId: string, nodeType: TreeNode["nodeType"], position: number) =>
    dispatch({ type: "ADD_NODE", parentTempId, nodeType, position })

  const renderCard = () => {
    switch (node.nodeType) {
      case "trigger":
        return <TriggerCard node={node} triggerType={triggerType} onUpdate={onUpdate} />
      case "action":
        return <ActionCard node={node} onUpdate={onUpdate} onDelete={onDelete} dispatch={dispatch} />
      case "condition":
        // Standalone condition (not under branch) -- no schema available
        return (
          <ConditionCard
            node={node}
            onUpdate={onUpdate}
            onDelete={onDelete}
            schemaFields={[]}
            flowId={null}
            flowVersion={null}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className={depth > 0 ? "pl-1 sm:pl-2" : ""}>
      <div className={depth > 0 ? "border-l-2 border-green-400 pl-2 sm:pl-3" : ""}>
        {/* The card */}
        <div className="py-1">
          {renderCard()}
        </div>

        {/* Children */}
        {node.children
          .sort((a, b) => a.position - b.position)
          .map(child => (
            <NodeRenderer
              key={child.tempId}
              node={child}
              depth={depth + 1}
              triggerType={triggerType}
              dispatch={dispatch}
              templateName={templateName}
            />
          ))}

        {/* Add button */}
        <AddNodeButton
          parentId={node.tempId}
          parentNodeType={node.nodeType}
          onAdd={onAdd}
          childCount={node.children.length}
        />
      </div>
    </div>
  )
}

// ── Flat Step View (Mobile) ────────────────────────────────────────────────────

/** Action type labels */
const ACTION_LABELS: Record<string, string> = {
  send_template: "Send Template",
  send_flow: "Send Flow",
  send_text: "Send Text",
  wait: "Wait",
}

interface FlatStep {
  node: TreeNode
  label: string
  sublabel?: string
  stepNumber: string
  color: string
  parentLabel?: string
}

/** Convert index to letter: 0→a, 1→b, ... */
function toLetter(i: number): string {
  return String.fromCharCode(97 + i) // a, b, c, ...
}

/** Convert index to roman: 0→i, 1→ii, ... */
function toRoman(i: number): string {
  const numerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
  return numerals[i] ?? String(i + 1)
}

function flattenToSteps(
  node: TreeNode,
  steps: FlatStep[] = [],
  parentNumber: string = "",
  siblingIndex: number = 0,
  depth: number = 0,
  parentLabel?: string,
): FlatStep[] {
  const colors: Record<string, string> = {
    trigger: "border-[#128C7E] text-[#128C7E]",
    action: "border-green-500 text-green-600",
    branch: "border-blue-500 text-blue-600",
    condition: "border-yellow-500 text-yellow-600",
  }
  const color = colors[node.nodeType] ?? "border-gray-400 text-gray-600"

  // Build step number — show ONLY the current level identifier, not concatenated
  let stepNumber: string
  if (depth <= 1) {
    // Top-level: 1, 2, 3, 4...
    stepNumber = String(steps.length + 1)
  } else if (depth === 2) {
    // Branch children: a, b, c...
    stepNumber = toLetter(siblingIndex)
  } else if (depth === 3) {
    // Condition children: i, ii, iii...
    stepNumber = toRoman(siblingIndex)
  } else {
    // Deeper nesting: 1, 2, 3...
    stepNumber = String(siblingIndex + 1)
  }

  // Build label and sublabel
  let label = ""
  let sublabel = ""

  switch (node.nodeType) {
    case "trigger":
      label = "Trigger"
      sublabel = TRIGGER_LABELS[node.config.triggerType as string] ?? "Ad Click"
      break
    case "action": {
      const actionType = (node.config.actionType as string) ?? ""
      label = ACTION_LABELS[actionType] ?? "Action"
      sublabel = (node.config.templateName as string) ?? (node.config.text as string)?.substring(0, 30) ?? ""
      break
    }
    case "branch":
      label = "Branch"
      sublabel = `${node.children.filter(c => c.nodeType === "condition").length} conditions`
      break
    case "condition":
      if ((node.config.version as number) === 2) {
        const conditions = (node.config.conditions as Array<{ field_key: string; value: string }>) ?? []
        if (conditions[0]?.value) {
          label = `If ${humanize(conditions[0].field_key)}`
          sublabel = `= ${humanize(conditions[0].value)}`
        } else {
          label = "Condition"
          sublabel = "Not configured"
        }
      } else {
        label = "Condition"
        sublabel = `${node.config.operator ?? "eq"} ${node.config.value ?? ""}`
      }
      break
  }

  steps.push({ node, label, sublabel, stepNumber, color, parentLabel })

  // Determine child depth for numbering
  const childDepth = node.nodeType === "branch" ? 2
    : node.nodeType === "condition" ? 3
    : depth < 2 ? 1 : depth + 1

  const sorted = node.children.sort((a, b) => a.position - b.position)
  sorted.forEach((child, i) => {
    flattenToSteps(child, steps, stepNumber, i, childDepth, label + (sublabel ? `: ${sublabel}` : ""))
  })

  return steps
}

function FlatStepView({
  tree,
  triggerType,
  dispatch,
  templateName,
}: {
  tree: TreeNode
  triggerType: string
  dispatch: React.Dispatch<Action>
  templateName: string | null
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const steps = React.useMemo(() => flattenToSteps(tree), [tree])

  // Schema hooks for condition/branch cards
  const { syncSchema, fields: schemaFields, flowVersion, syncedAt, syncing, error: syncError } = useFlowSchema()
  const { templates: enrichedTemplates } = useEnrichedTemplates()
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false)

  // Resolve flowId from templateName
  const flowId = React.useMemo(() => {
    if (!templateName) return null
    const match = enrichedTemplates.find(t => t.name === templateName)
    return match?.flow_id ?? null
  }, [templateName, enrichedTemplates])

  // Auto-load schema when flowId available and conditions exist
  const hasV2Conditions = steps.some(s => s.node.nodeType === "condition" && (s.node.config.version as number) === 2)
  React.useEffect(() => {
    if (flowId && hasV2Conditions && schemaFields.length === 0 && !syncing && !hasLoadedOnce) {
      syncSchema(flowId).then(() => setHasLoadedOnce(true)).catch(() => {})
    }
  }, [flowId, hasV2Conditions]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="divide-y">
      {steps.map((step, i) => {
        const isExpanded = expandedId === step.node.tempId
        const onUpdate = (config: Record<string, unknown>) =>
          dispatch({ type: "UPDATE_NODE", tempId: step.node.tempId, config })
        const onDelete = () =>
          dispatch({ type: "DELETE_NODE", tempId: step.node.tempId })
        const onAdd = (parentTempId: string, nodeType: TreeNode["nodeType"], position: number) =>
          dispatch({ type: "ADD_NODE", parentTempId, nodeType, position })

        return (
          <div key={step.node.tempId}>
            {/* Step header — tap to expand/collapse */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : step.node.tempId)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
            >
              {/* Step number with hierarchical label */}
              <div className={`min-w-[36px] h-9 rounded-full border-2 ${step.color} flex items-center justify-center shrink-0 text-xs font-bold px-1.5`}>
                {step.stepNumber}
              </div>
              {/* Label + sublabel */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{step.label}</p>
                {step.sublabel && (
                  <p className="text-[11px] text-muted-foreground truncate">{step.sublabel}</p>
                )}
              </div>
              {/* Expand arrow */}
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>

            {/* Expanded content — render the actual card */}
            {isExpanded && (
              <div className="px-3 pb-4 bg-gray-50/50">
                {step.node.nodeType === "trigger" && (
                  <TriggerCard node={step.node} triggerType={triggerType} onUpdate={onUpdate} />
                )}
                {step.node.nodeType === "action" && (
                  <ActionCard node={step.node} onUpdate={onUpdate} onDelete={onDelete} dispatch={dispatch} />
                )}
                {step.node.nodeType === "branch" && (
                  <Card className="border-l-4 border-l-blue-500 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <GitBranch className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Branch</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Tap conditions below to configure each branch path.</p>
                    <p className="text-xs text-muted-foreground mt-1">Unmatched responses take the default path.</p>
                  </Card>
                )}
                {step.node.nodeType === "condition" && (
                  <ConditionCard
                    node={step.node}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    schemaFields={schemaFields}
                    flowId={flowId}
                    flowVersion={flowVersion}
                  />
                )}

                {/* Add button */}
                {step.node.nodeType !== "trigger" && (
                  <div className="mt-2">
                    <AddNodeButton
                      parentId={step.node.tempId}
                      parentNodeType={step.node.nodeType}
                      onAdd={onAdd}
                      childCount={step.node.children.length}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Builder Page ──────────────────────────────────────────────────────────

export default function AutomationBuilderPage() {
  const [, setLocation] = useLocation()
  const [matched, params] = useRoute("/automations/:id")
  const workflowId = parseInt(params?.id ?? "0", 10)
  const { workflow, loading, error, saveNodes, savingNodes, updateWorkflow } = useAutomation(workflowId)
  const { toast } = useToast()
  const validationProvider = useValidationProvider()

  const [tree, dispatch] = React.useReducer(treeReducer, makeDefaultTrigger())
  const [initialized, setInitialized] = React.useState(false)

  // Tab state
  const [activeTab, setActiveTab] = React.useState<"builder" | "runs" | "funnel">("builder")

  // Editable name
  const [editingName, setEditingName] = React.useState(false)
  const [nameValue, setNameValue] = React.useState("")
  const nameInputRef = React.useRef<HTMLInputElement>(null)

  // Extract templateName from tree (trigger config or first send_template action)
  const templateName = React.useMemo(() => {
    return extractTemplateName(tree)
  }, [tree])

  // Initialize tree from API data
  React.useEffect(() => {
    if (workflow && !initialized) {
      setNameValue(workflow.name)
      if (workflow.nodes) {
        dispatch({ type: "SET_TREE", tree: apiToTree(workflow.nodes) })
      } else {
        // Create default trigger node matching workflow trigger
        const trigger = makeDefaultTrigger()
        trigger.config = workflow.triggerConfig ?? {}
        dispatch({ type: "SET_TREE", tree: trigger })
      }
      setInitialized(true)
    }
  }, [workflow, initialized])

  // Focus name input when editing
  React.useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingName])

  const handleSaveName = async () => {
    if (!nameValue.trim() || !workflow) return
    setEditingName(false)
    if (nameValue.trim() !== workflow.name) {
      try {
        await updateWorkflow({ name: nameValue.trim() })
        toast({ title: "Name updated" })
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" })
        setNameValue(workflow.name)
      }
    }
  }

  const handleToggleActive = async () => {
    if (!workflow) return
    try {
      await updateWorkflow({ isActive: !workflow.isActive })
      toast({ title: workflow.isActive ? "Workflow deactivated" : "Workflow activated" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleToggleDebug = async () => {
    if (!workflow) return
    try {
      await updateWorkflow({ debugMode: !(workflow.debugMode ?? false) })
      toast({ title: workflow.debugMode ? "Debug mode disabled" : "Debug mode enabled" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleSave = async () => {
    if (!validationProvider.allValid) {
      toast({ title: "Fix errors before saving", variant: "destructive" })
      return
    }
    try {
      const stamped = stampSchemaVersion(tree, validationProvider.flowVersion) as TreeNode
      const nodes = flattenTree(stamped)
      await saveNodes(nodes)
      toast({ title: "Workflow saved successfully" })
    } catch (e: any) {
      toast({ title: "Error saving workflow", description: e.message, variant: "destructive" })
    }
  }

  if (loading && !workflow) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="h-[60px] bg-[#128C7E] shrink-0" />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-6 h-6 animate-spin text-[#128C7E]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="h-[60px] bg-[#128C7E] flex items-center gap-3 px-4 shrink-0">
          <button onClick={() => setLocation("/automations")} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-semibold">Error</span>
        </div>
        <div className="flex items-center justify-center flex-1 p-4">
          <div className="text-center text-red-600 text-sm">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-[#128C7E] shrink-0">
        {/* Row 1: Back + Name + Save */}
        <div className="h-[48px] flex items-center gap-2 px-3 sm:px-4">
          <button
            onClick={() => setLocation("/automations")}
            className="text-white/80 hover:text-white transition-colors shrink-0 p-1"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditingName(false); setNameValue(workflow?.name ?? "") } }}
                  className="bg-white/20 text-white text-sm font-semibold rounded px-2 py-1 outline-none placeholder-white/50 w-full"
                />
                <button onClick={handleSaveName} className="text-white/80 hover:text-white p-1">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditingName(false); setNameValue(workflow?.name ?? "") }} className="text-white/80 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1.5 text-white hover:text-white/90 transition-colors max-w-full"
              >
                <h1 className="font-semibold text-sm sm:text-base leading-tight truncate">
                  {workflow?.name ?? "Untitled"}
                </h1>
                <Pencil className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={savingNodes || !validationProvider.allValid}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-0 h-9 px-3 shrink-0"
          >
            {savingNodes ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save
          </Button>
        </div>

        {/* Row 2: Debug toggle + Active toggle */}
        <div className="h-[36px] flex items-center gap-4 px-3 sm:px-4 bg-[#0e7a6e] border-t border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="text-white/70 text-xs">Debug</span>
            <Switch
              checked={workflow?.debugMode ?? false}
              onCheckedChange={handleToggleDebug}
              className="data-[state=checked]:bg-amber-400/60 scale-90"
            />
            {workflow?.debugMode && (
              <Badge className="bg-amber-400/80 text-amber-950 text-[9px] px-1 py-0 h-3.5 leading-none">ON</Badge>
            )}
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-white/70 text-xs">Active</span>
            <Switch
              checked={workflow?.isActive ?? false}
              onCheckedChange={handleToggleActive}
              className="data-[state=checked]:bg-green-400/60 scale-90"
            />
            {workflow?.isActive && (
              <Badge className="bg-green-400/80 text-green-950 text-[9px] px-1 py-0 h-3.5 leading-none">ON</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Kill Switch Banner */}
      {workflow?.disabledReason === "kill_switch" && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4 mx-4 mt-4">
          <p className="text-sm text-amber-800 font-medium">
            This workflow was paused because recent runs had issues. Review your rules and re-enable.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b px-4 pt-2">
        <button
          onClick={() => setActiveTab("builder")}
          className={`flex-1 sm:flex-initial px-4 py-3 sm:py-2 text-sm font-medium transition-colors ${
            activeTab === "builder"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Builder
        </button>
        <button
          onClick={() => setActiveTab("runs")}
          className={`flex-1 sm:flex-initial px-4 py-3 sm:py-2 text-sm font-medium transition-colors ${
            activeTab === "runs"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Runs
        </button>
        <button
          onClick={() => setActiveTab("funnel")}
          className={`flex-1 sm:flex-initial px-4 py-3 sm:py-2 text-sm font-medium transition-colors ${
            activeTab === "funnel"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Funnel
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "runs" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ExecutionLogPanel workflowId={workflowId} showFunnel={false} />
        </div>
      ) : activeTab === "funnel" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ExecutionLogPanel workflowId={workflowId} showFunnel={true} funnelOnly={true} />
        </div>
      ) : (
        <ValidationContext.Provider value={validationProvider}>
          {/* Flat step view — mobile-first, works on all screen sizes */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <FlatStepView
              tree={tree}
              triggerType={workflow?.triggerType ?? "manual"}
              dispatch={dispatch}
              templateName={templateName}
            />
          </div>
        </ValidationContext.Provider>
      )}
    </div>
  )
}
