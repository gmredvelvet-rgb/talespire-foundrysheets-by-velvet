/**
 * Hoja de Personaje 5e (By Fatmorbus)
 * rarity-bridge.js — Color de rareza en el inventario y en los tooltips.
 *
 * Se apoya en «Special Item Reveal - By Fatmorbus» cuando está activo: su
 * función `resolveRarity` ya sabe leer la rareza de dnd5e, de Shadowdark y de
 * Tidy 5e, y normaliza las variantes en español («muy raro», «legendaria»,
 * «artefacto»…). Aquí solo se le pide la clave y se traduce a color.
 *
 * Diferencia importante con ese módulo: él solo pinta los objetos marcados
 * como «especiales» por el DM. La hoja colorea **todos** los objetos según su
 * rareza, que es lo que se espera de un inventario.
 *
 * Si el módulo no está instalado se usa una lectura propia equivalente, para
 * que la hoja no dependa de él.
 */

const SIR_ID = "special-item-reveal-by-fatmorbus";

/**
 * Paleta por rareza. Son los mismos valores que usa Special Item Reveal, de
 * modo que un objeto se vea igual en la hoja que en el directorio o en Item
 * Piles. Si allí cambian, hay que cambiarlos aquí.
 */
const PALETTE = {
  common:      { color: "#a4a8ad", glow: "rgba(164,168,173,.35)", bg: "rgba(164,168,173,.08)" },
  uncommon:    { color: "#5dbb74", glow: "rgba(93,187,116,.38)",  bg: "rgba(93,187,116,.09)" },
  rare:        { color: "#5b93d3", glow: "rgba(91,147,211,.42)",  bg: "rgba(91,147,211,.09)" },
  "very-rare": { color: "#a96ed4", glow: "rgba(169,110,212,.42)", bg: "rgba(169,110,212,.10)" },
  legendary:   { color: "#d8ae55", glow: "rgba(216,174,85,.45)",  bg: "rgba(216,174,85,.10)" },
  artifact:    { color: "#b8463f", glow: "rgba(184,70,63,.48)",   bg: "rgba(184,70,63,.11)" }
};

const LABELS = {
  common: "Común",
  uncommon: "Poco común",
  rare: "Raro",
  "very-rare": "Muy raro",
  legendary: "Legendario",
  artifact: "Artefacto"
};

let sirResolve = null;
let sirLoad = null;

/** ¿Está Special Item Reveal instalado y activo? */
export function revealActive() {
  return game.modules.get(SIR_ID)?.active === true;
}

/**
 * Carga `resolveRarity` de Special Item Reveal una sola vez. Se dispara al
 * abrir la hoja; hasta que resuelve se usa la lectura propia, que da el mismo
 * resultado en los casos normales de dnd5e.
 */
export function primeRarityResolver() {
  if (sirResolve || sirLoad || !revealActive()) return;
  sirLoad = import(`/modules/${SIR_ID}/scripts/item-highlights.js`)
    .then((mod) => { sirResolve = typeof mod.resolveRarity === "function" ? mod.resolveRarity : null; })
    .catch((err) => {
      console.warn(`talespire-foundrysheets-by-velvet | Special Item Reveal está activo pero no se pudo leer su lógica de rareza`, err);
      sirResolve = null;
    });
}

/** Normalización propia, gemela de la de Special Item Reveal. */
function normalize(value) {
  if (value && typeof value === "object") value = value.value ?? value.id ?? value.label ?? "";
  const text = String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (!text) return "common";
  if (["artifact", "artefact", "artefacto", "unique", "unico"].some((v) => text.includes(v))) return "artifact";
  if (["legendary", "legendario", "legendaria"].some((v) => text.includes(v))) return "legendary";
  if (["veryrare", "muyraro", "muyrara"].some((v) => text.includes(v))) return "very-rare";
  if (["uncommon", "pococomun", "inusual"].some((v) => text.includes(v))) return "uncommon";
  if (["rare", "raro", "rara"].some((v) => text.includes(v))) return "rare";
  return "common";
}

/** Clave de rareza del objeto: `common`, `uncommon`, `rare`, `very-rare`… */
export function rarityOf(item) {
  if (sirResolve) {
    try { return sirResolve(item) ?? "common"; }
    catch (_error) { /* si su firma cambiara, seguimos con la lectura propia */ }
  }
  return normalize(
    foundry.utils.getProperty(item, "system.rarity")
    ?? foundry.utils.getProperty(item, "system.rarity.value")
  );
}

/**
 * Datos de rareza listos para pintar. `show` es false en los objetos comunes:
 * no tiene sentido teñir de gris medio inventario.
 */
export function rarityInfo(item) {
  const key = rarityOf(item);
  const palette = PALETTE[key] ?? PALETTE.common;
  return {
    key,
    label: LABELS[key] ?? LABELS.common,
    color: palette.color,
    glow: palette.glow,
    bg: palette.bg,
    show: key !== "common"
  };
}
