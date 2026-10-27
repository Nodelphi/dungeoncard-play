// The save slots panel: keep up to three snapshots of a delve, load one, or move a delve between
// devices with a save file. Opened from the pause menu (to save) and the title screen (to load).
import { h, toast } from "./dom.js";
import { A, render, persist } from "./app.js";
import { listSlots, saveSlot, loadSlot, deleteSlot, exportRun, importRun } from "../engine/save.js";
import { HEROES } from "../../data/heroes.js";
import { ACT_NAMES } from "../../data/monsters.js";

let confirm = null;   // { slot, action } waiting for a second tap

const when = t => {
  const d = new Date(t), now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? `Today, ${time}` : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
};

function close() { confirm = null; A.overlay = A.title ? null : "menu"; render(); }

/** Replaces the current delve with a loaded one and drops into it. */
function enter(run) {
  A.run = run;
  A.title = false;
  A.choosing = false;
  A.overlay = null;
  confirm = null;
  persist();
  render();
  toast("Delve loaded");
}

export function savesOverlay() {
  const canSave = !!A.run && !A.title && !A.run.recorded && !A.busy;
  const slots = listSlots();
  const ask = (slot, action) => confirm?.slot === slot && confirm.action === action;
  const tap = (slot, action, run) => () => {
    // Overwriting a slot, loading over a delve in progress and deleting all take a second tap.
    const risky = action === "delete" || (action === "save" && slots[slot]) || (action === "load" && A.run && !A.run.recorded);
    if (risky && !ask(slot, action)) { confirm = { slot, action }; render(); return; }
    run();
  };

  const rows = slots.map((s, i) => {
    const hero = s && HEROES[s.hero];
    return h(`div.save-slot${s ? "" : ".empty"}`,
      h("div.slot-num", String(i + 1)),
      s ? h("div.slot-info",
        h("b", hero?.short || "Delver"),
        h("span", `${ACT_NAMES[s.act] || "Act " + s.act} · ${s.floor > 15 ? "Boss" : "Floor " + Math.max(1, s.floor)}${s.inCombat ? " · mid-fight" : ""}`),
        h("small", `${s.hp}/${s.maxHp} HP · ${s.gold} gold${s.descent ? ` · Descent ${s.descent}` : ""} · ${when(s.savedAt)}`))
        : h("div.slot-info", h("span", "Empty slot")),
      h("div.slot-actions",
        canSave && h("button.btn.small", { onclick: tap(i, "save", () => {
          if (!saveSlot(i, A.run)) return toast("Couldn't save: browser storage is full");
          confirm = null; render(); toast(`Saved to slot ${i + 1}`);
        }) }, ask(i, "save") ? "Overwrite?" : "Save"),
        s && h("button.btn.small.ghost", { onclick: tap(i, "load", () => {
          const run = loadSlot(i);
          if (!run) return toast("That save couldn't be read");
          enter(run);
        }) }, ask(i, "load") ? "Replace current?" : "Load"),
        s && h("button.btn.small.ghost.danger", { "aria-label": `Delete slot ${i + 1}`, onclick: tap(i, "delete", () => { deleteSlot(i); confirm = null; render(); }) }, ask(i, "delete") ? "Delete?" : "✕"),
      ),
    );
  });

  const fileInput = h("input", { type: "file", accept: ".dcsave,application/json", style: { display: "none" }, onchange: async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const run = importRun(await file.text());
    if (!run) return toast("That isn't a Dungeoncard save file");
    enter(run);
  } });

  return h("div.overlay", { onclick: e => { if (e.target === e.currentTarget) close(); } },
    h("div.panel.saves",
      h("h2.gilt-text", canSave ? "Save your delve" : "Load a delve"),
      h("p.saves-sub", canSave ? "Your delve is also saved automatically after every move. Slots keep a snapshot you can return to." : "Pick a saved snapshot, or import a save file."),
      h("div.save-slots", rows),
      h("div.saves-files",
        canSave && h("button.btn.small.ghost", { onclick: () => {
          const blob = new Blob([exportRun(A.run)], { type: "application/json" });
          const a = h("a", { href: URL.createObjectURL(blob), download: `dungeoncard-${A.run.hero}-act${A.run.act || 1}-floor${Math.max(1, A.run.floor)}.dcsave` });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        } }, "Export to file"),
        h("button.btn.small.ghost", { onclick: () => fileInput.click() }, "Import from file"),
        fileInput,
      ),
      h("button.btn", { onclick: close }, "Back"),
    ));
}
