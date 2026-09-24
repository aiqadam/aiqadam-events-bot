// W72 (#124): ссылки на карты для Mini App. Координаты из Tables приходят
// строками, а пустое значение — это '', не 0 (Number('') === 0 давал ссылку
// на точку 0,0 в Атлантике — баг #124). Онлайн-событие координат не имеет,
// и ссылок нет; офлайн без координат, но с адресом — поиск по адресу.
// Домен — yandex.uz (решение владельца по #130 п.3), как в чате.
export type MapLinks = { yandex: string; google: string };

function coord(v: unknown): number {
  const s = String(v === undefined || v === null ? '' : v).trim().replace(',', '.');
  if (s === '') return NaN;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

export function mapLinks(lat: unknown, lon: unknown, address: unknown): MapLinks | null {
  const addr = String(address === undefined || address === null ? '' : address).trim();
  const la = coord(lat);
  const lo = coord(lon);
  const hasGeo =
    isFinite(la) &&
    isFinite(lo) &&
    Math.abs(la) <= 90 &&
    Math.abs(lo) <= 180 &&
    !(la === 0 && lo === 0);
  if (hasGeo) {
    return {
      yandex: 'https://yandex.uz/maps/?pt=' + lo + ',' + la + '&z=16&l=map',
      google: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(la + ',' + lo),
    };
  }
  if (addr !== '') {
    const q = encodeURIComponent(addr);
    return {
      yandex: 'https://yandex.uz/maps/?text=' + q,
      google: 'https://www.google.com/maps/search/?api=1&query=' + q,
    };
  }
  return null;
}
