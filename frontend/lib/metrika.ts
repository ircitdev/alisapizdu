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
// ask_alice     — нажал "Спросить Алису"
// share_click   — нажал "Поделиться"
// vote_up       — поставил 👍
// vote_down     — поставил 👎
// donate_open   — открыл модалку доната
// donate_click  — нажал "Выделить грант"
// custom_open   — открыл "Написать своё"
// name_edit     — изменил имя
