/**
 * Stoneshard Sheet 5e By Fatmorbus — v3.1.0
 *
 * ActorSheet alternativa para personajes de dnd5e con el inventario de
 * Stoneshard: paperdoll de equipamiento, grilla de celdas, tooltips de
 * pergamino y sonidos de objetos según su material.
 *
 * - Se registra como hoja OPCIONAL («Hoja Stoneshard (inventario)») en la
 *   configuración de hoja del actor; no fuerza nada.
 * - El resto del personaje se gestiona con Tidy 5e / dnd5e mediante el botón
 *   «Hoja completa» de la cabecera.
 * - Posiciones de grilla y slots se guardan en flags del actor; el equipado
 *   real usa system.equipped de dnd5e.
 * - Recursos de assets/ y sounds/ extraídos de una copia local de Stoneshard:
 *   SOLO USO PRIVADO (ver sounds/CREDITOS.txt).
 */

import {
  hubActive,
  loadHub,
  hubLoadoutView,
  equipHandViaHub,
  unequipHandViaHub,
  reconcileSlots,
  isTwoHanded,
  HAND_OF_SLOT
} from "./combat-hub-bridge.js";
import { primeRarityResolver, rarityInfo } from "./rarity-bridge.js";
import { itemFootprint, primeInventoryFootprints } from "./inventory-sizing.mjs";

const MODULE_ID = "talespire-foundrysheets-by-velvet";
const PATH = `modules/${MODULE_ID}`;
const CELL = 52; // 26 px de Stoneshard × 2
const INV_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container", "backpack"];
const COIN_EXCHANGE_SCENES_SETTING = "coinExchangeScenes";
const CURRENCY_KEYS = ["pp", "gp", "ep", "sp", "cp"];

/* -------------------------------------------------------------------------- */
/*  Slots de equipamiento                                                     */
/* -------------------------------------------------------------------------- */

/*
 * Cada ranura lleva un dibujo propio en `assets/slots`, trazado a línea clara
 * al estilo de las hojas de equipo clásicas. Se dibujan en SVG en vez de usar
 * iconos de fuente porque a 72 px un glifo se ve blando y estos aguantan.
 */
const SLOT_DEFS = [
  { key: "main",   label: "SSSHEET.SlotMain",   frame: "hand",   pos: { x: 0.0,  y: 2.0,  w: 17.5, h: 43.0 } },
  { key: "off",    label: "SSSHEET.SlotOff",    frame: "hand",   pos: { x: 82.5, y: 2.0,  w: 17.5, h: 43.0 } },
  { key: "head",   label: "SSSHEET.SlotHead",   frame: "head",   pos: { x: 39.0, y: 0.0,  w: 22.0, h: 19.0 } },
  { key: "body",   label: "SSSHEET.SlotBody",   frame: "body",   pos: { x: 38.5, y: 20.0, w: 23.0, h: 29.0 } },
  { key: "belt",   label: "SSSHEET.SlotBelt",   frame: "belt",   pos: { x: 37.5, y: 50.5, w: 25.0, h: 9.0 } },
  { key: "amulet", label: "SSSHEET.SlotAmulet", frame: "amulet", pos: { x: 65.0, y: 1.5,  w: 13.0, h: 15.0 } },
  { key: "ring1",  label: "SSSHEET.SlotRing1",  frame: "ring",   pos: { x: 22.0, y: 27.0, w: 11.5, h: 12.5 } },
  { key: "ring2",  label: "SSSHEET.SlotRing2",  frame: "ring",   pos: { x: 66.0, y: 37.5, w: 11.5, h: 12.5 } },
  { key: "gloves", label: "SSSHEET.SlotGloves", frame: "gloves", pos: { x: 17.0, y: 61.0, w: 20.0, h: 17.0 } },
  { key: "cape",   label: "SSSHEET.SlotCape",   frame: "cape",   pos: { x: 0.5,  y: 59.5, w: 15.0, h: 20.0 } },
  { key: "boots",  label: "SSSHEET.SlotBoots",  frame: "boots",  pos: { x: 63.0, y: 61.0, w: 20.0, h: 17.0 } },
  // 5e conserva una ranura de arma a distancia, independiente de las manos.
  { key: "ranged", label: "SSSHEET.SlotRanged", frame: "hand", art: "ranged", pos: { x: 83.0, y: 49.0, w: 17.0, h: 31.0 } },
  { key: "belt1",  label: "SSSHEET.SlotBelt1",  frame: null, pos: { x: 26.1, y: 85.0, w: 9.8, h: 14.5 } },
  { key: "belt2",  label: "SSSHEET.SlotBelt2",  frame: null, pos: { x: 35.9, y: 85.0, w: 9.8, h: 14.5 } },
  { key: "belt3",  label: "SSSHEET.SlotBelt3",  frame: null, pos: { x: 45.7, y: 85.0, w: 9.8, h: 14.5 } },
  { key: "belt4",  label: "SSSHEET.SlotBelt4",  frame: null, pos: { x: 55.5, y: 85.0, w: 9.8, h: 14.5 } },
  { key: "belt5",  label: "SSSHEET.SlotBelt5",  frame: null, pos: { x: 65.3, y: 85.0, w: 9.8, h: 14.5 } }
].map((def) => ({
  ...def,
  frameUrl: def.frame ? `${PATH}/assets/slots/frame-${def.frame}.png` : null,
  artUrl: def.art
    ? `${PATH}/assets/slots/${def.art}.svg`
    : !def.frame
    ? null
    : ["ring1", "ring2"].includes(def.key)
      ? `${PATH}/assets/slots/ring.svg`
      : `${PATH}/assets/slots/art-${def.frame}.png`
}));

/** Las cinco cartucheras del cinturón. */
const BELT_SLOTS = ["belt1", "belt2", "belt3", "belt4", "belt5"];

/* Tipos de `equipment` de dnd5e, separados por lo que son de verdad. */

/** Lo que cubre el torso y da CA: solo esto entra en la ranura de armadura. */
const ARMOR_TYPES = ["light", "medium", "heavy", "natural"];

/**
 * Complementos: bagatelas, maravillosos, ropa, anillos, varas y varitas.
 * Los yelmos, guantes, botas, cinturones y capas de 5e no tienen un tipo
 * propio en el sistema — se configuran como **bagatelas**, así que estas son
 * las ranuras que los admiten.
 */
const TRINKET_TYPES = ["trinket", "wondrous", "clothing", "ring", "rod", "wand"];

/** ¿El item es un complemento vestible (bagatela y compañía) o un tesoro suelto? */
function isTrinketLike(item) {
  if (item.type === "loot") return true;
  if (item.type !== "equipment") return false;
  const type = String(foundry.utils.getProperty(item, "system.type.value") ?? "").toLowerCase();
  // Sin tipo declarado se trata como bagatela: es lo que asume dnd5e.
  return !type || TRINKET_TYPES.includes(type);
}

/** ¿Es una armadura de cuerpo? (el escudo no cuenta: va a la mano torpe) */
function isBodyArmor(item) {
  if (item.type !== "equipment") return false;
  const type = String(foundry.utils.getProperty(item, "system.type.value") ?? "").toLowerCase();
  return ARMOR_TYPES.includes(type);
}

function isShield(item) {
  return item.type === "equipment"
    && String(foundry.utils.getProperty(item, "system.type.value") ?? "").toLowerCase() === "shield";
}

/** ¿Se pisan dos rectángulos de la grilla? */
function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Redibuja las hojas abiertas cuando el DM cambia un ajuste de mundo. */
/* ---------------------- Diseño compacto (Symbiote) ----------------------- */

function sheetLayout() {
  try { return game.settings.get(MODULE_ID, "dnd5eLayout") ?? "standard"; } catch { return "standard"; }
}

/** Symbiote de TaleSpire (capa de compatibilidad o API `TS`) o viewport estrecho. */
function narrowClient() {
  return !!globalThis.TALESPIRE_COMPAT || typeof globalThis.TS !== "undefined" || window.innerWidth < 900;
}

function compactWidth() {
  return Math.max(340, Math.min(520, window.innerWidth - 8));
}

function sheetWidth() {
  if (narrowClient()) return compactWidth();
  return sheetLayout() === "symbiote-optimized" ? 520 : 1040;
}

function rerenderOpenSheets() {
  for (const app of Object.values(ui.windows ?? {})) {
    if (StoneshardSheet && app instanceof StoneshardSheet) app.render(false);
  }
}

function currentSceneId() {
  const viewed = globalThis.canvas?.scene?.id ?? game.user?.viewedScene;
  return typeof viewed === "string" ? viewed : viewed?.id ?? null;
}

function configuredCoinExchangeScenes() {
  try {
    const value = game.settings.get(MODULE_ID, COIN_EXCHANGE_SCENES_SETTING);
    return Array.isArray(value) ? value.filter((id) => typeof id === "string" && id) : [];
  } catch (_error) { return []; }
}

function coinExchangeState() {
  const sceneId = currentSceneId();
  const allowedScenes = configuredCoinExchangeScenes();
  const allowed = game.user?.isGM === true || (Boolean(sceneId) && allowedScenes.includes(sceneId));
  let tooltip = "Cambiar monedas de menor a mayor denominación";
  if (!allowed) {
    tooltip = allowedScenes.length
      ? "El cambio de monedas no está disponible en esta escena"
      : "El DJ todavía no ha configurado escenas para cambiar monedas";
  }
  return { allowed, sceneId, configured: allowedScenes.length, tooltip };
}

