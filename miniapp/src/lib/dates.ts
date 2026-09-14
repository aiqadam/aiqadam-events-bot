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
