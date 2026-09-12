(function (root) {
  // Русский-онли до платформенного i18n — ADR-0014,
  // qadam-flow#420 (milestone v2.0.0).
  //
  // Раньше здесь выбирался язык по `user.language_code` и подгружался
  // `i18n/<lang>.json`. Бот с 2026-09-13 отвечает только по-русски, и выбор
  // языка тут означал бы расхождение: контролёр с английским Telegram видел бы
  // английский интерфейс сканера и русские ответы сервера в нём же.
  //
  // Файлы `i18n/uz.json` и `i18n/en.json` в репозитории **остаются** — это то,
  // что вернётся при воскрешении i18n. Здесь они просто не загружаются.
  // Возврат: восстановить pick() по `language_code` и список SUPPORTED.
  var LANG = 'ru';

  function pick() {
    return LANG;
  }

  function load(cb) {
    fetch('i18n/' + LANG + '.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { cb(null, d, LANG); })
      // Словарь не загрузился — отдаём пустой, и страница покажет сырые ключи.
      // Сырой ключ на экране заметен, пустой экран — нет (I18N.md).
      .catch(function (err) { cb(err, {}, LANG); });
  }

  root.MiniAppI18n = { pick: pick, load: load };
})(window);
