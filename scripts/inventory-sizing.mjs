/**
 * Resolución de huellas para la grilla Stoneshard.
 *
 * Los dos compendios 5e By Fatmorbus usan lienzos de 108 px por casilla.
 * Stoneshard Items ya guarda una bandera explícita; Food & Drink conserva el
 * tamaño en el propio PNG. Las huellas exactas tienen prioridad sobre el modo
 * genérico por peso para que un objeto importado nunca cambie de forma.
 */

const SOURCE_CELL_PX = 108;
const MAX_FOOTPRINT = 6;

const EXACT_FLAG_PATHS = Object.freeze([
  "flags.talespire-foundrysheets-by-velvet.inventorySize",
  "flags.stoneshard-sheet-by-fatmorbus.inventorySize",
  "flags.stoneshard-items-dnd5e-by-fatmorbus.inventorySize",
  "flags.stoneshard-items-shadowdark-by-fatmorbus.inventorySize",
  "flags.dnd5e-food-drink-by-fatmorbus.inventorySize",
  "flags.dnd5e-food-drink-by-fatmorbus.food.inventorySize"
]);

const COMPANION_ASSET = /(?:^|\/)modules\/(?:stoneshard-items-dnd5e-by-fatmorbus|dnd5e-food-drink-by-fatmorbus)\/assets\/items\/[^?#]+\.png(?:[?#].*)?$/i;
const IMAGE_FOOTPRINTS = new Map();
const IMAGE_LOADS = new Map();

function getProperty(object, path) {
  try {
    return globalThis.foundry?.utils?.getProperty?.(object, path);
  } catch (_error) {
    return undefined;
  }
}

function clampCell(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(1, Math.min(MAX_FOOTPRINT, number)) : null;
}

/** Convierte una bandera `{w,h,pxw,pxh}` en una huella segura. */
export function normalizeInventorySize(value) {
  if (!value) return null;

  let data = value;
  if (typeof data === "string") {
    try { data = JSON.parse(data); }
    catch (_error) { return null; }
  }
  if (typeof data !== "object") return null;

  const width = clampCell(data.w ?? (Number(data.pxw) / SOURCE_CELL_PX));
  const height = clampCell(data.h ?? (Number(data.pxh) / SOURCE_CELL_PX));
  return width && height ? { w: width, h: height } : null;
}

/** Lee las banderas actuales y heredadas usadas por los compendios. */
export function flaggedInventorySize(item) {
  for (const path of EXACT_FLAG_PATHS) {
    const size = normalizeInventorySize(getProperty(item, path));
    if (size) return size;
  }
  return null;
}

function itemImage(item) {
  return String(item?.img ?? "").trim();
}

function isCompanionImage(src) {
  return Boolean(src) && COMPANION_ASSET.test(src.replaceAll("\\", "/"));
}

/** Solo acepta lienzos que realmente sean múltiplos de 108 px. */
export function footprintFromImageDimensions(width, height) {
  const rawW = Number(width) / SOURCE_CELL_PX;
  const rawH = Number(height) / SOURCE_CELL_PX;
  if (!Number.isFinite(rawW) || !Number.isFinite(rawH)) return null;
  if (Math.abs(rawW - Math.round(rawW)) > 0.02 || Math.abs(rawH - Math.round(rawH)) > 0.02) return null;
  return normalizeInventorySize({ w: rawW, h: rawH });
}

async function loadImageFootprint(src) {
  if (IMAGE_FOOTPRINTS.has(src)) return IMAGE_FOOTPRINTS.get(src);
  if (IMAGE_LOADS.has(src)) return IMAGE_LOADS.get(src);

  const ImageClass = globalThis.Image;
  if (typeof ImageClass !== "function") return null;

  const pending = new Promise((resolve) => {
    const image = new ImageClass();
    let settled = false;
    const finish = (size) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      IMAGE_FOOTPRINTS.set(src, size);
      resolve(size);
    };
    const timeout = setTimeout(() => finish(null), 2500);
    image.onload = () => finish(footprintFromImageDimensions(image.naturalWidth, image.naturalHeight));
    image.onerror = () => finish(null);
    image.src = src;
    if (image.complete && image.naturalWidth > 0) {
      queueMicrotask(() => finish(footprintFromImageDimensions(image.naturalWidth, image.naturalHeight)));
    }
  }).finally(() => IMAGE_LOADS.delete(src));

  IMAGE_LOADS.set(src, pending);
  return pending;
}

/**
 * Carga solo los PNG de los dos módulos compañeros que aún no traen bandera.
 * Se llama antes de construir la grilla, por lo que el primer render ya usa
 * el tamaño correcto y no produce un salto visual posterior.
 */
export async function primeInventoryFootprints(items) {
  const sources = new Set();
  for (const item of items ?? []) {
    if (flaggedInventorySize(item)) continue;
    const src = itemImage(item);
    if (isCompanionImage(src)) sources.add(src);
  }
  await Promise.allSettled([...sources].map((src) => loadImageFootprint(src)));
}

function imageInventorySize(item) {
  const src = itemImage(item);
  return isCompanionImage(src) ? (IMAGE_FOOTPRINTS.get(src) ?? null) : null;
}

const FOOTPRINT_BY_WEIGHT = Object.freeze([
  { upTo: 2,        w: 1, h: 1 },
  { upTo: 6,        w: 1, h: 2 },
  { upTo: 12,       w: 2, h: 2 },
  { upTo: 30,       w: 2, h: 3 },
  { upTo: Infinity, w: 3, h: 3 }
]);

/**
 * Huella final. Los compendios siempre conservan su tamaño artístico exacto;
 * `bulky` solo controla el cálculo por peso para objetos 5e genéricos.
 */
export function itemFootprint(item, bulky) {
  const exact = flaggedInventorySize(item) ?? imageInventorySize(item);
  if (exact) return exact;
  if (!bulky) return { w: 1, h: 1 };

  const weight = Number(getProperty(item, "system.weight.value") ?? getProperty(item, "system.weight")) || 0;
  const rule = FOOTPRINT_BY_WEIGHT.find((entry) => weight <= entry.upTo) ?? { w: 1, h: 1 };
  let { w, h } = rule;

  const armorType = String(getProperty(item, "system.type.value") ?? "").toLowerCase();
  if (["medium", "heavy"].includes(armorType)) { w = Math.max(w, 2); h = Math.max(h, 2); }
  if (armorType === "shield") { w = Math.max(w, 2); h = Math.max(h, 2); }

  if (item?.type === "weapon") {
    const properties = getProperty(item, "system.properties") ?? item?.system?.properties;
    const has = (key) => (properties instanceof Set ? properties.has(key)
      : Array.isArray(properties) ? properties.includes(key)
      : properties?.[key] === true || properties?.[key]?.value === true);
    if (has("two")) { w = Math.max(w, 2); h = Math.max(h, 2); }
  }
  if (["container", "backpack"].includes(item?.type)) { w = Math.max(w, 2); h = Math.max(h, 2); }

  return { w, h };
}
