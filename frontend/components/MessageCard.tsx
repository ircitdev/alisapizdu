'use client';

import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { type Message, getMessageShareUrl, updateName, voteMessage } from '@/lib/api';
import { reachGoal } from '@/lib/metrika';

interface MessageCardProps {
  message: Message;
  streamingTokens?: string;
  isStreaming?: boolean;
  isNew?: boolean;
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
  streamingTokens,
  isStreaming,
  isNew,
}: MessageCardProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [myVote, setMyVote] = useState<0 | 1 | -1>(0);
  const [showShareTip, setShowShareTip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPaid = message.type === 'paid';
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

  // Share tooltip
  useEffect(() => {
    if (isOwnMessage && !isStreaming && message.alice_response && message.alice_response !== '...') {
      const tipShown = localStorage.getItem('alisapizdu_tip_shown');
      if (!tipShown) {
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
    const border = isPaid ? 'vip-card' : isOwnMessage ? 'own-card' : 'border border-white/5';
    return `${base} ${bg} ${animation} ${border}`;
  }, [isNew, isPaid, isOwnMessage]);

  // Build meta line parts
  const metaParts: string[] = [];
  if (message.user_id) metaParts.push(`#${message.user_id}`);
  if (message.device) metaParts.push(`${deviceIcon(message.device)} ${message.device}`);
  if (message.os) metaParts.push(message.os);
  if (message.country) metaParts.push(message.country);
  if (message.city) metaParts.push(message.city);
  metaParts.push(formatDateTime(message.created_at));

  return (
    <div id={`msg-${message.id}`} className={cardClass}>
      {isPaid && (
        <div className="flex items-center gap-2 mb-2">
          <span className="vip-badge text-xs font-bold uppercase tracking-wider">
            VIP-запрос {message.amount ? `${message.amount}` : '1000'}&thinsp;&#8381;
          </span>
        </div>
      )}

      {/* Header: name + meta in one line */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap text-[10px] sm:text-[11px]">
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
              isOwnMessage ? 'border-b border-dashed border-white/30 cursor-pointer hover:text-white/70' : ''
            }`}
          >
            {senderName}
          </span>
        )}
        <span className="text-white/15">
          {metaParts.join(' · ')}
        </span>
      </div>

      {/* User message */}
      <p className="text-white text-base sm:text-lg leading-relaxed mb-3">
        {message.user_message}
      </p>

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
            {message.alice_image && (
              <img
                src={`data:image/jpeg;base64,${message.alice_image}`}
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
              className={`flex items-center gap-1 text-sm transition-all duration-200 ${
                myVote === 1 ? 'text-green-400' : 'text-white/25 hover:text-green-400/70'
              }`}
            >
              <span className="text-base">👍</span>
              {(message.votes_up > 0 || myVote === 1) && (
                <span className="text-xs font-medium">{message.votes_up}</span>
              )}
            </button>
            <button
              onClick={() => handleVote(-1)}
              className={`flex items-center gap-1 text-sm transition-all duration-200 ${
                myVote === -1 ? 'text-red-400' : 'text-white/25 hover:text-red-400/70'
              }`}
            >
              <span className="text-base">👎</span>
              {(message.votes_down > 0 || myVote === -1) && (
                <span className="text-xs font-medium">{message.votes_down}</span>
              )}
            </button>
          </div>

          {/* Share */}
          <div className="relative">
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
              {copied ? '✓ Скопировано' : '↗ Поделиться'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
