'use client';

import { useState, useEffect, useRef } from 'react';

interface PreloaderProps {
  onComplete: () => void;
}

const STEPS = [
  'Инициализация ядра нейросети...',
  'Загрузка протоколов взаимодействия...',
  'Калибровка модулей ИИ...',
  'Синхронизация с облачным кластером...',
  'Активация нейронных связей...',
  'Подключение к серверам Алисы...',
  'Загрузка элементов интерфейса взаимодействия с искусственным интеллектом...',
  'Почти готово...',
];

const BASE = 'https://storage.googleapis.com/uspeshnyy-projects/apokajipizdu';
const VIDEO_COUNT = 4;

export default function Preloader({ onComplete }: PreloaderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pick random video index once, detect mobile
  const videoIdx = useRef(Math.floor(Math.random() * VIDEO_COUNT) + 1);
  const isMobile = useRef(
    typeof window !== 'undefined' && window.innerWidth < 640
  );

  const videoSrc = isMobile.current
    ? `${BASE}/intro${videoIdx.current}_m.MP4`
    : `${BASE}/intro${videoIdx.current}.MP4`;

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        const increment = p < 70 ? 2 + Math.random() * 3 : 0.5 + Math.random() * 1.5;
        return Math.min(p + increment, 100);
      });
    }, 50);

    const stepInterval = setInterval(() => {
      setCurrentStep((s) => (s >= STEPS.length - 1 ? s : s + 1));
    }, 400);

    const completeTimer = setTimeout(() => {
      setProgress(100);
      setCurrentStep(STEPS.length - 1);
      setTimeout(() => {
        setFading(true);
        setTimeout(onComplete, 500);
      }, 300);
    }, 3500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-bg-primary flex items-center justify-center
                  transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Background video — desktop only */}
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
      />

      {/* Overlay gradient to darken video */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-transparent to-bg-primary/80 pointer-events-none" />

      {/* Content */}
      <div className="relative w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-alice-purple to-alice-light
                            flex items-center justify-center animate-pulse-glow">
              <span className="text-white font-bold text-4xl">А</span>
            </div>
            {/* Rotating ring */}
            <div className="absolute -inset-3 border-2 border-alice-purple/20 rounded-3xl animate-spin"
                 style={{ animationDuration: '3s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                              w-2 h-2 bg-alice-purple rounded-full" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-center text-white/80 text-sm font-medium tracking-widest uppercase mb-6">
          AI Dashboard v2.0
        </h2>

        {/* Progress bar */}
        <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-alice-purple via-alice-light to-alice-purple
                       rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-0 h-full w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent
                       rounded-full blur-sm"
            style={{ left: `${Math.max(0, progress - 10)}%` }}
          />
        </div>

        {/* Percentage */}
        <div className="flex justify-between items-center mb-6">
          <span className="text-white/30 text-xs font-mono">{Math.round(progress)}%</span>
          <span className="text-white/20 text-[10px] font-mono">
            {(progress * 0.37).toFixed(0)} MB / 37 MB
          </span>
        </div>

        {/* Current step */}
        <div className="text-center min-h-[40px]">
          <p className="text-white/40 text-xs leading-relaxed animate-fade-in" key={currentStep}>
            {STEPS[currentStep]}
          </p>
        </div>

        {/* Fake metrics */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { label: 'Модули', value: Math.min(Math.round(progress * 0.12), 12), max: 12 },
            { label: 'Потоки', value: Math.min(Math.round(progress * 0.08), 8), max: 8 },
            { label: 'Нейроны', value: `${(progress * 1.75).toFixed(0)}M`, max: '' },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-alice-purple text-lg font-bold font-mono">
                {m.value}{m.max ? <span className="text-white/15">/{m.max}</span> : ''}
              </div>
              <div className="text-white/20 text-[10px] uppercase tracking-wider">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
