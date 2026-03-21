'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSSEUrl, type Message } from '@/lib/api';

interface SSEEvents {
  onNewMessage: (message: Message) => void;
  onToken: (messageId: number, token: string) => void;
  onMessageComplete: (messageId: number, fullResponse: string, aliceImage?: string | null) => void;
  onOnlineCount: (count: number) => void;
  onNameUpdate?: (messageId: number, senderName: string) => void;
  onVoteUpdate?: (messageId: number, up: number, down: number) => void;
}

const MIN_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

export function useSSE(events: SSEEvents) {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const url = getSSEUrl();
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      retryCountRef.current = 0;
    };

    es.addEventListener('message:new', (e) => {
      try {
        const message: Message = JSON.parse(e.data);
        eventsRef.current.onNewMessage(message);
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('message:token', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventsRef.current.onToken(data.id, data.token);
      } catch { /* ignore */ }
    });

    es.addEventListener('message:complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventsRef.current.onMessageComplete(data.id, data.alice_response, data.alice_image);
      } catch { /* ignore */ }
    });

    es.addEventListener('online:count', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventsRef.current.onOnlineCount(data.count);
      } catch { /* ignore */ }
    });

    es.addEventListener('message:name', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventsRef.current.onNameUpdate?.(data.id, data.sender_name);
      } catch { /* ignore */ }
    });

    es.addEventListener('message:vote', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventsRef.current.onVoteUpdate?.(data.id, data.up, data.down);
      } catch { /* ignore */ }
    });

    // heartbeat is handled automatically by EventSource

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      if (!mountedRef.current) return;

      const retryDelay = Math.min(
        MIN_RETRY_DELAY * Math.pow(2, retryCountRef.current),
        MAX_RETRY_DELAY
      );
      retryCountRef.current += 1;

      setTimeout(() => {
        if (mountedRef.current) connect();
      }, retryDelay);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);
}
