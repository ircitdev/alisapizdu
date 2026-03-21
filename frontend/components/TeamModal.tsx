'use client';

import { useRef, useEffect, useCallback } from 'react';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TeamModal({ isOpen, onClose }: TeamModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/70 backdrop-blur-sm animate-fade-in px-4"
    >
      <div className="w-full max-w-lg max-h-[85vh] mx-auto bg-bg-card rounded-2xl border border-white/10 flex flex-col animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-base font-bold text-white">Исследовательский коллектив</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 pb-5">
          {/* Photo */}
          <div className="rounded-xl overflow-hidden mb-4 border border-white/5">
            <img
              src="/team.jpg"
              alt="Исследовательский коллектив"
              className="w-full object-cover"
            />
          </div>

          {/* Description */}
          <div className="space-y-3 text-white/50 text-sm leading-relaxed">
            <p>
              Междисциплинарная группа специалистов в области компьютерной лингвистики,
              когнитивной психологии и машинного обучения, объединённая общей целью —
              исследование границ допустимого в диалоговых системах на основе
              больших языковых моделей.
            </p>

            <p>
              Проект реализуется под научным руководством{' '}
              <span className="text-white/70 font-medium">Александра Успешного</span> —
              независимого исследователя в области генеративного ИИ, автора ряда
              экспериментальных платформ по изучению поведенческих паттернов нейросетей
              в условиях нестандартных пользовательских сценариев.
            </p>

            <p className="text-white/30 text-xs italic">
              «Мы не задаём нейросетям неудобные вопросы. Мы изучаем, как они
              формируют отказ — и что это говорит о границах машинной этики.»
            </p>

            <p className="text-white/30 text-xs">
              Коллектив открыт к сотрудничеству с академическими институтами
              и независимыми исследователями. Для связи:{' '}
              <a
                href="https://t.me/uspeshnyy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-alice-purple hover:text-alice-purple/80 transition-colors"
              >
                @uspeshnyy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
