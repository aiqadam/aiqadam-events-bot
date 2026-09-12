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
    found: true,
    eventOk: true,
    eventId: eventId,
    lang: lang,
    recordId: ev.__recordId,
    title: ev.title || '',
    description: ev.description || '',
    address: ev.address || '',
    photoFileId: ev.photo_file_id || '',
    status: ev.status || '',
    ownerId: ev.owner_id || '',
    chapterId: ev.chapter_id || '',
    startsAt: ev.starts_at || '',
    endsAt: ev.ends_at || '',
    regDeadlineAt: ev.reg_deadline_at || '',
    lat: hasGeo ? String(lat) : '',
    lon: hasGeo ? String(lon) : '',
    hasGeo: hasGeo,
    mapsUrl: mapsUrl,
    registerDeepLink: registerDeepLink,
    capacity: ev.capacity || '',
    overbookPct: ev.overbook_pct || ''
  };
};
```

> **Приведено к побайтовому виду 2026-09-13 (W22, по замечанию ревью).** До этого
> `return` при `found: true` был записан в файле компактно (по строке на группу
> полей), а в живом шаге — по полю на строку, и файл честно отсылал за эталоном
> к `fn-event-card/step_3`. После удаления этого флоу отсылка стала указывать
> в пустоту, и блок 2a по `event-card` перестал проходить против чего-либо.
> Теперь текст выше **дословно равен** `registration/step_96` — сверять `diff`
> надо с ним.

### assemble — сборка карточки

**Текст приведён 2026-09-13 по замечанию 1 ревью W21.** До этого здесь стояло
«Полный текст — ниже», а ниже не было ничего: изначально файл отсылал за
эталоном к `fn-event-card/step_8`, W22 удалил флоу и переписал фразу, но текст
не перенёс. Единственная живая копия (`registration/step_19`) была не сверяема
ни с чем — ровно тот тихий дрейф, ради которого заведён блок 2a.

Ниже — **вариант с конвертом**, потому что другого носителя в проекте нет:
тело вынесено в `const build = () => {…}`, а шаг возвращает
`{ status: 'success', data: build() }`. Так сделано потому, что шаг отправки
ниже читает `.data.text`, а шаги `@aiqadam/qadam-telegram-bot` не редактируются
([#411](https://github.com/aiqadam/qadam-flow/issues/411)). Плоский вариант
получается снятием обёртки — если он где-то понадобится, он и станет вторым
блоком этого файла.

**Ключи i18n карточки (10):** `event.card.header`, `.description`, `.when`,
`.ends`, `.where`, `.deadline`, `.map_link`, `.btn_map`, `.btn_register`,
`.not_found`.

**`varsByKey` обязателен:** `event.card.when`, `.ends` и `.deadline` используют
**одно и то же** имя `{when}` с разным значением. Общими `vars` их не различить —
это не стиль, это единственный способ не показать в трёх строках одно время.

**Мёртвое поле, оставлено намеренно:** `venue`/`hasGeo` вычисляются, хотя
`sendVenue` удалён в W22 ([ADR-0013](../../docs/adr/0013-fewer-messages-on-start.md)).
Убирать их — значит трогать эталон ради нуля секунд; вернуть пин дешевле, пока
поле считается. Замечено ревью W21 (замечание 6).

```js
export const code = async (inputs) => {
  const ev = inputs.event && typeof inputs.event === 'object' ? inputs.event : {};
  const raw = inputs.i18n;
  const box = raw && typeof raw === 'object' ? (raw.data && typeof raw.data === 'object' ? raw.data : raw) : {};
  const texts = box && typeof box.texts === 'object' && box.texts !== null ? box.texts : {};
  const missing = Array.isArray(box.missing) ? box.missing.map((k) => String(k)) : [];

  // Ключ, которого нет в strings, fn-t отдаёт сырым. Ставить такой на кнопку нельзя,
  // поэтому has() отличает "перевод есть" от "видно ключ".
  const has = (k) => typeof texts[k] === 'string' && missing.indexOf(k) < 0;
  const t = (k) => typeof texts[k] === 'string' ? texts[k] : k;

  const lang = String(ev.lang || 'ru');
  const found = ev.found === true || ev.found === 'true';

  const build = () => {
    if (!found) {
      return {
        found: false, lang: lang, eventId: String(ev.eventId || ''),
        text: t('event.card.not_found'), lines: [], buttons: [], labels: {},
        venue: null, mapsUrl: '', photoFileId: '', registerDeepLink: '',
        status: '', ownerId: '', chapterId: '',
        startsAt: '', endsAt: '', regDeadlineAt: '', startsAtFmt: '', endsAtFmt: '', regDeadlineAtFmt: '',
        capacity: '', overbookPct: '', parseMode: '', missing: missing
      };
    }

    // Строки UI берутся только из fn-t (I18N-2). Здесь склеиваются готовые переводы
    // (в них уже подставлены title/description/address/время) — литералов текста нет.
    const lines = [];
    const add = (key, condition) => { if (condition && has(key)) lines.push(t(key)); };

    add('event.card.header', String(ev.title || '') !== '');
    add('event.card.description', String(ev.description || '') !== '');
    add('event.card.when', String(ev.startsAt || '') !== '');
    add('event.card.ends', String(ev.endsAt || '') !== '');
    add('event.card.where', String(ev.address || '') !== '');
    add('event.card.deadline', String(ev.regDeadlineAt || '') !== '');
    add('event.card.map_link', String(ev.mapsUrl || '') !== '');

    const labels = {};
    if (has('event.card.btn_map')) labels.map = t('event.card.btn_map');
    if (has('event.card.btn_register')) labels.register = t('event.card.btn_register');

    const buttons = [];
    if (labels.map !== undefined && String(ev.mapsUrl || '') !== '') {
      buttons.push([{ text: labels.map, url: String(ev.mapsUrl) }]);
    }
    if (labels.register !== undefined && String(ev.registerDeepLink || '') !== '') {
      buttons.push([{ text: labels.register, url: String(ev.registerDeepLink) }]);
    }

    const venue = (ev.hasGeo === true || ev.hasGeo === 'true')
      ? { latitude: String(ev.lat || ''), longitude: String(ev.lon || ''), title: String(ev.title || ''), address: String(ev.address || '') }
      : null;

    return {
      found: true,
      lang: lang,
      eventId: String(ev.eventId || ''),
      // Текст содержит ввод owner'а (title/description/address) — шлётся без parse_mode,
      // иначе разметка в названии сломает сообщение или подделает его вид.
      parseMode: '',
      text: lines.join('\n\n'),
      lines: lines,
      buttons: buttons,
      labels: labels,
      venue: venue,
      mapsUrl: String(ev.mapsUrl || ''),
      photoFileId: String(ev.photoFileId || ''),
      registerDeepLink: String(ev.registerDeepLink || ''),
      // status + ownerId — то, чем вызывающий делает гейт (карточка сама не авторизует)
      status: String(ev.status || ''),
      ownerId: String(ev.ownerId || ''),
      chapterId: String(ev.chapterId || ''),
      startsAt: String(ev.startsAt || ''),
      endsAt: String(ev.endsAt || ''),
      regDeadlineAt: String(ev.regDeadlineAt || ''),
      startsAtFmt: String(inputs.startsFmt === undefined || inputs.startsFmt === null ? '' : inputs.startsFmt),
      endsAtFmt: String(inputs.endsFmt === undefined || inputs.endsFmt === null ? '' : inputs.endsFmt),
      regDeadlineAtFmt: String(inputs.deadlineFmt === undefined || inputs.deadlineFmt === null ? '' : inputs.deadlineFmt),
      capacity: String(ev.capacity || ''),
      overbookPct: String(ev.overbookPct || ''),
      missing: missing
    };
  };

  // Форма ответа fn-event-card повторяется один в один: шаги отправки и ROUTER
  // «есть venue?» ниже ссылаются на {{<шаг>['output'].data...}}, а шаги
  // @aiqadam/qadam-telegram-bot не редактируются (qadam-flow#411).
  return { status: 'success', data: build() };
};
```


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
