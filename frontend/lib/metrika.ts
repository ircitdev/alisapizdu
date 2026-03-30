declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

export function reachGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.ym) {
    window.ym(108182887, 'reachGoal', goal, params);
  }
}

// Goals:
// ask_alice        — нажал "Спросить Алису" (1-я попытка)
// convince_alice   — отправил "Убедить Алису" (2-я попытка, кастомный текст)
// share_click      — нажал "Поделиться"
// vote_up          — поставил 👍
// vote_down        — поставил 👎
// reaction         — поставил реакцию (😂🔥💀🤡)
// about_open       — открыл "О проекте"
// donate_click     — нажал "Выделить грант"
// name_edit        — изменил имя
// invite_open      — открыл модалку "Пригласить"
// invite_create    — создал invite-ссылку
// invite_copy      — скопировал invite-ссылку
// invite_telegram  — отправил invite в Telegram
// invite_use       — использовал invite-ссылку (спросил Алису)
// image_lightbox   — открыл картинку в лайтбоксе
// filter_change    — изменил фильтр ленты (top/new/vip/images)
