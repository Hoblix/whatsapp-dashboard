import React from "react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  useIntegrations, useMappings, fetchNotionDatabases, fetchNotionDatabaseSchema,
  type FlowDef, type FlowIntegration, type NotionDatabase, type NotionDatabaseSchema,
} from "@/hooks/useFlows"
import {
  Plus, Trash2, Plug, CheckCircle2, AlertCircle, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink, ToggleLeft, ToggleRight,
  Database, ArrowRight, Save, X
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldRow {
  sourceField: string
  targetField: string
  targetFieldType: string
  isStatic: boolean      // true = push a fixed value; false = use flow field
  staticValue: string    // the fixed value when isStatic=true
}

// ── Notion setup wizard ───────────────────────────────────────────────────────

function NotionSetupWizard({
  tenantId,
  flow,
  onDone,
  onCancel,
}: {
  tenantId: number
  flow: FlowDef
  onDone: () => void
  onCancel: () => void
}) {
  const { createIntegration } = useIntegrations(tenantId, flow.id)
  const { toast } = useToast()

  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [token, setToken] = React.useState("")
  const [databases, setDatabases] = React.useState<NotionDatabase[]>([])
  const [selectedDb, setSelectedDb] = React.useState<NotionDatabase | null>(null)
  const [dbSchema, setDbSchema] = React.useState<NotionDatabaseSchema | null>(null)
  const [integrationName, setIntegrationName] = React.useState("Notion — Lead Capture")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Step 1 → Step 2: fetch databases using the token
  async function handleFetchDatabases() {
    if (!token.trim()) { setError("Please enter your Notion API token."); return }
    setLoading(true); setError(null)
    try {
      const dbs = await fetchNotionDatabases(token.trim())
      setDatabases(dbs)
      setStep(2)
    } catch (e: any) {
      setError(e.message ?? "Could not connect to Notion")
    } finally {
      setLoading(false)
    }
  }

  // Step 2 → Step 3: user picks a database
  async function handleSelectDatabase(db: NotionDatabase) {
    setSelectedDb(db)
    // Create the integration first so we can proxy the database schema
    setLoading(true); setError(null)
    try {
      const created = await createIntegration({
        type: "notion",
        name: integrationName,
        config: { notionToken: token.trim(), databaseId: db.id, databaseName: db.title },
      })
      // Fetch schema through the integration proxy
      const schema = await fetchNotionDatabaseSchema(created.id)
      setDbSchema(schema)
      setStep(3)
    } catch (e: any) {
      setError(e.message ?? "Could not load database schema")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {(["Connect", "Select database", "Field mapping"] as const).map((label, i) => (
          <React.Fragment key={label}>
            <span className={cn(
              "flex items-center gap-1 font-medium",
              step === i + 1 ? "text-[#128C7E]" : step > i + 1 ? "text-green-600" : ""
            )}>
              <span className={cn(
                "w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0",
                step > i + 1 ? "bg-green-100 text-green-700" : step === i + 1 ? "bg-[#128C7E] text-white" : "bg-gray-100 text-gray-400"
              )}>
                {step > i + 1 ? "✓" : i + 1}
              </span>
              {label}
            </span>
            {i < 2 && <ChevronRight className="w-3 h-3 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Token */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Connect Notion</h3>
            <p className="text-xs text-muted-foreground">
              Create an integration at{" "}
              <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-[#128C7E] underline">
                notion.so/my-integrations
              </a>
              {" "}and share your database with it. Then paste the token below.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Integration name</label>
            <input
              value={integrationName}
              onChange={e => setIntegrationName(e.target.value)}
              placeholder="e.g. Notion — Lead Capture"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Notion API token</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full text-sm border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30"
            />
            <p className="text-[11px] text-muted-foreground">Token is encrypted and stored securely. Never exposed to the client again.</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={handleFetchDatabases}
              disabled={loading}
              className="bg-[#128C7E] hover:bg-[#0a7567] text-white text-sm h-9"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plug className="w-3.5 h-3.5 mr-1.5" />}
              Connect
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-sm h-9">Cancel</Button>
          </div>
        </div>
      )}

      {/* Step 2: Select database */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Select database</h3>
            <p className="text-xs text-muted-foreground">{databases.length} database{databases.length !== 1 ? "s" : ""} accessible to your integration</p>
          </div>
          {loading && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting…
            </div>
          )}
          <div className="space-y-2">
            {databases.map(db => (
              <button
                key={db.id}
                onClick={() => handleSelectDatabase(db)}
                disabled={loading}
                className="w-full text-left flex items-center gap-3 border rounded-xl px-4 py-3 hover:border-[#128C7E] hover:bg-[#128C7E]/5 transition-colors"
              >
                <Database className="w-5 h-5 text-[#128C7E] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{db.title}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{db.id}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {/* Step 3: done — open field mapping */}
      {step === 3 && dbSchema && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 border rounded-xl px-4 py-3 bg-green-50/50">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium">Connected to "{dbSchema.title}"</p>
              <p className="text-xs text-muted-foreground">{dbSchema.properties.length} properties available for mapping</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Integration saved. Now configure field mapping to push leads to Notion.</p>
          <Button
            onClick={onDone}
            className="bg-[#128C7E] hover:bg-[#0a7567] text-white text-sm h-9"
          >
            Configure field mapping
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Field mapping editor ───────────────────────────────────────────────────────

const NOTION_TYPES = [
  { value: "title", label: "Title" },
  { value: "rich_text", label: "Text" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "number", label: "Number" },
  { value: "phone_number", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
]

function FieldMappingEditor({
  integration,
  onClose,
}: {
  integration: FlowIntegration
  onClose: () => void
}) {
  const { mappings, loading, saveMappings, saving } = useMappings(integration.id)
  const { toast } = useToast()

  const [rows, setRows] = React.useState<FieldRow[]>([])
  const [dbSchema, setDbSchema] = React.useState<NotionDatabaseSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = React.useState(false)
  const [schemaError, setSchemaError] = React.useState<string | null>(null)

  // Load current mappings
  React.useEffect(() => {
    if (mappings.length > 0) {
      setRows(mappings.map(m => ({
        sourceField: m.sourceField,
        targetField: m.targetField,
        targetFieldType: m.targetFieldType ?? "rich_text",
        isStatic: m.isStatic ?? false,
        staticValue: m.staticValue ?? "",
      })))
    }
  }, [mappings])

  // Load Notion database schema
  React.useEffect(() => {
    if (!integration.id) return
    setLoadingSchema(true)
    fetchNotionDatabaseSchema(integration.id)
      .then(schema => { setDbSchema(schema); setSchemaError(null) })
      .catch(e => setSchemaError(e.message))
      .finally(() => setLoadingSchema(false))
  }, [integration.id])

  function addRow() {
    setRows(r => [...r, { sourceField: "", targetField: "", targetFieldType: "rich_text", isStatic: false, staticValue: "" }])
  }

  function removeRow(i: number) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, key: keyof FieldRow, value: string | boolean) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: value } : row))
  }

  function toggleStatic(i: number) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, isStatic: !row.isStatic } : row))
  }

  function autoSelectType(i: number, propName: string) {
    const prop = dbSchema?.properties.find(p => p.name === propName)
    if (prop) {
      updateRow(i, "targetFieldType", prop.type)
      updateRow(i, "targetField", propName)
    } else {
      updateRow(i, "targetField", propName)
    }
  }

  async function handleSave() {
    const valid = rows.filter(r => {
      if (!r.targetField) return false
      return r.isStatic ? r.staticValue.trim() !== "" : r.sourceField.trim() !== ""
    })
    try {
      await saveMappings(valid.map(r => ({
        sourceField: r.isStatic ? "" : r.sourceField,
        targetField: r.targetField,
        targetFieldType: r.targetFieldType,
        isStatic: r.isStatic,
        staticValue: r.isStatic ? r.staticValue : undefined,
      })))
      toast({ title: "Mappings saved", description: `${valid.length} field mapping${valid.length !== 1 ? "s" : ""} saved` })
      onClose()
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" })
    }
  }

  const dbProps = dbSchema?.properties ?? []

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Field mapping</h3>
        <p className="text-xs text-muted-foreground">
          Map flow submission fields (left) to Notion database properties (right).
          {dbSchema && <span className="font-medium text-gray-700"> Database: {dbSchema.title}</span>}
        </p>
      </div>

      {loadingSchema && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading database schema…
        </div>
      )}
      {schemaError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Could not load Notion schema — you can still enter property names manually.
        </div>
      )}

      {/* Mapping rows */}
      <div className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-[28px_1fr_20px_1fr_80px_28px] gap-2 px-1">
          <span />
          <span className="text-[11px] font-medium text-muted-foreground">Flow field / Static value</span>
          <span />
          <span className="text-[11px] font-medium text-muted-foreground">Notion property</span>
          <span className="text-[11px] font-medium text-muted-foreground">Type</span>
          <span />
        </div>

        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr_20px_1fr_80px_28px] gap-2 items-center">
            {/* Static toggle */}
            <button
              onClick={() => toggleStatic(i)}
              title={row.isStatic ? "Using static value — click to use flow field" : "Using flow field — click to use static value"}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-bold border transition-colors shrink-0",
                row.isStatic
                  ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                  : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
              )}
            >
              {row.isStatic ? "S" : "F"}
            </button>

            {/* Source field OR static value */}
            {row.isStatic ? (
              <input
                value={row.staticValue}
                onChange={e => updateRow(i, "staticValue", e.target.value)}
                placeholder="Fixed value e.g. Hoblix"
                className="text-xs border border-amber-200 bg-amber-50/30 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            ) : (
              <input
                value={row.sourceField}
                onChange={e => updateRow(i, "sourceField", e.target.value)}
                placeholder="e.g. name"
                className="text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30 font-mono"
              />
            )}

            <ArrowRight className="w-4 h-4 text-gray-400" />
            {/* Target Notion property */}
            {dbProps.length > 0 ? (
              <select
                value={row.targetField}
                onChange={e => autoSelectType(i, e.target.value)}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30 bg-white"
              >
                <option value="">— select —</option>
                {dbProps.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={row.targetField}
                onChange={e => updateRow(i, "targetField", e.target.value)}
                placeholder="Property name"
                className="text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30"
              />
            )}
            {/* Type */}
            <select
              value={row.targetFieldType}
              onChange={e => updateRow(i, "targetFieldType", e.target.value)}
              className="text-xs border rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30 bg-white"
            >
              {NOTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={() => removeRow(i)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">
            No mappings yet — add one below
          </div>
        )}
      </div>

      {/* Common fields quick-add */}
      {(() => {
        const usedFields = new Set(rows.filter(r => !r.isStatic).map(r => r.sourceField).filter(Boolean))

        const SECTIONS = [
          {
            label: "General",
            color: "gray" as const,
            fields: [
              { field: "name",          type: "rich_text",    hint: "Contact name" },
              { field: "wa_phone",      type: "phone_number", hint: "WhatsApp number" },
              { field: "intent",        type: "select",       hint: "Intent label (Talk to Someone, Book a Seat, …)" },
              { field: "space_type",    type: "select",       hint: "Space type label (Private Cabin, Day Pass, …)" },
              { field: "team_size",     type: "rich_text",    hint: "Alias for seats (Just me, 2-4 seats, …)" },
              { field: "timeline",      type: "select",       hint: "Alias for urgency (Immediately, This week, …)" },
              { field: "message",       type: "rich_text",    hint: "Free-text message" },
            ],
          },
          {
            label: "Schedule a Call",
            color: "blue" as const,
            fields: [
              { field: "callback_day",       type: "date",       hint: "ISO date YYYY-MM-DD — use Notion Date type" },
              { field: "callback_day_label", type: "rich_text",  hint: "Readable: Tomorrow, Wednesday 1 Apr" },
              { field: "callback_time",      type: "select",     hint: "e.g. 10 AM – 12 PM" },
            ],
          },
          {
            label: "Schedule a Tour / Visit",
            color: "purple" as const,
            fields: [
              { field: "visit_day",       type: "date",      hint: "ISO date YYYY-MM-DD — use Notion Date type" },
              { field: "visit_day_label", type: "rich_text", hint: "Readable: Tomorrow, Wednesday 1 Apr" },
              { field: "visit_time",      type: "select",    hint: "e.g. 2 PM – 5 PM" },
            ],
          },
          {
            label: "Book a Seat",
            color: "green" as const,
            fields: [
              { field: "booking_plan", type: "select",     hint: "Plan (Monthly, Quarterly, …)" },
              { field: "start_date",   type: "rich_text",  hint: "Start date preference (This Week, Next Week, …)" },
            ],
          },
        ]

        const btnCls = {
          gray:   "font-mono bg-gray-100 hover:bg-[#128C7E]/10 hover:text-[#128C7E] text-gray-700",
          blue:   "font-mono bg-blue-50 hover:bg-blue-100 text-blue-700",
          purple: "font-mono bg-purple-50 hover:bg-purple-100 text-purple-700",
          green:  "font-mono bg-green-50 hover:bg-green-100 text-green-700",
        }

        // Only render the outer wrapper if at least one section has remaining fields
        const hasAny = SECTIONS.some(s => s.fields.some(f => !usedFields.has(f.field)))

        return (
          <div className="space-y-3">
            {hasAny && (
              <>
                <p className="text-[11px] text-muted-foreground font-medium">Quick-add flow fields:</p>
                {SECTIONS.map(section => {
                  const remaining = section.fields.filter(f => !usedFields.has(f.field))
                  if (remaining.length === 0) return null
                  return (
                    <div key={section.label} className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {section.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {remaining.map(({ field, type, hint }) => (
                          <button
                            key={field}
                            title={hint}
                            onClick={() => setRows(r => [...r, { sourceField: field, targetField: "", targetFieldType: type, isStatic: false, staticValue: "" }])}
                            className={`text-[11px] px-2 py-0.5 rounded transition-colors ${btnCls[section.color]}`}
                          >
                            + {field}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
            {/* Static value quick-add */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Default / Static values
              </p>
              <p className="text-[11px] text-muted-foreground">
                Push a fixed value to Notion on every submission (e.g. Lead Source = "WhatsApp").
              </p>
              <button
                onClick={() => setRows(r => [...r, { sourceField: "", targetField: "", targetFieldType: "select", isStatic: true, staticValue: "" }])}
                className="text-[11px] px-2 py-0.5 rounded transition-colors bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
              >
                + Add static value
              </button>
            </div>
          </div>
        )
      })()}

      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={addRow}
          variant="outline"
          size="sm"
          className="text-xs h-8 gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add mapping
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#128C7E] hover:bg-[#0a7567] text-white text-xs h-8 gap-1 ml-auto"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save mappings
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-8">Cancel</Button>
      </div>
    </div>
  )
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  onDelete,
  onToggle,
  onConfigure,
}: {
  integration: FlowIntegration
  onDelete: () => void
  onToggle: () => void
  onConfigure: () => void
}) {
  const cfg = integration.config as { databaseName?: string; notionToken?: string }

  return (
    <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-base font-bold text-gray-600">
          N
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{integration.name}</span>
            <span className={cn(
              "text-[10px] rounded-full px-2 py-0.5 font-medium",
              integration.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            )}>
              {integration.isActive ? "Active" : "Paused"}
            </span>
          </div>
          {cfg.databaseName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <Database className="w-3 h-3 inline mr-1" />
              {cfg.databaseName}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            Notion · Created {new Date(integration.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="border-t bg-gray-50/50 px-4 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={onConfigure}
          className="flex items-center gap-1.5 text-xs font-medium text-[#128C7E] hover:text-[#0a7567] bg-[#128C7E]/10 rounded-lg px-3 py-1.5 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Field mapping
        </button>
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors",
            integration.isActive
              ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
              : "text-green-600 bg-green-50 hover:bg-green-100"
          )}
        >
          {integration.isActive
            ? <><ToggleLeft className="w-3.5 h-3.5" /> Pause</>
            : <><ToggleRight className="w-3.5 h-3.5" /> Activate</>}
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 rounded-lg px-3 py-1.5 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove
        </button>
      </div>
    </div>
  )
}

// ── Main panel sheet ──────────────────────────────────────────────────────────

type View = "list" | "add-notion" | { configure: FlowIntegration }

export function FlowIntegrationsPanel({
  tenantId,
  flow,
  onClose,
}: {
  tenantId: number
  flow: FlowDef
  onClose: () => void
}) {
  const {
    integrations, loading, error, refetch,
    updateIntegration, deleteIntegration,
  } = useIntegrations(tenantId, flow.id)
  const { toast } = useToast()
  const [view, setView] = React.useState<View>("list")

  async function handleToggle(integration: FlowIntegration) {
    try {
      await updateIntegration(integration.id, { isActive: !integration.isActive })
      toast({ title: integration.isActive ? "Integration paused" : "Integration activated" })
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" })
    }
  }

  async function handleDelete(integration: FlowIntegration) {
    if (!confirm(`Remove "${integration.name}"? This will stop pushing leads to Notion.`)) return
    try {
      await deleteIntegration(integration.id)
      toast({ title: "Integration removed" })
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" })
    }
  }

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-[#128C7E]" />
            Integrations
          </SheetTitle>
          <SheetDescription>
            Connect <span className="font-medium">{flow.name}</span> to external apps.
            Submissions are pushed automatically on completion.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pb-4">
          {/* ── Field mapping view ── */}
          {typeof view === "object" && "configure" in view && (
            <FieldMappingEditor
              integration={view.configure}
              onClose={() => setView("list")}
            />
          )}

          {/* ── Add Notion wizard ── */}
          {view === "add-notion" && (
            <NotionSetupWizard
              tenantId={tenantId}
              flow={flow}
              onDone={() => setView("list")}
              onCancel={() => setView("list")}
            />
          )}

          {/* ── Integration list ── */}
          {view === "list" && (
            <>
              {/* Add Integration header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Connected apps</p>
                  <p className="text-xs text-muted-foreground">
                    {integrations.length === 0
                      ? "No integrations yet"
                      : `${integrations.length} integration${integrations.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="relative group">
                  <Button
                    size="sm"
                    className="bg-[#128C7E] hover:bg-[#0a7567] text-white h-8 px-3 text-xs gap-1"
                    onClick={() => setView("add-notion")}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add integration
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex flex-col gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="flex items-center gap-1.5 self-start text-xs font-medium text-red-700 hover:text-red-900 underline underline-offset-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                </div>
              )}

              {loading && integrations.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6">Loading…</div>
              )}

              {!loading && integrations.length === 0 && !error && (
                <div className="border-2 border-dashed rounded-2xl py-10 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Plug className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">No integrations yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Connect Notion to capture leads automatically</p>
                  </div>
                  {/* App tiles */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setView("add-notion")}
                      className="flex flex-col items-center gap-2 border rounded-xl px-5 py-4 hover:border-[#128C7E] hover:bg-[#128C7E]/5 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center text-white font-bold text-lg">N</div>
                      <span className="text-xs font-medium">Notion</span>
                    </button>
                    <button
                      disabled
                      className="flex flex-col items-center gap-2 border rounded-xl px-5 py-4 opacity-40 cursor-not-allowed"
                    >
                      <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center text-white text-lg">📊</div>
                      <span className="text-xs font-medium">Sheets</span>
                      <span className="text-[10px] text-muted-foreground">Coming soon</span>
                    </button>
                    <button
                      disabled
                      className="flex flex-col items-center gap-2 border rounded-xl px-5 py-4 opacity-40 cursor-not-allowed"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-700 flex items-center justify-center text-white text-lg">🔗</div>
                      <span className="text-xs font-medium">Webhook</span>
                      <span className="text-[10px] text-muted-foreground">Coming soon</span>
                    </button>
                  </div>
                </div>
              )}

              {integrations.length > 0 && (
                <div className="space-y-3">
                  {integrations.map(integration => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      onToggle={() => handleToggle(integration)}
                      onDelete={() => handleDelete(integration)}
                      onConfigure={() => setView({ configure: integration })}
                    />
                  ))}
                </div>
              )}

              {/* How it works info box */}
              <div className="rounded-xl border bg-[#128C7E]/5 border-[#128C7E]/20 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-[#128C7E]">How it works</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>User completes the WhatsApp Flow form</li>
                  <li>Submission is saved to your dashboard</li>
                  <li>Fields are mapped and pushed to Notion instantly</li>
                  <li>New row appears in your Notion database as a lead</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
