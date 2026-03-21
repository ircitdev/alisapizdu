'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPayment } from '@/lib/api';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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

    setLoading(true);
    setError(null);

    try {
      const { payment_url } = await createPayment(trimmed);
      // Redirect to payment
      window.location.href = payment_url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка. Попробуйте позже.'
      );
      setLoading(false);
    }
  }, [message]);

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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            Напиши своё сообщение
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            aria-label="Закрыть"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Name input */}
        <div className="mb-3">
          <label className="text-white/50 text-sm mb-1 block">
            Имя (необязательно)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Аноним"
            maxLength={30}
            className="w-full bg-bg-primary border border-white/10 rounded-lg px-4 py-2.5
                       text-white placeholder:text-white/20 text-sm
                       focus:outline-none focus:border-alice-purple/50
                       transition-colors"
          />
        </div>

        {/* Message textarea */}
        <div className="mb-4">
          <label className="text-white/50 text-sm mb-1 block">
            Сообщение для Алисы
          </label>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_LENGTH) {
                setMessage(e.target.value);
              }
            }}
            placeholder="Напишите что-нибудь..."
            rows={3}
            className="w-full bg-bg-primary border border-white/10 rounded-lg px-4 py-3
                       text-white placeholder:text-white/20 text-base
                       focus:outline-none focus:border-vip-gold/40
                       transition-colors resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-white/30 text-xs">
              {message.length}/{MAX_LENGTH}
            </span>
            {message.length >= MAX_LENGTH && (
              <span className="text-red-400 text-xs">Максимум символов</span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm mb-3 animate-fade-in">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !message.trim()}
          className={`
            w-full py-3.5 rounded-xl font-semibold text-base
            transition-all duration-300 select-none
            ${
              loading || !message.trim()
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-vip-gold to-yellow-500 text-black hover:shadow-lg hover:shadow-vip-gold/20 active:scale-[0.98]'
            }
          `}
        >
          {loading ? 'Перенаправление на оплату...' : 'Оплатить и отправить — 1000 \u20BD'}
        </button>

        <p className="text-white/20 text-xs text-center mt-3">
          Оплата через ЮKassa. Ваше сообщение появится в общем чате.
        </p>
      </div>
    </div>
  );
}
