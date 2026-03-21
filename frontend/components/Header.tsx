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
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap">
            <span className="text-alice-purple">алиса</span>
            <span className="text-white/60">покажи</span>
            <span className="text-white">пизду</span>
            <span className="text-white/30 hidden sm:inline">.рф</span>
          </h1>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-sm">
              {/* Online */}
              <div className="flex items-center gap-1" title="Сейчас онлайн">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-white font-semibold">{onlineCount}</span>
              </div>

              {/* Total asked */}
              <div className="flex items-center gap-1" title="Всего спросили">
                <span>💬</span>
                <span className="text-white font-semibold">{totalMessages.toLocaleString('ru-RU')}</span>
              </div>

              {/* VIP count */}
              <div className="flex items-center gap-1" title="VIP сообщений">
                <span>👑</span>
                <span className="text-vip-gold font-semibold">{vipCount}</span>
              </div>
            </div>

            <button
              onClick={onDonateClick}
              className="donate-btn px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold
                         transition-all duration-300 select-none active:scale-95"
            >
              Донат
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
