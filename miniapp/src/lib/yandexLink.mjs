// Разбор ссылок Яндекс.Карт (W136, ADR-0055). Чистая функция без зависимостей —
// используется Mini App (`Manage.tsx`) и покрыта тестом `yandexLink.test.mjs`.
// Обычный .mjs (не .ts), чтобы тест гонял ровно этот код на любой Node;
// типы для TS — рядом в `yandexLink.d.ts`.

export const YANDEX_MAPS_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*yandex\.[a-z.]{2,6}\/maps\//i;

const dec = (raw) => {
  try { return decodeURIComponent(raw); } catch { return raw; }
};

export function analyzeYandexLink(raw) {
  const orig = String(raw || '').trim();
  const s = dec(orig);
  const out = { coords: null, point: false, oid: '', text: '', short: false, yandex: false };
  const N = '(-?\\d+(?:\\.\\d+)?)';
  const NB = '(-?\\d+(?:[.,]\\d+)?)';
  const num = (v) => parseFloat(String(v).replace(',', '.'));
  const grab = (re, latFirst) => {
    const m = re.exec(s);
    if (!m) return false;
    const a = num(m[1]);
    const b = num(m[2]);
    out.coords = latFirst ? { lat: a, lon: b } : { lat: b, lon: a };
    return true;
  };
  // Порядок источников: poi[point] > pt > ll > @lat,lon > q=lat,lon > голая
  // пара. ll/@/q — центр карты, поэтому oid организации их перекрывает (ниже).
  if (grab(new RegExp('poi\\[point\\]=' + N + ',' + N, 'i'), false)) out.point = true;
  else if (grab(new RegExp('[?&]pt=' + N + ',' + N, 'i'), false)) out.point = true;
  else if (grab(new RegExp('[?&]ll=' + N + ',' + N, 'i'), false)) { /* центр карты */ }
  else if (grab(new RegExp('@' + N + ',' + N), true)) { /* центр карты */ }
  else if (grab(new RegExp('[?&]q=' + N + ',' + N, 'i'), true)) { /* центр/запрос */ }
  else grab(new RegExp('^' + NB + '\\s*[,; ]\\s*' + NB + '$'), true);

  const oidPath = /\/maps\/org\/(?:[^/?#]+\/)?(\d{1,20})(?:[/?#]|$)/i.exec(s);
  const oidUri = new RegExp('ymaps' + 'bm1://org\\?oid=(\\d{1,20})', 'i').exec(s);
  out.oid = oidPath ? oidPath[1] : (oidUri ? oidUri[1] : '');

  const textM = /[?&]text=([^&]+)/i.exec(s);
  if (textM) out.text = textM[1].replace(/\+/g, ' ').trim();
  else {
    const qM = /[?&]q=([^&]+)/i.exec(s);
    if (qM && !/^-?\d/.test(qM[1].trim())) out.text = qM[1].replace(/\+/g, ' ').trim();
  }
  out.short = /^https?:\/\/(?:[a-z0-9-]+\.)*yandex\.[a-z.]{2,6}\/maps\/-\//i.test(orig);
  out.yandex = YANDEX_MAPS_RE.test(orig);
  return out;
}

// Координаты из ссылки или null — контракт для валидации/подсказки.
export function parseYandexLink(raw) {
  return analyzeYandexLink(raw).coords;
}

// Ссылка распознана (координаты/oid/текст/короткая) — не показываем «битую»,
// пока сервер не ответил.
export function linkRecognized(raw) {
  const a = analyzeYandexLink(raw);
  return !!(a.coords || a.oid || a.text || a.short);
}
