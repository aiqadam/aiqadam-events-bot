import { t } from '../lib/i18n';
import { openExternal } from '../lib/telegram';
import { mapLinks } from '../lib/maps';
import Icon from './Icon';

// W72 (#124): две ссылки на карты под адресом события. Показываются только
// когда mapLinks вернул ссылки: офлайн-событие с координатами (или, без них,
// с адресом). Онлайн-событие — ничего.
export default function MapLinks({ lat, lon, address }: { lat?: string; lon?: string; address?: string }) {
  const links = mapLinks(lat, lon, address);
  if (!links) return null;
  return (
    <div className="app-actions" id="map-links" style={{ marginTop: 8 }}>
      <button type="button" className="btn btn-outline" id="map-yandex" onClick={() => openExternal(links.yandex)}>
        <Icon name="map-pin" />
        {t('event.card.btn_map_yandex')}
      </button>
      <button type="button" className="btn btn-outline" id="map-google" onClick={() => openExternal(links.google)}>
        <Icon name="map-pin" />
        {t('event.card.btn_map_google')}
      </button>
    </div>
  );
}
