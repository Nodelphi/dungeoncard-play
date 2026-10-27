// Saving and loading a run as JSON. Random-number generators are stored as their state, and the
// combat's link back to its run is dropped and restored on load.
import { Rng } from "./rng.js";

export function serialize(run) {
  return JSON.stringify(run, (key, value) => {
    if (value instanceof Rng) return { __rng: value.state };
    if (key === "run") return undefined;   // combat.run points back at the run
    if (key === "events") return [];       // animations already shown
    return value;
  });
}

export function deserialize(text) {
  const run = JSON.parse(text, (key, value) => (value && typeof value === "object" && "__rng" in value ? new Rng(value.__rng) : value));
  if (run.combat) run.combat.run = run;
  return run;
}

const KEY = "dungeoncard.run";
const META = "dungeoncard.meta";

export function saveRun(run, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, serialize(run)); } catch { /* storage full or blocked */ }
}
export function loadRun(storage = globalThis.localStorage) {
  try {
    const s = storage?.getItem(KEY);
    const run = s ? deserialize(s) : null;
    return run && run.version >= 2 ? run : null;   // older saves predate heroes and acts
  } catch { return null; }
}
export function clearRun(storage = globalThis.localStorage) {
  try { storage?.removeItem(KEY); } catch { /* ignore */ }
}

/** Lifetime records: runs, wins, best floor, biggest hit. */
export function loadMeta(storage = globalThis.localStorage) {
  const base = { runs: 0, wins: 0, bestFloor: 0, biggestHit: 0, descent: 0, heroWins: {} };
  try { return { ...base, ...JSON.parse(storage?.getItem(META) || "{}") }; }
  catch { return base; }
}
export function recordRun(run, storage = globalThis.localStorage) {
  const m = loadMeta(storage);
  m.runs++;
  if (run.screen === "victory") {
    m.wins++;
    m.heroWins[run.hero] = (m.heroWins[run.hero] || 0) + 1;
    // Winning at your highest Descent unlocks the next one.
    if ((run.descent || 0) >= m.descent) m.descent = Math.min(5, (run.descent || 0) + 1);
  }
  m.bestFloor = Math.max(m.bestFloor, run.stats.floors);
  m.biggestHit = Math.max(m.biggestHit, run.stats.biggestHit);
  try { storage?.setItem(META, JSON.stringify(m)); } catch { /* ignore */ }
  return m;
}

// ---------- save slots ----------
// Besides the automatic save, the player can keep up to three named snapshots of a delve and load
// any of them later, or export a delve to a file and import it on another device.
const SLOTS = "dungeoncard.slots";
export const SLOT_COUNT = 3;

/** Slot summaries (null for an empty slot). */
export function listSlots(storage = globalThis.localStorage) {
  let slots = [];
  try { slots = JSON.parse(storage?.getItem(SLOTS) || "[]"); } catch { slots = []; }
  return Array.from({ length: SLOT_COUNT }, (_, i) => (slots[i] && slots[i].data ? slots[i] : null));
}
export function slotSummary(run) {
  return { hero: run.hero, act: run.act || 1, floor: run.floor, hp: run.combat ? run.combat.player.hp : run.hp, maxHp: run.maxHp,
           gold: run.gold, descent: run.descent || 0, inCombat: !!run.combat, savedAt: Date.now() };
}
/** Saves a snapshot of the run into slot i. Returns false if storage refused it. */
export function saveSlot(i, run, storage = globalThis.localStorage) {
  const slots = listSlots(storage);
  slots[i] = { ...slotSummary(run), data: serialize(run) };
  try { storage?.setItem(SLOTS, JSON.stringify(slots)); return true; } catch { return false; }
}
export function loadSlot(i, storage = globalThis.localStorage) {
  const slot = listSlots(storage)[i];
  if (!slot) return null;
  try { const run = deserialize(slot.data); return run.version >= 2 ? run : null; } catch { return null; }
}
export function deleteSlot(i, storage = globalThis.localStorage) {
  const slots = listSlots(storage);
  slots[i] = null;
  try { storage?.setItem(SLOTS, JSON.stringify(slots)); } catch { /* ignore */ }
}

/** A save file's text: a small header plus the run. */
export function exportRun(run) {
  return JSON.stringify({ game: "dungeoncard", v: 1, summary: slotSummary(run), data: serialize(run) });
}
/** Reads a save file's text back into a run, or null if it isn't one. */
export function importRun(text) {
  try {
    const file = JSON.parse(text);
    if (file?.game !== "dungeoncard" || typeof file.data !== "string") return null;
    const run = deserialize(file.data);
    return run && run.version >= 2 && run.deck && run.map ? run : null;
  } catch { return null; }
}
