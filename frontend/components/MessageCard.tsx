'use client';

import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { type Message, getMessageShareUrl, updateName, voteMessage } from '@/lib/api';
import { reachGoal } from '@/lib/metrika';

interface MessageCardProps {
  message: Message;
  replyMessage?: Message | null;
  streamingTokens?: string;
  isStreaming?: boolean;
  isNew?: boolean;
  onInvite?: () => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const d = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const t = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${d} ${t}`;
}

function deviceIcon(device: string | null): string {
  if (!device) return '';
  const d = device.toLowerCase();
  if (d.includes('iphone') || d.includes('android') || d.includes('phone') || d.includes('pixel') || d.includes('samsung') || d.includes('xiaomi')) return '📱';
  if (d.includes('ipad') || d.includes('tablet')) return '📱';
  return '💻';
}

export default function MessageCard({
  message,
  replyMessage,
  streamingTokens,
  isStreaming,
  isNew,
  onInvite,
}: MessageCardProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [myVote, setMyVote] = useState<0 | 1 | -1>(0);
  const [showShareTip, setShowShareTip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPaid = message.type === 'paid';
  const isInvite = message.type === 'invite';
  const senderName = message.sender_name || 'Аноним';
  const displayedResponse = isStreaming ? streamingTokens || '' : message.alice_response;

  const isOwnMessage = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const myMsgId = localStorage.getItem('alisapizdu_my_msg');
    return myMsgId ? parseInt(myMsgId, 10) === message.id : false;
  }, [message.id]);

  // Load saved vote
  useEffect(() => {
    const saved = localStorage.getItem(`vote_${message.id}`);
    if (saved) setMyVote(parseInt(saved, 10) as 1 | -1);
  }, [message.id]);

  const [showNameTip, setShowNameTip] = useState(false);

  // Name tooltip — show first, then share tooltip
  useEffect(() => {
    if (isOwnMessage && !isStreaming && message.alice_response && message.alice_response !== '...') {
      const nameTipShown = localStorage.getItem('alisapizdu_name_tip');
      const shareTipShown = localStorage.getItem('alisapizdu_tip_shown');

      if (!nameTipShown) {
        // Show name tip first
        setTimeout(() => setShowNameTip(true), 1000);
        setTimeout(() => {
          setShowNameTip(false);
          localStorage.setItem('alisapizdu_name_tip', '1');
          // Then show share tip
          if (!shareTipShown) {
            setTimeout(() => setShowShareTip(true), 500);
            setTimeout(() => {
              setShowShareTip(false);
              localStorage.setItem('alisapizdu_tip_shown', '1');
            }, 4000);
          }
        }, 4000);
      } else if (!shareTipShown) {
        setTimeout(() => setShowShareTip(true), 1500);
        setTimeout(() => { setShowShareTip(false); localStorage.setItem('alisapizdu_tip_shown', '1'); }, 5000);
      }
    }
  }, [isOwnMessage, isStreaming, message.alice_response]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const handleNameClick = useCallback(() => {
    if (!isOwnMessage) return;
    setEditName(message.sender_name || '');
    setEditing(true);
  }, [isOwnMessage, message.sender_name]);

  const handleNameSubmit = useCallback(async () => {
    const name = editName.trim();
    if (!name) { setEditing(false); return; }
    try { await updateName(message.id, name); reachGoal('name_edit'); } catch {}
    setEditing(false);
  }, [editName, message.id]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSubmit();
    if (e.key === 'Escape') setEditing(false);
  }, [handleNameSubmit]);

  const handleVote = useCallback(async (vote: 1 | -1) => {
    if (myVote === vote) return;
    setMyVote(vote);
    localStorage.setItem(`vote_${message.id}`, String(vote));
    reachGoal(vote === 1 ? 'vote_up' : 'vote_down');
    try { await voteMessage(message.id, vote); } catch {}
  }, [myVote, message.id]);

  const handleShare = useCallback(async () => {
    reachGoal('share_click');
    const userId = localStorage.getItem('alisapizdu_my_msg') ? `?ref=${message.user_id || ''}` : '';
    const url = `${window.location.origin}/${userId}#msg-${message.id}`;
    const shareText = `${message.user_message}\n\nАлиса: ${message.alice_response}\n\n`;

