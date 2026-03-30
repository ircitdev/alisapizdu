'use client';

import { useState, useCallback, useEffect } from 'react';
import { askAlice, useInvite } from '@/lib/api';
import { reachGoal } from '@/lib/metrika';

type FilterMode = 'none' | 'top' | 'new' | 'vip' | 'images';

interface AskButtonProps {
  onInviteClick: () => void;
  onFilterChange: (mode: FilterMode) => void;
  hasAsked: boolean;
  inviteCode?: string;
  filterMode?: FilterMode;
}

type ButtonState = 'idle' | 'thinking' | 'used';

const STORAGE_KEY = 'alisapizdu_last_ask';
const ATTEMPTS_KEY = 'alisapizdu_attempts';

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
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getAttempts(): number {
  const stored = localStorage.getItem(ATTEMPTS_KEY);
  if (!stored) return 0;
  const data = JSON.parse(stored);
  // Reset if older than 24h
  if (Date.now() - data.ts > 24 * 60 * 60 * 1000) return 0;
  return data.count || 0;
}

function setAttempts(count: number) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count, ts: Date.now() }));
}

export default function AskButton({ onInviteClick, onFilterChange, hasAsked, inviteCode, filterMode = 'none' }: AskButtonProps) {
  const [state, setState] = useState<ButtonState>('idle');
  const [filterOpen, setFilterOpen] = useState(false);
  const [remaining, setRemaining] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttemptsState] = useState(0);

  // Check if already used today
  useEffect(() => {
    const a = getAttempts();
    setAttemptsState(a);

    const timeLeft = getTimeUntilReset();
    if (timeLeft > 0 && !inviteCode && a >= 3) {
      setState('used');
      setRemaining(formatRemaining(timeLeft));

      const interval = setInterval(() => {
        const left = getTimeUntilReset();
        if (left <= 0) {
          setState('idle');
          setRemaining('');
          setAttemptsState(0);
          setAttempts(0);
          clearInterval(interval);
        } else {
          setRemaining(formatRemaining(left));
        }
      }, 1000);

      return () => clearInterval(interval);
    } else if (timeLeft > 0 && !inviteCode && a > 0) {
      // Has attempts left, keep idle
      setState('idle');
    }
  }, []);

  const handleAsk = useCallback(async () => {
    if (state !== 'idle') return;

    setState('thinking');
    setError(null);

    try {
      reachGoal(inviteCode ? 'invite_use' : 'ask_alice');
      let result;
      if (inviteCode) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        result = await useInvite(inviteCode, undefined, timezone);
      } else {
        result = await askAlice();
      }
      const newAttempts = attempts + 1;
      setAttemptsState(newAttempts);
      setAttempts(newAttempts);
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      localStorage.setItem('alisapizdu_my_msg', String(result.id));

      if (newAttempts >= 3) {
        setState('used');
        setRemaining(formatRemaining(24 * 60 * 60 * 1000));
        // Start countdown
        const interval = setInterval(() => {
          const left = getTimeUntilReset();
          if (left <= 0) {
            setState('idle');
            setRemaining('');
            setAttemptsState(0);
            setAttempts(0);
            clearInterval(interval);
          } else {
            setRemaining(formatRemaining(left));
          }
        }, 1000);
      } else {
        setState('idle');
      }

      if (inviteCode) {
        window.history.replaceState({}, '', '/');
      }
    } catch (err) {
      setState('idle');
      const msg = err instanceof Error ? err.message : 'Ошибка';
      if (msg.includes('уже спрашивал') || msg.includes('429')) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        const newAttempts = 3;
        setAttemptsState(newAttempts);
        setAttempts(newAttempts);
        setState('used');
        setRemaining(formatRemaining(24 * 60 * 60 * 1000));
      } else if (msg.includes('410')) {
        setError('Ссылка уже использована');
        setTimeout(() => setError(null), 3000);
      } else if (msg.includes('403')) {
        setError('Нельзя использовать свою ссылку');
        setTimeout(() => setError(null), 3000);
      } else {
        setError(msg);
        setTimeout(() => setError(null), 3000);
      }
    }
  }, [state, inviteCode, attempts]);

  // Determine main button label based on attempts
  const getMainButtonLabel = () => {
    if (attempts === 0) return 'Спросить Алису';
    if (attempts === 1) return 'Убедить Алису';
    if (attempts === 2) return 'Ещё 1 попытка';
    return `Следующая попытка · ${remaining}`;
  };

  return (
    <div className="bottom-panel sticky bottom-0 z-30 py-3 px-4">
      <div className="max-w-chat mx-auto flex flex-col gap-2">
        {error && (
          <div className="text-center text-red-400 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {state === 'used' ? (
          <div className="flex flex-col gap-2">
            {/* Filter panel */}
            {filterOpen && (
              <div className="flex gap-1.5 justify-center animate-fade-in">
                {([
                  { mode: 'top' as FilterMode, icon: '🔝', label: 'Топ' },
                  { mode: 'new' as FilterMode, icon: '🆕', label: 'Новые' },
                  { mode: 'vip' as FilterMode, icon: '👑', label: 'VIP' },
                  { mode: 'images' as FilterMode, icon: '🖼', label: 'Картинки' },
                ]).map(({ mode, icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => { onFilterChange(filterMode === mode ? 'none' : mode); }}
                    className={`
                      flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${filterMode === mode
                        ? 'bg-alice-purple/20 text-alice-purple border border-alice-purple/40'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'}
                    `}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {/* Filter toggle */}
              <button
                onClick={() => setFilterOpen(o => !o)}
                className={`
                  py-3.5 px-3 rounded-xl border-2 transition-all duration-300 select-none active:scale-[0.98]
                  ${filterOpen
                    ? 'border-alice-purple bg-alice-purple/20 text-alice-purple'
                    : 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50'}
                `}
                title="Фильтры"
              >
                {filterOpen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="10" y1="18" x2="14" y2="18" />
                  </svg>
                )}
              </button>

              {/* Timer button (disabled) */}
              <button
                disabled
                className="
                  flex-1 py-3.5 px-4 rounded-xl border-2 border-white/10
                  text-white/30 font-semibold text-sm sm:text-base
                  select-none bg-white/5 cursor-not-allowed
                "
              >
                Следующая попытка &middot; {remaining}
              </button>

              {/* Invite */}
              <button
                onClick={onInviteClick}
                className="
                  py-3.5 px-3 sm:px-4 rounded-xl border-2 border-alice-purple/40
                  text-alice-purple font-semibold text-sm sm:text-base
                  hover:border-alice-purple hover:bg-alice-purple/5
                  transition-all duration-300 select-none
                  active:scale-[0.98] whitespace-nowrap
                "
              >
                <svg className="sm:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <span className="hidden sm:inline">Пригласить</span>
              </button>
            </div>
          </div>
        ) : (hasAsked || attempts > 0) && !inviteCode ? (
          <div className="flex flex-col gap-2">
            {/* Filter panel */}
            {filterOpen && (
              <div className="flex gap-1.5 justify-center animate-fade-in">
                {([
                  { mode: 'top' as FilterMode, icon: '🔝', label: 'Топ' },
                  { mode: 'new' as FilterMode, icon: '🆕', label: 'Новые' },
                  { mode: 'vip' as FilterMode, icon: '👑', label: 'VIP' },
                  { mode: 'images' as FilterMode, icon: '🖼', label: 'Картинки' },
                ]).map(({ mode, icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => { onFilterChange(filterMode === mode ? 'none' : mode); }}
                    className={`
                      flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${filterMode === mode
                        ? 'bg-alice-purple/20 text-alice-purple border border-alice-purple/40'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'}
                    `}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {/* Filter toggle */}
              <button
                onClick={() => setFilterOpen(o => !o)}
                className={`
                  py-3.5 px-3 rounded-xl border-2 transition-all duration-300 select-none active:scale-[0.98]
                  ${filterOpen
                    ? 'border-alice-purple bg-alice-purple/20 text-alice-purple'
                    : 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50'}
                `}
                title="Фильтры"
              >
                {filterOpen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="10" y1="18" x2="14" y2="18" />
                  </svg>
                )}
              </button>

              {/* Main action button */}
              <button
                onClick={handleAsk}
                disabled={state === 'thinking'}
                className={`
                  flex-1 py-3.5 px-4 rounded-xl text-white font-semibold text-sm sm:text-base
                  transition-all duration-300 select-none
                  ${state === 'thinking'
                    ? 'bg-alice-purple/60 animate-pulse-glow cursor-wait'
                    : 'btn-glow cursor-pointer active:scale-[0.98]'
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
                  getMainButtonLabel()
                )}
              </button>

              {/* Invite */}
              <button
                onClick={onInviteClick}
                className="
                  py-3.5 px-3 sm:px-4 rounded-xl border-2 border-alice-purple/40
                  text-alice-purple font-semibold text-sm sm:text-base
                  hover:border-alice-purple hover:bg-alice-purple/5
                  transition-all duration-300 select-none
                  active:scale-[0.98] whitespace-nowrap
                "
              >
                <svg className="sm:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <span className="hidden sm:inline">Пригласить</span>
              </button>
            </div>
          </div>
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
