// W25: язык выбирается по `user.language_code` Telegram (ru/uz/en), дефолт — ru.
// Русский словарь грузится всегда как основа; словарь выбранного языка ложится
// поверх. Это даёт честный фолбэк по каждому ключу: пока словарь языка неполон
// (догон переводов — W27), пользователь видит русскую строку, а не сырой ключ.
// Платформенные переводы флоу и этот словарь — два слоя: сервер отвечает на
// языке из заголовка `ap-parent-run-locale` (см. lib/api.ts), клиент — отсюда.

import { getLang } from './telegram';

const SUPPORTED_LANGS = ['ru', 'uz', 'en'];

let LANG = 'ru';
let dict: Record<string, string> = {};
let loaded = false;
let loading: Promise<Record<string, string>> | null = null;

export function getLangCode(): string {
  return LANG;
}

export function isSupportedLang(code: string): boolean {
  return SUPPORTED_LANGS.includes(String(code || '').toLowerCase());
}

// W114: смена языка из таба «Профиль». Меняет словарь немедленно (компонент
// перерисовывается по своему state), пишет выбор в localStorage (его читает
// getLang() — для словаря и заголовка ap-parent-run-locale) и в <html lang>.
// Запись на сервер (users.lang) делает вызывающий через reg-api set_lang.
export async function setLang(code: string): Promise<void> {
  const next = String(code || '').toLowerCase();
  if (!SUPPORTED_LANGS.includes(next)) return;
  LANG = next;
  try {
    localStorage.setItem('aiqadam.lang', next);
  } catch {
    /* localStorage недоступен — выбор всё равно применится в этой сессии */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
  const base = await load('ru');
  const over = next === 'ru' ? ({} as Record<string, string>) : await load(next);
  dict = Object.assign({}, base, over);
  loaded = true;
  loading = null;
}

function load(lang: string): Promise<Record<string, string>> {
  return fetch('i18n/' + lang + '.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((d: Record<string, string>) => (d && typeof d === 'object' ? d : {}))
    .catch(() => ({}));
}

// W42: подстановка {vars} — «Шаг {n} из {m}», «Координаты: {lat}, {lon}» и т. п.
// Форма та же, что у t() во входах CODE-шагов (catalog/snippets/ru-texts.md).
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict[key] || key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      s = s.split('{' + k + '}').join(String(vars[k]));
    });
  }
  return s;
}

export function getDict(): Record<string, string> {
  return dict;
}

export function loadI18n(): Promise<Record<string, string>> {
  if (loaded) return Promise.resolve(dict);
  if (loading) return loading;
  LANG = getLang();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = LANG;
  }
  const base = load('ru');
  const over = LANG === 'ru' ? Promise.resolve({} as Record<string, string>) : load(LANG);
  loading = Promise.all([base, over]).then(([ru, lang]) => {
    dict = Object.assign({}, ru, lang);
    loaded = true;
    return dict;
  });
  return loading;
}

// Для тех кто хочет подписаться на словарь — не нужно, но оставим.
export function setDictForTest(d: Record<string, string>) {
  dict = d;
  loaded = true;
}
