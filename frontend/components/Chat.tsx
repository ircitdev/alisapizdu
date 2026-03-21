'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useSSE } from '@/hooks/useSSE';
import Header from './Header';
import MessageCard from './MessageCard';
import AskButton from './AskButton';
import CustomMessageModal from './CustomMessageModal';
import DonateModal from './DonateModal';
import LegalModal from './LegalModal';
import { reachGoal } from '@/lib/metrika';

const APP_VERSION = '1.0.0';
const BUILD_ID = '2026.03.21';

export default function Chat() {
  const {
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
    updateMessageName,
    updateOnlineCount,
    setTotalMessages,
  } = useMessages();

  const [modalOpen, setModalOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [legalType, setLegalType] = useState<'privacy' | 'terms' | 'cookies' | null>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<number>>(new Set());
  const [hasAsked, setHasAsked] = useState(false);
  const [fakeOnline, setFakeOnline] = useState(0);

  // Check if user already asked
  useEffect(() => {
    const lastAsk = localStorage.getItem('alisapizdu_last_ask');
    if (lastAsk) {
      const elapsed = Date.now() - parseInt(lastAsk, 10);
      if (elapsed < 24 * 60 * 60 * 1000) setHasAsked(true);
    }
  }, []);

  // Fake online count — random between 3-25, drifts slowly
  useEffect(() => {
    const base = 5 + Math.floor(Math.random() * 12);
    setFakeOnline(base);
    const interval = setInterval(() => {
      setFakeOnline((prev) => {
        const delta = Math.random() < 0.5 ? -1 : 1;
        const next = prev + delta;
        return Math.max(3, Math.min(28, next));
      });
    }, 4000 + Math.random() * 6000);
    return () => clearInterval(interval);
  }, []);

  const chatRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = useRef(true);
  const initialScrollDone = useRef(false);

  // SSE connection
  useSSE({
    onNewMessage: (msg) => {
      addMessage(msg);
      setNewMessageIds((prev) => new Set(prev).add(msg.id));
      // Remove from "new" set after animation
      setTimeout(() => {
        setNewMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      }, 1000);
    },
    onToken: appendToken,
    onMessageComplete: completeMessage,
    onOnlineCount: updateOnlineCount,
    onNameUpdate: updateMessageName,
    onVoteUpdate: updateVotes,
  });

  // Check if user is near bottom
  const checkNearBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const threshold = 150;
    isUserNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (isUserNearBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingState]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!initialLoading && !initialScrollDone.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      initialScrollDone.current = true;
    }
  }, [initialLoading]);

  // Infinite scroll up — load older messages
  const handleScroll = useCallback(() => {
    checkNearBottom();
    const el = chatRef.current;
    if (!el) return;

    if (el.scrollTop < 200 && hasMore && !loading) {
      const prevHeight = el.scrollHeight;
      loadMore().then(() => {
        // Preserve scroll position after prepending messages
        requestAnimationFrame(() => {
          if (chatRef.current) {
            chatRef.current.scrollTop =
              chatRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [checkNearBottom, hasMore, loading, loadMore]);

  // Scroll to message from hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#msg-')) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-alice-purple', 'ring-opacity-50');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-alice-purple', 'ring-opacity-50');
        }, 3000);
      }
    }
  }, [initialLoading]);

  return (
    <div className="flex flex-col h-[100dvh]">
      <Header onlineCount={Math.max(fakeOnline, onlineCount)} totalMessages={totalMessages} onDonateClick={() => setDonateOpen(true)} />

      {/* Chat feed */}
      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="max-w-chat mx-auto space-y-3">
          {/* Loading indicator at top */}
          {loading && (
            <div className="flex justify-center py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-alice-purple/50 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-alice-purple/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-alice-purple/50 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          )}

          {/* Initial loading */}
          {initialLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 rounded-full bg-alice-purple flex items-center justify-center animate-pulse">
                <span className="text-white font-bold text-xl">А</span>
              </div>
              <p className="text-white/40 text-sm">Загрузка чата...</p>
            </div>
          )}

          {/* Empty state */}
          {!initialLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-full bg-alice-purple flex items-center justify-center">
                <span className="text-white font-bold text-2xl">А</span>
              </div>
              <p className="text-white/50 text-center text-base">
                Пока никто не спросил.
                <br />
                Будь первым!
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            const streaming = streamingState[msg.id];
            return (
              <MessageCard
                key={msg.id}
                message={msg}
                streamingTokens={streaming?.tokens}
                isStreaming={!!streaming && !streaming.isComplete}
                isNew={newMessageIds.has(msg.id)}
              />
            );
          })}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      <AskButton onCustomClick={() => { setModalOpen(true); reachGoal('custom_open'); }} hasAsked={hasAsked} />

      <CustomMessageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <DonateModal
        isOpen={donateOpen}
        onClose={() => setDonateOpen(false)}
      />

      <LegalModal
        isOpen={legalType !== null}
        onClose={() => setLegalType(null)}
        type={legalType || 'privacy'}
      />

      <footer className="py-3 px-4">
        <div className="max-w-chat mx-auto flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <a
              href="https://t.me/uspeshnyy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/15 hover:text-white/30 text-[10px] transition-colors"
            >
              Uspeshnyy dev
            </a>
            <span className="text-white/8 text-[9px] font-mono">v{APP_VERSION} ({BUILD_ID})</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button onClick={() => setLegalType('privacy')} className="text-white/10 hover:text-white/25 text-[10px] transition-colors">
              Политика
            </button>
            <button onClick={() => setLegalType('terms')} className="text-white/10 hover:text-white/25 text-[10px] transition-colors">
              Соглашение
            </button>
            <button onClick={() => setLegalType('cookies')} className="text-white/10 hover:text-white/25 text-[10px] transition-colors">
              Cookies
            </button>
            <span className="text-white/15 text-[10px] border border-white/10 rounded px-1 py-0.5 font-bold">18+</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
