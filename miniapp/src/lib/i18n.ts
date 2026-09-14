// Русский-онли до платформенного i18n — ADR-0014, issue 420
// Раньше здесь выбирался язык по user.language_code и подгружался i18n/<lang>.json.
// С 2026-09-13 бот отвечает только по-русски, и выбор языка тут означал бы расхождение.
// Файлы uz/en в репозитории остаются — здесь они просто не загружаются.

const LANG = 'ru';
let dict: Record<string, string> = {};
let loaded = false;
let loading: Promise<Record<string, string>> | null = null;

export function t(key: string): string {
  return dict[key] || key;
}

export function getDict(): Record<string, string> {
  return dict;
}

export function loadI18n(): Promise<Record<string, string>> {
  if (loaded) return Promise.resolve(dict);
  if (loading) return loading;
  loading = fetch('i18n/' + LANG + '.json')
    .then((r) => r.json())
    .then((d: Record<string, string>) => {
      dict = d || {};
      loaded = true;
      return dict;
    })
    .catch(() => {
      dict = {};
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
