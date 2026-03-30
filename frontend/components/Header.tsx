'use client';

interface HeaderProps {
  onlineCount: number;
  totalMessages: number;
  vipCount: number;
  onDonateClick: () => void;
}

export default function Header({ onlineCount, totalMessages, vipCount, onDonateClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-bg-primary/90 backdrop-blur-md border-b border-alice-purple/20">
      <div className="max-w-chat mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-2xl font-bold tracking-tight whitespace-nowrap shrink-0">
            <span className="text-alice-purple">а</span>
            <span className="text-alice-purple hidden sm:inline">лиса</span>
            <span className="header-shimmer">покажи</span>
            <span className="text-white">пизду</span>
            <span className="text-white/30 hidden sm:inline">.рф</span>
          </h1>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-sm
                            border border-alice-purple/30 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 bg-alice-purple/5">
              {/* Online */}
              <div className="flex items-center gap-1" title="Сейчас онлайн">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-white font-semibold">{onlineCount}</span>
              </div>

              <div className="w-px h-3 bg-alice-purple/20" />

              {/* Total asked */}
              <div className="flex items-center gap-1" title="Всего спросили">
                <span className="text-alice-purple/60">💬</span>
                <span className="text-white font-semibold">{totalMessages.toLocaleString('ru-RU')}</span>
              </div>

              <div className="w-px h-3 bg-alice-purple/20" />

              {/* VIP count */}
              <div className="flex items-center gap-1" title="VIP сообщений">
                <span>👑</span>
                <span className="text-vip-gold font-semibold">{vipCount}</span>
              </div>
            </div>

            <button
              onClick={onDonateClick}
              className="donate-btn px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold
                         transition-all duration-300 select-none active:scale-95 shrink-0"
            >
              О проекте
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
