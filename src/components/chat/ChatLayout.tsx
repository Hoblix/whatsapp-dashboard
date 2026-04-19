import React from "react"
import { useRoute } from "wouter"
import { ConversationList } from "./ConversationList"
import { ChatDetail } from "./ChatDetail"
import { useListConversations, useGetConversation } from "../../lib/api-client"
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates"

export function ChatLayout() {
  const [match, params] = useRoute("/chat/:id")
  const activeId = match ? params.id : undefined

  // Connect to realtime push (replaces 3-second polling)
  useRealtimeUpdates()

  const { data: conversations = [], isLoading: isLoadingList, refetch: refetchConversations } = useListConversations({
    // Fallback poll every 60s in case WebSocket is disconnected; pause when tab hidden
    query: { refetchInterval: 60_000, refetchIntervalInBackground: false }
  })

  const { data: messages = [], isLoading: isLoadingMessages, refetch: refetchMessages } = useGetConversation(
    activeId || "",
    {
      query: {
        enabled: !!activeId,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
      }
    }
  )

  const activeConversation = conversations.find(c => c.phoneNumber === activeId)

  function handleRefresh() {
    refetchMessages()
    refetchConversations()
  }

  return (
    <div className="flex h-[100dvh] w-full bg-[#dfdcd7] overflow-hidden justify-center">
      {/* Desktop wrapper container (simulates WhatsApp web constrained width on huge screens) */}
      <div className="flex w-full max-w-[1600px] h-full shadow-2xl relative">
        
        {/* Left Pane: Conversation List */}
        <div className={`
          w-full md:w-[380px] lg:w-[420px] h-full shrink-0 flex flex-col bg-white border-r border-border
          ${activeId ? 'hidden md:flex' : 'flex'}
        `}>
          <ConversationList 
            conversations={conversations} 
            activeId={activeId} 
            isLoading={isLoadingList} 
          />
        </div>

        {/* Right Pane: Chat Detail */}
        <div className={`
          flex-1 h-full bg-wa-bg relative
          ${!activeId ? 'hidden md:flex flex-col items-center justify-center' : 'flex flex-col'}
        `}>
          {!activeId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 z-10">
              <div 
                className="absolute inset-0 z-0 opacity-[0.3]"
                style={{
                  backgroundImage: `url('${import.meta.env.BASE_URL}images/chat-bg.png')`,
                  backgroundSize: '400px',
                  backgroundRepeat: 'repeat'
                }}
              />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-[320px] mb-8">
                  {/* Abstract illustration placeholder for WA web empty state */}
                  <div className="aspect-video bg-slate-200/50 rounded-2xl flex items-center justify-center overflow-hidden border border-white">
                    <img 
                      src="https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=800&q=80" 
                      alt="Communication abstract"
                      className="w-full h-full object-cover opacity-80 mix-blend-multiply"
                    />
                  </div>
                </div>
                <h1 className="text-3xl font-light text-slate-700 mb-4">WhatsApp Webhook Dashboard</h1>
                <p className="text-slate-500 max-w-md text-[15px] leading-relaxed mb-8">
                  Send a message to your WhatsApp Business API phone number and it will appear here in real-time.
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-wa-green/80 animate-pulse" />
                  Listening for webhooks...
                </div>
              </div>
            </div>
          ) : (
            <ChatDetail
              phoneNumber={activeId}
              messages={messages}
              conversation={activeConversation}
              isLoading={isLoadingMessages}
              onRefresh={handleRefresh}
            />
          )}
        </div>
      </div>
    </div>
  )
}
