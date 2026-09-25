/**
 * Hoja de Personaje 5e (By Fatmorbus)
 * combat-hub-bridge.js — Puente nativo con «Combat Hub – D&D 5e (By Fatmorbus)».
 *
 * La idea es que haya UNA sola verdad sobre lo que el personaje lleva encima:
 *
 *  - El paperdoll de la hoja escribe `system.equipped`, que es exactamente lo
 *    que el Hub valida antes de mostrar un objeto en sus menús. Así, todo lo
 *    que equipas en la hoja aparece ya equipado en el Hub sin hacer nada más.
 *  - Las dos ranuras de mano (arma principal / secundaria) se delegan en la
 *    lógica del propio Hub — `equipToHand` / `unequipHand` — en vez de
 *    reimplementarla. De esa forma respetamos sus reglas: un arma a dos manos
 *    desequipa todo lo demás, ocupar la izquierda quita cualquier otro escudo,
 *    etcétera.
 *  - En sentido contrario, cuando el jugador equipa desde el Hub (o cambia de
 *    conjunto con los numerales I/II/III), las banderas de manos del Hub se
 *    copian a las ranuras del paperdoll, de modo que la hoja refleja el cambio.
 *
 * La ranura «a distancia» de la hoja no tiene equivalente en el Hub: se deja
 * equipada pero sin ocupar mano, como un arma envainada a la espalda. Al
 * hacerle clic en el Hub, sus reglas normales de equipado toman el control.
 *
 * Si el Hub no está instalado o desactivado, todo esto se salta y la hoja
 * funciona igual que antes.
 */

const HUB_ID = "combat-hub-dnd5e-by-fatmorbus";

/** Ranura del paperdoll → mano del Hub. */
export const HAND_OF_SLOT = { main: "right", off: "left" };
/** Mano del Hub → ranura del paperdoll. */
export const SLOT_OF_HAND = { right: "main", left: "off" };

let hubModule = null;
let hubLoad = null;

/** ¿Está el Combat Hub instalado y activo en este mundo? */
export function hubActive() {
  return game.modules.get(HUB_ID)?.active === true;
}

/**
 * Carga la lógica del Hub bajo demanda (una sola vez por sesión).
 * @returns {Promise<object|null>} el módulo, o null si no se puede usar
 */
export function loadHub() {
  if (!hubActive()) return Promise.resolve(null);
  if (hubModule) return Promise.resolve(hubModule);
  if (!hubLoad) {
    hubLoad = import(`/modules/${HUB_ID}/scripts/hub-logic.mjs`)
      .then((mod) => { hubModule = mod; return mod; })
      .catch((err) => {
        console.warn("talespire-foundrysheets-by-velvet | No se pudo cargar la lógica del Combat Hub", err);
        return null;
      });
  }
  return hubLoad;
}

/** Manos que el Hub tiene guardadas, sin validar contra system.equipped. */
export function hubHandFlags(actor) {
  const flags = foundry.utils.getProperty(actor, `flags.${HUB_ID}.hands`);
  return { right: flags?.right ?? null, left: flags?.left ?? null };
}

/** Convierte índices, números y numerales de distintas versiones del Hub. */
function normalizeLoadoutIndex(value, { oneBased = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") {
    for (const key of ["index", "activeIndex", "currentIndex", "loadoutIndex", "weaponSetIndex"]) {
      const index = normalizeLoadoutIndex(value?.[key]);
      if (index !== null) return index;
    }
    for (const key of ["number", "setNumber", "loadoutNumber", "weaponSetNumber"]) {
      const index = normalizeLoadoutIndex(value?.[key], { oneBased: true });
      if (index !== null) return index;
    }
    return null;
  }

  const text = String(value).trim().toUpperCase();
  const roman = ["I", "II", "III", "IV"].indexOf(text);
  if (roman >= 0) return roman;
  const number = Number(text);
  if (!Number.isInteger(number)) return null;
  const index = oneBased ? number - 1 : number;
  return index >= 0 && index < 12 ? index : null;
}

