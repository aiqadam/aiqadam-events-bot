# Эталон: сборка карточки ивента

**Инварианты:** I18N-2 (ни одной строки литералом), OWN-2 (ссылка на карты
собирается из `lat`/`lon`, а не хранится), OWN-3 (время — в `Asia/Tashkent`).

**Встраивают:**

| Флоу | Шаги | Сверено |
|---|---|---|
| `registration` (`vfVfIngczCKA2DpUgcevP`) | `step_96` (extract) → `step_19` (assemble, **в конверте**) | 2026-09-12 |

## Как встраивается

Пять шагов: extract → fmt (батч) → чтение `strings` → resolve i18n → assemble.
Первый и последний приведены полностью — по выдержке побайтовая сверка
невозможна (правило 1 [README](README.md)).

### extract — выделение полей ивента

```js
export const code = async (inputs) => {
  const arr = (src) => Array.isArray(src) ? src : (src && Array.isArray(src.records) ? src.records : []);
  const flat = (rec) => {
    const out = { __recordId: String(rec && rec.id ? rec.id : '') };
    const cells = (rec && rec.cells) || {};
    Object.keys(cells).forEach((fid) => {
      const c = cells[fid];
      if (c && typeof c === 'object' && typeof c.fieldName === 'string') {
        out[c.fieldName] = c.value === undefined || c.value === null ? '' : String(c.value);
      }
    });
    return out;
  };

  const eventOk = inputs.eventOk === true || inputs.eventOk === 'true';
  const eventId = String(inputs.eventId === undefined || inputs.eventId === null ? '' : inputs.eventId);
  const lang = String(inputs.lang === undefined || inputs.lang === null ? '' : inputs.lang) || 'ru';

  const rows = arr(inputs.records).map(flat).filter((e) => (e.id || '') === eventId);
  const ev = rows[0];

  const blank = {
    found: false, eventOk: eventOk, eventId: eventId, lang: lang,
    recordId: '', title: '', description: '', address: '', photoFileId: '', status: '',
    // ownerId нужен вызывающему для гейта по владельцу (W6/W11): карточка сама
    // никого не авторизует, но обязана дать чем проверить.
    ownerId: '', chapterId: '',
    startsAt: '', endsAt: '', regDeadlineAt: '', lat: '', lon: '', hasGeo: false,
    mapsUrl: '', registerDeepLink: '', capacity: '', overbookPct: ''
  };
  if (!eventOk || !ev) return blank;

  // Числа из Tables приходят строками, пустое значение — это '' , а не 0.
  const num = (v) => {
    const s = String(v === undefined || v === null ? '' : v).trim();
    if (s === '') return NaN;
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  };
  const lat = num(ev.lat);
  const lon = num(ev.lon);
  const hasGeo = isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  // OWN-2: ссылка на Я.Карты не хранится, а собирается из lat/lon
  const mapsUrl = hasGeo
    ? 'https://yandex.uz/maps/?ll=' + lon + '%2C' + lat + '&z=17&pt=' + lon + '%2C' + lat
    : '';

  const bot = String(inputs.botUsername === undefined || inputs.botUsername === null ? '' : inputs.botUsername).trim();
  const registerDeepLink = bot === '' ? '' : 'https://t.me/' + bot + '?start=e' + eventId;

  return {
    found: true, eventOk: true, eventId: eventId, lang: lang,
    recordId: ev.__recordId,
    title: ev.title || '', description: ev.description || '', address: ev.address || '',
    photoFileId: ev.photo_file_id || '', status: ev.status || '',
    ownerId: ev.owner_id || '', chapterId: ev.chapter_id || '',
    startsAt: ev.starts_at || '', endsAt: ev.ends_at || '', regDeadlineAt: ev.reg_deadline_at || '',
    lat: hasGeo ? String(lat) : '', lon: hasGeo ? String(lon) : '', hasGeo: hasGeo,
    mapsUrl: mapsUrl, registerDeepLink: registerDeepLink,
    capacity: ev.capacity || '', overbookPct: ev.overbook_pct || ''
  };
};
```

> **Внимание:** в файле выше `return` при `found: true` записан компактно, в одну
> строку на группу полей. В `registration/step_96` он
> развёрнут по одному полю на строку. Это **расхождение формата записи эталона**,
> а не кода: при сверке `diff` сравнивайте с текстом ниже (живого `fn-event-card` больше нет), он
> остаётся источником. Привести файл к побайтовому виду — задача следующей правки.

### assemble — сборка карточки

Полный текст — ниже (флоу `fn-event-card` удалён в W22). **Вариант с конвертом**
(`registration/step_19`) отличается ровно одним: тело вынесено в `const build = () => {…}`,
а шаг возвращает `{ status: 'success', data: build() }` — потому что ROUTER
«есть venue?» и шаг отправки ниже читают `.data.venue` и `.data.text`, а шаги
`@aiqadam/qadam-telegram-bot` не редактируются
([#411](https://github.com/aiqadam/qadam-flow/issues/411)).

**Ключи i18n карточки (10):** `event.card.header`, `.description`, `.when`,
`.ends`, `.where`, `.deadline`, `.map_link`, `.btn_map`, `.btn_register`,
`.not_found`.

**`varsByKey` обязателен:** `event.card.when`, `.ends` и `.deadline` используют
**одно и то же** имя `{when}` с разным значением. Общими `vars` их не различить —
это не стиль, это единственный способ не показать в трёх строках одно время.

## Что нельзя трогать

- **`parseMode: ''`.** Текст содержит ввод owner'а (`title`/`description`/`address`).
  С разметкой ввод либо сломает сообщение, либо подделает его вид.
- **`has()` против `t()`.** `has()` отличает «перевод есть» от «виден сырой ключ».
  Сырой ключ на **кнопке** недопустим — кнопка без перевода просто не рисуется.
- **`mapsUrl` собирается из `lat`/`lon`** и только при валидных координатах
  (`hasGeo`), иначе пустая строка и никакой кнопки карты.
- **`ownerId` и `status` отдаются наружу** — карточка сама никого не авторизует,
  но обязана дать вызывающему, чем проверить.

## Оптимизация при встраивании

Удалённый `fn-event-card` делал **свой** запрос к `events`. Встроенная копия в `registration`
берёт строку из уже прочитанного `step_5` — минус один запрос на каждую
регистрацию. Это допустимое отличие **входа**, не кода: тело `extract` совпадает
с эталоном побайтово.

## Как ловится дрейф

Тихо: расхождение даёт неверную или неполную карточку при зелёном прогоне.
Различающий признак при ревью — три разных времени в строках «Когда»,
«Окончание», «Регистрация до».
