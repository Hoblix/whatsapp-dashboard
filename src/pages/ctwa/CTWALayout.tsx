import React from "react"
import { useLocation } from "wouter"
import { ArrowLeft, ListChecks, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "rules" | "events"

interface CTWALayoutProps {
  tab: Tab
  children: React.ReactNode
}

export function CTWALayout({ tab, children }: CTWALayoutProps) {
  const [, setLocation] = useLocation()

  const tabs: { id: Tab; label: string; icon: React.ElementType; href: string }[] = [
    { id: "rules", label: "Rules", icon: ListChecks, href: "/ctwa" },
    { id: "events", label: "Events", icon: Activity, href: "/ctwa/events" },
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-[60px] bg-[#128C7E] flex items-center gap-3 px-4 shrink-0">
        <button
          onClick={() => setLocation("/")}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-base leading-tight">Ad Automations</h1>
          <p className="text-white/70 text-xs">Click-to-WhatsApp Ads</p>
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
                onClick={() => setLocation(t.href)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-[#128C7E] text-[#128C7E]"
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
