(function (root) {
  var SUPPORTED = ['ru', 'uz', 'en'];

  function norm(code) {
    if (SUPPORTED.indexOf(code) !== -1) return code;
    return 'ru';
  }

  function pick() {
    var tg = root.Telegram && root.Telegram.WebApp;
    var code = '';
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      code = tg.initDataUnsafe.user.language_code || '';
    }
    if (typeof code !== 'string') code = '';
    return norm(code.split('-')[0].split('_')[0].toLowerCase());
  }

  function tryLoad(lang, cb) {
    fetch('i18n/' + lang + '.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { cb(null, d); })
      .catch(function (err) { cb(err); });
  }

  function load(cb) {
    var lang = pick();
    tryLoad(lang, function (err, d) {
      if (!err && d) { cb(null, d, lang); return; }
      if (lang !== 'ru') {
        tryLoad('ru', function (err2, d2) {
          if (!err2 && d2) { cb(null, d2, 'ru'); return; }
          cb(err2 || new Error('i18n unavailable'), {}, 'ru');
        });
      } else {
        cb(err || new Error('i18n unavailable'), {}, lang);
      }
    });
  }

  root.MiniAppI18n = { pick: pick, load: load };
})(window);