const FormApplicationBase = foundry.appv1?.api?.FormApplication ?? globalThis.FormApplication;
class CoinExchangeSceneConfig extends FormApplicationBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-coin-scenes`,
      title: "Escenas para cambio de monedas",
      template: `${PATH}/templates/coin-exchange-scenes.hbs`,
      width: 520,
      height: "auto",
      resizable: true,
      closeOnSubmit: true
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    const selected = new Set(configuredCoinExchangeScenes());
    context.scenes = [...(game.scenes ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((scene) => ({ id: scene.id, name: scene.name, selected: selected.has(scene.id) }));
    context.hasScenes = context.scenes.length > 0;
    return context;
  }

  async _updateObject(_event, formData) {
    const raw = formData?.sceneIds;
    const submitted = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const values = submitted.flatMap((value) => String(value).split(",")).filter(Boolean);
    const valid = new Set([...(game.scenes ?? [])].map((scene) => scene.id));
    const sceneIds = [...new Set(values.filter((id) => valid.has(id)))];
    await game.settings.set(MODULE_ID, COIN_EXCHANGE_SCENES_SETTING, sceneIds);
    ui.notifications?.info?.(`${sceneIds.length} escena(s) habilitada(s) para cambiar monedas.`);
  }
}

/* -------------------------------------------------------------------------- */
/*  Árbol de rasgos                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Avances que no son «rasgos»: solo suben números o marcan competencias, y en
 * un árbol de habilidades serían ruido.
 */
const SKIPPED_ADVANCEMENTS = ["HitPoints", "Trait", "ScaleValue", "Size"];

const DEFAULT_ADVANCEMENT_ICON = "icons/svg/upgrade.svg";

/* -------------------------------------------------------------------------- */
/*  Preparación de conjuros (dnd5e 4.x y 5.x)                                 */
/* -------------------------------------------------------------------------- */

/*
 * dnd5e 5.1 partió el viejo `system.preparation` en dos campos:
 *   preparation.mode      → system.method   ("spell", "pact", "atwill", "innate", "ritual")
 *   preparation.prepared  → system.prepared (0 sin preparar, 1 preparado, 2 siempre)
 * Las rutas antiguas siguen funcionando por compatibilidad, pero avisan en
 * consola y desaparecen en dnd5e 6.0. Aquí se detecta cuál toca y la hoja
 * funciona igual en Foundry 13 (dnd5e 4.x) que en Foundry 14 (5.x).
 */

/** ¿El conjuro usa el modelo nuevo (`system.method`)? */
function usesModernSpellFields(spell) {
  return typeof spell?.system?.method === "string";
}

/** Método de lanzamiento normalizado al vocabulario nuevo. */
function spellMethod(spell) {
  if (usesModernSpellFields(spell)) return spell.system.method || "spell";
  const mode = spell?.system?.preparation?.mode ?? "prepared";
  return mode === "prepared" || mode === "always" ? "spell" : mode;
}

/** Estado de preparación: 0 sin preparar, 1 preparado, 2 siempre preparado. */
function spellState(spell) {
  if (usesModernSpellFields(spell)) return Number(spell.system.prepared) || 0;
  const prep = spell?.system?.preparation ?? {};
  if (prep.mode === "always") return 2;
  return prep.prepared ? 1 : 0;
}

/** ¿Este método exige preparar los conjuros? (a voluntad e innatos, no) */
function methodPrepares(method) {
  const config = CONFIG.DND5E?.spellcasting?.[method];
  if (config) return config.prepares === true;
  // dnd5e 4.x: solo el modo «prepared» llevaba casilla.
  return method === "spell";
}

/** Actualización que marca o desmarca un conjuro como preparado. */
function preparedUpdate(spell, prepared) {
  if (usesModernSpellFields(spell)) return { "system.prepared": prepared ? 1 : 0 };
  return { "system.preparation.prepared": prepared };
}

/* -------------------------------------------------------------------------- */
/*  Filtros del inventario                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Botonera que aparece entre las monedas y la grilla. `all` no se filtra:
 * es el estado de reposo.
 */
const ITEM_GROUPS = [
  { key: "all",        label: "Todo",      icon: "fa-grip" },
  { key: "weapon",     label: "Armas",     icon: "fa-sword" },
  { key: "armor",      label: "Armadura",  icon: "fa-shield-halved" },
  { key: "consumable", label: "Consumo",   icon: "fa-flask" },
  { key: "container",  label: "Contened.", icon: "fa-sack" },
  { key: "loot",       label: "Botín",     icon: "fa-gem" }
];

/** Grupo del filtro al que pertenece un objeto. */
function itemGroup(item) {
  switch (item.type) {
    case "weapon": return "weapon";
    case "consumable": return "consumable";
    case "container":
    case "backpack": return "container";
    case "tool": return "loot";
    case "loot": return "loot";
    case "equipment":
      // La ropa y las bagatelas cuentan como botín; solo la armadura de verdad
      // y los escudos van al grupo de armadura.
      return (isBodyArmor(item) || isShield(item)) ? "armor" : "loot";
    default: return "loot";
  }
}

function slotAccepts(key, item) {
  if (!item) return false;
  switch (key) {
    case "main":
    case "ranged":
      return item.type === "weapon";
    case "off":
      return item.type === "weapon" || isShield(item);
    case "body":
      // Antes aceptaba cualquier `equipment`, y por eso la cota de malla
      // acababa cabiendo también en la ranura del yelmo.
      return isBodyArmor(item);
    case "belt1":
    case "belt2":
    case "belt3":
    case "belt4":
    case "belt5":
      // Cartucheras: pociones, venenos, pergaminos y demás de un solo uso.
      // La munición no, que se gestiona sola y llenaría el cinturón.
      if (item.type === "consumable") {
        return String(foundry.utils.getProperty(item, "system.type.value") ?? "").toLowerCase() !== "ammo";
      }
      // También cabe una bagatela con carga (una varita, una piedra rúnica).
      return isTrinketLike(item);
    case "ring1":
    case "ring2":
    case "amulet":
    case "head":
    case "gloves":
    case "boots":
    case "cape":
      return isTrinketLike(item);
    default:
      return isTrinketLike(item);
  }
}

/* -------------------------------------------------------------------------- */
/*  Sonidos                                                                   */
/* -------------------------------------------------------------------------- */

const WEAPON_SOUNDS = [
  { rx: /dagger|daga|dirk|sickle|hoz/i,                            file: "snd_drop_dagger_metal.wav" },
  { rx: /greatsword|espad[oó]n|mandoble/i,                         file: "snd_drop_2hsword_metal.wav" },
  { rx: /sword|espada|scimitar|cimitarra|rapier|estoque|katana/i,  file: "snd_drop_sword_metal.wav" },
  { rx: /greataxe|gran\s*hacha/i,                                  file: "snd_drop_2haxe_metal.wav" },
  { rx: /axe|hacha/i,                                              file: "snd_drop_axe_metal.wav" },
  { rx: /maul|alm[aá]dena/i,                                       file: "snd_drop_2hmace_metal.wav" },
  { rx: /warhammer|martillo|mace|maza|morningstar|lucero|flail|mangual|war\s*pick|piqueta/i, file: "snd_drop_mace_metal.wav" },
  { rx: /club|garrote|porra/i,                                     file: "snd_drop_mace_wood.wav" },
  { rx: /quarterstaff|bast[oó]n|staff|vara/i,                      file: "snd_drop_2hStaff_wood.wav" },
  { rx: /javelin|jabalina/i,                                       file: "snd_drop_spear_wood.wav" },
  { rx: /spear|lanza|pike|pica|trident|tridente|glaive|guja|halberd|alabarda/i, file: "snd_drop_spear_metal.wav" },
  { rx: /crossbow|ballesta/i,                                      file: "snd_drop_crossbow_wood.wav" },
  { rx: /\bbow\b|arco/i,                                           file: "snd_drop_bow_wood.wav" },
  { rx: /sling|honda/i,                                            file: "snd_drop_sling_medium.ogg" },
  { rx: /whip|l[aá]tigo|chain|cadena/i,                            file: "snd_drop_chain_metal.wav" }
];

const EQUIPMENT_SOUNDS = {
  light:    "snd_drop_Chest_Light_Leather.wav",
  medium:   "snd_drop_Chest_Medium_Metal.wav",
  heavy:    "snd_drop_Chest_Heavy_Metal.wav",
  shield:   "snd_drop_shield_Heavy_Metal.wav",
  clothing: "snd_drop_Chest_Light_Cloth.wav",
  trinket:  "snd_drop_Amulet_Light_Gold.wav"
};

function dropSoundFor(item) {
  try {
    if (!item) return "snd_gui_drop_ico.wav";
    const name = String(item.name ?? "");
    const sub = String(foundry.utils.getProperty(item, "system.type.value") ?? "").toLowerCase();

    if (item.type === "weapon") {
      const hay = `${foundry.utils.getProperty(item, "system.type.baseItem") ?? ""} ${name}`;
      for (const e of WEAPON_SOUNDS) if (e.rx.test(hay)) return e.file;
      return "snd_drop_sword_metal.wav";
    }
    if (item.type === "equipment") {
      if (/anillo|ring/i.test(name)) return "snd_drop_Ring_Light_Gold.wav";
      if (/casco|yelmo|helm|sombrero|capucha|hood/i.test(name)) {
        return EQUIPMENT_SOUNDS[sub] === EQUIPMENT_SOUNDS.heavy ? "snd_drop_Head_Light_Metal.wav" : "snd_drop_Head_Light_Cloth.wav";
      }
      return EQUIPMENT_SOUNDS[sub] ?? "snd_drop_Chest_Light_Cloth.wav";
    }
    if (item.type === "consumable") {
      if (["potion", "poison", "elixir"].includes(sub) || /poci[oó]n|potion|elixir|veneno/i.test(name)) return "snd_gui_drop_potion.wav";
      if (sub === "scroll" || /pergamino|scroll/i.test(name)) return "snd_close_scroll.wav";
      if (sub === "ammo" || /flecha|arrow|virote|bolt|bala/i.test(name)) return "snd_arrow_drop.wav";
      if (sub === "food" || /raci[oó]n|comida|pan|carne|queso|food|bread|meat/i.test(name)) return "snd_bread_drop.wav";
      if (["wand", "rod"].includes(sub) || /varita|wand|cetro/i.test(name)) return "snd_drop_tool_wood.wav";
      return "snd_drug_herbs_drop.wav";
    }
    if (item.type === "tool") {
      return /instrumento|lute|la[uú]d|flauta|drum|tambor/i.test(name) ? "snd_drop_tool_wood.wav" : "snd_drop_tool_metal.wav";
    }
    if (["container", "backpack"].includes(item.type)) return "snd_backpack_heavy_drop.wav";

    // loot y resto
    if (/libro|book|tomo|grimorio/i.test(name)) return "snd_book_drop.wav";
    if (/llave|key/i.test(name)) return "snd_drop_key.wav";
    if (/oro|gold|moneda|coin|tesoro/i.test(name)) return "snd_gui_drop_gold_1.wav";
    if (/gema|gem|joya|jewel|diamante|rub[ií]|perla/i.test(name)) return "snd_gui_pick_ring.wav";
    if (/piel|pelaje|hide|pelt|cuero/i.test(name)) return "snd_drop_hide.wav";
    if (/botella|frasco|vial|jarra|bottle|flask/i.test(name)) return "snd_gui_drop_potion.wav";
    return "snd_gui_drop_ico.wav";
  } catch {
    return "snd_gui_drop_ico.wav";
  }
}

function pickSoundFor(item) {
  try {
    const name = String(item?.name ?? "");
    const sub = String(foundry.utils.getProperty(item, "system.type.value") ?? "").toLowerCase();
    if (item?.type === "consumable" && (["potion", "poison", "elixir"].includes(sub) || /poci[oó]n|potion/i.test(name))) return "snd_gui_pick_potion.wav";
    if (/libro|book|tomo/i.test(name)) return "snd_book_pick.wav";
    if (/oro|gold|moneda|coin/i.test(name)) return "snd_gui_pick_gold.wav";
    if (/anillo|ring|amuleto|amulet|gema|gem/i.test(name)) return "snd_gui_pick_ring.wav";
    if (["container", "backpack"].includes(item?.type)) return "snd_bag_medium_pick.wav";
    return "snd_bag_medium_pick.wav";
  } catch {
    return null;
  }
}

function useSoundFor(item) {
  const sub = String(foundry.utils.getProperty(item, "system.type.value") ?? "").toLowerCase();
  if (item?.type === "consumable") {
    if (["potion", "elixir"].includes(sub)) return "snd_gui_drink_potion.wav";
    if (sub === "scroll") return "snd_open_scroll.wav";
  }
  return null;
}

function play(file, { delay = 0 } = {}) {
  try {
    if (!file) return;
    if (!game.settings.get(MODULE_ID, "sounds")) return;
    const raw = Number(game.settings.get(MODULE_ID, "volume"));
    const volume = Number.isFinite(raw) ? raw : 0.6;
    if (volume <= 0) return;
    const helper = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    const go = () => helper?.play({ src: `${PATH}/sounds/${file}`, volume, autoplay: true, loop: false }, false);
    if (delay > 0) setTimeout(go, delay);
    else go();
  } catch (error) {
    console.warn(`${MODULE_ID} | audio`, error);
  }
}

/* -------------------------------------------------------------------------- */
/*  Colores de daño (paleta Stoneshard)                                       */
/* -------------------------------------------------------------------------- */

const DAMAGE_COLORS = {
  fire: "#ff7f27", cold: "#9ae5ff", lightning: "#ffd94d", thunder: "#9db8d6",
  acid: "#c2d92e", poison: "#77b529", necrotic: "#b04ae0", radiant: "#ffdf80",
  psychic: "#ff7fc9", force: "#b58cff", bludgeoning: "#cdb488",
  piercing: "#ded4b5", slashing: "#e0725c"
};

/* -------------------------------------------------------------------------- */
/*  Registro                                                                  */
/* -------------------------------------------------------------------------- */

let StoneshardSheet = null;

Hooks.once("init", () => {
  // Este archivo usa el modelo de datos de 5e. PF2e se registra por separado
  // en pf2e-sheet.js y hereda de la hoja oficial del sistema.
  if (game.system?.id !== "dnd5e") return;

  game.settings.register(MODULE_ID, COIN_EXCHANGE_SCENES_SETTING, {
    name: "Escenas para cambio de monedas",
    hint: "Los jugadores solo pueden convertir monedas en escenas autorizadas. El DJ puede convertir en cualquier escena.",
    scope: "world", config: false, type: Array, default: [],
    onChange: () => rerenderOpenSheets()
  });
  game.settings.registerMenu(MODULE_ID, "coinExchangeSceneConfig", {
    name: "Escenas para cambio de monedas",
    hint: "Selecciona bases, bastiones, bancos o tiendas donde los jugadores pueden optimizar sus monedas.",
    label: "Configurar escenas",
    icon: "fa-solid fa-coins",
    type: CoinExchangeSceneConfig,
    restricted: true
  });
  game.settings.register(MODULE_ID, "dnd5eLayout", {
    name: "Diseño de hoja 5e",
    hint: "Symbiote Optimized usa una sola columna de 520 px. Dentro de TaleSpire o en pantallas estrechas se activa solo.",
    scope: "client", config: true, type: String,
    choices: { standard: "Standard", "symbiote-optimized": "Symbiote Optimized (TaleSpire)" },
    default: "standard",
    onChange: () => {
      for (const app of Object.values(ui.windows ?? {})) {
        if (StoneshardSheet && app instanceof StoneshardSheet) app.setPosition({ width: sheetWidth() });
      }
      rerenderOpenSheets();
    }
  });
  game.settings.register(MODULE_ID, "sounds", {
    name: "Sonidos de objetos",
    hint: "Sonido según material al mover, equipar y usar objetos.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "volume", {
    name: "Volumen de efectos",
    scope: "client", config: true, type: Number,
    range: { min: 0, max: 1, step: 0.05 }, default: 0.6
  });
  game.settings.register(MODULE_ID, "gridCols", {
    name: "Columnas de la grilla",
    hint: "Ancho del inventario en celdas. Las posiciones guardadas son absolutas: cambiarlo no las pierde.",
    scope: "world", config: true, type: Number,
    range: { min: 6, max: 14, step: 1 }, default: 9
  });
  game.settings.register(MODULE_ID, "bulkyItems", {
    name: "Tamaño por peso para objetos 5e genéricos",
    hint: "Los objetos de los compendios Stoneshard By Fatmorbus conservan siempre su tamaño exacto. Activa esta opción para que los demás objetos 5e también ocupen varias casillas según su peso.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => rerenderOpenSheets()
  });
  game.settings.register(MODULE_ID, "capacityGrid", {
    name: "Tamaño de la mochila según la carga",
    hint: "El inventario tendrá tantos cuadros como libras pueda cargar el personaje, en vez de un alto fijo. Va de la mano de la opción anterior.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => rerenderOpenSheets()
  });

  const Base =
    globalThis.dnd5e?.applications?.actor?.ActorSheet5eCharacter ??
    foundry.appv1?.sheets?.ActorSheet ??
    ActorSheet;

  StoneshardSheet = class StoneshardSheet extends Base {
    /** Pestaña activa y visibilidad del paperdoll: estado propio de la ventana. */
    _tab = "attributes";
    _showDoll = false;
    /** Grupo de objetos visible en el inventario («all» = sin filtrar). */
    _filter = "all";
    /** Nivel de conjuro visible («all» = todos). */
    _spellLevel = "all";
    /** Encuadre del retrato activado y último conjunto visible del Combat Hub. */
    _portraitAdjust = false;
    _hubLoadoutIndex = null;

    _portraitFraming() {
      const saved = this.actor.getFlag(MODULE_ID, "portraitOffset") ?? {};
      return {
        x: Number(saved.x) || 0,
        y: Number(saved.y) || 0,
        scale: Number(saved.scale) > 0 ? Number(saved.scale) : 1
      };
    }

    _portraitTransform(framing = this._portraitFraming()) {
      return `translate(${framing.x}px, ${framing.y}px) scale(${framing.scale})`;
    }

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["sss-window", "sheet", "actor"],
        template: `${PATH}/templates/sheet.hbs`,
        // Tres columnas: navegación, retrato y panel de contenido; una sola en Symbiote.
        width: sheetWidth(),
        height: 820,
        resizable: true,
        submitOnChange: true,
        closeOnSubmit: false,
        scrollY: [".sss-panel", ".sss-grid-wrap"],
        tabs: [],
        dragDrop: [{ dragSelector: ".sss-draggable", dropSelector: null }]
      });
    }

    /* ------------------------------ Datos ------------------------------ */

    async getData(options) {
      let context;
      try {
        context = await super.getData(options);
      } catch {
        context = { actor: this.actor, system: this.actor.system };
      }
      context.ss = await this._buildModel();
      return context;
    }

    async _buildModel() {
      const actor = this.actor;
      const sys = actor.system;
      const cols = Math.max(6, Number(game.settings.get(MODULE_ID, "gridCols")) || 9);

      // Stoneshard Items trae una huella explícita. Food & Drink conserva la
      // huella en el lienzo PNG; se lee antes de colocar para evitar que una
      // poción o un plato salten de tamaño después de dibujar la hoja.
      await primeInventoryFootprints(actor.items.filter((item) => INV_TYPES.includes(item.type)));

      // --- slots ---
      // El paperdoll se deriva del estado real del actor: si el Combat Hub o
      // la hoja del sistema han cambiado el equipo, la vista lo refleja sin
      // esperar a que el jugador toque nada.
      const stored = actor.getFlag(MODULE_ID, "slots") ?? {};
      const { slots: slotFlag, changed } = reconcileSlots(actor, stored, SLOT_DEFS, slotAccepts);
      // La escritura se hace después del render para no reentrar en getData.
      if (changed && actor.isOwner) this._persistSlots(slotFlag);

      const slotted = new Set();
      const slotView = {};
      for (const def of SLOT_DEFS) {
        const id = slotFlag[def.key];
        const item = id ? actor.items.get(id) : null;
        if (item) slotted.add(item.id);
        slotView[def.key] = {
          ...def,
          labelText: game.i18n.localize(def.label),
          // Número de cartuchera (1–4), para pintarlo en la esquina.
          beltIndex: BELT_SLOTS.includes(def.key) ? BELT_SLOTS.indexOf(def.key) + 1 : null,
          // Un arma a dos manos ocupa `main` y `off`: la secundaria se marca
          // para poder atenuarla y no dejar soltar nada encima.
          twoHanded: !!item && def.key === "off" && slotFlag.main === id && isTwoHanded(item),
          item: item ? this._tileData(item) : null
        };
      }

      // --- grilla ---
      const bulky = Boolean(game.settings.get(MODULE_ID, "bulkyItems"));
      const items = actor.items.filter((i) => INV_TYPES.includes(i.type) && !slotted.has(i.id));
      const posFlag = actor.getFlag(MODULE_ID, "grid") ?? {};
      const placed = [];
      const tiles = [];
      const pending = [];

      const fits = (rect) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= cols
        && !placed.some((other) => overlaps(rect, other));

      for (const item of items) {
        const size = itemFootprint(item, bulky);
        const p = posFlag[item.id];
        const rect = { x: p?.x, y: p?.y, ...size };
        if (Number.isInteger(rect.x) && Number.isInteger(rect.y) && fits(rect)) {
          placed.push(rect);
          tiles.push({ ...this._tileData(item), ...rect });
        } else {
          pending.push({ item, size });
        }
      }

      // Autocolocar los que no tienen sitio: se busca el primer hueco donde
      // quepa el objeto entero, no solo su esquina.
      for (const { item, size } of pending) {
        let spot = null;
        for (let y = 0; !spot && y < 400; y++) {
          for (let x = 0; x + size.w <= cols; x++) {
            const rect = { x, y, ...size };
            if (fits(rect)) { spot = rect; break; }
          }
        }
        if (!spot) spot = { x: 0, y: 0, ...size };
        placed.push(spot);
        tiles.push({ ...this._tileData(item), ...spot });
      }

      // --- alto de la grilla ---
      let maxY = 5;
      for (const t of tiles) maxY = Math.max(maxY, t.y + t.h);
      let rows = Math.max(6, maxY + 1);

      // Modo mochila realista: tantos cuadros como libras pueda cargar.
      if (game.settings.get(MODULE_ID, "capacityGrid")) {
        const capacity = Number(sys.attributes?.encumbrance?.max) || 0;
        if (capacity > 0) rows = Math.max(rows, Math.ceil(capacity / cols));
      }

      // --- cabecera ---
      const hp = sys.attributes?.hp ?? { value: 0, max: 0 };
      const enc = sys.attributes?.encumbrance ?? { value: 0, max: 1, pct: 0 };
      const cur = sys.currency ?? {};
      const gold = Math.floor((cur.pp ?? 0) * 10 + (cur.gp ?? 0) + (cur.ep ?? 0) * 0.5 + (cur.sp ?? 0) * 0.1 + (cur.cp ?? 0) * 0.01);
      const loadout = hubActive()
        ? await hubLoadoutView(actor, this._hubLoadoutIndex)
        : null;

      return {
        // El tamaño real de celda lo fija el CSS con `--sss-cell`, que se
        // recalcula al abrir y al redimensionar para que la grilla entre
        // entera en el panel. Aquí solo viaja el valor de partida.
        cols, rows, cell: CELL, bulky,
        tiles,
        slots: slotView,
        slotList: SLOT_DEFS.map((def) => slotView[def.key]),
        hp: {
          value: hp.value ?? 0, max: hp.max ?? 0,
          temp: Number(hp.temp) || 0, tempmax: Number(hp.tempmax) || 0,
          pct: Math.max(0, Math.min(100, ((hp.value ?? 0) / Math.max(1, hp.max ?? 1)) * 100))
        },
        ac: sys.attributes?.ac?.value ?? "—",
        speed: sys.attributes?.movement?.walk ?? "—",
        gold: gold.toLocaleString("es-CL"),
        enc: { value: Math.round(enc.value ?? 0), max: Math.round(enc.max ?? 0), pct: Math.max(0, Math.min(100, enc.pct ?? 0)) },
        portrait: actor.img,
        editable: actor.isOwner === true,
        portraitOffset: this._portraitTransform(),
        portraitAdjust: this._portraitAdjust === true && actor.isOwner,

        // --- Resto de la hoja (pestañas) ---
        tab: this._tab,
        is: this._tabFlags(),
        tabs: this._buildTabs(),
        showDoll: this._showDoll || this._tab === "inventory",
        dollForced: this._tab === "inventory",
        identity: this._buildIdentity(),
        vitals: this._buildVitals(),
        abilities: this._buildAbilities(),
        saves: this._buildSaves(),
        skills: this._buildSkills(),
        currency: this._buildCurrency(),
        coinExchange: coinExchangeState(),
        spellbook: this._buildSpellbook(),
        features: this._buildFeatures(),
        effects: this._buildEffects(),
        pinned: this._buildPinned(),
        filters: this._buildFilters(tiles),
        attunement: this._buildAttunement(),
        details: this._buildDetails(),
        combat: this._buildCombatSummary(),
        hasLoadouts: Boolean(loadout),
        loadout
      };
    }

    /* --------------------------- Pestañas ------------------------------ */

    /** Definición de la navegación lateral. El orden es el del diseño. */
    _buildTabs() {
      const spells = (this.actor.itemTypes?.spell ?? []).length;
      const effects = this._buildEffects().length;
      const defs = [
        { key: "attributes", label: "Atributos",  icon: "fa-shield-halved" },
        { key: "skills",     label: "Habilidades", icon: "fa-person-running" },
        { key: "inventory",  label: "Inventario",  icon: "fa-briefcase" },
        { key: "spells",     label: "Conjuros",    icon: "fa-book-sparkles", badge: spells || null },
        { key: "features",   label: "Rasgos",      icon: "fa-star" },
        { key: "biography",  label: "Biografía",   icon: "fa-book" },
        { key: "effects",    label: "Efectos",     icon: "fa-bolt", badge: effects || null }
      ];
      return defs.map((tab) => ({ ...tab, active: tab.key === this._tab }));
    }

    /**
     * Banderas booleanas por pestaña.
     * Handlebars no trae un helper de igualdad, así que se precalculan aquí
     * en vez de depender de `{{#if (eq …)}}`, que rompería la plantilla.
     */
    _tabFlags() {
      const flags = {};
      for (const key of ["attributes", "skills", "inventory", "spells", "features", "biography", "effects"]) {
        flags[key] = this._tab === key;
      }
      return flags;
    }

    /* ------------------- Modelo: identidad y vitales -------------------- */

    _buildIdentity() {
      const actor = this.actor;
      const sys = actor.system;
      const classes = actor.itemTypes?.class ?? [];
      const classText = classes
        .map((c) => `${c.name} ${foundry.utils.getProperty(c, "system.levels") ?? ""}`.trim())
        .join(" / ");
      const race = actor.itemTypes?.race?.[0]?.name
        ?? (typeof sys.details?.race === "string" ? sys.details.race : sys.details?.race?.name)
        ?? "";
      const background = actor.itemTypes?.background?.[0]?.name ?? sys.details?.background ?? "";
      const level = sys.details?.level ?? classes.reduce((n, c) => n + (foundry.utils.getProperty(c, "system.levels") ?? 0), 0);

      return {
        name: actor.name,
        level,
        race,
        background,
        classText,
        // "Elfo (Drow) · Pícaro 3 · Nivel 3", como en el diseño de referencia.
        subtitle: [race, classText].filter(Boolean).join(" · "),
        biography: sys.details?.biography?.value ?? ""
      };
    }

    _buildVitals() {
      const sys = this.actor.system;
      const attrs = sys.attributes ?? {};
      const xp = sys.details?.xp ?? {};
      const xpMax = Number(xp.max) || 0;
      const xpValue = Number(xp.value) || 0;

      // Dados de golpe: dnd5e 3.x+ los agrega en attributes.hd; si no, se suman
      // desde las clases para no dejar el bloque vacío.
      let hd = attrs.hd;
      let hdValue = Number(hd?.value);
      let hdMax = Number(hd?.max);
      if (!Number.isFinite(hdValue) || !Number.isFinite(hdMax)) {
        hdValue = 0; hdMax = 0;
        for (const cls of this.actor.itemTypes?.class ?? []) {
          const levels = Number(foundry.utils.getProperty(cls, "system.levels")) || 0;
          const spent = Number(foundry.utils.getProperty(cls, "system.hitDiceUsed")) || 0;
          hdMax += levels;
          hdValue += Math.max(0, levels - spent);
        }
      }
      const denom = (this.actor.itemTypes?.class ?? [])
        .map((c) => foundry.utils.getProperty(c, "system.hitDice") ?? foundry.utils.getProperty(c, "system.hd.denomination"))
        .filter(Boolean)[0] ?? "d8";

      const init = attrs.init?.total ?? attrs.init?.mod ?? 0;

      return {
        prof: attrs.prof ?? sys.attributes?.prof ?? 0,
        init,
        initText: this._signed(init),
        speed: attrs.movement?.walk ?? 0,
        ac: attrs.ac?.value ?? 0,
        xp: { value: xpValue, max: xpMax, pct: xpMax > 0 ? Math.max(0, Math.min(100, (xpValue / xpMax) * 100)) : 0, show: xpMax > 0 },
        death: {
          success: Number(attrs.death?.success) || 0,
          failure: Number(attrs.death?.failure) || 0,
          // Tres casillas por fila, como en la hoja de referencia.
          successBoxes: [1, 2, 3].map((n) => ({ n, on: n <= (Number(attrs.death?.success) || 0) })),
          failureBoxes: [1, 2, 3].map((n) => ({ n, on: n <= (Number(attrs.death?.failure) || 0) }))
        },
        hitDice: { value: hdValue, max: hdMax, denom }
      };
    }

    /* ---------------- Modelo: características y destrezas --------------- */

    _buildAbilities() {
      const sys = this.actor.system;
      const config = CONFIG.DND5E?.abilities ?? {};
      return Object.entries(sys.abilities ?? {}).map(([key, data]) => {
        const label = config[key]?.label ?? config[key] ?? key.toUpperCase();
        const abbr = config[key]?.abbreviation ?? key;
        return {
          key,
          label: typeof label === "string" ? label : key.toUpperCase(),
          abbr: String(abbr).toUpperCase(),
          value: data?.value ?? 10,
          mod: data?.mod ?? 0,
          modText: this._signed(data?.mod ?? 0)
        };
      });
    }

    _buildSaves() {
      const sys = this.actor.system;
      const config = CONFIG.DND5E?.abilities ?? {};
      return Object.entries(sys.abilities ?? {}).map(([key, data]) => {
        const label = config[key]?.label ?? key.toUpperCase();
        return {
          key,
          label: typeof label === "string" ? label : key.toUpperCase(),
          proficient: Number(data?.proficient) > 0,
          total: data?.save?.value ?? data?.save ?? 0,
          totalText: this._signed(data?.save?.value ?? data?.save ?? 0)
        };
      });
    }

    _buildSkills() {
      const sys = this.actor.system;
      const config = CONFIG.DND5E?.skills ?? {};
      const abilityConfig = CONFIG.DND5E?.abilities ?? {};
      return Object.entries(sys.skills ?? {}).map(([key, data]) => {
        const entry = config[key] ?? {};
        const abilityKey = data?.ability ?? entry.ability ?? "int";
        const abbr = abilityConfig[abilityKey]?.abbreviation ?? abilityKey;
        const prof = Number(data?.value) || 0;
        return {
          key,
          label: entry.label ?? key,
          ability: String(abbr).toUpperCase(),
          proficiency: prof,               // 0 ninguna · 0.5 media · 1 competente · 2 experto
          proficient: prof > 0,
          expertise: prof >= 2,
          total: data?.total ?? 0,
          totalText: this._signed(data?.total ?? 0),
          passive: data?.passive ?? 10
        };
      }).sort((a, b) => a.label.localeCompare(b.label, "es"));
    }

    _buildCurrency() {
      const cur = this.actor.system?.currency ?? {};
      // Orden de la hoja de referencia: PP, GP, EP, SP, CP.
      // Los iconos son los que trae el propio sistema dnd5e.
      const art = {
        pp: { file: "platinum", title: "Platino" },
        gp: { file: "gold",     title: "Oro" },
        ep: { file: "electrum", title: "Electro" },
        sp: { file: "silver",   title: "Plata" },
        cp: { file: "copper",   title: "Cobre" }
      };
      return ["pp", "gp", "ep", "sp", "cp"].map((key) => ({
        key,
        label: key.toUpperCase(),
        title: art[key].title,
        icon: `systems/dnd5e/icons/currency/${art[key].file}.webp`,
        value: Number(cur[key]) || 0
      }));
    }

    /* -------------------- Modelo: conjuros y rasgos --------------------- */

    _buildSpellbook() {
      const actor = this.actor;
      const sys = actor.system;
      const spells = (actor.itemTypes?.spell ?? []).slice();

      const levels = new Map();
      for (const spell of spells) {
        const level = Number(foundry.utils.getProperty(spell, "system.level")) || 0;
        if (!levels.has(level)) levels.set(level, []);
        const method = spellMethod(spell);
        const state = spellState(spell);
        const prepares = methodPrepares(method);
        levels.get(level).push({
          id: spell.id,
          uuid: spell.uuid,
          name: spell.name,
          img: spell.img,
          level,
          school: CONFIG.DND5E?.spellSchools?.[foundry.utils.getProperty(spell, "system.school")]?.label
            ?? foundry.utils.getProperty(spell, "system.school") ?? "",
          // Los trucos, los innatos y los «siempre preparados» no llevan casilla.
          alwaysPrepared: state === 2 || !prepares,
          prepared: state >= 1,
          canPrepare: level > 0 && prepares && state !== 2,
          // Un conjuro «activo» se puede lanzar hoy: truco, siempre preparado,
          // innato o marcado. Los demás se pintan apagados.
          active: level === 0 || state >= 1 || !prepares
        });
      }

      const slotFor = (level) => {
        const slot = sys.spells?.[`spell${level}`] ?? {};
        return { value: Number(slot.value) || 0, max: Number(slot.max) || 0 };
      };

      // Orden manual del jugador (arrastrando conjuros). Los que nunca se han
      // movido van detrás, alfabéticamente.
      const order = actor.getFlag(MODULE_ID, "spellOrder") ?? {};
      const rank = (spell) => {
        const value = Number(order[spell.id]);
        return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
      };

      const groups = [...levels.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([level, list]) => ({
          level,
          label: level === 0
            ? (game.i18n.localize("DND5E.SpellCantrip") || "Trucos")
            : `${game.i18n.localize("DND5E.SpellLevel") || "Nivel"} ${level}`,
          slots: level === 0 ? null : slotFor(level),
          spells: list.sort((a, b) => {
            const diff = rank(a) - rank(b);
            return diff !== 0 ? diff : a.name.localeCompare(b.name, "es");
          })
        }));

      // --- Aptitud, CD y ataque ---
      // Se calculan a mano en vez de deducir el ataque de la CD: así valen
      // aunque un efecto toque solo uno de los dos, y recogen los bonos de
      // `system.bonuses.spell.*`.
      const ability = sys.attributes?.spellcasting;
      const abilityConfig = ability ? CONFIG.DND5E?.abilities?.[ability] : null;
      const mod = Number(sys.abilities?.[ability]?.mod) || 0;
      const prof = Number(sys.attributes?.prof) || 0;

      let dc = Number(sys.attributes?.spelldc);
      if (!Number.isFinite(dc) && ability) dc = 8 + prof + mod;

      let attack = null;
      if (ability) {
        attack = prof + mod;
        const bonus = Number(sys.bonuses?.spell?.attack);
        if (Number.isFinite(bonus)) attack += bonus;
      }

      return {
        groups,
        hasSpells: spells.length > 0,
        ability: ability ? (abilityConfig?.abbreviation?.toUpperCase() ?? String(ability).toUpperCase()) : "—",
        abilityFull: abilityConfig?.label ?? "Este personaje no lanza conjuros",
        dc: Number.isFinite(dc) ? dc : "—",
        attack: attack === null ? "—" : this._signed(attack),
        canRollAttack: attack !== null,
        slots: this._buildSpellSlots(),
        // Niveles con espacios, para las fichas de filtro.
        filters: [
          { level: "all", label: "Todos", has: true, active: this._spellLevel === "all" },
          ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
            level: n,
            label: n === 0 ? "Trucos" : `${n}º`,
            has: levels.has(n),
            active: this._spellLevel === String(n)
          }))
        ]
      };
    }

    /**
     * Espacios de conjuro con sus llamitas, incluidos los de pacto.
     * Solo se listan los niveles en los que el personaje tiene algo.
     */
    _buildSpellSlots() {
      const spells = this.actor.system?.spells ?? {};
      const rows = [];

      const push = (key, label, slot) => {
        const max = Number(slot?.max) || 0;
        if (max <= 0) return;
        const value = Math.max(0, Math.min(max, Number(slot.value) || 0));
        rows.push({
          key, label, value, max,
          pips: Array.from({ length: max }, (_v, index) => ({ index, filled: index < value }))
        });
      };

      for (let level = 1; level <= 9; level++) {
        push(`spell${level}`, `Nivel ${level}`, spells[`spell${level}`]);
      }
      const pact = spells.pact;
      if (pact) push("pact", `Pacto (nivel ${pact.level ?? "?"})`, pact);

      return rows;
    }

    /**
     * Botonera de filtro. Se cuenta cuántos objetos hay en cada grupo para
     * poder apagar los que están vacíos en vez de dejarlos engañando.
     */
    _buildFilters(tiles) {
      const counts = new Map();
      for (const tile of tiles) counts.set(tile.group, (counts.get(tile.group) ?? 0) + 1);
      return ITEM_GROUPS.map((group) => ({
        ...group,
        count: group.key === "all" ? tiles.length : (counts.get(group.key) ?? 0),
        empty: group.key !== "all" && !counts.has(group.key),
        active: this._filter === group.key
      }));
    }

    /**
     * Sintonización: cuántos objetos lleva sintonizados y cuántos admite.
     * El máximo sale de `system.attributes.attunement.max`, que dnd5e deja
     * en 3 salvo que un rasgo lo suba.
     */
    _buildAttunement() {
      const attr = this.actor.system?.attributes?.attunement ?? {};
      const max = Number(attr.max);
      const items = this.actor.items.filter(
        (item) => foundry.utils.getProperty(item, "system.attuned") === true
      );
      const limit = Number.isFinite(max) ? max : 3;
      return {
        value: items.length,
        max: limit,
        over: items.length > limit,
        names: items.map((item) => item.name).join(", ")
      };
    }

    /**
     * Datos base del personaje que faltaban en la pestaña de Atributos:
     * sentidos, clases con su subclase, especie, trasfondo, defensas y
     * competencias. Todo sale del actor, así que se mantiene solo.
     */
    _buildDetails() {
      const actor = this.actor;
      const sys = actor.system ?? {};

      // --- Sentidos ---
      const senses = sys.attributes?.senses ?? {};
      const units = senses.units ?? "ft";
      const senseLabels = {
        darkvision: "Visión en la oscuridad",
        blindsight: "Visión ciega",
        tremorsense: "Sentido sísmico",
        truesight: "Visión verdadera"
      };
      const senseList = Object.entries(senseLabels)
        .filter(([key]) => Number(senses[key]) > 0)
        .map(([key, label]) => `${label} ${senses[key]} ${units}`);
      if (senses.special) senseList.push(String(senses.special));

      // --- Clases y subclases ---
      const classes = Object.values(actor.classes ?? {}).map((cls) => ({
        id: cls.id,
        name: cls.name,
        img: cls.img,
        levels: Number(cls.system?.levels) || 0,
        subclass: cls.subclass ? { id: cls.subclass.id, name: cls.subclass.name } : null
      }));

      // --- Especie y trasfondo ---
      let species = null;
      let background = null;
      for (const item of actor.items) {
        if (!species && (item.type === "race" || item.type === "species")) {
          species = { id: item.id, name: item.name, img: item.img };
        }
        if (!background && item.type === "background") {
          background = { id: item.id, name: item.name, img: item.img };
        }
      }

      // --- Defensas (resistencias, inmunidades, vulnerabilidades) ---
      const defenseMap = [
        ["dr", "Resistencias", CONFIG.DND5E?.damageTypes],
        ["di", "Inmunidades", CONFIG.DND5E?.damageTypes],
        ["dv", "Vulnerabilidades", CONFIG.DND5E?.damageTypes],
        ["ci", "Inmune a estados", CONFIG.DND5E?.conditionTypes]
      ];
      const defenses = [];
      for (const [key, label, config] of defenseMap) {
        const values = this._traitValues(sys.traits?.[key], config);
        if (values.length) defenses.push({ label, values: values.join(", ") });
      }

      // --- Competencias ---
      const profMap = [
        ["languages", "Idiomas", "fa-language", CONFIG.DND5E?.languages],
        ["armorProf", "Armadura", "fa-shield-halved", CONFIG.DND5E?.armorProficiencies],
        ["weaponProf", "Armas", "fa-sword", CONFIG.DND5E?.weaponProficiencies]
      ];
      const proficiencies = [];
      for (const [key, label, icon, config] of profMap) {
        const values = this._traitValues(sys.traits?.[key], config);
        if (values.length) proficiencies.push({ label, icon, values: values.join(", ") });
      }
      // Las herramientas viven aparte desde dnd5e 4.x (`system.tools`).
      const tools = Object.keys(sys.tools ?? {}).map((key) => {
        const config = CONFIG.DND5E?.tools?.[key];
        return config?.label ?? game.i18n.localize(`DND5E.Tool${key.capitalize?.() ?? key}`) ?? key;
      }).filter((label) => label && !label.startsWith("DND5E."));
      if (tools.length) proficiencies.push({ label: "Herramientas", icon: "fa-wrench", values: tools.join(", ") });

      return {
        senses: senseList,
        classes,
        species,
        background,
        defenses,
        proficiencies,
        alignment: sys.details?.alignment ?? "",
        size: CONFIG.DND5E?.actorSizes?.[sys.traits?.size]?.label ?? ""
      };
    }

    /**
     * Traduce un rasgo de dnd5e (`{value: Set, custom: "a;b"}`) a etiquetas
     * legibles. Sirve tanto para defensas como para competencias.
     */
    _traitValues(trait, config) {
      if (!trait) return [];
      const out = [];
      const raw = trait.value;
      const list = raw instanceof Set ? [...raw] : (Array.isArray(raw) ? raw : []);
      for (const key of list) {
        const entry = config?.[key];
        const label = typeof entry === "object" ? (entry?.label ?? key) : (entry ?? key);
        out.push(game.i18n.localize(label));
      }
      if (trait.custom) {
        for (const piece of String(trait.custom).split(";")) {
          const text = piece.trim();
          if (text) out.push(text);
        }
      }
      return out;
    }

    /**
     * Resumen de combate del pie del inventario: CA, el daño de lo que lleva
     * empuñado, y las CD que dependen de la clase.
     */
    _buildCombatSummary() {
      const sys = this.actor.system ?? {};
      const prof = Number(sys.attributes?.prof) || 0;

      // --- Daño de las armas equipadas ---
      const weapons = [];
      for (const item of this.actor.items) {
        if (item.type !== "weapon") continue;
        if (foundry.utils.getProperty(item, "system.equipped") !== true) continue;

        // Desde dnd5e 4/5 el ataque vive en una Activity. Sus etiquetas ya
        // incluyen competencia, aptitud, bonificadores y efectos del actor.
        const activities = item.system?.activities;
        const activityList = activities?.contents
          ?? (Array.isArray(activities) ? activities : activities ? [...activities] : []);
        const attackActivity = activityList.find((activity) => activity?.type === "attack")
          ?? activityList.find((activity) => activity?.attack);
        const attack = attackActivity?.labels?.modifier
          ?? attackActivity?.labels?.toHit
          ?? item.labels?.toHit
          ?? null;

        const labelledDamages = item.labels?.damages ?? [];
        let formula = labelledDamages.map((damage) => damage?.formula ?? damage).filter(Boolean).join(" + ");
        if (!formula && attackActivity?.labels?.damage) formula = String(attackActivity.labels.damage);
        if (!formula) {
          const parts = attackActivity?.damage?.parts?.contents
            ?? attackActivity?.damage?.parts
            ?? [];
          const list = Array.isArray(parts) ? parts : [...parts];
          formula = list.map((part) => {
            if (typeof part === "string") return part;
            if (Array.isArray(part)) return part[0];
            return part?.formula ?? part?.custom?.formula ?? "";
          }).filter(Boolean).join(" + ");
        }
        weapons.push({
          id: item.id,
          activityId: attackActivity?.id ?? attackActivity?._id ?? null,
          name: item.name,
          img: item.img,
          attack: attack ? String(attack).trim() : null,
          damage: formula || "—"
        });
      }

      // --- CD de conjuro / de rasgos de clase ---
      const casting = sys.attributes?.spellcasting;
      const saveDcs = [];
      if (casting) {
        const dc = Number(sys.attributes?.spelldc);
        saveDcs.push({
          label: "CD de conjuros",
          ability: CONFIG.DND5E?.abilities?.[casting]?.abbreviation?.toUpperCase() ?? casting.toUpperCase(),
          value: Number.isFinite(dc) ? dc : 8 + prof + (Number(sys.abilities?.[casting]?.mod) || 0)
        });
      }
      // Sin lanzamiento de conjuros, la CD que importa es la de los rasgos de
      // clase (Aliento del dragón, Maniobras…). Se calcula con la mejor
      // característica en la que el personaje sea competente en salvación.
      const fallback = this._classSaveAbility();
      if (fallback) {
        saveDcs.push({
          label: casting ? "CD de rasgos" : "CD de habilidades",
          ability: CONFIG.DND5E?.abilities?.[fallback]?.abbreviation?.toUpperCase() ?? fallback.toUpperCase(),
          value: 8 + prof + (Number(sys.abilities?.[fallback]?.mod) || 0)
        });
      }

      return {
        ac: sys.attributes?.ac?.value ?? "—",
        prof: this._signed(prof),
        initiative: this._signed(sys.attributes?.init?.total ?? sys.abilities?.dex?.mod ?? 0),
        weapons,
        saveDcs
      };
    }

    /**
     * Característica con la que un personaje sin conjuros calcula la CD de
     * sus rasgos: la de mayor modificador entre aquellas en las que tiene
     * competencia en salvación (un guerrero suele dar FUE o CON).
     */
    _classSaveAbility() {
      const abilities = this.actor.system?.abilities ?? {};
      let best = null;
      for (const [key, data] of Object.entries(abilities)) {
        if (!Number(data?.proficient)) continue;
        if (!best || Number(data.mod) > Number(abilities[best].mod)) best = key;
      }
      return best;
    }

    _buildFeatures() {
      const feats = (this.actor.itemTypes?.feat ?? []).slice();
      const toEntry = (item) => {
        const uses = foundry.utils.getProperty(item, "system.uses") ?? {};
        const max = Number(uses.max) || 0;
        const spent = Number(uses.spent);
        const value = Number.isFinite(Number(uses.value)) ? Number(uses.value) : (max - (Number.isFinite(spent) ? spent : 0));
        return {
          id: item.id,
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          hasUses: max > 0,
          uses: { value: Math.max(0, value), max },
          type: foundry.utils.getProperty(item, "system.type.value") ?? "",
          requirements: foundry.utils.getProperty(item, "system.requirements") ?? ""
        };
      };

      // "Activo" = tiene tipo de activación (acción, bonus, reacción…).
      const isActive = (item) => {
        const activation = foundry.utils.getProperty(item, "system.activation.type");
        return Boolean(activation) && activation !== "none";
      };

      const active = feats.filter(isActive).map(toEntry).sort((a, b) => a.name.localeCompare(b.name, "es"));
      const passive = feats.filter((i) => !isActive(i)).map(toEntry).sort((a, b) => a.name.localeCompare(b.name, "es"));
      return {
        active, passive, total: feats.length,
        tree: this._buildFeatureTree(feats, toEntry, isActive)
      };
    }

    /* ------------------------ Árbol de rasgos -------------------------- */

    /**
     * Nivel al que el personaje obtuvo un rasgo.
     *
     * dnd5e marca cada objeto concedido por la progresión con la bandera
     * `advancementOrigin` = "<idDeLaClase>.<idDelAvance>". Con ella se llega al
     * avance concreto de la clase, que sabe en qué niveles actúa. Si el rasgo
     * se añadió a mano, se intenta leer el número de `system.requirements`
     * («Explorador 3»), y si tampoco hay nada se deja sin nivel.
     *
     * @returns {number|null}
     */
    _featureLevel(item) {
      const origin = item.getFlag?.("dnd5e", "advancementOrigin");
      if (origin) {
        const [grantingId, advancementId] = String(origin).split(".");
        const granting = this.actor.items.get(grantingId);
        const advancement = granting?.advancement?.byId?.[advancementId];
        const levels = advancement?.levels ?? [];
        if (levels.length) {
          // Un avance puede repetirse en varios niveles; nos quedamos con el
          // primero que el personaje ya haya alcanzado en esa clase.
          const classLevel = Number(granting?.system?.levels)
            || Number(this.actor.system?.details?.level) || 0;
          const reached = levels.filter((l) => l <= classLevel);
          const level = reached.length ? Math.min(...reached) : Math.min(...levels);
          // La especie y el trasfondo conceden en el nivel 0, porque van antes
          // de la clase. En un árbol que empieza en 1, ese es su sitio.
          return Math.max(1, level);
        }
        // Sin avance configurado, especie y trasfondo siguen siendo de nivel 1.
        if (granting && ["race", "species", "background"].includes(granting.type)) return 1;
      }

      const requirements = String(foundry.utils.getProperty(item, "system.requirements") ?? "");
      const match = requirements.match(/(\d+)/);
      if (match) {
        const level = Number(match[1]);
        if (level >= 1 && level <= 20) return level;
      }
      return null;
    }

    /**
     * Lo que cada clase concederá en los niveles que aún no tiene. Se lee de
     * los avances de la propia clase, así que vale para cualquier clase,
     * incluidas las de módulos de terceros.
     *
     * @returns {Map<number, object[]>} nivel → rasgos futuros
     */
    _upcomingByLevel() {
      const upcoming = new Map();
      const add = (level, entry) => {
        if (!upcoming.has(level)) upcoming.set(level, []);
        const list = upcoming.get(level);
        // Sin duplicados: dos clases pueden dar «Mejora de característica».
        if (!list.some((e) => e.name === entry.name)) list.push(entry);
      };

      for (const source of this.actor.items) {
        if (!["class", "subclass"].includes(source.type)) continue;
        const owned = Number(source.system?.levels) || 0;
        const byLevel = source.advancement?.byLevel ?? {};

        for (const [rawLevel, advancements] of Object.entries(byLevel)) {
          const level = Number(rawLevel);
          if (!Number.isFinite(level) || level <= owned || level > 20) continue;

          for (const advancement of advancements) {
            // El tipo va en el propio dato (`advancement.type`), no en el
            // nombre de la clase: el sistema viene empaquetado y un renombrado
            // dejaría inservible cualquier comprobación por constructor.
            const type = advancement?.type ?? advancement?.constructor?.typeName ?? "";
            if (SKIPPED_ADVANCEMENTS.includes(type)) continue;

            // Un avance que concede objetos ya sabe cuáles: se muestran por su
            // nombre real, leído del índice del compendio.
            const grants = advancement?.configuration?.items;
            if (Array.isArray(grants) && grants.length) {
              for (const grant of grants) {
                const doc = this._peekUuid(grant?.uuid);
                add(level, {
                  name: doc?.name ?? advancement.title ?? "Rasgo",
                  img: doc?.img ?? advancement.icon ?? DEFAULT_ADVANCEMENT_ICON,
                  source: source.name,
                  optional: grant?.optional === true
                });
              }
              continue;
            }

            // El resto (elegir un rasgo, mejora de característica…) se anuncia
            // con su título, que ya viene traducido.
            const raw = advancement.titleForLevel?.(level, { configMode: true }) ?? advancement.title;
            const title = String(raw ?? "").replace(/<[^>]*>/g, "").trim();
            if (!title) continue;
            add(level, {
              name: title,
              img: advancement.icon ?? DEFAULT_ADVANCEMENT_ICON,
              source: source.name,
              optional: false
            });
          }
        }
      }
      return upcoming;
    }

    /**
     * Lee un UUID sin cargar el documento (usa el índice del compendio).
     * Devuelve null si el compendio no está disponible.
     */
    _peekUuid(uuid) {
      if (!uuid) return null;
      try { return fromUuidSync(uuid) ?? null; }
      catch (_error) { return null; }
    }

    /**
     * Árbol de niveles 1–20. Cada nivel trae lo que el personaje ya ganó y,
     * en gris, lo que le queda por ganar.
     */
    _buildFeatureTree(feats, toEntry, isActive) {
      const currentLevel = Number(this.actor.system?.details?.level) || 1;
      const maxLevel = Number(CONFIG.DND5E?.maxLevel) || 20;

      // --- Lo que ya tiene, repartido por nivel ---
      const owned = new Map();
      const looseFeats = [];
      for (const item of feats) {
        const level = this._featureLevel(item);
        const entry = { ...toEntry(item), owned: true, active: isActive(item) };
        if (level === null) { looseFeats.push(entry); continue; }
        if (!owned.has(level)) owned.set(level, []);
        owned.get(level).push(entry);
      }

      const upcoming = this._upcomingByLevel();

      // --- Un peldaño por nivel ---
      const levels = [];
      for (let level = 1; level <= maxLevel; level++) {
        const reached = level <= currentLevel;
        const nodes = [
          ...(owned.get(level) ?? []).sort((a, b) => a.name.localeCompare(b.name, "es")),
          ...(upcoming.get(level) ?? []).map((entry) => ({ ...entry, owned: false }))
        ];
        // Los niveles futuros vacíos no aportan nada; los alcanzados sí se
        // muestran aunque estén vacíos, para no romper la escalera.
        if (!nodes.length && !reached) continue;
        levels.push({ level, reached, current: level === currentLevel, nodes, empty: !nodes.length });
      }

      return {
        currentLevel,
        maxLevel,
        levels,
        loose: looseFeats.sort((a, b) => a.name.localeCompare(b.name, "es")),
        // Cuántos rasgos futuros se conocen, para avisar si no hay ninguno.
        upcomingCount: [...upcoming.values()].reduce((sum, list) => sum + list.length, 0)
      };
    }

    _buildEffects() {
      const actor = this.actor;
      let list = [];
      try {
        // dnd5e 3.x+ agrega también los efectos que transfieren los objetos.
        list = typeof actor.allApplicableEffects === "function"
          ? [...actor.allApplicableEffects()]
          : [...actor.effects];
      }
      catch (_error) { list = [...actor.effects]; }

      return list.map((effect) => ({
        id: effect.id,
        uuid: effect.uuid,
        name: effect.name ?? effect.label,
        img: effect.img ?? effect.icon,
        disabled: Boolean(effect.disabled),
        suppressed: effect.isSuppressed === true,
        editable: effect.isOwner === true,
        fromItem: effect.parent !== actor,
        source: effect.parent?.documentName === "Item" ? (effect.parent?.name ?? "") : ""
      })).sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
    }

    /** "+3" / "-1" / "+0" */
    _signed(value) {
      const number = Number(value) || 0;
      return `${number >= 0 ? "+" : ""}${number}`;
    }

    _tileData(item) {
      const qty = Number(foundry.utils.getProperty(item, "system.quantity") ?? 1);
      const rarity = rarityInfo(item);
      const footprint = itemFootprint(item, Boolean(game.settings.get(MODULE_ID, "bulkyItems")));
      const iconClass = footprint.h > footprint.w
        ? "sss-icon-portrait"
        : footprint.w > footprint.h
          ? "sss-icon-landscape"
          : "sss-icon-square";
      return {
        id: item.id,
        uuid: item.uuid,
        img: String(item.img ?? "").trim() || "icons/svg/item-bag.svg",
        name: item.name,
        qty: qty > 1 ? qty : null,
        iconClass,
        iconW: footprint.w,
        iconH: footprint.h,
        // Grupo para el filtro de la barra que hay sobre la grilla.
        group: itemGroup(item),
        rarity: rarity.show ? rarity : null,
        attuned: foundry.utils.getProperty(item, "system.attuned") === true
      };
    }

    /* ---------------------------- Cabecera ----------------------------- */

    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();
      buttons.unshift({
        label: game.i18n.localize("SSSHEET.FullSheet"),
        class: "sss-open-full",
        icon: "fas fa-book-open",
        onclick: () => this._openFullSheet()
      });
      return buttons;
    }

    _openFullSheet() {
      try {
        play("snd_button_click.wav");
        const sheets = CONFIG.Actor?.sheetClasses?.character ?? {};
        const tidy = Object.entries(sheets).find(([k]) => k.startsWith("tidy5e-sheet."))?.[1];
        const fallback =
          sheets["dnd5e.ActorSheet5eCharacter2"] ??
          sheets["dnd5e.CharacterActorSheet"] ??
          Object.values(sheets).find((s) => !String(s.id ?? "").startsWith(MODULE_ID));
        const entry = tidy ?? fallback;
        if (!entry?.cls) return ui.notifications?.warn("No encontré otra hoja registrada.");
        let app;
        try {
          app = new entry.cls(this.actor, { id: `sss-full-${this.actor.id}` });
        } catch {
          app = new entry.cls({ document: this.actor, id: `sss-full-${this.actor.id}` });
        }
        app.render(true);
      } catch (error) {
        console.error(`${MODULE_ID} | hoja completa`, error);
        ui.notifications?.warn("No fue posible abrir la otra hoja. Cámbiala desde la configuración de hoja del actor.");
      }
    }

    /* ---------------------------- Listeners ---------------------------- */

    activateListeners(html) {
      try { super.activateListeners(html); } catch (e) { /* la base busca selectores propios */ }
      const root = html instanceof HTMLElement ? html : html?.[0];
      if (!root) return;

      // Foundry desactiva todos los botones si el usuario no es dueño (p. ej.
      // un jugador en el Symbiote); la navegación solo cambia la vista.
      if (!this.isEditable) {
        root.querySelectorAll("[data-sss-tab], [data-action='sss-toggle-doll'], [data-action='sss-filter'], input[data-sss-filter]")
          .forEach((el) => { el.disabled = false; });
      }
      try { this._sssApplyLayout(); } catch (e) { console.warn(MODULE_ID, "layout", e); }

      this._bindImageFallbacks(root);
      this._bindPortraitFraming(root);

      // abrir / usar
      root.querySelectorAll("[data-sss-item]").forEach((el) => {
        const id = el.dataset.sssItem;
        el.addEventListener("click", (ev) => {
          if (ev.detail > 1) return;
          this.actor.items.get(id)?.sheet?.render(true);
        });
        el.addEventListener("dblclick", async (ev) => {
          ev.preventDefault();
          const item = this.actor.items.get(id);
          if (!item) return;
          const s = useSoundFor(item);
          try { await item.use(); if (s) play(s); } catch {}
        });
        el.addEventListener("dragstart", (ev) => {
          const item = this.actor.items.get(id);
          if (!item) return;
          // Se guarda aparte porque el contenido del dataTransfer no se puede
          // leer durante el `dragover`, y la silueta lo necesita.
          this._draggingItem = item;
          ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
          // «copyMove», no «move»: el directorio de objetos, los compendios y
          // la barra de macros piden `copy` al pasar por encima, y el
          // navegador cancela el soltado si no está permitido. Con solo
          // «move» no se podía sacar nada de la hoja.
          ev.dataTransfer.effectAllowed = "copyMove";
          play(pickSoundFor(item));
        });
        el.addEventListener("dragend", () => { this._draggingItem = null; });
        el.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const item = this.actor.items.get(id);
          if (!item) return;
          this._hideTooltip();
          this._openContextMenu(ev, item);
        });
        el.addEventListener("mouseenter", (ev) => this._showTooltip(ev, id));
        el.addEventListener("mouseleave", () => this._hideTooltip());
      });

      // grilla
      const grid = root.querySelector("[data-sss-grid]");
      if (grid) {
        grid.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          // Si el origen solo permite copiar (un compendio, por ejemplo),
          // pedir «move» haría que el navegador rechazara el soltado.
          ev.dataTransfer.dropEffect = ev.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
          this._showDropGhost(ev, grid);
        });
        grid.addEventListener("dragleave", (ev) => {
          if (!grid.contains(ev.relatedTarget)) this._clearDropGhost(grid);
        });
        grid.addEventListener("drop", (ev) => this._onGridDrop(ev, grid));
        // Clic DERECHO en hueco vacío: crear un objeto ahí mismo.
        grid.addEventListener("contextmenu", (ev) => {
          if (ev.target.closest("[data-sss-item]")) return;
          ev.preventDefault();
          this._createItemAt(ev, grid);
        });
      }

      // Clic derecho sobre una llamita devuelve el espacio de conjuro.
      root.querySelectorAll("[data-action='sss-slot-pip']").forEach((pip) => {
        pip.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this._spendSlot(pip.dataset.key, Number(pip.dataset.index), true);
        });
      });

      // Sonido de monedas al cambiar el dinero: suben o bajan según el caso.
      root.querySelectorAll(".sss-coins input").forEach((input) => {
        const before = Number(input.value) || 0;
        input.addEventListener("change", () => {
          const after = Number(input.value) || 0;
          if (after === before) return;
          play(after > before ? "snd_gui_pick_gold.wav" : "snd_gui_drop_gold_1.wav");
        });
      });

      // Conjuros: reordenar arrastrando y menú de clic derecho.
      this._activateSpellListeners(root);

      // El filtro sobrevive al redibujado, así que hay que volver a aplicarlo.
      if (this._filter !== "all") {
        for (const tile of root.querySelectorAll("[data-sss-grid] [data-sss-item]")) {
          tile.classList.toggle("is-dimmed", tile.dataset.group !== this._filter);
        }
      }

      // slots
      root.querySelectorAll("[data-sss-slot]").forEach((el) => {
        const key = el.dataset.sssSlot;
        el.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          // Se avisa en rojo si el objeto no encaja en esa ranura, en vez de
          // dejar que el jugador lo suelte y no pase nada.
          const fits = !this._draggingItem || slotAccepts(key, this._draggingItem);
          el.classList.add("sss-over");
          el.classList.toggle("sss-over-bad", !fits);
        });
        el.addEventListener("dragleave", () => el.classList.remove("sss-over", "sss-over-bad"));
        el.addEventListener("drop", (ev) => {
          el.classList.remove("sss-over", "sss-over-bad");
          this._onSlotDrop(ev, key);
        });
        el.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this._unequipSlot(key); });
      });

      this._activateSheetListeners(root);

      // La grilla se mide después de pintar, para que el ancho sea el real.
      requestAnimationFrame(() => this._fitGrid(root));
      this._watchGridSize(root);
    }

    setPosition(pos) {
      const result = super.setPosition(pos);
      try { this._sssApplyLayout(); } catch (e) { console.warn(MODULE_ID, "layout", e); }
      return result;
    }

    /**
     * Una sola columna si el ajuste lo pide, si estamos en el Symbiote de
     * TaleSpire (su ajuste de cliente es independiente) o si la ventana es
     * estrecha. En TaleSpire además se encoge la ventana al ancho del panel.
     */
    _sssApplyLayout() {
      const win = this.element?.[0] ?? this.element;
      if (!(win instanceof HTMLElement)) return;
      const narrow = narrowClient();
      const w = win.offsetWidth || this.position?.width || 0;
      const compact = narrow || sheetLayout() === "symbiote-optimized" || (w > 0 && w < 760);
      if (narrow && !this._sssFitting && (this.position?.width ?? 0) > compactWidth() + 1) {
        this._sssFitting = true;
        try {
          const width = compactWidth();
          this.setPosition({ width, left: Math.max(0, Math.min(this.position.left ?? 0, window.innerWidth - width)) });
        } finally { this._sssFitting = false; }
        return;
      }
      win.classList.toggle("sss-layout-symbiote", compact);
      win.querySelector(".sss-stage-art")?.classList.toggle("sss-has-doll", !!win.querySelector(".sss-doll-overlay"));
    }

    /* --------------------- Interacción de la hoja ---------------------- */

    /** Navegación, tiradas, usos y acciones del raíl. */
    _activateSheetListeners(root) {
      // --- Pestañas ---
      root.querySelectorAll("[data-sss-tab]").forEach((el) => {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          const tab = el.dataset.sssTab;
          if (!tab || tab === this._tab) return;
          this._tab = tab;
          play("snd_button_click.wav");
          this.render(false);
        });
      });

      // --- Acciones con `data-action` ---
      const on = (action, handler) => {
        root.querySelectorAll(`[data-action="${action}"]`).forEach((el) => {
          el.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            try { await handler(el, event); }
            catch (error) {
              console.error(`${MODULE_ID} | Error en "${action}"`, error);
              ui.notifications?.warn("No fue posible completar la acción.");
            }
          });
        });
      };

      on("sss-toggle-doll", () => {
        if (this._tab === "inventory") return;
        this._showDoll = !this._showDoll;
        this.render(false);
      });
      on("sss-configure", () => this._openFullSheet());
      on("sss-portrait", () => this._pickPortrait());
      on("sss-adjust-portrait", () => this._adjustPortrait());
      on("sss-portrait-reset", () => this._resetPortrait());

      on("sss-roll-ability", (el) => this._rollAbility(el.dataset.ability, "check"));
      on("sss-roll-save", (el) => this._rollAbility(el.dataset.ability, "save"));
      on("sss-roll-skill", (el) => this._rollSkill(el.dataset.skill));
      on("sss-initiative", () => this.actor.rollInitiative?.({ createCombatants: true }));
      on("sss-roll-death", () => this._rollDeathSave());

      on("sss-short-rest", () => this.actor.shortRest?.());
      on("sss-long-rest", () => this.actor.longRest?.());

      on("sss-death", (el) => this._setDeathSaves(el.dataset.kind, Number(el.dataset.n)));
      on("sss-use", (el) => this._useItem(el.dataset.itemId));
      on("sss-use-activity", (el) => this._useActivity(el.dataset.itemId, el.dataset.activityId));
      on("sss-filter", (el) => this._applyFilter(el.dataset.group, root));
      on("sss-spell-level", (el) => this._applySpellLevel(el.dataset.level, root));
      on("sss-slot-pip", (el) => this._spendSlot(el.dataset.key, Number(el.dataset.index), false));
      on("sss-roll-spell-attack", () => this._rollSpellAttack());
      on("sss-special-traits", () => this._openSpecialTraits());
      on("sss-edit-item", (el) => this.actor.items.get(el.dataset.itemId)?.sheet?.render(true));
      on("sss-cycle-loadout", (el) => this._cycleLoadout(1, el));
      on("sss-prepare", (el) => this._togglePrepared(el.dataset.itemId));
      on("sss-create-effect", () => this._createEffect());
      on("sss-toggle-effect", (el) => this._toggleEffect(el.dataset.effectUuid));
      on("sss-edit-effect", (el) => this._editEffect(el.dataset.effectUuid));
      on("sss-delete-effect", (el) => this._deleteEffect(el.dataset.effectUuid));
      on("sss-adjust-coins", (el) => this._adjustCoins(el.dataset.mode));
      on("sss-give-coins", () => this._giveCoins());
      on("sss-convert-coins", () => this._convertCoins());

      // --- Buscadores de conjuros y rasgos ---
      root.querySelectorAll("[data-sss-filter]").forEach((input) => {
        input.addEventListener("input", () => {
          const needle = input.value.trim().toLowerCase();
          const panel = input.closest("[data-sss-tabpanel]");
          if (!panel) return;
          for (const row of panel.querySelectorAll("[data-sss-entry]")) {
            const name = (row.dataset.name ?? "").toLowerCase();
            row.classList.toggle("is-hidden", Boolean(needle) && !name.includes(needle));
          }
          // Oculta los bloques y los peldaños del árbol que se quedan sin
          // nada visible, para que buscar no deje una escalera de huecos.
          for (const block of panel.querySelectorAll(".sss-block, .sss-tier")) {
            const rows = block.querySelectorAll("[data-sss-entry]");
            if (!rows.length) {
              // Un peldaño sin rasgos solo tiene sentido cuando no se busca.
              if (block.classList.contains("sss-tier")) block.classList.toggle("is-hidden", Boolean(needle));
              continue;
            }
            const visible = [...rows].some((row) => !row.classList.contains("is-hidden"));
            block.classList.toggle("is-hidden", !visible);
          }
        });
      });
    }

    /* ---------------------------- Tiradas ------------------------------ */

    /**
     * Prueba o salvación de característica.
     * dnd5e cambió los nombres entre 3.x y 4/5.x, así que se prueban en orden
     * y se cae al primero disponible.
     */
    async _rollAbility(ability, kind) {
      if (!ability) return;
      const actor = this.actor;
      const names = kind === "save"
        ? ["rollSavingThrow", "rollAbilitySave"]
        : ["rollAbilityCheck", "rollAbilityTest"];
      for (const name of names) {
        if (typeof actor[name] === "function") {
          // 4.x/5.x esperan un objeto de configuración; 3.x, la clave suelta.
          try { return await actor[name]({ ability }); }
          catch (_error) { return await actor[name](ability); }
        }
      }
      ui.notifications?.warn("Este sistema no expone tiradas de característica.");
    }

    async _rollSkill(skill) {
      if (!skill) return;
      const actor = this.actor;
      if (typeof actor.rollSkill === "function") {
        try { return await actor.rollSkill({ skill }); }
        catch (_error) { return await actor.rollSkill(skill); }
      }
      ui.notifications?.warn("Este sistema no expone tiradas de habilidad.");
    }

    async _rollDeathSave() {
      const actor = this.actor;
      for (const name of ["rollDeathSave", "rollDeath"]) {
        if (typeof actor[name] === "function") {
          try { return await actor[name]({}); }
          catch (_error) { return await actor[name](); }
        }
      }
    }

    /** Marca N éxitos/fallos; volver a pulsar la última casilla la desmarca. */
    async _setDeathSaves(kind, n) {
      if (!["success", "failure"].includes(kind) || !Number.isFinite(n)) return;
      const path = `system.attributes.death.${kind}`;
      const current = Number(foundry.utils.getProperty(this.actor, path)) || 0;
      const next = current === n ? n - 1 : n;
      await this.actor.update({ [path]: Math.max(0, Math.min(3, next)) });
    }

    /* ------------------------ Objetos y efectos ------------------------ */

    async _useItem(itemId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;
      const sound = useSoundFor(item);
      if (typeof item.use === "function") await item.use();
      else item.sheet?.render(true);
      if (sound) play(sound);
    }

    async _useActivity(itemId, activityId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;
      const activities = item.system?.activities;
      const activity = activities?.get?.(activityId)
        ?? activities?.contents?.find?.((entry) => entry.id === activityId || entry._id === activityId)
        ?? null;
      if (activity && typeof activity.use === "function") return activity.use();
      return this._useItem(itemId);
    }

    async _togglePrepared(itemId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;
      await item.update(preparedUpdate(item, spellState(item) < 1));
      play("snd_button_click.wav");
    }

    async _resolveEffect(effectUuid) {
      if (!effectUuid) return null;
      try {
        const resolved = await fromUuid(effectUuid);
        if (resolved?.documentName === "ActiveEffect") return resolved;
      } catch (_error) { /* Se prueba la colección local. */ }
      const direct = this.actor.effects.get(effectUuid);
      if (direct) return direct;
      try {
        const all = typeof this.actor.allApplicableEffects === "function"
          ? [...this.actor.allApplicableEffects()]
          : [];
        return all.find((entry) => entry.uuid === effectUuid || entry.id === effectUuid) ?? null;
      } catch (_error) { return null; }
    }

    async _createEffect() {
      if (!this.actor?.isOwner) return ui.notifications?.warn("No tienes permiso para agregar efectos.");
      const [effect] = await this.actor.createEmbeddedDocuments("ActiveEffect", [{
        name: "Nuevo efecto",
        label: "Nuevo efecto",
        img: "icons/svg/aura.svg",
        origin: this.actor.uuid,
        disabled: false
      }]);
      effect?.sheet?.render(true);
    }

    async _toggleEffect(effectUuid) {
      const effect = await this._resolveEffect(effectUuid);
      if (!effect?.isOwner) return ui.notifications?.warn("No puedes modificar este efecto.");
      await effect.update({ disabled: !effect.disabled });
      this.render(false);
    }

    async _editEffect(effectUuid) {
      const effect = await this._resolveEffect(effectUuid);
      if (!effect?.isOwner) return;
      effect.sheet?.render(true);
    }

    async _deleteEffect(effectUuid) {
      const effect = await this._resolveEffect(effectUuid);
      if (!effect?.isOwner) return;
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const confirmed = DialogV2?.confirm
        ? await DialogV2.confirm({
            window: { title: "Borrar efecto" },
            content: `<p>¿Borrar <strong>${foundry.utils.escapeHTML(effect.name ?? "este efecto")}</strong>?</p>`,
            rejectClose: false
          })
        : globalThis.confirm?.(`¿Borrar ${effect.name ?? "este efecto"}?`);
      if (!confirmed) return;
      await effect.delete();
      this.render(false);
    }

    /* ------------------------ Favoritos y anclados --------------------- */

    /**
     * Referencia del objeto tal y como la guarda dnd5e en `system.favorites`
     * (un UUID relativo al actor, del tipo `.Item.abc123`).
     */
    _favoriteId(item) {
      try { return item.getRelativeUUID(this.actor); }
      catch (_error) { return `.Item.${item.id}`; }
    }

    /**
     * Favoritos NATIVOS de dnd5e, no una lista propia: así el objeto marcado
     * aquí también sale marcado en la hoja del sistema, en Tidy 5e y en el
     * Combat Hub (que puede filtrar sus rasgos por favoritos).
     */
    _isFavorite(item) {
      const id = this._favoriteId(item);
      if (typeof this.actor.system?.hasFavorite === "function") {
        try { return this.actor.system.hasFavorite(id) === true; }
        catch (_error) { /* sistema antiguo: cae al flag */ }
      }
      return Boolean(this.actor.getFlag(MODULE_ID, `favorites.${item.id}`));
    }

    async _toggleFavorite(item) {
      const id = this._favoriteId(item);
      const sys = this.actor.system;
      if (typeof sys?.hasFavorite === "function"
        && typeof sys?.addFavorite === "function"
        && typeof sys?.removeFavorite === "function") {
        if (sys.hasFavorite(id)) return sys.removeFavorite(id);
        return sys.addFavorite({ type: "item", id });
      }
      // Fallback para versiones sin la API de favoritos.
      const current = Boolean(this.actor.getFlag(MODULE_ID, `favorites.${item.id}`));
      return this.actor.setFlag(MODULE_ID, `favorites.${item.id}`, !current);
    }

    /** Ids de los objetos anclados a la pestaña de Atributos. */
    _pinnedIds() {
      const raw = this.actor.getFlag(MODULE_ID, "pinned");
      return Array.isArray(raw) ? raw : [];
    }

    /**
     * Objetos anclados, listos para la pestaña de Atributos. Los que ya no
     * existan se ignoran (se limpian solos la próxima vez que se ancle algo).
     */
    _buildPinned() {
      return this._pinnedIds()
        .map((id) => this.actor.items.get(id))
        .filter(Boolean)
        .map((item) => {
          const uses = foundry.utils.getProperty(item, "system.uses") ?? {};
          const max = Number(uses.max);
          const value = Number(uses.value);
          return {
            id: item.id,
            name: item.name,
            img: item.img,
            equipped: foundry.utils.getProperty(item, "system.equipped") === true,
            qty: Number(foundry.utils.getProperty(item, "system.quantity")) || 0,
            uses: (Number.isFinite(max) && max > 0)
              ? { value: Number.isFinite(value) ? value : max, max }
              : null
          };
        });
    }

    /* -------------------------- Menú contextual ------------------------ */

    /**
     * Menú de clic derecho sobre un objeto del inventario o del paperdoll.
     * Las entradas se calculan para cada objeto: sintonizar solo aparece si el
     * objeto lo admite, y «Equipar/Quitar» cambia según su estado.
     */
    _buildContextEntries(item) {
      const equipped = foundry.utils.getProperty(item, "system.equipped") === true;
      const attunement = foundry.utils.getProperty(item, "system.attunement");
      const attuned = foundry.utils.getProperty(item, "system.attuned") === true;
      const canAttune = Boolean(attunement) && attunement !== "none";
      const favorite = this._isFavorite(item);
      const owner = this.actor.isOwner;

      const entries = [];

      if (canAttune) {
        entries.push({
          icon: "fa-hand-sparkles",
          label: attuned ? "Dejar de sintonizar" : "Sintonizarse al Objeto",
          disabled: !owner,
          run: () => item.update({ "system.attuned": !attuned })
        });
      }

      if (foundry.utils.getProperty(item, "system.equipped") !== undefined) {
        entries.push({
          icon: "fa-shirt",
          label: equipped ? "Quitar" : "Equipar",
          disabled: !owner,
          run: () => this._toggleEquipped(item)
        });
      }

      entries.push({
        icon: "fa-bookmark",
        label: favorite ? "Quitar favorito" : "Añadir Favorito",
        disabled: !owner,
        run: () => this._toggleFavorite(item)
      });

      // --- Pilas, al estilo de Item Piles ---
      const quantity = Number(foundry.utils.getProperty(item, "system.quantity"));
      if (Number.isFinite(quantity)) {
        const mergeable = this.actor.items.filter((other) => this._canStack(item, other)).length;
        if (quantity > 1 || mergeable) entries.push({ separator: true });
        if (quantity > 1) {
          entries.push({
            icon: "fa-arrows-split-up-and-left",
            label: "Dividir pila…",
            disabled: !owner,
            run: () => this._splitStack(item)
          });
        }
        if (mergeable) {
          entries.push({
            icon: "fa-layer-group",
            label: `Juntar pilas (${mergeable + 1})`,
            disabled: !owner,
            run: () => this._mergeStacks(item)
          });
        }
      }

      entries.push({ separator: true });

      entries.push({
        icon: "fa-eye",
        label: "Vista",
        // Vista solo lectura: útil para que el jugador consulte sin tocar nada.
        run: () => item.sheet?.render(true, { editable: false })
      });
      entries.push({
        icon: "fa-pen",
        label: "Editar",
        disabled: !owner,
        run: () => item.sheet?.render(true)
      });
      entries.push({
        icon: "fa-copy",
        label: "Duplicar",
        disabled: !owner,
        run: async () => {
          const data = item.toObject();
          delete data._id;
          data.name = `${data.name} (copia)`;
          await this.actor.createEmbeddedDocuments("Item", [data]);
        }
      });
      entries.push({
        icon: "fa-trash",
        label: "Borrar",
        danger: true,
        disabled: !owner,
        run: () => this._deleteItem(item)
      });

      entries.push({ separator: true });

      entries.push({
        icon: "fa-comment",
        label: "Mostrar en el Chat",
        run: async () => {
          if (typeof item.postItem === "function") return item.postItem();
          if (typeof item.displayCard === "function") return item.displayCard();
          return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `<h3>${foundry.utils.escapeHTML(item.name)}</h3>${foundry.utils.getProperty(item, "system.description.value") ?? ""}`
          });
        }
      });
      entries.push({
        icon: "fa-user",
        label: "Dar a un personaje",
        disabled: !owner,
        run: () => this._giveToCharacter(item)
      });

      entries.push({ separator: true });

      entries.push({
        icon: "fa-thumbtack",
        label: this._pinnedIds().includes(item.id) ? "Desanclar de Atributos" : "Anclar a Atributos",
        disabled: !owner,
        run: async () => {
          // De paso se descartan los anclados cuyos objetos ya no existen.
          const pinned = this._pinnedIds().filter((id) => this.actor.items.has(id));
          const index = pinned.indexOf(item.id);
          if (index >= 0) pinned.splice(index, 1);
          else pinned.push(item.id);
          await this.actor.setFlag(MODULE_ID, "pinned", pinned);
        }
      });

      return entries;
    }

    /**
     * Dibuja el menú flotante junto al cursor. Con `customEntries` se pueden
     * pasar otras opciones (los conjuros usan las suyas).
     */
    _openContextMenu(event, item, customEntries = null) {
      this._closeContextMenu();
      const entries = customEntries ?? this._buildContextEntries(item);

      const menu = document.createElement("nav");
      menu.className = "sss-ctx";
      for (const entry of entries) {
        if (entry.separator) {
          menu.appendChild(document.createElement("hr"));
          continue;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = `sss-ctx-item${entry.danger ? " is-danger" : ""}`;
        button.disabled = Boolean(entry.disabled);
        button.innerHTML = `<i class="fas ${entry.icon}" aria-hidden="true"></i><span>${foundry.utils.escapeHTML(entry.label)}</span>`;
        button.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this._closeContextMenu();
          play("snd_button_click.wav");
          try { await entry.run(); }
          catch (error) {
            console.error(`${MODULE_ID} | Error en «${entry.label}»`, error);
            ui.notifications?.warn(`No fue posible: ${entry.label}`);
          }
        });
        menu.appendChild(button);
      }

      document.body.appendChild(menu);
      // Se coloca junto al cursor sin salirse de la pantalla.
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      menu.style.left = `${Math.min(window.innerWidth - width - 8, event.clientX + 2)}px`;
      menu.style.top = `${Math.min(window.innerHeight - height - 8, event.clientY + 2)}px`;

      this._ctxMenu = menu;
      this._ctxCloser = (ev) => { if (!menu.contains(ev.target)) this._closeContextMenu(); };
      // `capture` para cerrarlo antes de que otro handler consuma el clic.
      setTimeout(() => {
        window.addEventListener("pointerdown", this._ctxCloser, true);
        window.addEventListener("wheel", this._ctxCloser, true);
      }, 0);
    }

    _closeContextMenu() {
      if (!this._ctxMenu) return;
      this._ctxMenu.remove();
      this._ctxMenu = null;
      if (this._ctxCloser) {
        window.removeEventListener("pointerdown", this._ctxCloser, true);
        window.removeEventListener("wheel", this._ctxCloser, true);
        this._ctxCloser = null;
      }
    }

    async _deleteItem(item) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const confirmed = DialogV2?.confirm
        ? await DialogV2.confirm({
            window: { title: "Borrar objeto" },
            content: `<p>¿Seguro que quieres borrar <strong>${foundry.utils.escapeHTML(item.name)}</strong>?</p>`,
            rejectClose: false
          })
        : confirm(`¿Borrar ${item.name}?`);
      if (!confirmed) return;
      await item.delete();
    }

    async _pickCharacter({ title, confirm = "Aceptar", extra = "" } = {}) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.wait) return null;
      const targets = game.actors
        .filter((actor) => actor.id !== this.actor.id && actor.type === "character")
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      if (!targets.length) {
        ui.notifications?.warn("No hay otros personajes en la mesa.");
        return null;
      }

      const esc = foundry.utils.escapeHTML;
      const rows = targets.map((actor, index) => `
        <label class="sss-pick-row">
          <input type="radio" name="targetId" value="${actor.id}"${index === 0 ? " checked" : ""}>
          <img src="${esc(actor.img ?? "")}" alt="">
          <span class="sss-pick-name">${esc(actor.name)}</span>
        </label>`).join("");

      const result = await DialogV2.wait({
        window: { title },
        classes: ["sss-pick"],
        content: `
          <div class="sss-pick-body">
            <div class="sss-pick-search"><i class="fas fa-search"></i>
              <input type="search" name="needle" placeholder="Buscar personaje…" autocomplete="off">
            </div>
            <div class="sss-pick-list">${rows}</div>${extra}
          </div>`,
        rejectClose: false,
        render: (_event, dialog) => {
          const root = dialog.element;
          const search = root?.querySelector("input[name='needle']");
          if (!search) return;
          search.addEventListener("input", () => {
            const needle = search.value.trim().toLowerCase();
            let checkedVisible = false;
            let first = null;
            for (const row of root.querySelectorAll(".sss-pick-row")) {
              const name = row.querySelector(".sss-pick-name")?.textContent.toLowerCase() ?? "";
              const hidden = Boolean(needle) && !name.includes(needle);
              row.classList.toggle("is-hidden", hidden);
              if (hidden) continue;
              const radio = row.querySelector("input[type='radio']");
              first ??= radio;
              if (radio?.checked) checkedVisible = true;
            }
            if (!checkedVisible && first) first.checked = true;
          });
          search.focus();
        },
        buttons: [
          { action: "cancel", label: "Cancelar" },
          {
            action: "ok", label: confirm, default: true,
            callback: (_event, button) => ({
              targetId: button.form?.elements?.targetId?.value ?? "",
              values: Object.fromEntries(new FormData(button.form).entries())
            })
          }
        ]
      });
      const target = result?.targetId ? game.actors.get(result.targetId) : null;
      return target ? { actor: target, values: result.values } : null;
    }

    async _deliver(target, payload) {
      if (game.user.isGM || target.isOwner) return "local";
      if (!game.users.activeGM) {
        ui.notifications?.warn("Hace falta un DJ conectado para realizar la entrega.");
        return false;
      }
      game.socket.emit(`module.${MODULE_ID}`, {
        ...payload, from: this.actor.id, to: target.id, userId: game.user.id
      });
      return "socket";
    }

    async _announceTransfer(target, what) {
      const esc = foundry.utils.escapeHTML;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="sss-give-card"><i class="fas fa-handshake"></i>
          <span><strong>${esc(this.actor.name)}</strong> da ${esc(what)} a <strong>${esc(target.name)}</strong>.</span></div>`
      });
    }

    /** Traspasa un objeto incluso si la ficha receptora pertenece a otro jugador. */
    async _giveToCharacter(item) {
      const quantity = Math.max(1, Number(foundry.utils.getProperty(item, "system.quantity") ?? 1));
      const picked = await this._pickCharacter({
        title: `Dar ${item.name}`,
        confirm: "Dar",
        extra: quantity > 1
          ? `<div class="sss-pick-fields"><label>Cantidad
               <input type="number" name="qty" value="1" min="1" max="${quantity}"></label></div>`
          : ""
      });
      if (!picked) return;
      const target = picked.actor;
      const amount = Math.max(1, Math.min(quantity, Math.floor(Number(picked.values.qty) || 1)));
      const how = await this._deliver(target, { action: "give-item", itemId: item.id, qty: amount });
      if (!how) return;

      if (how === "local") {
        const data = item.toObject();
        delete data._id;
        if (quantity > 1) foundry.utils.setProperty(data, "system.quantity", amount);
        if (foundry.utils.getProperty(data, "system.equipped") !== undefined) {
          foundry.utils.setProperty(data, "system.equipped", false);
        }
        if (foundry.utils.getProperty(data, "system.attuned") !== undefined) {
          foundry.utils.setProperty(data, "system.attuned", false);
        }
        await target.createEmbeddedDocuments("Item", [data]);
        if (amount >= quantity) await item.delete();
        else await item.update({ "system.quantity": quantity - amount });
      }

      play(dropSoundFor(item));
      await this._announceTransfer(target, amount > 1 ? `${item.name} ×${amount}` : item.name);
    }

    async _adjustCoins(mode) {
      if (!this.actor?.isOwner) return;
      const subtract = mode === "subtract";
      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.wait) return ui.notifications?.warn("Esta versión de Foundry no pudo abrir el ajuste de monedas.");
      const current = this.actor.system?.currency ?? {};
      const labels = { pp: "Platino", gp: "Oro", ep: "Electro", sp: "Plata", cp: "Cobre" };
      const holdings = CURRENCY_KEYS.map((key) => `<span><b>${Number(current[key]) || 0}</b> ${labels[key]}</span>`).join("");
      const options = CURRENCY_KEYS.map((key) => `<option value="${key}">${labels[key]}</option>`).join("");
      const result = await DialogV2.wait({
        window: { title: subtract ? "Restar monedas" : "Sumar monedas" },
        classes: ["sss-coin-dialog"],
        content: `<div class="sss-coin-adjust-form">
          <p class="sss-coin-holdings">${holdings}</p>
          <label>Moneda <select name="denomination">${options}</select></label>
          <label>Cantidad <input type="number" name="amount" value="1" min="1" step="1" autofocus></label>
        </div>`,
        rejectClose: false,
        buttons: [
          { action: "cancel", label: "Cancelar", callback: () => null },
          {
            action: "apply", label: subtract ? "Restar" : "Sumar", default: true,
            callback: (_event, button) => ({
              denomination: button.form?.elements?.denomination?.value,
              amount: Math.floor(Number(button.form?.elements?.amount?.value) || 0)
            })
          }
        ]
      });
      if (!result || !CURRENCY_KEYS.includes(result.denomination) || result.amount < 1) return;
      const latest = Math.max(0, Math.floor(Number(this.actor.system?.currency?.[result.denomination]) || 0));
      const next = latest + (subtract ? -result.amount : result.amount);
      if (next < 0) return ui.notifications?.warn(`No tienes suficientes monedas de ${result.denomination.toUpperCase()}.`);
      await this.actor.update({ [`system.currency.${result.denomination}`]: next });
      play(subtract ? "snd_gui_drop_gold_1.wav" : "snd_gui_pick_gold.wav");
    }

    async _giveCoins() {
      if (!this.actor.isOwner) return;
      const current = this.actor.system?.currency ?? {};
      const have = Object.fromEntries(CURRENCY_KEYS.map((key) => [key, Math.max(0, Math.floor(Number(current[key]) || 0))]));
      const labels = { pp: "Platino", gp: "Oro", ep: "Electro", sp: "Plata", cp: "Cobre" };
      const fields = CURRENCY_KEYS.map((key) => `<label>${labels[key]}
        <input type="number" name="${key}" value="0" min="0" max="${have[key]}"></label>`).join("");
      const picked = await this._pickCharacter({
        title: "Dar monedas",
        confirm: "Dar",
        extra: `<div class="sss-pick-fields sss-pick-coins">${fields}</div>`
      });
      if (!picked) return;
      const give = Object.fromEntries(CURRENCY_KEYS.map((key) => [
        key, Math.max(0, Math.min(have[key], Math.floor(Number(picked.values[key]) || 0)))
      ]));
      if (!CURRENCY_KEYS.some((key) => give[key] > 0)) return ui.notifications?.warn("No has puesto ninguna moneda.");

      const target = picked.actor;
      const how = await this._deliver(target, { action: "give-coins", coins: give });
      if (!how) return;
      if (how === "local") {
        const theirs = target.system?.currency ?? {};
        const mineUpdate = {};
        const targetUpdate = {};
        for (const key of CURRENCY_KEYS) {
          mineUpdate[`system.currency.${key}`] = have[key] - give[key];
          targetUpdate[`system.currency.${key}`] = (Number(theirs[key]) || 0) + give[key];
        }
        await this.actor.update(mineUpdate);
        await target.update(targetUpdate);
      }

      const what = CURRENCY_KEYS
        .filter((key) => give[key] > 0)
        .map((key) => `${give[key]} ${key.toUpperCase()}`)
        .join(", ");
      play("snd_gui_pick_gold.wav");
      await this._announceTransfer(target, what);
    }

    async _convertCoins() {
      if (!this.actor.isOwner) return;
      const access = coinExchangeState();
      if (!access.allowed) return ui.notifications?.warn(access.tooltip);
      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.wait) return ui.notifications?.warn("Esta versión de Foundry no pudo abrir el cambio de monedas.");
      const held = this.actor.system?.currency ?? {};
      const result = await DialogV2.wait({
        window: { title: "Optimizar monedas 5e" },
        classes: ["sss-coin-dialog", "sss-coin-convert-dialog"],
        content: `<div class="sss-coin-convert-form">
          <p>Convierte denominaciones según las equivalencias oficiales de 5e y conserva cada sobrante.</p>
          <p class="sss-coin-holdings">${CURRENCY_KEYS.map((key) => `<span><b>${Number(held[key]) || 0}</b> ${key.toUpperCase()}</span>`).join("")}</p>
          <div class="sss-coin-rates"><span>10 CP = 1 SP</span><span>5 SP = 1 EP</span><span>2 EP = 1 GP</span><span>10 GP = 1 PP</span></div>
        </div>`,
        rejectClose: false,
        buttons: [
          { action: "cancel", label: "Cancelar", callback: () => null },
          { action: "cp-sp", label: "CP → SP", callback: () => "cp-sp" },
          { action: "sp-ep", label: "SP → EP", callback: () => "sp-ep" },
          { action: "ep-gp", label: "EP → GP", callback: () => "ep-gp" },
          { action: "gp-pp", label: "GP → PP", callback: () => "gp-pp" },
          { action: "all", label: "Optimizar todo", default: true, callback: () => "all" }
        ]
      });
      if (!result) return;

      const coins = Object.fromEntries(CURRENCY_KEYS.map((key) => [key, Math.max(0, Math.floor(Number(this.actor.system?.currency?.[key]) || 0))]));
      const before = JSON.stringify(coins);
      const convert = (lower, higher, ratio) => {
        const gained = Math.floor(coins[lower] / ratio);
        coins[lower] %= ratio;
        coins[higher] += gained;
      };
      if (result === "cp-sp" || result === "all") convert("cp", "sp", 10);
      if (result === "sp-ep" || result === "all") convert("sp", "ep", 5);
      if (result === "ep-gp" || result === "all") convert("ep", "gp", 2);
      if (result === "gp-pp" || result === "all") convert("gp", "pp", 10);
      if (JSON.stringify(coins) === before) return ui.notifications?.warn("No hay suficientes monedas para convertir.");
      await this.actor.update(Object.fromEntries(CURRENCY_KEYS.map((key) => [`system.currency.${key}`, coins[key]])));
      play("snd_gui_pick_gold.wav");
      ui.notifications?.info(`Monedas optimizadas: ${coins.pp} PP, ${coins.gp} GP, ${coins.ep} EP, ${coins.sp} SP y ${coins.cp} CP.`);
    }

    /** Cambia el estado de equipado y mantiene el paperdoll coherente. */
    async _toggleEquipped(item) {
      const equipped = foundry.utils.getProperty(item, "system.equipped") === true;
      if (equipped) {
        // Si estaba en una ranura del paperdoll, se libera también.
        const slots = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "slots") ?? {});
        const key = Object.entries(slots).find(([, id]) => id === item.id)?.[0];
        if (key) return this._unequipSlot(key);
        await item.update({ "system.equipped": false });
        return;
      }
      // Al equipar desde el menú, se busca la primera ranura libre que lo admita.
      const slots = this.actor.getFlag(MODULE_ID, "slots") ?? {};
      const free = SLOT_DEFS.find((def) => !slots[def.key] && slotAccepts(def.key, item));
      if (free) return this._assignSlot(free.key, item);
      await item.update({ "system.equipped": true });
    }

    /** Cambia el retrato del actor con el explorador de archivos. */
    async _pickPortrait() {
      if (!this.actor.isOwner) return;
      const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
      if (!FP) return;
      new FP({
        type: "image",
        current: this.actor.img,
        callback: (path) => this.actor.update({ img: path })
      }).browse();
    }

    async _adjustPortrait() {
      if (!this.actor.isOwner) return;
      this._portraitAdjust = !this._portraitAdjust;
      play("snd_button_click.wav");
      this.render(false);
    }

    async _resetPortrait() {
      if (!this.actor.isOwner) return;
      await this.actor.unsetFlag(MODULE_ID, "portraitOffset");
      play("snd_button_click.wav");
      this.render(false);
    }

    _bindPortraitFraming(root) {
      const art = root.querySelector(".sss-stage-art");
      const img = root.querySelector(".sss-stage-img");
      if (!art || !img || !this._portraitAdjust || !this.actor.isOwner) return;

      const framing = this._portraitFraming();
      const apply = () => img.style.setProperty(
        "--sss-portrait-offset",
        `translate(${framing.x}px, ${framing.y}px) scale(${framing.scale})`
      );
      const save = () => this.actor.setFlag(MODULE_ID, "portraitOffset", {
        x: Math.round(framing.x),
        y: Math.round(framing.y),
        scale: Math.round(framing.scale * 1000) / 1000
      });

      let drag = null;
      img.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag = { px: event.clientX, py: event.clientY, x: framing.x, y: framing.y };
        art.classList.add("is-dragging");
        try { img.setPointerCapture(event.pointerId); }
        catch (_error) { /* El movimiento sigue funcionando sin captura. */ }
      });
      img.addEventListener("pointermove", (event) => {
        if (!drag) return;
        framing.x = drag.x + (event.clientX - drag.px);
        framing.y = drag.y + (event.clientY - drag.py);
        apply();
      });
      const release = (event) => {
        if (!drag) return;
        drag = null;
        art.classList.remove("is-dragging");
        try { img.releasePointerCapture(event.pointerId); }
        catch (_error) { /* Ya liberado. */ }
        save();
      };
      img.addEventListener("pointerup", release);
      img.addEventListener("pointercancel", release);
      img.addEventListener("wheel", (event) => {
        event.preventDefault();
        const step = event.deltaY < 0 ? 1.08 : 1 / 1.08;
        framing.scale = Math.min(4, Math.max(0.4, framing.scale * step));
        apply();
        clearTimeout(this._framingTimer);
        this._framingTimer = setTimeout(save, 350);
      }, { passive: false });
    }

    _bindImageFallbacks(root) {
      root.querySelectorAll("img[data-sss-image-fallback]").forEach((image) => {
        const fallback = () => {
          const path = image.dataset.sssImageFallback;
          if (!path || image.dataset.sssFallbackApplied === "1") return;
          image.dataset.sssFallbackApplied = "1";
          image.src = path;
        };
        if (image.complete && image.naturalWidth === 0) fallback();
        else image.addEventListener("error", fallback, { once: true });
      });
    }

    /* ------------------------- Drag & drop ----------------------------- */

    /**
     * Clic en una celda libre: pregunta el tipo y crea el objeto ahí.
     * Es el equivalente al «+ Añadir» de las hojas normales, pero puesto donde
     * el jugador está mirando.
     */
    async _createItemAt(event, gridEl) {
      if (!this.actor.isOwner) return;

      const { x, y } = this._cellAt(event, gridEl);

      // Si ya hay algo colocado justo ahí, no es un hueco libre.
      const positions = this.actor.getFlag(MODULE_ID, "grid") ?? {};
      const taken = Object.values(positions).some((p) => p?.x === x && p?.y === y);
      if (taken) return;

      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.wait) return;

      const types = INV_TYPES.filter((type) => CONFIG.Item?.dataModels?.[type] || Item.TYPES?.includes(type));
      const options = (types.length ? types : INV_TYPES).map((type) => {
        const label = CONFIG.Item?.typeLabels?.[type]
          ? game.i18n.localize(CONFIG.Item.typeLabels[type])
          : type;
        return `<option value="${type}">${foundry.utils.escapeHTML(label)}</option>`;
      }).join("");

      const result = await DialogV2.wait({
        window: { title: "Nuevo objeto" },
        content: `
          <div class="sss-give">
            <p><label>Nombre <input type="text" name="name" value="Objeto nuevo" autofocus></label></p>
            <p><label>Tipo <select name="type">${options}</select></label></p>
          </div>`,
        rejectClose: false,
        buttons: [
          { action: "cancel", label: "Cancelar" },
          {
            action: "create",
            label: "Crear",
            default: true,
            callback: (_ev, button) => ({
              name: String(button.form?.elements?.name?.value ?? "").trim() || "Objeto nuevo",
              type: button.form?.elements?.type?.value
            })
          }
        ]
      });
      if (!result?.type) return;

      const [created] = await this.actor.createEmbeddedDocuments("Item", [
        { name: result.name, type: result.type }
      ]);
      if (!created) return;

      // Se coloca justo en el hueco donde el jugador hizo clic.
      const next = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "grid") ?? {});
      next[created.id] = { x, y };
      await this.actor.setFlag(MODULE_ID, "grid", next);
      play(dropSoundFor(created));
      created.sheet?.render(true);
    }

    /**
     * Filtra la grilla sin volver a dibujarla: los objetos que no son del
     * grupo se atenúan pero no se mueven, para no perder sus posiciones.
     * Volver a pulsar el filtro activo lo quita.
     */
    _applyFilter(group, root) {
      this._filter = (this._filter === group && group !== "all") ? "all" : group;
      const active = this._filter;

      for (const button of root.querySelectorAll("[data-action='sss-filter']")) {
        const on = button.dataset.group === active;
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-pressed", String(on));
      }
      for (const tile of root.querySelectorAll("[data-sss-grid] [data-sss-item]")) {
        tile.classList.toggle("is-dimmed", active !== "all" && tile.dataset.group !== active);
      }
      play("snd_button_click.wav");
    }

    /** Filtro por nivel de conjuro. Oculta los bloques que se quedan vacíos. */
    _applySpellLevel(level, root) {
      this._spellLevel = (this._spellLevel === level && level !== "all") ? "all" : level;
      const active = this._spellLevel;

      for (const button of root.querySelectorAll("[data-action='sss-spell-level']")) {
        button.classList.toggle("is-active", button.dataset.level === active);
      }
      for (const block of root.querySelectorAll("[data-sss-level]")) {
        block.classList.toggle("is-hidden", active !== "all" && block.dataset.sssLevel !== active);
      }
      play("snd_button_click.wav");
    }

    /**
     * Gasta o recupera un espacio de conjuro pulsando su llamita.
     * Clic normal gasta uno; clic derecho lo devuelve.
     */
    async _spendSlot(key, index, restore) {
      if (!this.actor.isOwner || !key) return;
      const slot = this.actor.system?.spells?.[key];
      if (!slot) return;
      const max = Number(slot.max) || 0;
      const current = Number(slot.value) || 0;
      // Al pulsar la llamita nº3 se deja el contador en 3 (o en 2 si ya estaba
      // encendida), que es como se comporta esta clase de barra.
      const next = restore
        ? Math.min(max, Math.max(current, index + 1))
        : (index < current ? index : Math.min(max, index + 1));
      if (next === current) return;
      await this.actor.update({ [`system.spells.${key}.value`]: next });
      play(next < current ? "snd_button_click.wav" : "snd_chest_open.wav");
    }

    /** Tirada suelta de ataque con conjuro. */
    async _rollSpellAttack() {
      const book = this._buildSpellbook();
      if (!book.canRollAttack) return ui.notifications?.warn("Este personaje no lanza conjuros.");
      await new Roll(`1d20 ${book.attack}`).toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: "Ataque de conjuro"
      });
    }

    /**
     * Abre los «Rasgos Especiales» de dnd5e, donde Midi-QOL cuelga sus
     * banderas por personaje. En dnd5e 5.x es una pestaña de la hoja del
     * sistema; en 4.x era una ventana aparte.
     */
    async _openSpecialTraits() {
      const Flags = globalThis.dnd5e?.applications?.actor?.ActorSheetFlags;
      if (typeof Flags === "function") {
        try { return new Flags(this.actor).render(true); }
        catch (error) { console.warn(`${MODULE_ID} | ActorSheetFlags`, error); }
      }

      // dnd5e 5.x: se abre la hoja del sistema directamente en esa pestaña.
      const sheets = CONFIG.Actor?.sheetClasses?.character ?? {};
      const entry = sheets["dnd5e.CharacterActorSheet"]
        ?? sheets["dnd5e.ActorSheet5eCharacter2"]
        ?? Object.values(sheets).find((s) => String(s.id ?? "").startsWith("dnd5e."));
      if (!entry?.cls) return ui.notifications?.warn("No encontré la hoja de dnd5e para abrir los rasgos especiales.");

      let app;
      try { app = new entry.cls({ document: this.actor, id: `sss-traits-${this.actor.id}` }); }
      catch { app = new entry.cls(this.actor, { id: `sss-traits-${this.actor.id}` }); }
      await app.render(true);
      // `changeTab` existe en ApplicationV2; el grupo de la hoja es "primary".
      try { app.changeTab?.("specialTraits", "primary"); }
      catch (error) { console.warn(`${MODULE_ID} | No pude cambiar a la pestaña de rasgos especiales`, error); }
    }

    /**
     * Cambia al siguiente conjunto de equipo del Combat Hub (I, II, III…),
     * igual que su botón de numerales.
     */
    async _cycleLoadout(direction, button = null) {
      if (!hubActive()) return ui.notifications?.warn("El Combat Hub no está activo.");
      // Pulsar dos veces seguidas encadenaba dos ciclos y se saltaba un
      // conjunto; el segundo clic se ignora hasta que termine el primero.
      if (this._loadoutBusy) return;
      this._loadoutBusy = true;

      // El sonido y el giro del icono salen ya, antes de esperar a nada:
      // el retraso venía de que no pasaba nada visible hasta terminar.
      play("snd_button_click.wav");
      button?.classList.add("is-working");

      try {
        const api = await loadHub();
        if (typeof api?.cycleLoadout !== "function") {
          return ui.notifications?.warn("Tu versión del Combat Hub no maneja conjuntos de equipo.");
        }
        const index = await api.cycleLoadout(this.actor, direction);
        if (index === null || index === undefined) return;
        this._hubLoadoutIndex = Number(index) || 0;
        const numerals = api.LOADOUT_NUMERALS ?? ["I", "II", "III", "IV"];
        const badge = button?.querySelector?.(".sss-loadout-number");
        if (badge) badge.textContent = String(this._hubLoadoutIndex + 1);
        ui.notifications?.info(`Conjunto ${numerals[index] ?? index + 1}`);
        // Sin `render` a mano: `cycleLoadout` actualiza el actor y sus objetos,
        // y eso ya redibuja la hoja. Forzarlo aquí la pintaba dos veces.
      } catch (error) {
        console.error(`${MODULE_ID} | conjunto de equipo`, error);
        ui.notifications?.warn("No fue posible cambiar de conjunto.");
      } finally {
        this._loadoutBusy = false;
        button?.classList.remove("is-working");
      }
    }

    /* --------------------------- Conjuros ------------------------------ */

    /**
     * Los conjuros se pueden reordenar arrastrándolos dentro de su nivel, y
     * traen el mismo menú de clic derecho que el inventario más las opciones
     * propias (preparar, crear pergamino, mover de sección).
     */
    _activateSpellListeners(root) {
      let dragged = null;

      for (const row of root.querySelectorAll("[data-sss-spell]")) {
        const id = row.dataset.sssSpell;

        row.addEventListener("dragstart", (event) => {
          dragged = row;
          row.classList.add("is-dragging");
          const spell = this.actor.items.get(id);
          // Se sigue publicando el UUID para poder soltarlo en la barra de
          // macros o en otra hoja, como cualquier objeto.
          if (spell) event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: spell.uuid }));
          // Igual que en el inventario: con «move» a secas no se podía soltar
          // un conjuro en la barra de macros ni en un compendio.
          event.dataTransfer.effectAllowed = "copyMove";
        });

        row.addEventListener("dragend", () => {
          row.classList.remove("is-dragging");
          root.querySelectorAll(".sss-spell.is-over").forEach((el) => el.classList.remove("is-over"));
          dragged = null;
        });

        row.addEventListener("dragover", (event) => {
          if (!dragged || dragged === row) return;
          // Solo dentro del mismo nivel: mezclarlos no tendría sentido.
          if (dragged.closest("[data-sss-spell-list]") !== row.closest("[data-sss-spell-list]")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          row.classList.add("is-over");
        });

        row.addEventListener("dragleave", () => row.classList.remove("is-over"));

        row.addEventListener("drop", async (event) => {
          row.classList.remove("is-over");
          if (!dragged || dragged === row) return;
          const list = row.closest("[data-sss-spell-list]");
          if (!list || dragged.closest("[data-sss-spell-list]") !== list) return;
          event.preventDefault();
          event.stopPropagation();

          // Se reordena el DOM primero para que se vea inmediato, y luego se
          // guarda el orden resultante.
          const rows = [...list.querySelectorAll("[data-sss-spell]")];
          const from = rows.indexOf(dragged);
          const to = rows.indexOf(row);
          list.insertBefore(dragged, from < to ? row.nextSibling : row);
          await this._saveSpellOrder(list);
          play("snd_button_click.wav");
        });

        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const spell = this.actor.items.get(id);
          if (!spell) return;
          this._openContextMenu(event, spell, this._buildSpellContextEntries(spell));
        });
      }
    }

    /** Guarda el orden visible de una lista de conjuros. */
    async _saveSpellOrder(list) {
      const order = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "spellOrder") ?? {});
      // El nivel se multiplica para que los índices no choquen entre listas.
      const base = (Number(list.dataset.sssSpellList) || 0) * 1000;
      [...list.querySelectorAll("[data-sss-spell]")].forEach((el, index) => {
        order[el.dataset.sssSpell] = base + index;
      });
      await this.actor.setFlag(MODULE_ID, "spellOrder", order);
    }

    /** Entradas del menú contextual propias de un conjuro. */
    _buildSpellContextEntries(spell) {
      const owner = this.actor.isOwner;
      const level = Number(foundry.utils.getProperty(spell, "system.level")) || 0;
      const state = spellState(spell);
      const canPrepare = level > 0 && methodPrepares(spellMethod(spell)) && state !== 2;
      const favorite = this._isFavorite(spell);
      const pinned = this._pinnedIds().includes(spell.id);

      const entries = [];

      if (canPrepare) {
        entries.push({
          icon: "fa-circle-check",
          label: state >= 1 ? "Quitar de preparados" : "Preparar",
          disabled: !owner,
          run: () => spell.update(preparedUpdate(spell, state < 1))
        });
      }

      entries.push({
        icon: "fa-bookmark",
        label: favorite ? "Quitar favorito" : "Añadir Favorito",
        disabled: !owner,
        run: () => this._toggleFavorite(spell)
      });

      entries.push({ separator: true });

      entries.push({ icon: "fa-eye", label: "Vista", run: () => spell.sheet?.render(true, { editable: false }) });
      entries.push({ icon: "fa-pen", label: "Editar", disabled: !owner, run: () => spell.sheet?.render(true) });
      entries.push({
        icon: "fa-copy",
        label: "Duplicar",
        disabled: !owner,
        run: async () => {
          const data = spell.toObject();
          delete data._id;
          data.name = `${data.name} (copia)`;
          await this.actor.createEmbeddedDocuments("Item", [data]);
        }
      });
      entries.push({ icon: "fa-trash", label: "Eliminar", danger: true, disabled: !owner, run: () => this._deleteItem(spell) });

      entries.push({ separator: true });

      entries.push({
        icon: "fa-comment",
        label: "Mostrar en el Chat",
        run: () => (typeof spell.displayCard === "function" ? spell.displayCard() : spell.use())
      });
      entries.push({
        icon: "fa-thumbtack",
        label: pinned ? "Desanclar de Atributos" : "Anclar a Atributos",
        disabled: !owner,
        run: async () => {
          const list = this._pinnedIds().filter((id) => this.actor.items.has(id));
          const index = list.indexOf(spell.id);
          if (index >= 0) list.splice(index, 1);
          else list.push(spell.id);
          await this.actor.setFlag(MODULE_ID, "pinned", list);
        }
      });

      entries.push({ separator: true });

      entries.push({
        icon: "fa-scroll-old",
        label: "Crear Pergamino",
        disabled: !owner,
        run: () => this._createScroll(spell)
      });
      entries.push({
        icon: "fa-layer-group",
        label: "Selecciona una Sección",
        disabled: !owner,
        run: () => this._moveSpellSection(spell)
      });

      return entries;
    }

    /**
     * Pergamino de conjuro con la utilidad del propio dnd5e, para que salga
     * con su CD, su nivel y su descripción estándar.
     */
    async _createScroll(spell) {
      const create = globalThis.dnd5e?.documents?.Item5e?.createScrollFromSpell
        ?? CONFIG.Item?.documentClass?.createScrollFromSpell;
      if (typeof create !== "function") {
        return ui.notifications?.warn("Tu versión de dnd5e no ofrece la creación de pergaminos.");
      }
      const data = await create(spell);
      if (!data) return;
      const [scroll] = await this.actor.createEmbeddedDocuments("Item", [
        data instanceof Item ? data.toObject() : data
      ]);
      if (scroll) {
        play(dropSoundFor(scroll));
        ui.notifications?.info(`Pergamino creado: ${scroll.name}`);
      }
    }

    /**
     * Mueve el conjuro a otra sección cambiando su modo de preparación:
     * preparado normal, siempre preparado, a voluntad, innato o de pacto.
     */
    async _moveSpellSection(spell) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.wait) return;

      // `spellcasting` es la config de dnd5e 5.x; en 4.x se cae al mapa viejo,
      // que allí todavía no está deprecado.
      const modern = usesModernSpellFields(spell);
      const modes = (modern ? CONFIG.DND5E?.spellcasting : CONFIG.DND5E?.spellPreparationModes) ?? {};
      const current = spellMethod(spell);
      const options = Object.entries(modes).map(([key, config]) => {
        const label = typeof config === "string" ? config : (config?.label ?? key);
        const selected = key === current || (!modern && key === "prepared" && current === "spell");
        return `<option value="${key}" ${selected ? "selected" : ""}>${foundry.utils.escapeHTML(game.i18n.localize(label))}</option>`;
      }).join("");
      if (!options) return ui.notifications?.warn("No hay secciones de conjuro disponibles.");

      const result = await DialogV2.wait({
        window: { title: `Sección de ${spell.name}` },
        content: `<div class="sss-give"><p><label>Sección <select name="mode">${options}</select></label></p></div>`,
        rejectClose: false,
        buttons: [
          { action: "cancel", label: "Cancelar" },
          {
            action: "move",
            label: "Mover",
            default: true,
            callback: (_ev, button) => button.form?.elements?.mode?.value
          }
        ]
      });
      if (!result || result === current) return;
      await spell.update(modern ? { "system.method": result } : { "system.preparation.mode": result });
    }

    /* --------------------------- Pilas --------------------------------- */

    /**
     * ¿Son el mismo objeto a efectos de apilar? Como en Item Piles: mismo
     * tipo y mismo nombre, y ninguno de los dos con carga propia que se
     * perdería al fusionarlos (usos gastados, sintonía, encantamientos).
     */
    _canStack(a, b) {
      if (!a || !b || a.id === b.id) return false;
      if (a.type !== b.type || a.name !== b.name) return false;
      // Solo lo que tiene cantidad se apila.
      if (!Number.isFinite(Number(a.system?.quantity))) return false;
      if (!Number.isFinite(Number(b.system?.quantity))) return false;
      // Un objeto sintonizado o equipado es «ese» objeto, no uno más del montón.
      for (const item of [a, b]) {
        if (foundry.utils.getProperty(item, "system.attuned") === true) return false;
        if (foundry.utils.getProperty(item, "system.equipped") === true) return false;
        // Usos ya gastados: fusionarlos regalaría o robaría cargas.
        const uses = foundry.utils.getProperty(item, "system.uses") ?? {};
        if (Number(uses.max) > 0 && Number(uses.spent) > 0) return false;
      }
      return true;
    }

    /** Objeto apilable que hay en esa celda, si lo hay. */
    _stackTargetAt(gridEl, x, y, dragged) {
      for (const tile of gridEl.querySelectorAll("[data-sss-item]")) {
        const rect = {
          x: Number(tile.dataset.x) || 0,
          y: Number(tile.dataset.y) || 0,
          w: Number(tile.dataset.w) || 1,
          h: Number(tile.dataset.h) || 1
        };
        if (!overlaps({ x, y, w: 1, h: 1 }, rect)) continue;
        const item = this.actor.items.get(tile.dataset.sssItem);
        if (this._canStack(dragged, item)) return item;
        return null;
      }
      return null;
    }

    /** Funde el objeto arrastrado dentro del montón destino. */
    async _stackInto(source, target) {
      const moving = Number(source.system?.quantity) || 0;
      const held = Number(target.system?.quantity) || 0;
      if (moving <= 0) return;

      await target.update({ "system.quantity": held + moving });
      await source.delete();

      // La posición del que desaparece deja de tener sentido.
      const positions = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "grid") ?? {});
      if (positions[source.id]) {
        delete positions[source.id];
        await this.actor.setFlag(MODULE_ID, "grid", positions);
      }
      play(dropSoundFor(target));
      ui.notifications?.info(`${target.name} ×${held + moving}`);
    }

    /**
     * Parte una pila en dos, como el «split» de Item Piles: se pide cuántas
     * unidades sacar y se crea un objeto nuevo con ellas en el primer hueco
     * libre.
     */
    async _splitStack(item) {
      const total = Number(foundry.utils.getProperty(item, "system.quantity")) || 0;
      if (total < 2) return ui.notifications?.warn("Necesitas al menos dos unidades para dividir.");

      const DialogV2 = foundry.applications?.api?.DialogV2;
      if (!DialogV2?.wait) return;

      const half = Math.floor(total / 2);
      const amount = await DialogV2.wait({
        window: { title: `Dividir ${item.name}` },
        content: `
          <div class="sss-give sss-split">
            <p class="sss-split-total">Tienes <b>${total}</b> unidades.</p>
            <p><label>Separar
              <input type="number" name="qty" value="${half}" min="1" max="${total - 1}" autofocus>
            </label></p>
          </div>`,
        rejectClose: false,
        buttons: [
          { action: "cancel", label: "Cancelar" },
          {
            action: "split",
            label: "Dividir",
            default: true,
            callback: (_ev, button) => Number(button.form?.elements?.qty?.value) || 0
          }
        ]
      });

      const take = Math.floor(Math.max(0, Math.min(total - 1, amount ?? 0)));
      if (take < 1) return;

      const data = item.toObject();
      delete data._id;
      foundry.utils.setProperty(data, "system.quantity", take);
      const [created] = await this.actor.createEmbeddedDocuments("Item", [data]);
      await item.update({ "system.quantity": total - take });

      // El montón nuevo se coloca solo: el render buscará su hueco.
      if (created) play(dropSoundFor(created));
    }

    /**
     * Junta en una todas las pilas equivalentes del inventario. Es el atajo
     * para cuando el jugador acumula ocho montones de flechas.
     */
    async _mergeStacks(item) {
      const candidates = this.actor.items.filter((other) => this._canStack(item, other));
      if (!candidates.length) return ui.notifications?.info("No hay otras pilas iguales.");

      const total = candidates.reduce(
        (sum, other) => sum + (Number(other.system?.quantity) || 0),
        Number(item.system?.quantity) || 0
      );
      await item.update({ "system.quantity": total });
      await this.actor.deleteEmbeddedDocuments("Item", candidates.map((other) => other.id));

      const positions = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "grid") ?? {});
      for (const other of candidates) delete positions[other.id];
      await this.actor.setFlag(MODULE_ID, "grid", positions);

      play(dropSoundFor(item));
      ui.notifications?.info(`${item.name} ×${total}`);
    }

    /* --------------------------- Grilla -------------------------------- */

    /** Tamaño de celda que se está usando ahora mismo, leído del CSS. */
    _cellSize(root) {
      const el = root ?? this.element?.[0] ?? this.element;
      const raw = el ? getComputedStyle(el).getPropertyValue("--sss-cell") : "";
      const value = parseFloat(raw);
      return Number.isFinite(value) && value > 0 ? value : CELL;
    }

    /**
     * Ajusta el tamaño de celda para que las columnas quepan enteras en el
     * panel. Sin esto, con 9 columnas de 52 px la grilla se salía por la
     * derecha y quedaban objetos fuera de vista.
     */
    _fitGrid(root) {
      const wrap = root?.querySelector(".sss-grid-wrap");
      const grid = root?.querySelector("[data-sss-grid]");
      if (!wrap || !grid) return;

      const cols = Math.max(1, Number(grid.dataset.cols) || 9);
      const styles = getComputedStyle(wrap);
      const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      // Se descuenta el ancho de la barra de desplazamiento vertical.
      const available = wrap.clientWidth - padding - 2;
      if (available <= 0) return;

      // Nunca más grande que el diseño original ni tan pequeño que no se vea.
      const cell = Math.max(28, Math.min(CELL, Math.floor(available / cols)));
      (this.element?.[0] ?? this.element)?.style.setProperty("--sss-cell", `${cell}px`);
    }

    /** Recalcula la grilla cuando cambia el tamaño de la ventana. */
    _watchGridSize(root) {
      this._gridObserver?.disconnect();
      const wrap = root?.querySelector(".sss-grid-wrap");
      if (!wrap || typeof ResizeObserver !== "function") return;
      this._gridObserver = new ResizeObserver(() => this._fitGrid(root));
      this._gridObserver.observe(wrap);
    }

    /**
     * Silueta de destino mientras se arrastra: enseña dónde va a caer el
     * objeto y de qué tamaño, o marca en verde el montón con el que se
     * apilaría. Con objetos de varios cuadros es imprescindible.
     */
    _showDropGhost(event, gridEl) {
      const dragged = this._draggingItem;
      const { x, y } = this._cellAt(event, gridEl);

      // ¿Se apila? Entonces se resalta el destino y no se dibuja silueta.
      const stackTarget = dragged ? this._stackTargetAt(gridEl, x, y, dragged) : null;
      for (const tile of gridEl.querySelectorAll(".is-stack-target")) {
        tile.classList.remove("is-stack-target");
      }
      if (stackTarget) {
        this._clearDropGhost(gridEl);
        gridEl.querySelector(`[data-sss-item="${stackTarget.id}"]`)?.classList.add("is-stack-target");
        return;
      }

      const bulky = Boolean(game.settings.get(MODULE_ID, "bulkyItems"));
      const size = dragged ? itemFootprint(dragged, bulky) : { w: 1, h: 1 };
      const cols = Math.max(1, Number(gridEl.dataset.cols) || 9);
      const rect = { x: Math.max(0, Math.min(cols - size.w, x)), y, ...size };

      let ghost = gridEl.querySelector(".sss-drop-ghost");
      if (!ghost) {
        ghost = document.createElement("div");
        ghost.className = "sss-drop-ghost";
        gridEl.appendChild(ghost);
      }
      const cell = this._cellSize();
      ghost.style.left = `${rect.x * cell}px`;
      ghost.style.top = `${rect.y * cell}px`;
      ghost.style.width = `${rect.w * cell}px`;
      ghost.style.height = `${rect.h * cell}px`;

      // Rojo si el hueco está pillado por más de un objeto (no hay canje).
      const blocked = this._occupiedRects(gridEl, dragged?.id).filter((other) => overlaps(rect, other));
      ghost.classList.toggle("is-bad", blocked.length > 1);
    }

    _clearDropGhost(gridEl) {
      gridEl?.querySelector(".sss-drop-ghost")?.remove();
      for (const tile of gridEl?.querySelectorAll(".is-stack-target") ?? []) {
        tile.classList.remove("is-stack-target");
      }
    }

    /** Celda de la grilla bajo el cursor. */
    _cellAt(event, gridEl) {
      const bounds = gridEl.getBoundingClientRect();
      const cell = this._cellSize();
      const cols = Math.max(1, Number(gridEl.dataset.cols) || 9);
      return {
        x: Math.max(0, Math.min(cols - 1, Math.floor((event.clientX - bounds.left) / cell))),
        y: Math.max(0, Math.floor((event.clientY - bounds.top) / cell))
      };
    }

    /** Rectángulos ocupados ahora mismo, salvo el del objeto que se mueve. */
    _occupiedRects(gridEl, exceptId) {
      const rects = [];
      for (const tile of gridEl.querySelectorAll("[data-sss-item]")) {
        if (tile.dataset.sssItem === exceptId) continue;
        rects.push({
          id: tile.dataset.sssItem,
          x: Number(tile.dataset.x) || 0,
          y: Number(tile.dataset.y) || 0,
          w: Number(tile.dataset.w) || 1,
          h: Number(tile.dataset.h) || 1
        });
      }
      return rects;
    }

    async _onGridDrop(event, gridEl) {
      event.preventDefault();
      event.stopPropagation();
      this._clearDropGhost(gridEl);
      let data;
      try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
      if (data?.type !== "Item" || !data.uuid) return;

      const cols = Math.max(1, Number(gridEl.dataset.cols) || 9);
      const { x, y } = this._cellAt(event, gridEl);
      const doc = await fromUuid(data.uuid).catch(() => null);

      // objeto propio: mover, apilar o desequipar
      if (doc && doc.parent === this.actor) {
        // Si cae encima de un montón compatible, se apilan en vez de moverse.
        const target = this._stackTargetAt(gridEl, x, y, doc);
        if (target) return this._stackInto(doc, target);

        const bulky = Boolean(game.settings.get(MODULE_ID, "bulkyItems"));
        const size = itemFootprint(doc, bulky);
        const rect = {
          x: Math.max(0, Math.min(cols - size.w, x)),
          y: Math.max(0, y),
          ...size
        };

        const others = this._occupiedRects(gridEl, doc.id);
        const collisions = others.filter((other) => overlaps(rect, other));

        const positions = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "grid") ?? {});
        const slots = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "slots") ?? {});
        let cameFromSlot = false;
        for (const [k, v] of Object.entries(slots)) {
          if (v === doc.id) { delete slots[k]; cameFromSlot = true; }
        }

        if (collisions.length === 1) {
          // Un solo estorbo del mismo tamaño: se intercambian los sitios.
          const other = collisions[0];
          const previous = positions[doc.id];
          if (previous && other.w === rect.w && other.h === rect.h) positions[other.id] = previous;
          else delete positions[other.id];
        } else if (collisions.length > 1) {
          // Con varios no hay intercambio posible: se sueltan y se recolocan.
          for (const other of collisions) delete positions[other.id];
        }

        positions[doc.id] = { x: rect.x, y: rect.y };
        await this.actor.setFlag(MODULE_ID, "grid", positions);
        if (cameFromSlot) {
          await this.actor.setFlag(MODULE_ID, "slots", slots);
          if (foundry.utils.getProperty(doc, "system.equipped") !== undefined) {
            await doc.update({ "system.equipped": false }).catch(() => null);
          }
        }
        play(dropSoundFor(doc));
        return;
      }

      // objeto externo: crearlo con la lógica de dnd5e y colocarlo después
      this._pendingPlace = { x, y };
      try {
        await this._onDropItem(event, data);
      } catch (error) {
        console.warn(`${MODULE_ID} | drop externo`, error);
      }
    }

    async _onSlotDrop(event, key) {
      event.preventDefault();
      event.stopPropagation();
      let data;
      try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
      if (data?.type !== "Item" || !data.uuid) return;

      let doc = await fromUuid(data.uuid).catch(() => null);

      if (!doc || doc.parent !== this.actor) {
        // crear primero en el actor
        this._pendingSlot = key;
        try { await this._onDropItem(event, data); } catch {}
        return;
      }
      await this._assignSlot(key, doc);
    }

    /**
     * Guarda las ranuras recalculadas sin provocar otro render en cadena.
     * Se llama desde `_buildModel`, así que la escritura se aplaza.
     */
    _persistSlots(slots) {
      if (this._slotSyncing) return;
      this._slotSyncing = true;
      setTimeout(async () => {
        try { await this.actor.setFlag(MODULE_ID, "slots", slots); }
        catch (error) { console.warn(`${MODULE_ID} | No se pudieron guardar las ranuras`, error); }
        finally { this._slotSyncing = false; }
      }, 0);
    }

    async _assignSlot(key, item) {
      if (!slotAccepts(key, item)) {
        return ui.notifications?.warn(`${item.name} no encaja en ese espacio.`);
      }

      // Las manos se delegan en el Combat Hub para heredar sus reglas de
      // exclusión (dos manos, escudos, arma torpe). Él escribe system.equipped
      // y sus banderas; nosotros solo sacamos el objeto de la grilla.
      if (HAND_OF_SLOT[key] && hubActive()) {
        const handled = await equipHandViaHub(this.actor, key, item);
        if (handled) {
          const positions = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "grid") ?? {});
          delete positions[item.id];
          await this.actor.setFlag(MODULE_ID, "grid", positions);
          play(dropSoundFor(item));
          return this.render(false);
        }
      }

      const slots = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "slots") ?? {});
      const positions = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "grid") ?? {});

      // sacarlo de otro slot si estaba
      for (const [k, v] of Object.entries(slots)) if (v === item.id) delete slots[k];
      // si el slot estaba ocupado, el anterior vuelve a la grilla
      const previous = slots[key] ? this.actor.items.get(slots[key]) : null;
      if (previous) {
        delete positions[previous.id];
        if (foundry.utils.getProperty(previous, "system.equipped") !== undefined) {
          await previous.update({ "system.equipped": false }).catch(() => null);
        }
      }
      slots[key] = item.id;
      delete positions[item.id];
      await this.actor.setFlag(MODULE_ID, "slots", slots);
      await this.actor.setFlag(MODULE_ID, "grid", positions);
      if (foundry.utils.getProperty(item, "system.equipped") !== undefined) {
        await item.update({ "system.equipped": true }).catch(() => null);
      }
      play(dropSoundFor(item));
    }

    async _unequipSlot(key) {
      const slots = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, "slots") ?? {});
      const id = slots[key];
      if (!id) return;
      const item = this.actor.items.get(id);

      // Igual que al equipar: si es una mano y el Hub está activo, que sea él
      // quien la vacíe, para que un arma a dos manos libere las dos.
      if (HAND_OF_SLOT[key] && hubActive()) {
        const handled = await unequipHandViaHub(this.actor, key);
        if (handled) {
          if (item) play(dropSoundFor(item));
          return this.render(false);
        }
      }

      delete slots[key];
      await this.actor.setFlag(MODULE_ID, "slots", slots);
      if (item && foundry.utils.getProperty(item, "system.equipped") !== undefined) {
        await item.update({ "system.equipped": false }).catch(() => null);
      }
      if (item) play(dropSoundFor(item));
    }

    /* ---------------------------- Tooltip ------------------------------ */

    /**
     * «Acción», «Acción adicional», «Reacción», «1 minuto»… Se saca de las
     * actividades (dnd5e 4.x/5.x) y, si no hay, del campo antiguo.
     */
    _activationLabel(item) {
      const activities = item.system?.activities;
      const list = activities?.contents ?? (activities ? Object.values(activities) : []);
      const activation = list.find((a) => a?.activation?.type)?.activation
        ?? foundry.utils.getProperty(item, "system.activation");
      const type = activation?.type;
      if (!type || type === "none") return null;

      const config = CONFIG.DND5E?.activityActivationTypes?.[type]
        ?? CONFIG.DND5E?.abilityActivationTypes?.[type];
      const raw = typeof config === "string" ? config : (config?.label ?? type);
      const label = game.i18n.localize(raw);
      const value = Number(activation.value);
      // «2 acciones adicionales» tiene sentido; «1 acción» es ruido.
      return (Number.isFinite(value) && value > 1) ? `${value} ${label}` : label;
    }

    /** Descripción del objeto en texto plano, recortada para el tooltip. */
    _plainDescription(item) {
      const html = foundry.utils.getProperty(item, "system.description.value");
      if (!html) return "";
      const box = document.createElement("div");
      box.innerHTML = String(html);
      // Las imágenes de la descripción se ven en el chat, no aquí.
      const text = (box.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text.length <= 220) return text;
      return `${text.slice(0, 217).trimEnd()}…`;
    }

    _showTooltip(event, itemId) {
      const item = this.actor.items.get(itemId);
      if (!item) return;
      this._hideTooltip();

      const esc = foundry.utils.escapeHTML;
      const rarity = rarityInfo(item);
      const lines = [];

      // El título toma el color de la rareza; en los comunes se queda dorado.
      lines.push(`<header>${esc(item.name)}</header>`);

      const typeLabel = CONFIG.Item?.typeLabels?.[item.type]
        ? game.i18n.localize(CONFIG.Item.typeLabels[item.type])
        : item.type;
      const subtitle = [typeLabel];
      if (rarity.show) subtitle.push(rarity.label);
      lines.push(`<p class="sss-tt-type">${subtitle.map(esc).join(" · ")}</p>`);

      // Tiempo de activación: acción, acción adicional, reacción…
      const activation = this._activationLabel(item);
      if (activation) lines.push(`<p class="sss-tt-act"><i class="fas fa-bolt"></i>${esc(activation)}</p>`);

      const damages = item.labels?.damages ?? [];
      for (const d of damages) {
        const color = DAMAGE_COLORS[d.damageType] ?? "#ded4b5";
        lines.push(`<p class="sss-tt-dmg" style="color:${color}">${esc(d.formula ?? "")} ${esc(d.damageType ?? "")}</p>`);
      }

      const weight = foundry.utils.getProperty(item, "system.weight.value");
      const price = foundry.utils.getProperty(item, "system.price.value");
      const den = foundry.utils.getProperty(item, "system.price.denomination") ?? "gp";
      const meta = [];
      if (Number(weight)) meta.push(`${weight} lb`);
      const qty = Number(foundry.utils.getProperty(item, "system.quantity") ?? 1);
      if (qty > 1) meta.push(`×${qty}`);
      if (meta.length) lines.push(`<p class="sss-tt-meta">${meta.join(" · ")}</p>`);

      // El valor va aparte y con su moneda, que es lo que se mira al vender.
      if (Number(price)) {
        lines.push(`<p class="sss-tt-price"><b>${Number(price).toLocaleString("es-CL")}</b> ${esc(String(den).toUpperCase())}</p>`);
      }

      const description = this._plainDescription(item);
      if (description) lines.push(`<p class="sss-tt-desc">${esc(description)}</p>`);

      const tip = document.createElement("div");
      tip.className = `sss-tooltip sss-tt-${rarity.key}`;
      if (rarity.show) {
        tip.style.setProperty("--sss-rar", rarity.color);
        tip.style.setProperty("--sss-rar-glow", rarity.glow);
      }
      tip.innerHTML = lines.join("");
      document.body.appendChild(tip);
      const move = (ev) => {
        tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 12, ev.clientX + 14)}px`;
        tip.style.top = `${Math.min(window.innerHeight - tip.offsetHeight - 12, ev.clientY + 14)}px`;
      };
      move(event);
      this._tooltipEl = tip;
      this._tooltipMove = move;
      window.addEventListener("mousemove", move);
    }

    _hideTooltip() {
      if (this._tooltipMove) window.removeEventListener("mousemove", this._tooltipMove);
      this._tooltipEl?.remove();
      this._tooltipEl = null;
      this._tooltipMove = null;
    }

    /* ------------------------- Ciclo de vida --------------------------- */

    async _render(force, options) {
      await super._render(force, options);
      if (!this._sssOpened) {
        this._sssOpened = true;
        play("snd_chest_open.wav");
      }
    }

    async close(options) {
      // Toda la limpieza de la ventana en un solo sitio: antes había dos
      // `close` y el segundo pisaba al primero, así que el observador de
      // tamaño y el menú contextual se quedaban vivos.
      this._closeContextMenu();
      this._hideTooltip();
      this._gridObserver?.disconnect();
      this._gridObserver = null;
      this._draggingItem = null;
      clearTimeout(this._framingTimer);
      this._framingTimer = null;
      if (this._sssOpened) play("snd_chest_close.wav");
      this._sssOpened = false;
      return super.close(options);
    }
  };

  const collection = foundry.documents?.collections?.Actors ?? Actors;
  collection.registerSheet(MODULE_ID, StoneshardSheet, {
    types: ["character"],
    makeDefault: false,
    label: "SSSHEET.SheetLabel"
  });

  console.info(`${MODULE_ID} | Hoja Stoneshard registrada.`);
});

