'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useSSE } from '@/hooks/useSSE';
import Header from './Header';
import MessageCard from './MessageCard';
import AskButton from './AskButton';
import CustomMessageModal from './CustomMessageModal';
import DonateModal from './DonateModal';
import InviteModal from './InviteModal';
import LegalModal from './LegalModal';
import { reachGoal } from '@/lib/metrika';

const APP_VERSION = '1.2.0';
const BUILD_ID = '2026.03.22';

export default function Chat({ preloaderDone = false }: { preloaderDone?: boolean }) {
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
    vipCount,
    updateVotes,
    updateReactions,
    updateMessageName,
    updateOnlineCount,
    setTotalMessages,
  } = useMessages();

  const [modalOpen, setModalOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [legalType, setLegalType] = useState<'privacy' | 'terms' | 'cookies' | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState<Set<number>>(new Set());
  const [hasAsked, setHasAsked] = useState(false);
  const [fakeOnline, setFakeOnline] = useState(0);
  const [filterMode, setFilterMode] = useState<'none' | 'top' | 'new' | 'vip'>('none');
  const [inviteCode, setInviteCode] = useState<string | undefined>(undefined);

  // Read invite code from URL params (client-side only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) setInviteCode(code);
  }, []);

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
    onReactionsUpdate: updateReactions,
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

  // Scroll to bottom after preloader finishes (iOS-compatible)
  useEffect(() => {
    if (preloaderDone && !initialLoading && messages.length > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      const el = chatRef.current;
      if (el) {
        el.scrollTop = 0;
        const scrollEl = el;
        setTimeout(() => {
          const target = scrollEl.scrollHeight - scrollEl.clientHeight;
          const duration = 1200;
          const start = scrollEl.scrollTop;
          const startTime = performance.now();
          const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            scrollEl.scrollTop = start + (target - start) * ease;
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }, 600);
      }
    }
  }, [preloaderDone, initialLoading, messages]);

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
      <Header onlineCount={Math.max(fakeOnline, onlineCount)} totalMessages={totalMessages} vipCount={vipCount} onDonateClick={() => setDonateOpen(true)} />

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

          {/* Filter label */}
          {filterMode !== 'none' && messages.length > 0 && (
            <div className="text-center text-alice-purple/60 text-xs py-1">
              {filterMode === 'top' && 'Топ по голосам'}
              {filterMode === 'new' && 'Сначала новые'}
              {filterMode === 'vip' && 'Только VIP'}
            </div>
          )}

          {/* Messages */}
          {(() => {
            let sorted = messages;
            if (filterMode === 'top') sorted = [...messages].sort((a, b) => (b.votes_up - b.votes_down) - (a.votes_up - a.votes_down));
            else if (filterMode === 'new') sorted = [...messages].sort((a, b) => b.id - a.id);
            else if (filterMode === 'vip') sorted = messages.filter(m => m.type === 'paid');
            return sorted;
          })().map((msg) => {
            const streaming = streamingState[msg.id];
            const replyMsg = msg.reply_to
              ? messages.find((m) => m.id === msg.reply_to) || null
              : null;
            return (
              <MessageCard
                key={msg.id}
                message={msg}
                replyMessage={replyMsg}
                streamingTokens={streaming?.tokens}
                isStreaming={!!streaming && !streaming.isComplete}
                isNew={newMessageIds.has(msg.id)}
                onInvite={() => setInviteOpen(true)}
              />
            );
          })}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      <AskButton
        onCustomClick={() => { setModalOpen(true); reachGoal('custom_open'); }}
        onInviteClick={() => { setInviteOpen(true); reachGoal('invite_open'); }}
        onFilterChange={setFilterMode}
        filterMode={filterMode}
        hasAsked={hasAsked}
        inviteCode={inviteCode}
      />

      <CustomMessageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <DonateModal
        isOpen={donateOpen}
        onClose={() => setDonateOpen(false)}
      />

      <InviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <LegalModal
        isOpen={legalType !== null}
        onClose={() => setLegalType(null)}
        type={legalType || 'privacy'}
      />

      <footer className="py-2 px-4">
        <div className="max-w-chat mx-auto flex items-center justify-center gap-1.5 flex-wrap text-[9px] sm:text-[10px]">
          <a href="https://t.me/uspeshnyy" target="_blank" rel="noopener noreferrer" className="text-white/15 hover:text-white/30 transition-colors">Uspeshnyy dev</a>
          <span className="text-white/8">·</span>
          <span className="text-white/8 font-mono">v{APP_VERSION}</span>
          <span className="text-white/8">·</span>
          <button onClick={() => setLegalType('privacy')} className="text-white/10 hover:text-white/25 transition-colors">Политика</button>
          <button onClick={() => setLegalType('terms')} className="text-white/10 hover:text-white/25 transition-colors">Соглашение</button>
          <button onClick={() => setLegalType('cookies')} className="text-white/10 hover:text-white/25 transition-colors">Cookies</button>
          <span className="text-white/15 border border-white/10 rounded px-1 py-0.5 font-bold leading-none">18+</span>
          <a href="/docs.html" className="hidden sm:inline text-white/10 hover:text-white/25 transition-colors">Документация</a>
        </div>
      </footer>
    </div>
  );
}
