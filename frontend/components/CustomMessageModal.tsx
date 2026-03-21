'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { askCustom } from '@/lib/api';
import { reachGoal } from '@/lib/metrika';

interface CustomMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_LENGTH = 200;

export default function CustomMessageModal({
  isOpen,
  onClose,
}: CustomMessageModalProps) {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAlreadyUsed(!!localStorage.getItem('alisapizdu_custom_sent'));
  }, []);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      setMessage('');
      setName('');
      setError(null);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Напишите сообщение');
      return;
    }

    if (alreadyUsed) {
      setError('Вы уже отправляли бесплатное сообщение');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await askCustom(trimmed, name.trim() || undefined);
      reachGoal('custom_send');
      localStorage.setItem('alisapizdu_custom_sent', '1');
      setAlreadyUsed(true);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка. Попробуйте позже.'
      );
      setLoading(false);
    }
  }, [message, name, alreadyUsed]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Написать своё сообщение"
    >
      <div
        className="w-full sm:max-w-md mx-auto bg-bg-card rounded-t-2xl sm:rounded-2xl
                    border border-vip-gold/20 p-5 sm:p-6 animate-slide-in"
      >
        {success ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-alice-purple/20 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7B68EE" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Спасибо за участие в исследовании!</h3>
            <p className="text-white/50 text-sm mb-4 leading-relaxed">
              Как участник ранней стадии эксперимента, ваше сообщение
              опубликовано бесплатно. Алиса уже формирует ответ.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-base
                         bg-alice-purple text-white hover:bg-alice-purple/80
                         transition-all duration-300 active:scale-[0.98]"
            >
              Вернуться к чату
            </button>
          </div>
        ) : alreadyUsed ? (
          /* Already used state */
          <div className="text-center py-4">
            <h3 className="text-lg font-bold text-white mb-2">Вы уже участвовали</h3>
            <p className="text-white/50 text-sm mb-4">
              Бесплатное сообщение доступно один раз на участника.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-base
                         bg-white/10 text-white/60
                         transition-all duration-300 active:scale-[0.98]"
            >
              Закрыть
            </button>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Напиши своё сообщение
              </h2>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white/70 transition-colors p-1"
                aria-label="Закрыть"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-3">
              <label className="text-white/50 text-sm mb-1 block">Имя (необязательно)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Аноним"
                maxLength={30}
                className="w-full bg-bg-primary border border-white/10 rounded-lg px-4 py-2.5
                           text-white placeholder:text-white/20 text-sm
                           focus:outline-none focus:border-alice-purple/50 transition-colors"
              />
            </div>

            <div className="mb-4">
              <label className="text-white/50 text-sm mb-1 block">Сообщение для Алисы</label>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_LENGTH) setMessage(e.target.value);
                }}
                placeholder="Напишите что-нибудь гениальное..."
                rows={3}
                className="w-full bg-bg-primary border border-white/10 rounded-lg px-4 py-3
                           text-white placeholder:text-white/20 text-base
                           focus:outline-none focus:border-vip-gold/40 transition-colors resize-none"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-white/30 text-xs">{message.length}/{MAX_LENGTH}</span>
                {message.length >= MAX_LENGTH && <span className="text-red-400 text-xs">Максимум</span>}
              </div>
            </div>

            {error && <div className="text-red-400 text-sm mb-3 animate-fade-in">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-300 select-none ${
                loading || !message.trim()
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-gradient-to-r from-vip-gold to-yellow-500 text-black hover:shadow-lg hover:shadow-vip-gold/20 active:scale-[0.98]'
              }`}
            >
              {loading ? 'Отправляем...' : 'Отправить'}
            </button>

            <p className="text-white/20 text-xs text-center mt-3">
              Ваше сообщение появится в общем чате. Алиса ответит.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
