import React from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Building2, Workflow, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "tenants" | "flows" | "analytics"

interface FlowsLayoutProps {
  tab: Tab
  tenantId?: number
  tenantName?: string
  children: React.ReactNode
}

export function FlowsLayout({ tab, tenantId, tenantName, children }: FlowsLayoutProps) {
  const [, setLocation] = useLocation()

  const tabs: { id: Tab; label: string; icon: React.ElementType; href: string; disabled?: boolean }[] = [
    {
      id: "tenants",
      label: "Tenants",
      icon: Building2,
      href: "/flows/tenants",
    },
    {
      id: "flows",
      label: "Flows",
      icon: Workflow,
      href: tenantId ? `/flows/tenants/${tenantId}/flows` : "/flows/tenants",
      disabled: !tenantId,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      href: tenantId ? `/flows/tenants/${tenantId}/analytics` : "/flows/tenants",
      disabled: !tenantId,
    },
  ]

  // Smart back: from Flows/Analytics go to tenants list; from Tenants go to home
  const handleBack = () => {
    if (tab === "flows" || tab === "analytics") {
      setLocation("/flows/tenants")
    } else {
      setLocation("/")
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-[60px] bg-[#128C7E] flex items-center gap-3 px-4 shrink-0">
        <button
          onClick={handleBack}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base leading-tight">WhatsApp Flows</h1>
          {tenantName && (
            <p className="text-white/70 text-xs truncate">{tenantName}</p>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border bg-white shrink-0">
        <div className="flex">
          {tabs.map(t => {
            const Icon = t.icon
            const isActive = t.id === tab
            return (
              <button
                key={t.id}
                disabled={t.disabled}
                onClick={() => !t.disabled && setLocation(t.href)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-[#128C7E] text-[#128C7E]"
                    : t.disabled
                    ? "border-transparent text-muted-foreground/40 cursor-not-allowed"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
