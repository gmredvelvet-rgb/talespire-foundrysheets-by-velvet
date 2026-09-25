/** Separación nativa exclusiva de la hoja Stoneshard de personaje en Foundry 14. */

const MODULE_ID = "talespire-foundrysheets-by-velvet";
const HOSTS = new WeakMap();
let NativeSheetHost = null;

function actorOf(app) {
  const document = app?.actor ?? app?.document ?? app?.object;
  return document?.documentName === "Actor" || document?.items ? document : null;
}

function rootElement(app) {
  const value = app?.element ?? app?._element;
  if (value instanceof HTMLElement) return value;
  if (value?.[0] instanceof HTMLElement) return value[0];
  if (typeof value?.get === "function") return value.get(0) ?? null;
  return null;
}

function isStoneshardCharacter(app) {
  const classes = new Set(app?.options?.classes ?? []);
  for (const name of rootElement(app)?.classList ?? []) classes.add(name);
  return classes.has("sss-window");
}

function isSupportedSheet(app) {
  if (game.system?.id !== "dnd5e") return false;
  const actor = actorOf(app);
  const type = String(actor?.type ?? "").toLowerCase();
  return type === "character" && isStoneshardCharacter(app);
}

function safeUniqueId(app) {
  const actor = actorOf(app);
  const raw = `${actor?.id ?? "actor"}-${app?.appId ?? foundry.utils.randomID?.(6) ?? Date.now()}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function sourcePosition(app) {
  const position = app?.position ?? {};
  return {
    width: Math.max(420, Number(position.width) || (isStoneshardCharacter(app) ? 1040 : 600)),
    height: Math.max(480, Number(position.height) || (isStoneshardCharacter(app) ? 820 : 700))
  };
}

function nativeHostClass() {
  if (NativeSheetHost) return NativeSheetHost;
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base || typeof Base.prototype?.detachWindow !== "function") return null;

  NativeSheetHost = class NativeDnd5eSheetHost extends Base {
    static DEFAULT_OPTIONS = {
      id: `${MODULE_ID}-detached-{id}`,
      classes: ["sss-native-detach-host"],
      tag: "section",
      window: {
        frame: true,
        positioned: true,
        minimizable: true,
        resizable: true,
        icon: "fa-solid fa-up-right-from-square"
      },
      position: { width: 1040, height: 820 }
    };

    constructor(sourceSheet, options = {}) {
      super(options);
      this.sourceSheet = sourceSheet;
      this.sourceRoot = null;
      this.origin = null;
    }

    get title() {
      return this.sourceSheet?.title || actorOf(this.sourceSheet)?.name || "Hoja D&D 5e";
    }

    async _renderHTML() {
      const mount = document.createElement("div");
      mount.className = "sss-native-detach-content";
      return mount;
    }

    _replaceHTML(result, content) { content.replaceChildren(result); }

    async _onRender(context, options) {
      await super._onRender(context, options);
      const mount = this.element?.querySelector?.(".sss-native-detach-content");
      const root = this.sourceRoot ?? rootElement(this.sourceSheet);
      if (!mount || !root) return;
      if (!this.sourceRoot) {
        this.sourceRoot = root;
        this.origin = { parent: root.parentNode, next: root.nextSibling };
      }
      root.classList.add("sss-detached-sheet-root");
      mount.append(root);
    }

    async _preClose(options) {
      this._restoreSource();
      await super._preClose(options);
    }

    _restoreSource() {
      const root = this.sourceRoot;
      const parent = this.origin?.parent;
      if (!root) return;
      root.classList.remove("sss-detached-sheet-root");
      try {
        if (parent?.isConnected) {
          const next = this.origin?.next;
          parent.insertBefore(root, next?.parentNode === parent ? next : null);
        } else document.body.append(root);
      } catch (_error) { document.body.append(root); }
      HOSTS.delete(this.sourceSheet);
      this.sourceRoot = null;
      this.origin = null;
    }
  };
  return NativeSheetHost;
}

async function legacyFallback(app) {
  const actor = actorOf(app);
  const SheetClass = app?.constructor;
  if (!actor || typeof SheetClass !== "function") return;
  const randomId = foundry.utils.randomID?.(8) ?? `${Date.now()}`;
  const sheetOptions = {
    id: `sss-separated-${actor.id}-${randomId}`,
    popOut: true,
    editable: app.isEditable
  };
  let separated;
  const applicationV2 = app?.document === actor && !app?.object;
  if (applicationV2) {
    separated = new SheetClass({ document: actor, ...sheetOptions });
  } else {
    separated = new SheetClass(actor, sheetOptions);
  }
  if (applicationV2) await separated.render({ force: true, focus: true });
  else await separated.render(true, { focus: true });
}

async function detachSheet(app) {
  if (!isSupportedSheet(app)) return;
  try {
    if (typeof app?.detachWindow === "function") {
      await app.detachWindow({ focus: true });
      return;
    }
    const Host = nativeHostClass();
    if (!Host) return legacyFallback(app);
    const existing = HOSTS.get(app);
    if (existing?.rendered) return existing.bringToFront?.();
    if (!rootElement(app)) return ui.notifications?.warn?.("La hoja debe estar abierta para separarla.");

    const actor = actorOf(app);
    const host = new Host(app, {
      uniqueId: safeUniqueId(app),
      position: sourcePosition(app),
      window: {
        title: app.title || actor?.name || "Hoja D&D 5e",
        icon: "fa-solid fa-user-shield"
      }
    });
    HOSTS.set(app, host);
    await host.render({ force: true, focus: false });
    await host.detachWindow({ focus: true });
  } catch (error) {
    console.error(`${MODULE_ID} | No fue posible separar la hoja`, error);
    const host = HOSTS.get(app);
    if (host) {
      try { await host.close(); }
      catch (_closeError) { /* La restauración no debe ocultar el error. */ }
    }
    ui.notifications?.warn?.("No fue posible separar la ventana. Revisa los permisos del navegador.");
  }
}

Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
  if (!Array.isArray(buttons) || !isSupportedSheet(app)) return;
  if (buttons.some((button) => button.class === "sss-native-detach")) return;
  buttons.unshift({
    label: "Separar ventana",
    class: "sss-native-detach",
    icon: "fas fa-up-right-from-square",
    onclick: () => detachSheet(app)
  });
});

Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  if (!Array.isArray(controls) || !isSupportedSheet(app)) return;
  const hasDetach = controls.some((control) => {
    const value = `${control?.action ?? ""} ${control?.label ?? ""}`.toLowerCase();
    return value.includes("detach") || value.includes("separar");
  });
  if (hasDetach) return;
  controls.unshift({
    action: "sss-native-detach",
    label: "Separar ventana",
    icon: "fa-solid fa-up-right-from-square",
    visible: true,
    // Foundry 13+ solo ejecuta onClick en los controles de cabecera V2.
    onClick: () => detachSheet(app)
  });
});

Hooks.on("closeActorSheet", (app) => {
  const host = HOSTS.get(app);
  if (host?.rendered) host.close().catch(() => {});
});
