"use client";

/**
 * TripChat — §13 In-App Messaging
 *
 * Conversation thread scoped to a trip. Only shipper + carrier can send.
 * Read-only after COMPLETED/CANCELLED.
 * Polling-based refresh (MVP — no WebSocket).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";
import toast from "react-hot-toast";
import { MessageCircle, Send, Paperclip, X } from "lucide-react";

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderRole: string;
  attachmentUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender?: { firstName?: string; lastName?: string } | null;
}

interface TripChatProps {
  tripId: string;
  /** Current user's org ID — used to determine if message is "mine" */
  currentUserId: string;
  /** Whether the current user is the shipper on this trip */
  isShipper: boolean;
  /** Whether the current user is admin (read-only view) */
  isAdmin?: boolean;
}

export default function TripChat({
  tripId,
  currentUserId,
  isShipper: _isShipper,
  isAdmin = false,
}: TripChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/messages?limit=100`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
      setReadOnly(data.readOnly || false);
    } catch {
      // Silent — polling will retry
    }
  }, [tripId]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/messages/unread-count`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silent
    }
  }, [tripId]);

  // Fetch unread count on mount + poll
  useEffect(() => {
    if (isAdmin) return; // Admin doesn't need unread count
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [fetchUnreadCount, isAdmin]);

  // When chat opens: fetch messages + start polling
  useEffect(() => {
    if (!isOpen) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    setLoading(true);
    fetchMessages().then(() => {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    });

    // Poll every 5 seconds when chat is open
    pollingRef.current = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, fetchMessages, scrollToBottom]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, isOpen, scrollToBottom]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (!isOpen || isAdmin || messages.length === 0) return;

    const unreadFromOther = messages.filter(
      (m) => m.senderId !== currentUserId && !m.readAt
    );

    for (const msg of unreadFromOther) {
      getCSRFToken().then((csrfToken) => {
        fetch(`/api/trips/${tripId}/messages/${msg.id}/read`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken && { "X-CSRF-Token": csrfToken }),
          },
          credentials: "include",
        }).catch(() => {});
      });
    }

    // Reset unread after viewing
    if (unreadFromOther.length > 0) {
      setUnreadCount(0);
    }
  }, [isOpen, messages, currentUserId, tripId, isAdmin]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const csrfToken = await getCSRFToken();
      const res = await fetch(`/api/trips/${tripId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        setNewMessage("");
        await fetchMessages();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send message");
      }
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const canSend = !readOnly && !isAdmin;

  // Chat toggle button with unread badge
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-700 hover:shadow-xl"
      >
        <MessageCircle className="h-5 w-5" />
        Messages
        {unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Chat panel
  return (
    <div className="fixed right-6 bottom-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-teal-400" />
          <h3 className="text-sm font-semibold text-white">Trip Messages</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-full p-1 text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Read-only banner */}
      {readOnly && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          This conversation is now read-only
        </div>
      )}

      {isAdmin && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-center text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          Admin view — read-only for dispute resolution
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle
              className="mb-2 h-8 w-8"
              style={{ color: "var(--foreground-muted)" }}
            />
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              No messages yet
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              {canSend ? "Start the conversation" : "Messages will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMine = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                      isMine
                        ? "rounded-br-md bg-teal-600 text-white"
                        : "rounded-bl-md bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    {!isMine && (
                      <p
                        className={`mb-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                          isMine
                            ? "text-teal-200"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {msg.sender?.firstName || msg.senderRole}
                      </p>
                    )}
                    <p
                      className={`text-sm break-words whitespace-pre-wrap ${
                        isMine ? "text-white" : ""
                      }`}
                      style={
                        !isMine ? { color: "var(--foreground)" } : undefined
                      }
                    >
                      {msg.content}
                    </p>
                    {msg.attachmentUrl && (
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-1 flex items-center gap-1 text-xs underline ${
                          isMine
                            ? "text-teal-200"
                            : "text-teal-600 dark:text-teal-400"
                        }`}
                      >
                        <Paperclip className="h-3 w-3" />
                        Attachment
                      </a>
                    )}
                    <div
                      className={`mt-1 flex items-center gap-1 text-[10px] ${
                        isMine
                          ? "justify-end text-teal-200"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      <span>{formatTime(msg.createdAt)}</span>
                      {isMine && msg.readAt && (
                        <span className="ml-1">Read</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      {canSend && (
        <div className="border-t px-3 py-2.5 dark:border-slate-700">
          <div className="flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.slice(0, 2000))}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              maxLength={2000}
              className="max-h-24 flex-1 resize-none rounded-xl border px-3 py-2 text-sm"
              style={{
                background: "var(--card)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {newMessage.length > 1800 && (
            <p className="mt-1 text-right text-[10px] text-amber-600">
              {newMessage.length}/2000
            </p>
          )}
        </div>
      )}
    </div>
  );
}
