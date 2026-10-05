// Типы для yandexLink.mjs (W136, ADR-0055).
export type GeoLink = {
  coords: { lat: number; lon: number } | null;
  point: boolean;
  oid: string;
  text: string;
  short: boolean;
  yandex: boolean;
};

export const YANDEX_MAPS_RE: RegExp;
export function analyzeYandexLink(raw: string): GeoLink;
export function parseYandexLink(raw: string): { lat: number; lon: number } | null;
export function linkRecognized(raw: string): boolean;
