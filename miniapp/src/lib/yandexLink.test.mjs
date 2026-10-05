// Тест разбора ссылок Яндекс.Карт (W136, ADR-0055). Запуск:
//   node miniapp/src/lib/yandexLink.test.mjs
// Node 22 исполняет .ts через type stripping, поэтому тест гоняет настоящий
// модуль, а не его копию.
import assert from 'node:assert/strict';
import { analyzeYandexLink, parseYandexLink, linkRecognized } from './yandexLink.mjs';

let n = 0;
const t = (name, fn) => { fn(); n += 1; };
const near = (a, b) => Math.abs(a - b) < 1e-6;

t('poi[point] (encoded, канонический пример владельца) → точная точка + oid', () => {
  const a = analyzeYandexLink('https://yandex.uz/maps/10335/tashkent/?ll=69.245104%2C41.311005&mode=poi&poi%5Bpoint%5D=69.244228%2C41.311215&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D74162995744&z=17.87');
  assert.equal(a.point, true);
  assert.equal(a.oid, '74162995744');
  assert.ok(near(a.coords.lat, 41.311215) && near(a.coords.lon, 69.244228));
});

t('poi[point] приоритетнее ll (центр карты)', () => {
  const a = analyzeYandexLink('https://yandex.uz/maps/?ll=69.245104,41.311005&poi[point]=69.244228,41.311215');
  assert.equal(a.point, true);
  assert.ok(near(a.coords.lat, 41.311215) && near(a.coords.lon, 69.244228));
});

t('pt (lon,lat) и ll (lon,lat)', () => {
  const p = parseYandexLink('https://yandex.ru/maps/?pt=69.335264,41.341407&z=17');
  assert.ok(near(p.lat, 41.341407) && near(p.lon, 69.335264));
  const l = parseYandexLink('https://yandex.ru/maps/?ll=69.335264%2C41.341407&z=17');
  assert.ok(near(l.lat, 41.341407) && near(l.lon, 69.335264));
});

t('@lat,lon и q=lat,lon', () => {
  const at = parseYandexLink('https://yandex.ru/maps/@41.341407,69.335264,17z');
  assert.ok(near(at.lat, 41.341407) && near(at.lon, 69.335264));
  const q = parseYandexLink('https://yandex.ru/maps/?q=41.341407,69.335264');
  assert.ok(near(q.lat, 41.341407) && near(q.lon, 69.335264));
});

t('ll приоритетнее @ в одной ссылке', () => {
  const a = parseYandexLink('https://yandex.ru/maps/@41.0,69.0,17z?ll=69.5%2C41.5');
  assert.ok(near(a.lat, 41.5) && near(a.lon, 69.5));
});

t('голая пара: точка и десятичная запятая', () => {
  const dot = parseYandexLink('41.341407, 69.335264');
  assert.ok(near(dot.lat, 41.341407) && near(dot.lon, 69.335264));
  const comma = parseYandexLink('41,341407 69,335264');
  assert.ok(near(comma.lat, 41.341407) && near(comma.lon, 69.335264));
});

t('орг-ссылка /maps/org → oid', () => {
  const a = analyzeYandexLink('https://yandex.com/maps/org/beelab/34279609643?si=x');
  assert.equal(a.oid, '34279609643');
  assert.equal(a.coords, null);
});

t('короткая ссылка', () => {
  const a = analyzeYandexLink('https://yandex.uz/maps/-/CXeBa8mq');
  assert.equal(a.short, true);
  assert.equal(a.coords, null);
});

t('текст-адрес', () => {
  const a = analyzeYandexLink('https://yandex.uz/maps/?text=%D1%83%D0%BB%D0%B8%D1%86%D0%B0%20%D0%9C%D1%83%D0%BC%D0%B8%D0%BD%D0%BE%D0%B2%D0%B0%204');
  assert.equal(a.text, 'улица Муминова 4');
});

t('мусор не распознан', () => {
  const a = analyzeYandexLink('привет, это не ссылка');
  assert.equal(a.coords, null);
  assert.equal(a.oid, '');
  assert.equal(a.text, '');
  assert.equal(a.short, false);
  assert.equal(linkRecognized('привет'), false);
});

console.log(`yandexLink: ${n}/${n} ok`);
