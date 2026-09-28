// Даты: UTC в хранении, Asia/Tashkent на экране (OWN-3).
// Значение <input type=datetime-local> — «YYYY-MM-DDTHH:mm» без зоны.
// Страница отдаёт его серверу как есть; ташкентским его считает и в UTC
// переводит manage-api. Сюда, наоборот, UTC из таблицы раскладывается
// на ташкентские компоненты через Intl, а не через локальную зону телефона.

import { getLang } from './telegram';

const TZ = 'Asia/Tashkent';

// W25: месяц и день недели — на языке пользователя (ru/uz/en), время и числа
// остаются числовыми. Форматы дат не хардкодятся в строках (I18N-3).
const INTL: Record<string, string> = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };

// W124: язык — не снимок на импорте. Иначе холодный старт застревает на дефолте
// `ru`, а переключение языка в «Профиле» оставляет даты на прежнем языке до
// перезагрузки. Форматтеры строятся под текущий язык и кэшируются по локали.
type Fmts = { plate: Intl.DateTimeFormat; time: Intl.DateTimeFormat; when: Intl.DateTimeFormat };
const fmtCache: Record<string, Fmts> = {};
function fmts(): Fmts {
  const loc = INTL[getLang()] || 'ru-RU';
  if (!fmtCache[loc]) {
    fmtCache[loc] = {
      plate: new Intl.DateTimeFormat(loc, { timeZone: TZ, day: '2-digit', month: 'short', weekday: 'short' }),
      time: new Intl.DateTimeFormat(loc, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      when: new Intl.DateTimeFormat(loc, {
        timeZone: TZ,
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    };
  }
  return fmtCache[loc];
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function utcToLocalInput(iso: string): string {
  if (!iso) return '';
  const ms = Date.parse(/[Zz]$/.test(iso) || /[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z');
  if (!isFinite(ms)) return '';
  const p: Record<string, string> = {};
  partsFmt.formatToParts(new Date(ms)).forEach((x) => {
    p[x.type] = x.value;
  });
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}

// Момент времени из таблицы в миллисекундах (без зоны — считаем UTC).
export function utcMs(iso: string): number {
  if (!iso) return NaN;
  return Date.parse(/[Zz]$/.test(iso) || /[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z');
}

// Дата для плашки EventCard: месяц/день/день недели по Ташкенту.
export function utcToPlate(iso: string): { month: string; day: string; weekday: string } {
  const ms = utcMs(iso);
  if (!isFinite(ms)) return { month: '', day: '', weekday: '' };
  const p: Record<string, string> = {};
  fmts().plate.formatToParts(new Date(ms)).forEach((x) => {
    p[x.type] = x.value;
  });
  const clean = (s: string) => (s || '').replace(/\.$/, '');
  return { month: clean(p['month'] || ''), day: p['day'] || '', weekday: clean(p['weekday'] || '') };
}

export function utcToTime(iso: string): string {
  const ms = utcMs(iso);
  return isFinite(ms) ? fmts().time.format(new Date(ms)) : '';
}

// Строка «сб, 26 сентября · 18:30» для меты карточки каталога (форма прототипа W41).
export function utcToWhen(iso: string): string {
  const ms = utcMs(iso);
  if (!isFinite(ms)) return '';
  const p: Record<string, string> = {};
  fmts().when.formatToParts(new Date(ms)).forEach((x) => {
    p[x.type] = x.value;
  });
  // «сб, 26 сентября · 18:30» — форма прототипа: запятая после дня недели.
  const date = [p['weekday'] ? `${p['weekday']},` : '', p['day'], p['month']].filter(Boolean).join(' ');
  const time = p['hour'] && p['minute'] ? `${p['hour']}:${p['minute']}` : '';
  return time ? `${date} · ${time}` : date;
}