function matchingLoadoutIndex(actor) {
  const hands = hubHandFlags(actor);
  if (hands.right === null && hands.left === null) return null;
  const flags = foundry.utils.getProperty(actor, `flags.${HUB_ID}`) ?? {};
  const stored = flags.loadouts ?? flags.weaponSets ?? flags.sets ?? null;
  const entries = Array.isArray(stored)
    ? stored
    : (stored && typeof stored === "object" ? Object.values(stored) : []);
  const pair = (entry) => {
    const source = entry?.hands ?? entry?.weapons ?? entry ?? {};
    return {
      right: source.right ?? source.main ?? source.mainHand ?? null,
      left: source.left ?? source.off ?? source.offHand ?? null
    };
  };
  return entries.findIndex((entry) => {
    const candidate = pair(entry);
    return candidate.right === hands.right && candidate.left === hands.left;
  });
}

/** Datos visibles del conjunto de armas activo, tolerante a versiones del Hub. */
export async function hubLoadoutView(actor, fallbackIndex = null) {
  if (!hubActive() || !actor) return null;
  const api = await loadHub();
  const candidates = [];

  for (const name of ["getActiveLoadoutIndex", "getCurrentLoadoutIndex", "getLoadoutIndex", "getActiveWeaponSetIndex"]) {
    if (typeof api?.[name] !== "function") continue;
    try { candidates.push({ value: await api[name](actor), oneBased: false }); }
    catch (_error) { /* Integración opcional con versiones anteriores. */ }
  }
  for (const name of ["getActiveLoadout", "getCurrentLoadout", "getActiveWeaponSet"]) {
    if (typeof api?.[name] !== "function") continue;
    try { candidates.push({ value: await api[name](actor), oneBased: false }); }
    catch (_error) { /* Integración opcional con versiones anteriores. */ }
  }

  for (const [path, oneBased] of [
    ["activeLoadoutIndex", false], ["currentLoadoutIndex", false], ["loadoutIndex", false],
    ["activeWeaponSetIndex", false], ["activeLoadout", false], ["currentLoadout", false],
    ["activeSet", true], ["weaponSet", true], ["loadoutNumber", true]
  ]) candidates.push({ value: actor.getFlag?.(HUB_ID, path), oneBased });

  let index = null;
  for (const candidate of candidates) {
    index = normalizeLoadoutIndex(candidate.value, { oneBased: candidate.oneBased });
    if (index !== null) break;
  }
  if (index === null) {
    const matched = matchingLoadoutIndex(actor);
    if (matched >= 0) index = matched;
  }
  if (index === null) index = normalizeLoadoutIndex(fallbackIndex) ?? 0;

  const numerals = Array.isArray(api?.LOADOUT_NUMERALS)
    ? api.LOADOUT_NUMERALS
    : ["I", "II", "III", "IV"];
  return {
    index,
    number: index + 1,
    numeral: numerals[index] ?? String(index + 1),
    tooltip: `Conjunto de armas ${index + 1} · Combat Hub`
  };
}

/** ¿El arma ocupa las dos manos según el Hub? */
export function isTwoHanded(item) {
  if (item?.type !== "weapon") return false;
  const props = item.system?.properties;
  if (props instanceof Set) return props.has("two");
  if (Array.isArray(props)) return props.includes("two");
  if (props && typeof props === "object") {
    const entry = props.two;
    return entry === true || entry?.value === true;
  }
  return false;
}

/**
 * Equipa desde el paperdoll usando las reglas del Hub.
 * @returns {Promise<boolean>} true si el Hub se hizo cargo
 */
export async function equipHandViaHub(actor, slotKey, item) {
  const hand = HAND_OF_SLOT[slotKey];
  if (!hand) return false;
  const api = await loadHub();
  if (!api?.equipToHand) return false;
  await api.equipToHand(actor, hand, item);
  return true;
}

/**
 * Vacía una mano desde el paperdoll usando las reglas del Hub.
 * @returns {Promise<boolean>} true si el Hub se hizo cargo
 */
