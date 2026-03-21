'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchMessages, fetchStats, type Message } from '@/lib/api';

interface StreamingState {
  [messageId: number]: {
    tokens: string;
    isComplete: boolean;
  };
}

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [totalMessages, setTotalMessages] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [vipCount, setVipCount] = useState(0);
  const [streamingState, setStreamingState] = useState<StreamingState>({});

  const loadedRef = useRef(false);

  // Load initial messages and stats
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function init() {
      try {
        const [messagesData, statsData] = await Promise.all([
          fetchMessages(null, 20),
          fetchStats(),
        ]);

        setMessages([...messagesData.messages].reverse());
        setNextCursor(messagesData.next_cursor);
        setHasMore(messagesData.has_more);
        setTotalMessages(statsData.total_messages);
        setOnlineCount(statsData.online_count);
        setVipCount(statsData.vip_count || 0);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    init();
  }, []);

  // Load older messages (scroll up)
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || nextCursor == null) return;

    setLoading(true);
    try {
      const data = await fetchMessages(nextCursor, 20);
      setMessages((prev) => [...[...data.messages].reverse(), ...prev]);
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, nextCursor]);

  // SSE: new message arrived
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
    setTotalMessages((prev) => prev + 1);

    // Start streaming state for this message if response is empty
    if (!message.alice_response) {
      setStreamingState((prev) => ({
        ...prev,
        [message.id]: { tokens: '', isComplete: false },
      }));
    }
  }, []);

  // SSE: token received for streaming response
  const appendToken = useCallback((messageId: number, token: string) => {
    setStreamingState((prev) => {
      const current = prev[messageId] || { tokens: '', isComplete: false };
      return {
        ...prev,
        [messageId]: {
          ...current,
          tokens: current.tokens + token,
        },
      };
    });
  }, []);

  // SSE: message complete
  const completeMessage = useCallback(
    (messageId: number, fullResponse: string, aliceImage?: string | null) => {
      // Update the message with full response
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, alice_response: fullResponse, alice_image: aliceImage || null, has_image: aliceImage ? 1 : (m.has_image || 0) }
            : m
        )
      );

      // Mark streaming as complete
      setStreamingState((prev) => {
        const next = { ...prev };
        if (next[messageId]) {
          next[messageId] = { ...next[messageId], isComplete: true };
        }
        // Clean up after animation finishes
        setTimeout(() => {
          setStreamingState((p) => {
            const cleaned = { ...p };
            delete cleaned[messageId];
            return cleaned;
          });
        }, 500);
        return next;
      });
    },
    []
  );

  // SSE: vote update
  const updateVotes = useCallback((messageId: number, up: number, down: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, votes_up: up, votes_down: down } : m
      )
    );
  }, []);

  // SSE: name update
  const updateMessageName = useCallback((messageId: number, senderName: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, sender_name: senderName } : m
      )
    );
  }, []);

  const updateReactions = useCallback((messageId: number, reactions: Record<string, number>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      )
    );
  }, []);

  // SSE: online count update
  const updateOnlineCount = useCallback((count: number) => {
    setOnlineCount(count);
  }, []);

  return {
    messages,
    loading,
    initialLoading,
    hasMore,
    totalMessages,
    onlineCount,
    streamingState,
    loadMore,
    addMessage,
    appendToken,
    completeMessage,
    updateVotes,
    updateReactions,
    updateMessageName,
    vipCount,
    updateOnlineCount,
    setTotalMessages,
  };
}