    if (navigator.share) {
      try { await navigator.share({ title: 'Один вопрос нейросети', text: shareText, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url; document.body.appendChild(input); input.select();
      document.execCommand('copy'); document.body.removeChild(input);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }, [message]);

  const cardClass = useMemo(() => {
    const base = 'message-card relative rounded-xl p-4 transition-all duration-200';
    const bg = 'bg-bg-card hover:bg-bg-card_hover';
    const animation = isNew ? 'animate-slide-in' : '';
    const border = isPaid ? 'vip-card' : isInvite ? 'invite-card' : isOwnMessage ? 'own-card' : 'border border-white/5';
    return `${base} ${bg} ${animation} ${border}`;
  }, [isNew, isPaid, isInvite, isOwnMessage]);

  // Build meta parts - compact for mobile, full for desktop
  const metaCompact: string[] = [];
  if (message.user_id) metaCompact.push(`#${message.user_id}`);
  if (message.country) metaCompact.push(message.country);
  if (message.city) metaCompact.push(message.city);

  const metaExtra: string[] = [];
  if (message.device) metaExtra.push(`${deviceIcon(message.device)} ${message.device}`);
  if (message.os) metaExtra.push(message.os);

  return (
    <div id={`msg-${message.id}`} className={cardClass}>
      {isPaid && (
        <div className="flex items-center gap-2 mb-2">
          <span className="vip-badge text-xs font-bold uppercase tracking-wider">
            VIP-запрос {message.amount ? `${message.amount}` : '1000'}&thinsp;&#8381;
          </span>
        </div>
      )}
      {isInvite && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-alice-purple/70 text-[10px]">🔗 По приглашению</span>
        </div>
      )}

      {/* Header: name + meta */}
      <div className="flex items-baseline justify-between gap-1.5 mb-1.5 text-[10px] sm:text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative shrink-0">
            {showNameTip && (
              <div className="absolute -top-9 left-0 bg-alice-purple text-white text-xs px-3 py-1.5
                              rounded-lg whitespace-nowrap animate-fade-in shadow-lg z-10">
                Нажми, чтобы указать имя ☝
                <div className="absolute left-4 -bottom-[6px] w-0 h-0 border-l-[6px] border-l-transparent
                                border-r-[6px] border-r-transparent border-t-[6px] border-t-alice-purple" />
              </div>
            )}
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value.slice(0, 30))}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameSubmit}
                placeholder="Введите имя"
                className="bg-transparent border-b border-alice-purple/50 text-white/80 text-sm
                           font-medium outline-none w-28 py-0.5"
              />
            ) : (
              <span
                onClick={handleNameClick}
                className={`text-white/60 text-sm font-medium ${
                  isOwnMessage
                    ? 'border-b border-dashed border-white/30 cursor-pointer hover:text-white/70'
                    : ''
                } ${showNameTip ? 'text-white/80 animate-pulse' : ''}`}
              >
                {senderName}
              </span>
            )}
          </div>
          <span className="text-white/15 truncate">
            {metaCompact.join(' · ')}
            {metaExtra.length > 0 && (
              <span className="hidden sm:inline"> · {metaExtra.join(' · ')}</span>
            )}
          </span>
        </div>
        <span className="text-white/20 text-[10px] shrink-0">{formatDateTime(message.created_at)}</span>
      </div>

      {/* Reply reference */}
      {replyMessage && (
        <div
          className="mb-2 flex items-start gap-2 cursor-pointer group"
          onClick={() => {
            const el = document.getElementById(`msg-${replyMessage.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          <div className="w-0.5 h-full min-h-[32px] bg-alice-purple/30 rounded-full shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-alice-purple/60 font-medium mb-0.5">
              ↩ Ответ на сообщение Алисы
            </div>
            <p className="text-white/25 text-xs truncate group-hover:text-white/40 transition-colors">
              {replyMessage.alice_response?.slice(0, 80)}
              {(replyMessage.alice_response?.length || 0) > 80 ? '...' : ''}
            </p>
          </div>
        </div>
      )}

      {/* User message bubble */}
      <div className="mb-3">
        <div className="inline-block bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-2.5">
          <p className="text-white text-base sm:text-lg leading-relaxed">
            {message.user_message}
          </p>
        </div>
      </div>

      {/* Alice response */}
      {(displayedResponse || isStreaming || message.alice_image) && (
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-alice-purple flex items-center justify-center">
            <span className="text-white font-bold text-sm">А</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-alice-purple font-medium mb-1">Алиса</div>
            {displayedResponse && (
              <p className={`text-alice-text text-base sm:text-lg leading-relaxed break-words whitespace-pre-wrap${
                isStreaming ? ' typewriter-cursor' : ''
              }`}>
                {displayedResponse}
              </p>
            )}
            {(message.has_image || message.alice_image) && (
              <img
                src={message.alice_image
                  ? `data:image/jpeg;base64,${message.alice_image}`
                  : `/api/image/${message.id}`
                }
                alt="Ответ Алисы"
                className="mt-2 rounded-lg max-w-full max-h-[400px] object-contain border border-white/10"
                loading="lazy"
              />
            )}
          </div>
        </div>
      )}

      {/* Bottom bar: votes + share */}
      {!isStreaming && message.alice_response && message.alice_response !== '...' && (
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
          {/* Votes */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleVote(1)}
              className={`flex items-center gap-1 transition-all duration-200 ${
                myVote === 1 ? 'text-alice-purple' : 'text-white/15 hover:text-alice-purple/60'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 22V11l-5 1v9h5zm2-11l3-9a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.2l-1.2 7a2 2 0 0 1-2 1.8H9z" />
              </svg>
              {(message.votes_up > 0 || myVote === 1) && (
                <span className="text-[11px] font-medium">{message.votes_up}</span>
              )}
            </button>
            <button
              onClick={() => handleVote(-1)}
              className={`flex items-center gap-1 transition-all duration-200 ${
                myVote === -1 ? 'text-alice-light' : 'text-white/15 hover:text-alice-light/60'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-180">
                <path d="M7 22V11l-5 1v9h5zm2-11l3-9a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.2l-1.2 7a2 2 0 0 1-2 1.8H9z" />
              </svg>
              {(message.votes_down > 0 || myVote === -1) && (
                <span className="text-[11px] font-medium">{message.votes_down}</span>
              )}
            </button>
          </div>

          {/* Share + Invite */}
          <div className="flex items-center gap-1.5 relative">
            {showShareTip && (
              <div className="absolute -left-40 -top-1 bg-alice-purple text-white text-xs px-3 py-1.5
                              rounded-lg whitespace-nowrap animate-fade-in shadow-lg z-10">
                Расскажите друзьям! 👉
                <div className="absolute right-[-6px] top-2 w-0 h-0 border-t-[6px] border-t-transparent
                                border-b-[6px] border-b-transparent border-l-[6px] border-l-alice-purple" />
              </div>
            )}
            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 text-xs transition-all duration-200 px-2 py-1 rounded-lg ${
                isOwnMessage
                  ? 'text-alice-purple bg-alice-purple/10 hover:bg-alice-purple/20'
                  : 'text-white/25 hover:text-white/50 hover:bg-white/5'
              } ${showShareTip ? 'animate-pulse ring-2 ring-alice-purple/50' : ''}`}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Скопировано</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  <span>Поделиться</span>
                </>
              )}
            </button>
            {onInvite && (
              <button
                onClick={onInvite}
                className="flex items-center gap-1 text-xs transition-all duration-200 px-2 py-1 rounded-lg
                           text-alice-purple/60 hover:text-alice-purple hover:bg-alice-purple/10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <span className="hidden sm:inline">Пригласить</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
