import React from "react"
import { Activity, AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { CTWALayout } from "./CTWALayout"
import { useCTWAEvents } from "@/hooks/useCTWA"
import { Button } from "@/components/ui/button"

function fmtDateTime(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

export default function CTWAEventsPage() {
  const { events, loading, error, loadMore, hasMore } = useCTWAEvents(20)

  return (
    <CTWALayout tab="events">
      <div className="p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-base">Attribution Events</h2>
          <p className="text-xs text-muted-foreground">
            Log of incoming Click-to-WhatsApp ad interactions
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && events.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">Loading events...</div>
        )}

        {/* Empty */}
        {!loading && events.length === 0 && !error && (
          <div className="text-center py-12 space-y-2">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No events yet</p>
            <p className="text-xs text-muted-foreground/70">
              Events will appear here when users click your WhatsApp ads
            </p>
          </div>
        )}

        {/* Events table (mobile-friendly cards) */}
        {events.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block border rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Ad ID</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Headline</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Rule</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(evt => (
                    <tr key={evt.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(evt.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{evt.phoneNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                        {evt.adId ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-xs truncate max-w-[160px]">
                        {evt.adHeadline ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {evt.ruleId != null ? (
                          <span className="bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-[10px] font-medium">
                            Rule #{evt.ruleId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {evt.actionFired ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {events.map(evt => (
                <div key={evt.id} className="border rounded-xl bg-white p-3 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{fmtDateTime(evt.createdAt)}</span>
                    {evt.actionFired ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Fired
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                        <XCircle className="w-3.5 h-3.5" /> No action
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-sm">{evt.phoneNumber}</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    {evt.adId && (
                      <span className="font-mono bg-gray-50 rounded px-1.5 py-0.5 truncate max-w-[140px]">
                        {evt.adId}
                      </span>
                    )}
                    {evt.adHeadline && (
                      <span className="truncate max-w-[180px]">{evt.adHeadline}</span>
                    )}
                    {evt.ruleId != null && (
                      <span className="bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Rule #{evt.ruleId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="text-sm"
                >
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </CTWALayout>
  )
}
