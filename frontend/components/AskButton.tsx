'use client';

import { useState, useCallback, useEffect } from 'react';
import { askAlice } from '@/lib/api';
import { reachGoal } from '@/lib/metrika';

interface AskButtonProps {
  onCustomClick: () => void;
  hasAsked: boolean;
}

type ButtonState = 'idle' | 'thinking' | 'used';

const STORAGE_KEY = 'alisapizdu_last_ask';

function getTimeUntilReset(): number {
  const lastAsk = localStorage.getItem(STORAGE_KEY);
  if (!lastAsk) return 0;
  const elapsed = Date.now() - parseInt(lastAsk, 10);
  const remaining = 24 * 60 * 60 * 1000 - elapsed;
  return remaining > 0 ? remaining : 0;
}

function formatRemaining(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

export default function AskButton({ onCustomClick, hasAsked }: AskButtonProps) {
  const [state, setState] = useState<ButtonState>('idle');
  const [remaining, setRemaining] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [myMessageId, setMyMessageId] = useState<number | null>(null);

  // Check if already used today
  useEffect(() => {
    const timeLeft = getTimeUntilReset();
    if (timeLeft > 0) {
      setState('used');
      setRemaining(formatRemaining(timeLeft));

      const interval = setInterval(() => {
        const left = getTimeUntilReset();
        if (left <= 0) {
          setState('idle');
          setRemaining('');
          clearInterval(interval);
        } else {
          setRemaining(formatRemaining(left));
        }
      }, 60000);

      return () => clearInterval(interval);
    }
  }, []);

  // Store message ID for name editing
  useEffect(() => {
    const stored = localStorage.getItem('alisapizdu_my_msg');
    if (stored) setMyMessageId(parseInt(stored, 10));
  }, []);

  const handleAsk = useCallback(async () => {
    if (state !== 'idle') return;

    setState('thinking');
    setError(null);

    try {
      reachGoal('ask_alice');
      const result = await askAlice();
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      localStorage.setItem('alisapizdu_my_msg', String(result.id));
      setMyMessageId(result.id);
      setState('used');
      setRemaining(formatRemaining(24 * 60 * 60 * 1000));
    } catch (err) {
      setState('idle');
      const msg = err instanceof Error ? err.message : 'Ошибка';
      // If rate limited by server
      if (msg.includes('уже спрашивал') || msg.includes('429')) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        setState('used');
        setRemaining(formatRemaining(24 * 60 * 60 * 1000));
      } else {
        setError(msg);
        setTimeout(() => setError(null), 3000);
      }
    }
  }, [state]);

  const buttonContent = () => {
    switch (state) {
      case 'thinking':
        return (
          <span className="flex items-center gap-2 justify-center">
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce" />
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.1s]" />
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="ml-1">Алиса думает...</span>
          </span>
        );
      case 'used':
        return `Ты уже спросил · ${remaining}`;
      default:
        return 'Спросить Алису';
    }
  };

  return (
    <div className="bottom-panel sticky bottom-0 z-30 py-3 px-4">
      <div className="max-w-chat mx-auto flex flex-col gap-2">
        {error && (
          <div className="text-center text-red-400 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {state === 'used' || hasAsked ? (
          <button
            onClick={onCustomClick}
            className="
              w-full py-3.5 px-6 rounded-xl border-2 border-vip-gold/40
              text-vip-gold font-semibold text-base sm:text-lg
              hover:border-vip-gold hover:bg-vip-gold/5
              transition-all duration-300 select-none
              active:scale-[0.98]
            "
          >
            Написать своё &mdash; 1000&thinsp;&#8381;
          </button>
        ) : (
          <button
            onClick={handleAsk}
            disabled={state !== 'idle'}
            className={`
              w-full py-3.5 px-6 rounded-xl text-white font-semibold text-base sm:text-lg
              transition-all duration-300 select-none
              ${
                state === 'idle'
                  ? 'btn-glow cursor-pointer active:scale-[0.98]'
                  : 'bg-alice-purple/60 animate-pulse-glow cursor-wait'
              }
            `}
          >
            {state === 'thinking' ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce" />
                <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="ml-1">Алиса думает...</span>
              </span>
            ) : (
              'Спросить Алису'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
