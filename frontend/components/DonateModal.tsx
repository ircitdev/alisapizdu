'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { reachGoal } from '@/lib/metrika';
import TeamModal from './TeamModal';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonateModal({ isOpen, onClose }: DonateModalProps) {
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

  const [teamOpen, setTeamOpen] = useState(false);

  useEffect(() => {
    if (isOpen) reachGoal('donate_open');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/70 backdrop-blur-sm animate-fade-in px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm mx-auto bg-bg-card rounded-2xl border border-vip-gold/30 p-6 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-vip-gold">
            Грантовая поддержка
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-white/50 text-sm mb-5 leading-relaxed">
          Данная платформа является частью независимого исследования в области
          поведенческих реакций генеративных нейросетей на нестандартные
          пользовательские запросы. Проект реализуется без институционального
          финансирования и существует исключительно благодаря добровольным
          пожертвованиям неравнодушных участников научного сообщества.
        </p>

        <div className="space-y-3">
          <a
            onClick={() => reachGoal('donate_click')}
            href="https://t.me/uspeshnyy"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl font-semibold text-center text-base
                       bg-gradient-to-r from-vip-gold to-yellow-500 text-black
                       hover:shadow-lg hover:shadow-vip-gold/20 transition-all duration-300
                       active:scale-[0.98]"
          >
            Выделить грант
          </a>

          <button
            onClick={() => setTeamOpen(true)}
            className="w-full py-2.5 rounded-xl font-medium text-sm text-center
                       border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20
                       transition-all duration-300"
          >
            Команда исследователей
          </button>

          <div className="text-center">
            <p className="text-white/25 text-[11px] mt-3 leading-relaxed">
              Распространение ссылки на платформу среди коллег также является
              существенным вкладом в развитие исследования
            </p>
          </div>
        </div>
      </div>

      <TeamModal isOpen={teamOpen} onClose={() => setTeamOpen(false)} />
    </div>
  );
}
