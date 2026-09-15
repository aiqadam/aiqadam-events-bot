// Даты: UTC в хранении, Asia/Tashkent на экране (OWN-3).
// Значение <input type=datetime-local> — «YYYY-MM-DDTHH:mm» без зоны.
// Страница отдаёт его серверу как есть; ташкентским его считает и в UTC
// переводит manage-api. Сюда, наоборот, UTC из таблицы раскладывается
// на ташкентские компоненты через Intl, а не через локальную зону телефона.

const TZ = 'Asia/Tashkent';

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

const plateFmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  weekday: 'short',
});

// Дата для плашки EventCard: месяц/день/день недели по Ташкенту.
export function utcToPlate(iso: string): { month: string; day: string; weekday: string } {
  const ms = utcMs(iso);
  if (!isFinite(ms)) return { month: '', day: '', weekday: '' };
  const p: Record<string, string> = {};
  plateFmt.formatToParts(new Date(ms)).forEach((x) => {
    p[x.type] = x.value;
  });
  const clean = (s: string) => (s || '').replace(/\.$/, '');
  return { month: clean(p['month'] || ''), day: p['day'] || '', weekday: clean(p['weekday'] || '') };
}

const timeFmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function utcToTime(iso: string): string {
  const ms = utcMs(iso);
  return isFinite(ms) ? timeFmt.format(new Date(ms)) : '';
}