// Los módulos compañeros se preparan una vez, con el mundo ya montado. Si se
// dejan para el primer clic, ese clic paga la carga y se nota como retraso.
Hooks.once("ready", () => {
  if (game.system?.id !== "dnd5e") return;

  primeRarityResolver();
  if (hubActive()) loadHub();

  game.socket.on(`module.${MODULE_ID}`, async (payload) => {
    if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
    try {
      const from = game.actors.get(payload?.from);
      const to = game.actors.get(payload?.to);
      const sender = game.users.get(payload?.userId);
      if (!from || !to || !sender) return;
      if (from.type !== "character" || to.type !== "character" || from.id === to.id) return;
      const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
      if (!sender.isGM && !from.testUserPermission?.(sender, ownerLevel)) return;

      if (payload.action === "give-coins") {
        const mine = from.system?.currency ?? {};
        const theirs = to.system?.currency ?? {};
        const requested = payload.coins ?? {};
        const take = Object.fromEntries(CURRENCY_KEYS.map((key) => [
          key,
          Math.max(0, Math.min(Number(mine[key]) || 0, Math.floor(Number(requested[key]) || 0)))
        ]));
        await from.update(Object.fromEntries(CURRENCY_KEYS.map((key) => [
          `system.currency.${key}`, (Number(mine[key]) || 0) - take[key]
        ])));
        await to.update(Object.fromEntries(CURRENCY_KEYS.map((key) => [
          `system.currency.${key}`, (Number(theirs[key]) || 0) + take[key]
        ])));
        return;
      }

      if (payload.action === "give-item") {
        const item = from.items.get(payload.itemId);
        if (!item) return;
        const total = Math.max(1, Number(item.system?.quantity ?? 1));
        const amount = Math.max(1, Math.min(total, Math.floor(Number(payload.qty) || 1)));
        const data = item.toObject();
        delete data._id;
        if (total > 1) foundry.utils.setProperty(data, "system.quantity", amount);
        if (foundry.utils.getProperty(data, "system.equipped") !== undefined) {
          foundry.utils.setProperty(data, "system.equipped", false);
        }
        if (foundry.utils.getProperty(data, "system.attuned") !== undefined) {
          foundry.utils.setProperty(data, "system.attuned", false);
        }
        await to.createEmbeddedDocuments("Item", [data]);
        if (amount >= total) await item.delete();
        else await item.update({ "system.quantity": total - amount });
      }
    } catch (error) {
      console.error(`${MODULE_ID} | No fue posible entregar`, error);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Colocación y sonido de objetos creados desde fuera (compendio, etc.)      */
/* -------------------------------------------------------------------------- */

Hooks.on("createItem", async (item, options, userId) => {
  if (game.system?.id !== "dnd5e") return;

  try {
    if (userId !== game.user.id) return;
    const actor = item.parent;
    if (!actor || !StoneshardSheet) return;
    const sheet = actor.sheet;
    if (!(sheet instanceof StoneshardSheet) || !sheet.rendered) return;
    if (!INV_TYPES.includes(item.type)) return;

    if (sheet._pendingSlot) {
      const key = sheet._pendingSlot;
      sheet._pendingSlot = null;
      await sheet._assignSlot(key, item);
      return;
    }
    if (sheet._pendingPlace) {
      const { x, y } = sheet._pendingPlace;
      sheet._pendingPlace = null;
      const positions = foundry.utils.deepClone(actor.getFlag(MODULE_ID, "grid") ?? {});
      const taken = Object.values(positions).some((p) => p?.x === x && p?.y === y);
      if (!taken) {
        positions[item.id] = { x, y };
        await actor.setFlag(MODULE_ID, "grid", positions);
      }
    }
    play(dropSoundFor(item));
  } catch (error) {
    console.warn(`${MODULE_ID} | createItem`, error);
  }
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (game.system?.id !== "dnd5e") return;

  try {
    if (userId !== game.user.id) return;
    const actor = item.parent;
    if (!actor || !(actor.sheet instanceof StoneshardSheet)) return;
    play("snd_gui_drop_ico.wav");
  } catch {}
});
