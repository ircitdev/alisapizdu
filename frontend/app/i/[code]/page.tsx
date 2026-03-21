'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInvite, useInvite, type InviteInfo } from '@/lib/api';

type Status = 'loading' | 'ready' | 'used' | 'not_found' | 'sending' | 'done' | 'error' | 'self';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [status, setStatus] = useState<Status>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [name, setName] = useState('');
  const [messageId, setMessageId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code) return;
    getInvite(code)
      .then((data) => {
        setInvite(data);
        setName(data.preset_name);
        setStatus(data.used ? 'used' : 'ready');
      })
      .catch((err) => {
        if (err.message.includes('404')) setStatus('not_found');
        else setStatus('error');
      });
  }, [code]);

  const handleAsk = useCallback(async () => {
    if (!invite) return;
    setStatus('sending');
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const res = await useInvite(code, name, timezone);
      setMessageId(res.id);
      setStatus('done');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('410')) {
        setStatus('used');
      } else if (msg.includes('403')) {
        setStatus('self');
      } else {
        setErrorMsg('Ошибка отправки');
        setStatus('error');
      }
    }
  }, [invite, code, name]);

  const handleGoToFeed = useCallback(() => {
    if (messageId) {
      router.push(`/#msg-${messageId}`);
    } else {
      router.push('/');
    }
  }, [messageId, router]);

  return (
    <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-alice-purple flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-2xl">А</span>
          </div>
          <h1 className="text-white text-lg font-semibold">алисапокажипизду.рф</h1>
          <p className="text-white/30 text-xs mt-1">Экспериментальная платформа</p>
        </div>

        {/* Content card */}
        <div className="bg-bg-card rounded-2xl p-5 border border-alice-purple/20 shadow-2xl">
          {status === 'loading' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-10 h-10 rounded-full bg-alice-purple/20 flex items-center justify-center animate-pulse">
                <span className="text-alice-purple font-bold">А</span>
              </div>
              <p className="text-white/40 text-sm">Загрузка...</p>
            </div>
          )}

          {status === 'not_found' && (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🔍</div>
              <p className="text-white/60 text-sm mb-4">Ссылка не найдена</p>
              <button onClick={() => router.push('/')} className="btn-glow text-white text-sm px-6 py-2.5 rounded-xl">
                На главную
              </button>
            </div>
          )}

          {status === 'used' && (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-white/60 text-sm mb-1">Ссылка уже использована</p>
              <p className="text-white/30 text-xs mb-4">Кто-то уже спросил Алису по этой ссылке</p>
              <button onClick={() => router.push('/')} className="btn-glow text-white text-sm px-6 py-2.5 rounded-xl">
                Смотреть ленту
              </button>
            </div>
          )}

          {status === 'self' && (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🙅</div>
              <p className="text-white/60 text-sm mb-1">Это ваша собственная ссылка</p>
              <p className="text-white/30 text-xs mb-4">Отправьте её другу!</p>
              <button onClick={() => router.push('/')} className="btn-glow text-white text-sm px-6 py-2.5 rounded-xl">
                На главную
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">😵</div>
              <p className="text-white/60 text-sm mb-1">{errorMsg || 'Что-то пошло не так'}</p>
              <button onClick={() => router.push('/')} className="btn-glow text-white text-sm px-6 py-2.5 rounded-xl mt-4">
                На главную
              </button>
            </div>
          )}

          {status === 'ready' && invite && (
            <>
              <p className="text-white/40 text-xs mb-4">
                Вас пригласил пользователь <span className="text-alice-purple">#{invite.created_by_user_id}</span>
              </p>

              <label className="block text-white/50 text-xs mb-1.5">Ваше имя:</label>
              {invite.allow_rename ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 30))}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-white
                             placeholder:text-white/20 outline-none focus:border-alice-purple/50 transition-colors mb-4"
                />
              ) : (
                <div className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-white/60 mb-4">
                  {invite.preset_name}
                </div>
              )}

              <button
                onClick={handleAsk}
                className="w-full btn-glow text-white font-semibold py-3.5 rounded-xl text-base
                           animate-pulse-glow"
              >
                Спросить Алису
              </button>

              <p className="text-white/20 text-[10px] text-center mt-3">
                Сообщение будет опубликовано от имени «{name || invite.preset_name}»
              </p>
            </>
          )}

          {status === 'sending' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-alice-purple flex items-center justify-center animate-pulse">
                <span className="text-white font-bold text-xl">А</span>
              </div>
              <p className="text-white/50 text-sm">Алиса думает...</p>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-white text-base font-medium mb-1">Готово!</p>
              <p className="text-white/40 text-sm mb-4">
                Сообщение от «{name}» опубликовано в ленте
              </p>
              <button
                onClick={handleGoToFeed}
                className="w-full btn-glow text-white font-semibold py-3 rounded-xl"
              >
                Посмотреть ответ Алисы
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-white/10 text-[9px] text-center mt-4">
          Экспериментальная платформа изучения поведения нейросетей · 18+
        </p>
      </div>
    </div>
  );
}
