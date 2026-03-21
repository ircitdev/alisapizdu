'use client';

import { useState, useCallback } from 'react';
import { createInvite } from '@/lib/api';
import { reachGoal } from '@/lib/metrika';

const INVITE_MESSAGES = [
  (name: string) => `${name}, зацени — экспериментальная платформа изучения взаимодействия человека с ИИ. Открой ссылку, там одна кнопка`,
  (name: string) => `${name}, глянь что нашёл. Какой-то эксперимент с нейросетью, надо просто нажать кнопку`,
  (name: string) => `${name}, открой это. Не буду спойлерить, просто нажми кнопку и посмотри что будет`,
  (name: string) => `${name}, мне скинули ссылку на какой-то эксперимент с ИИ, я уже попробовал — теперь твоя очередь`,
  (name: string) => `${name}, тут исследование поведения нейросетей. Зайди и нажми кнопку — результат тебя удивит`,
];

function getInviteMessage(name: string): string {
  return INVITE_MESSAGES[Math.floor(Math.random() * INVITE_MESSAGES.length)](name);
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId?: number;
}

export default function InviteModal({ isOpen, onClose, messageId }: InviteModalProps) {
  const [name, setName] = useState('');
  const [allowRename, setAllowRename] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [inviteText, setInviteText] = useState('');

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Введите имя друга');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await createInvite(
        name.trim(),
        allowRename,
        email.trim() || undefined,
      );
      setResult({ code: res.code, url: res.url });
      setInviteText(getInviteMessage(name.trim()));
      reachGoal('invite_create');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('429')) {
        setError('Максимум 10 ссылок-приглашений');
      } else if (msg.includes('400')) {
        setError('Проверьте данные');
      } else {
        setError('Ошибка создания ссылки');
      }
    } finally {
      setLoading(false);
    }
  }, [name, allowRename, email]);

  const fullUrl = result ? `${window.location.origin}${result.url}` : '';

  const shareText = inviteText ? `${inviteText}\n\n${fullUrl}` : fullUrl;

  const handleCopy = useCallback(async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('textarea');
      input.value = shareText;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareText]);

  const handleTelegram = useCallback(() => {
    if (!fullUrl) return;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(inviteText)}`, '_blank');
  }, [fullUrl, inviteText]);

  const handleClose = useCallback(() => {
    setName('');
    setAllowRename(false);
    setEmail('');
    setResult(null);
    setError('');
    setCopied(false);
    setInviteText('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-bg-card rounded-2xl p-5 border border-alice-purple/20 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-white text-lg font-semibold mb-4">
          🔗 Пригласить друга
        </h3>

        {!result ? (
          <>
            {/* Name field */}
            <label className="block text-white/50 text-xs mb-1.5">Имя друга</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 30))}
              placeholder="Вася"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-white
                         placeholder:text-white/20 outline-none focus:border-alice-purple/50 transition-colors mb-3"
              autoFocus
            />

            {/* Allow rename */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowRename}
                onChange={(e) => setAllowRename(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/[0.06] text-alice-purple
                           focus:ring-alice-purple/50 focus:ring-offset-0 accent-[#7B68EE]"
              />
              <span className="text-white/50 text-sm">Разрешить менять имя</span>
            </label>

            {/* Email field */}
            <label className="block text-white/50 text-xs mb-1.5">Email для уведомлений</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 100))}
              placeholder="user@example.com"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-white
                         placeholder:text-white/20 outline-none focus:border-alice-purple/50 transition-colors mb-1"
            />
            <p className="text-white/20 text-[10px] mb-4">
              Получите письмо когда друг перейдёт по ссылке
            </p>

            {/* Preview text */}
            {name.trim() && (
              <p className="text-white/30 text-xs mb-4 bg-white/[0.03] rounded-lg p-2.5">
                Сообщение будет опубликовано от имени «<span className="text-alice-purple">{name.trim()}</span>» когда друг перейдёт по ссылке и нажмёт кнопку
              </p>
            )}

            {error && (
              <p className="text-red-400 text-xs mb-3">{error}</p>
            )}

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="w-full btn-glow text-white font-semibold py-3 rounded-xl
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Создаю...' : 'Создать ссылку'}
            </button>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-white/60 text-sm">
                Ссылка для «<span className="text-alice-purple">{name.trim()}</span>» готова
              </p>
            </div>

            {/* Message preview */}
            <div className="bg-white/[0.04] rounded-lg px-3 py-2.5 mb-3 text-white/50 text-sm leading-relaxed">
              {inviteText}
              <div className="mt-1.5 text-alice-purple text-xs font-mono break-all">{fullUrl}</div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleCopy}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  copied
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'btn-glow text-white'
                }`}
              >
                {copied ? '✓ Скопировано' : 'Скопировать'}
              </button>
              <button
                onClick={handleTelegram}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-[#2AABEE]/20
                           text-[#2AABEE] border border-[#2AABEE]/30 hover:bg-[#2AABEE]/30 transition-all"
              >
                Telegram
              </button>
            </div>

            <p className="text-white/20 text-[10px] text-center">
              Ссылка одноразовая — после использования станет неактивной
            </p>
          </>
        )}
      </div>
    </div>
  );
}
