import React from "react"
import { useLocation } from "wouter"
import { formatWhatsAppTime } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Search, Settings, Filter, MessageSquare, Zap, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Conversation } from "../../lib/api-client"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  isLoading?: boolean;
}

export function ConversationList({ conversations, activeId, isLoading }: ConversationListProps) {
  const [location, setLocation] = useLocation()
  const [search, setSearch] = React.useState("")
  const { isSuperAdmin } = useAuth()

  const filtered = conversations.filter(c => 
    c.phoneNumber.includes(search) || 
    (c.contactName && c.contactName.toLowerCase().includes(search.toLowerCase())) ||
    (c.lastMessage && c.lastMessage.toLowerCase().includes(search.toLowerCase()))
  )

  const navItems = [
    { id: "messages", label: "Messages", icon: MessageSquare, href: "/" },
    ...(isSuperAdmin ? [{ id: "automations", label: "Automations", icon: Zap, href: "/automations" }] : []),
    ...(isSuperAdmin ? [{ id: "templates", label: "Templates", icon: FileText, href: "/templates" }] : []),
    { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
  ] as const

  const activeTab = (() => {
    if (location.startsWith("/automations")) return "automations"
    if (location.startsWith("/templates"))   return "templates"
    if (location.startsWith("/settings"))    return "settings"
    return "messages"
  })()

  return (
    <div className="flex flex-col h-full bg-white border-r border-border">
      {/* Sidebar Header */}
      <div className="h-[60px] bg-slate-50 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Avatar fallback="WD" className="w-10 h-10 bg-wa-teal text-white" />
          <h1 className="font-semibold text-lg text-foreground">Messages</h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-border bg-white flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search or start a new chat" 
            className="pl-9 bg-slate-100 border-none rounded-xl h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Loading conversations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center px-4">
            No conversations found.
          </div>
        ) : (
          filtered.map((conv, i) => {
            const isActive = activeId === conv.phoneNumber
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                key={conv.id}
              >
                <div 
                  onClick={() => setLocation(`/chat/${conv.phoneNumber}`)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-border/50",
                    isActive ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                >
                  <Avatar 
                    fallback={conv.contactName || conv.phoneNumber} 
                    className="w-12 h-12 shrink-0" 
                  />
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-[15px] truncate text-foreground pr-2">
                        {conv.contactName || conv.phoneNumber}
                      </h3>
                      <span className={cn(
                        "text-[12px] whitespace-nowrap",
                        conv.unreadCount > 0 ? "text-wa-green font-medium" : "text-muted-foreground"
                      )}>
                        {formatWhatsAppTime(conv.lastMessageAt || conv.createdAt)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-sm text-muted-foreground truncate flex-1">
                        {conv.lastMessage || "Media message"}
                      </p>
                      {conv.unreadCount > 0 && (
                        <div className="bg-wa-green text-white text-[11px] font-bold h-[20px] min-w-[20px] rounded-full flex items-center justify-center px-1.5 shrink-0 shadow-sm">
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Bottom Tab Bar — pb accounts for iOS safe-area (home indicator) */}
      <div className="border-t border-border bg-white shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setLocation(item.href)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors relative",
                  isActive
                    ? "text-[#128C7E]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#128C7E] rounded-full" />
                )}
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
