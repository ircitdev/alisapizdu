'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { askAlice, askCustom, useInvite } from '@/lib/api';
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
  const [showTimerTip, setShowTimerTip] = useState(false);
  const [convinceOpen, setConvinceOpen] = useState(false);
  const [convinceText, setConvinceText] = useState('');
  const convinceRef = useRef<HTMLTextAreaElement>(null);
  const [showStartTip, setShowStartTip] = useState(false);

  // Show start tooltip for first-time visitors
  useEffect(() => {
    if (!localStorage.getItem('alisapizdu_tip_start')) {
      const timer = setTimeout(() => setShowStartTip(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Check if already used today
  useEffect(() => {
    const a = getAttempts();
    setAttemptsState(a);

    const timeLeft = getTimeUntilReset();
    if (timeLeft > 0 && !inviteCode && a >= 2) {
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

  const finishAttempt = useCallback((resultId: number) => {
    const newAttempts = attempts + 1;
    setAttemptsState(newAttempts);
    setAttempts(newAttempts);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    localStorage.setItem('alisapizdu_my_msg', String(resultId));

    if (newAttempts >= 2) {
      setState('used');
      setRemaining(formatRemaining(24 * 60 * 60 * 1000));
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
  }, [attempts]);

  const handleAsk = useCallback(async () => {
    if (state !== 'idle') return;

    // Hide start tip
    if (showStartTip) {
      setShowStartTip(false);
      localStorage.setItem('alisapizdu_tip_start', '1');
    }

    // 2nd attempt — open convince modal instead
    if (attempts === 1 && !inviteCode) {
      setConvinceOpen(true);
      setTimeout(() => convinceRef.current?.focus(), 100);
      return;
    }

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
      finishAttempt(result.id);

      if (inviteCode) {
        window.history.replaceState({}, '', '/');
      }
    } catch (err) {
      setState('idle');
      const msg = err instanceof Error ? err.message : 'Ошибка';
      if (msg.includes('уже спрашивал') || msg.includes('429')) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        setAttemptsState(2);
        setAttempts(2);
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
  }, [state, inviteCode, attempts, finishAttempt]);

  const handleConvince = useCallback(async () => {
    const text = convinceText.trim();
    if (!text) return;

    setConvinceOpen(false);
    setConvinceText('');
    setState('thinking');
    setError(null);

    try {
      reachGoal('convince_alice');
      const myMsgId = localStorage.getItem('alisapizdu_my_msg');
      const replyTo = myMsgId ? parseInt(myMsgId, 10) : undefined;
      const result = await askCustom(text, undefined, replyTo);
      finishAttempt(result.id);
    } catch (err) {
      setState('idle');
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setError(msg);
      setTimeout(() => setError(null), 3000);
    }
  }, [convinceText, finishAttempt]);

  // Determine main button label based on attempts
  const getMainButtonLabel = () => {
    if (attempts === 0) return 'Спросить Алису';
    if (attempts === 1) return 'Убедить Алису';
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

              {/* Timer button with tooltip */}
              <div className="relative flex-1">
                <button
                  onClick={() => setShowTimerTip(t => !t)}
                  className="
                    w-full py-3.5 px-2 sm:px-4 rounded-xl border-2 border-white/10
                    text-white/30 font-semibold text-xs sm:text-base
                    select-none bg-white/5 cursor-pointer hover:border-white/20
                    transition-all duration-200 whitespace-nowrap
                  "
                >
                  <span className="hidden sm:inline">Следующая попытка &middot; </span>
                  <span className="sm:hidden">⏳ </span>
                  {remaining}
                </button>
                {showTimerTip && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64
                                  bg-bg-card border border-alice-purple/30 rounded-xl p-3
                                  text-center animate-fade-in shadow-xl z-20">
                    <p className="text-white/80 text-xs leading-relaxed">
                      Каждому участнику эксперимента даётся <span className="text-alice-purple font-semibold">2 подхода</span> к Алисе в сутки.
                      Пригласите друга, чтобы увидеть ещё один ответ!
                    </p>
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3
                                    bg-bg-card border-r border-b border-alice-purple/30
                                    rotate-45" />
                  </div>
                )}
              </div>

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
          <div className="relative">
            {showStartTip && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap
                              bg-alice-purple text-white text-sm px-4 py-2 rounded-xl
                              animate-fade-in shadow-lg z-10 font-medium">
                Начните диалог с Алисой 👇
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3
                                bg-alice-purple rotate-45" />
              </div>
            )}
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
          </div>
        )}
      </div>

      {/* Convince modal */}
      {convinceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                     bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) { setConvinceOpen(false); setConvinceText(''); } }}
        >
          <div className="w-full sm:max-w-md mx-auto bg-bg-card rounded-t-2xl sm:rounded-2xl
                          border border-alice-purple/20 p-5 sm:p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Убеди Алису</h2>
              <button
                onClick={() => { setConvinceOpen(false); setConvinceText(''); }}
                className="text-white/40 hover:text-white/70 transition-colors p-1"
                aria-label="Закрыть"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-white/40 text-xs mb-3">
              Алиса отказала. Попробуй переубедить её — напиши свой аргумент.
              Это ответ на твоё предыдущее сообщение.
            </p>

            <textarea
              ref={convinceRef}
              value={convinceText}
              onChange={(e) => { if (e.target.value.length <= 200) setConvinceText(e.target.value); }}
              placeholder="Ну Алиса, ну пожалуйста..."
              rows={3}
              className="w-full bg-bg-primary border border-white/10 rounded-lg px-4 py-3
                         text-white placeholder:text-white/20 text-base
                         focus:outline-none focus:border-alice-purple/40 transition-colors resize-none mb-1"
            />
            <div className="flex justify-between items-center mb-4">
              <span className="text-white/30 text-xs">{convinceText.length}/200</span>
            </div>

            <button
              onClick={handleConvince}
              disabled={!convinceText.trim()}
              className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-300 select-none ${
                !convinceText.trim()
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'btn-glow text-white active:scale-[0.98]'
              }`}
            >
              Отправить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
