/**
 * Migración desde «Stoneshard Sheet PF2e & 5e - By Fatmorbus».
 *
 * Este módulo nació como copia de aquel, así que los datos que la hoja guarda
 * en cada actor (paperdoll, grilla, anclados, orden de conjuros, encuadre del
 * retrato) y la hoja elegida por actor seguían bajo el identificador antiguo.
 * Al iniciar, un DJ copia esas banderas al nuevo identificador una sola vez.
 * Solo copia: no borra nada del módulo antiguo.
 */
const MODULE_ID = "talespire-foundrysheets-by-velvet";
const LEGACY_ID = "stoneshard-sheet-by-fatmorbus";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "legacyMigrated", {
    scope: "world", config: false, type: Boolean, default: false
  });
});

Hooks.once("ready", async () => {
  if (!game.user?.isGM || game.settings.get(MODULE_ID, "legacyMigrated")) return;

  const updates = [];
  for (const actor of game.actors ?? []) {
    const update = {};
    const legacy = actor.flags?.[LEGACY_ID];
    // Nunca pisa datos que ya existan con el identificador nuevo.
    if (legacy && !actor.flags?.[MODULE_ID]) update[`flags.${MODULE_ID}`] = foundry.utils.deepClone(legacy);
    const sheetClass = actor.flags?.core?.sheetClass;
    if (typeof sheetClass === "string" && sheetClass.startsWith(`${LEGACY_ID}.`)) {
      update["flags.core.sheetClass"] = `${MODULE_ID}.${sheetClass.slice(LEGACY_ID.length + 1)}`;
    }
    if (Object.keys(update).length) updates.push({ _id: actor.id, ...update });
  }

  try {
    if (updates.length) await Actor.updateDocuments(updates);
    await game.settings.set(MODULE_ID, "legacyMigrated", true);
    if (updates.length) {
      console.log(`${MODULE_ID} | ${updates.length} actores migrados desde ${LEGACY_ID}`);
      ui.notifications?.info(`Talespire Foundry Sheets: ${updates.length} actores migrados desde la hoja de Fatmorbus.`);
    }
  } catch (err) {
    console.error(`${MODULE_ID} | Falló la migración desde ${LEGACY_ID}`, err);
  }
});
