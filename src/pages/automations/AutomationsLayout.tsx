import React from "react"
import { useLocation } from "wouter"
import { ArrowLeft } from "lucide-react"

interface AutomationsLayoutProps {
  children: React.ReactNode
}

export function AutomationsLayout({ children }: AutomationsLayoutProps) {
  const [, setLocation] = useLocation()

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
          <h1 className="text-white font-semibold text-base leading-tight">Automations</h1>
          <p className="text-white/70 text-xs">Workflow Builder</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
