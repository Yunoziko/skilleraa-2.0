import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { MessageSquare, Search } from "lucide-react";
import { formatMessageTime } from "@/lib/messagesService";

export default function ConversationList({
  conversations,
  activeId,
  query,
  onQueryChange,
  onSelect,
  loading,
  emptyDescription,
}) {
  return (
    <aside className="border-b lg:border-b-0 lg:border-r skl-border flex flex-col bg-white">
      <div className="p-4 border-b skl-border">
        <div className="flex items-center gap-2 border skl-border rounded-full px-3 py-2">
          <Search size={14} className="text-neutral-400" />
          <input
            id="messages-search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            data-testid="messages-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[40vh] lg:max-h-none">
        {loading ? (
          <div className="p-3">
            <ListRowSkeleton count={4} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No conversations"
              description={
                query.trim() ? "Search returned no matches." : emptyDescription
              }
              icon={MessageSquare}
            />
          </div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full text-left px-4 py-3 border-b skl-border hover:bg-neutral-50 transition ${
                c.id === activeId ? "bg-neutral-50" : ""
              }`}
              data-testid={`conversation-${c.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-black text-white grid place-items-center font-display font-semibold text-sm shrink-0">
                  {c.participant_letter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{c.participant_name}</div>
                    {c.unread > 0 && (
                      <span
                        className="text-[10px] font-semibold bg-black text-white rounded-full min-w-[18px] h-[18px] grid place-items-center px-1"
                        data-testid={`unread-${c.id}`}
                      >
                        {c.unread > 99 ? "99+" : c.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 truncate mt-0.5">{c.job_title}</p>
                  <p className="text-xs text-neutral-500 truncate mt-0.5">{c.preview}</p>
                  <div className="text-[10px] text-neutral-400 mt-1">
                    {formatMessageTime(c.updated_at)}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