export async function unequipHandViaHub(actor, slotKey) {
  const hand = HAND_OF_SLOT[slotKey];
  if (!hand) return false;
  const api = await loadHub();
  if (!api?.unequipHand) return false;
  await api.unequipHand(actor, hand);
  return true;
}

/**
 * Calcula cómo deben quedar las ranuras del paperdoll a partir del estado real
 * del actor. No escribe nada: solo devuelve el objeto resultante y si cambió.
 *
 * Reglas, por orden de prioridad:
 *  1. Las manos del Hub mandan sobre `main` y `off` (incluido el arma a dos
 *     manos, que aparece en ambas).
 *  2. Una ranura cuyo objeto ya no exista, o que se haya desequipado por otra
 *     vía (la hoja del sistema, una macro, un conjunto del Hub), se vacía.
 *
 * @returns {{slots: object, changed: boolean}}
 */
export function reconcileSlots(actor, slotFlag, slotDefs, accepts = null) {
  const slots = foundry.utils.deepClone(slotFlag ?? {});
  const before = JSON.stringify(slots);

  // 0. Ranuras que ya no existen (el «belt» único pasó a cuatro cartucheras).
  // Su contenido no se pierde: pasa por la reubicación de abajo.
  const known = new Set(slotDefs.map((def) => def.key));
  const orphaned = [];
  for (const [key, id] of Object.entries(slots)) {
    if (known.has(key)) continue;
    const item = id ? actor.items.get(id) : null;
    if (item) orphaned.push(item);
    delete slots[key];
  }

  // 1. Limpieza: objetos borrados, desequipados, o que ya no encajan.
  const misplaced = [...orphaned];
  for (const [key, id] of Object.entries(slots)) {
    if (!id) { delete slots[key]; continue; }
    const item = actor.items.get(id);
    if (!item) { delete slots[key]; continue; }
    const equipped = foundry.utils.getProperty(item, "system.equipped");
    if (equipped === false) { delete slots[key]; continue; }
    // Las reglas de ranura pueden haber cambiado entre versiones de la hoja.
    // Una asignación vieja que ya no vale se saca de ahí y, más abajo, se
    // intenta llevar a la ranura que le corresponde ahora.
    if (accepts && !accepts(key, item)) {
      delete slots[key];
      misplaced.push(item);
    }
  }

  // 1b. Reubicación: por ejemplo una armadura que estaba en la ranura del
  // yelmo (porque antes se admitía cualquier `equipment`) salta a «armadura».
  // Las manos quedan fuera: de ellas manda el Combat Hub.
  if (accepts && misplaced.length) {
    for (const item of misplaced) {
      const target = slotDefs.find((def) => !HAND_OF_SLOT[def.key] && !slots[def.key] && accepts(def.key, item));
      if (target) slots[target.key] = item.id;
    }
  }

  // 2. Las manos del Hub reescriben main/off.
  if (hubActive()) {
    const hands = hubHandFlags(actor);
    const resolve = (id) => {
      if (!id) return null;
      const item = actor.items.get(id);
      if (!item || item.system?.equipped !== true) return null;
      return item;
    };
    const right = resolve(hands.right);
    const twoHanded = !!right && hands.right === hands.left;
    const left = twoHanded ? right : resolve(hands.left);

    // Solo tocamos las manos si el Hub tiene algo dicho al respecto; si sus
    // banderas están vacías porque nunca se ha usado, dejamos el paperdoll.
    if (hands.right !== null || hands.left !== null) {
      if (right) slots.main = right.id; else delete slots.main;
      if (left) slots.off = left.id; else delete slots.off;
    }
  }

  // 3. Un mismo objeto no puede estar en dos ranuras (salvo el arma a 2 manos).
  const seen = new Map();
  for (const def of slotDefs) {
    const id = slots[def.key];
    if (!id) continue;
    const previous = seen.get(id);
    if (previous === undefined) { seen.set(id, def.key); continue; }
    const item = actor.items.get(id);
    const bothHands = isTwoHanded(item)
      && ["main", "off"].includes(previous) && ["main", "off"].includes(def.key);
    if (!bothHands) delete slots[def.key];
  }

  return { slots, changed: JSON.stringify(slots) !== before };
}
