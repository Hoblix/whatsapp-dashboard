import React, { useState } from "react"
import { format } from "date-fns"
import { Check, CheckCheck, Clock, FileText, Image as ImageIcon, Video, Mic, MapPin, Sticker, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "../../lib/api-client"

interface MessageBubbleProps {
  message: Message;
}

/**
 * Resolve a stored mediaUrl to a loadable src.
 * - "meta-media:{id}" → outbound uploads stored by our API
 * - raw numeric/string ID → inbound media IDs from webhook
 * - "https://..." → already a real URL (legacy), use as-is
 */
function resolveMediaSrc(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) return mediaUrl;
  const id = mediaUrl.startsWith("meta-media:") ? mediaUrl.slice(11) : mediaUrl;
  return `/api/media/${id}`;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isInbound = message.direction === "inbound"
  const [imgError, setImgError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // Format exact time for the bubble
  const timeString = message.timestamp ? format(new Date(message.timestamp), "HH:mm") : ""

  const mediaSrc = resolveMediaSrc(message.mediaUrl)

  // Reset error whenever the source changes (e.g. after a fix or new message)
  React.useEffect(() => {
    setImgError(false)
    setRetryKey(k => k + 1)
  }, [mediaSrc])

  const renderMediaContent = () => {
    switch(message.messageType) {
      case "image":
        return (
          <div className="mb-1 rounded-lg overflow-hidden max-w-[260px] bg-black/5">
            {mediaSrc && !imgError ? (
              <img
                key={`${mediaSrc}-${retryKey}`}
                src={mediaSrc}
                alt="Image"
                className="w-full h-auto object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 gap-2">
                <ImageIcon className="w-8 h-8 opacity-40" />
                {imgError && mediaSrc && (
                  <button
                    onClick={() => { setImgError(false); setRetryKey(k => k + 1) }}
                    className="text-[11px] text-wa-teal underline opacity-70 hover:opacity-100"
                  >
                    Tap to retry
                  </button>
                )}
              </div>
            )}
          </div>
        );
      case "video":
        return (
          <div className="mb-1 rounded-lg overflow-hidden max-w-[260px] bg-black/5">
            {mediaSrc ? (
              <video
                src={mediaSrc}
                controls
                className="w-full h-auto max-h-48 rounded-lg"
                preload="metadata"
              />
            ) : (
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-wa-teal text-white flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium opacity-80">Video</span>
              </div>
            )}
          </div>
        );
      case "audio":
        return (
          <div className="mb-1 bg-black/5 p-3 rounded-lg min-w-[200px]">
            {mediaSrc ? (
              <audio src={mediaSrc} controls className="w-full h-8" />
            ) : (
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 opacity-50 shrink-0" />
                <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden">
                  <div className="w-1/3 h-full bg-wa-teal rounded-full" />
                </div>
              </div>
            )}
          </div>
        );
      case "document":
        return (
          <div className="mb-1 bg-black/5 p-3 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-md shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium truncate max-w-[150px] flex-1">
              {message.body || "Document"}
            </span>
            {mediaSrc && (
              <a
                href={mediaSrc}
                download
                target="_blank"
                rel="noreferrer"
                className="shrink-0 p-1.5 rounded-full hover:bg-black/10 transition-colors"
              >
                <Download className="w-4 h-4 opacity-60" />
              </a>
            )}
          </div>
        );
      case "location":
        return (
          <div className="mb-1 bg-black/5 p-3 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-full shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Location</span>
          </div>
        );
      case "sticker":
        return (
          <div className="mb-1 p-2">
            {mediaSrc ? (
              <img src={mediaSrc} alt="Sticker" className="w-24 h-24 object-contain" />
            ) : (
              <Sticker className="w-16 h-16 opacity-60 text-wa-teal" />
            )}
          </div>
        );
      case "unsupported":
        // Show a subtle placeholder only when there's no body text to display
        if (message.body) return null;
        return (
          <div className="mb-1 flex items-center gap-2 text-[13px] opacity-60 italic py-0.5">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Message not supported</span>
          </div>
        );
      default:
        return null;
    }
  }

  // WhatsApp-style tick icons for outbound messages.
  // Outbound bubble is light green (bg-wa-bubble-out ≈ #D9FDD3), so we
  // use a medium gray for sent/delivered and WhatsApp's exact read-blue.
  const getStatusTick = (): { icon: React.ReactNode; colorClass: string; title: string } | null => {
    if (isInbound) return null;
    switch (message.status) {
      case "sent":
        return { icon: <Check className="w-4 h-4" />, colorClass: "text-[#8696A0]", title: "Sent" };
      case "delivered":
        return { icon: <CheckCheck className="w-4 h-4" />, colorClass: "text-[#8696A0]", title: "Delivered" };
      case "read":
        return { icon: <CheckCheck className="w-4 h-4" />, colorClass: "text-[#53BDEB]", title: "Read" };
      default:
        // Still sending — show a clock
        return { icon: <Clock className="w-3.5 h-3.5" />, colorClass: "text-[#8696A0]", title: "Sending…" };
    }
  }

  return (
    <div className={cn(
      "flex w-full mb-3",
      isInbound ? "justify-start" : "justify-end"
    )}>
      <div 
        className={cn(
          "relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          isInbound 
            ? "bg-wa-bubble-in text-foreground rounded-tl-none ml-2" 
            : "bg-wa-bubble-out text-foreground rounded-tr-none mr-2"
        )}
      >
        {/* Tail triangle */}
        <div className={cn(
          "absolute top-0 w-3 h-3",
          isInbound 
            ? "-left-2 bg-wa-bubble-in [clip-path:polygon(100%_0,0_0,100%_100%)]" 
            : "-right-2 bg-wa-bubble-out [clip-path:polygon(0_0,100%_0,0_100%)]"
        )} />
        
        {message.messageType !== "text" && renderMediaContent()}
        
        {message.body && (
          <div className="break-words leading-relaxed pb-1 text-[15px]">
            {message.body}
          </div>
        )}
        
        {/* Time + status ticks — ticks rendered separately so "read" blue is never dimmed */}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[11px] leading-none opacity-60">{timeString}</span>
          {(() => {
            const tick = getStatusTick()
            if (!tick) return null
            return (
              <span className={cn("flex items-center leading-none shrink-0", tick.colorClass)} title={tick.title}>
                {tick.icon}
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
