// The Balatro-style damage tally, played out over the fight:
//   dice tumble and land (Paladin), Base and Mult chips fill as each bonus flies in from its source,
//   ×Mult steps flare, then the result counts up and slams down with sparks, a shockwave and a shake
//   scaled to the size of the hit.
import { h } from "./dom.js";
import { sfx } from "./sfx.js";

const fmt = n => (Math.round(n * 100) / 100).toString();
const app = () => document.getElementById("app");

// Callouts for big results (the threshold is the final number).
const CALLOUTS = [[600, "Godlike!"], [300, "Legendary!"], [150, "Devastating!"], [75, "Crushing!"], [40, "Mighty!"]];

/** Centre of an element relative to the app box. */
function centre(el) {
  const r = el.getBoundingClientRect(), ar = app().getBoundingClientRect();
  return { x: r.left - ar.left + r.width / 2, y: r.top - ar.top + r.height / 2 };
}

/** A burst of sparks at a point (colour, count and reach scale with the moment). */
export function sparks(x, y, { n = 14, color = "var(--gilt-bright)", reach = 70, size = 6 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5, d = reach * (0.5 + Math.random() * 0.7);
    const s = h("div.spark", { style: { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, background: color } });
    app().append(s);
    s.animate([
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
    ], { duration: 420 + Math.random() * 300, easing: "cubic-bezier(.15,.7,.3,1)" }).onfinish = () => s.remove();
  }
}
/** An expanding ring. */
export function shockwave(x, y, { size = 160, color = "rgba(242, 212, 141, 0.9)" } = {}) {
  const r = h("div.shockwave", { style: { left: `${x}px`, top: `${y}px`, borderColor: color } });
  app().append(r);
  r.animate([{ width: "10px", height: "10px", opacity: 1, borderWidth: "6px" }, { width: `${size}px`, height: `${size}px`, opacity: 0, borderWidth: "1px" }],
    { duration: 480, easing: "ease-out" }).onfinish = () => r.remove();
}
/** Shakes the fight screen; strength 0..1. */
export function shake(strength) {
  const el = document.querySelector(".screen.combat");
  if (!el || strength <= 0) return;
  const p = Math.min(14, 3 + strength * 12);
  el.animate([
    { transform: "translate(0, 0)" }, { transform: `translate(${-p}px, ${p * 0.4}px)` }, { transform: `translate(${p * 0.8}px, ${-p * 0.5}px)` },
    { transform: `translate(${-p * 0.5}px, ${p * 0.3}px)` }, { transform: `translate(${p * 0.25}px, 0)` }, { transform: "translate(0, 0)" },
  ], { duration: 320 + strength * 200, easing: "ease-out" });
}
/** Flies a small label from one element to another, then resolves. */
function fly(text, cls, from, to, ms) {
  if (!from || !to) return Promise.resolve();
  const a = centre(from), b = centre(to);
  const el = h(`div.fly-chip.${cls}`, { style: { left: `${a.x}px`, top: `${a.y}px` } }, text);
  app().append(el);
  const anim = el.animate([
    { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
    { transform: "translate(-50%, -50%) scale(1.15)", opacity: 1, offset: 0.2 },
    { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(0.8)`, opacity: 0.9 },
  ], { duration: ms, easing: "cubic-bezier(.5,0,.6,1)" });
  return new Promise(res => { anim.onfinish = () => { el.remove(); res(); }; });
}
function pop(el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }

// ---------- dice ----------
const DIE_SHAPE = { 4: "d4", 6: "d6", 8: "d8", 10: "d10", 12: "d12", 20: "d20" };
function dieEl(d) {
  return h(`div.die.${DIE_SHAPE[d.sides] || "d6"}`, { title: `d${d.sides}` }, h("span.face", "?"), h("small", `d${d.sides}`));
}
/** Tumbles each die through random faces, then lands it on its roll. Crits flare gold. */
// An area attack shares one roll across its targets; only the first tally tumbles the dice.
const shownRolls = new WeakSet();
async function rollDiceRow(roll, host, wait, quick) {
  const seen = shownRolls.has(roll);
  shownRolls.add(roll);
  if (seen) quick = true;
  const row = h(`div.dice-row${roll.dice.length > 4 ? ".many" : ""}`);
  const els = roll.dice.map(dieEl);
  row.append(...els);
  if (roll.mod) row.append(h("span.dice-mod", `${roll.mod > 0 ? "+" : "−"}${Math.abs(roll.mod)}`));
  host.prepend(row);
  const spins = seen ? 0 : quick ? 3 : 6;
  els.forEach(el => el.classList.add("tumbling"));
  for (let i = 0; i < spins; i++) {
    els.forEach((el, k) => { el.querySelector(".face").textContent = String(1 + Math.floor(Math.random() * roll.dice[k].sides)); });
    if (i % 2 === 0) sfx.dice?.();
    await wait(quick ? 35 : 45);
  }
  els.forEach((el, k) => {
    const d = roll.dice[k];
    el.classList.remove("tumbling");
    el.querySelector(".face").textContent = String(d.value);
    if (d.other !== undefined) el.append(h("s.other", String(d.other)));   // Advantage: the lower die, struck out
    if (d.label) el.classList.add("extra");
    if (d.crit) { el.classList.add("crit"); const c = centre(el); sparks(c.x, c.y, { n: 8, reach: 40, size: 4 }); }
  });
  if (roll.crit && !seen) sfx.crit?.();
  await wait(seen ? 60 : quick ? 90 : 200);
  return row;
}

/**
 * Plays one tally. kind: "attack" | "block". hitIndex > 0 plays faster (later hits of a multi-hit card).
 * labelOf(step) names a step; slotOf(step) finds the treasure slot element it came from.
 */
export async function playTally(t, kind, hitIndex, { wait, labelOf, slotOf }) {
  const quick = hitIndex > 0;
  const stepMs = quick ? 80 : 170;
  const base = h(`span.chip.base${kind === "block" ? ".block" : ""}`, t.roll ? "…" : String(t.base));
  const mult = h("span.chip.mult", "1");
  const final = h("span.chip.final", "?");
  const src = h("div.src", "");
  const eq = h("div.tally-eq", base, h("span.op", "×"), mult, h("span.op", "="), final);
  const panel = h(`div.tally${kind === "block" ? ".is-block" : ""}`, eq, src);
  (document.querySelector(".enemies") || app()).append(panel);
  panel.animate([{ transform: "translate(-50%, -50%) scale(0.7)", opacity: 0 }, { transform: "translate(-50%, -50%) scale(1)", opacity: 1 }],
    { duration: quick ? 90 : 180, easing: "cubic-bezier(.2,1.4,.4,1)" });
  await wait(quick ? 50 : 120);

  if (t.roll?.dice.length) {
    await rollDiceRow(t.roll, panel, wait, quick);
    base.textContent = String(t.base);
    pop(base);
    sfx.tick(0);
    await wait(quick ? 40 : 120);
  }

  let i = 0;
  for (const step of t.steps) {
    const target = step.kind === "add" ? base : mult;
    const value = step.kind === "add" ? `+${step.value}` : step.kind === "mult" ? `+${fmt(step.value)}` : `×${fmt(step.value)}`;
    src.textContent = `${labelOf(step)} ${step.kind === "add" ? value : value + " Mult"}`;
    src.className = `src ${step.kind}`;
    const from = step.src === "treasure" ? slotOf(step) : null;
    if (from) {
      from.classList.remove("trigger"); void from.offsetWidth; from.classList.add("trigger");
      await fly(value, step.kind, from, target, quick ? 160 : 300);
    }
    if (step.kind === "add") { base.textContent = String(t.base + step.add); pop(base); sfx.tick(i); }
    else {
      mult.textContent = fmt(step.mult); pop(mult); sfx.mult(i);
      // Mult heats up as it grows.
      mult.style.setProperty("--heat", String(Math.min(1, Math.log2(Math.max(1, step.mult)) / 4)));
      if (step.kind === "xmult") {
        mult.classList.remove("flare"); void mult.offsetWidth; mult.classList.add("flare");
        const c = centre(mult);
        sparks(c.x, c.y, { n: quick ? 6 : 12, color: "#ff7a6e", reach: 55, size: 5 });
        if (step.label === "Critical!") {
          const cb = h("div.crit-burst", "Critical!");
          panel.append(cb);
          setTimeout(() => cb.remove(), 900);
          shake(0.25);
        } else panel.animate([{ transform: "translate(-50%, -50%) rotate(0)" }, { transform: "translate(-50%, -50%) rotate(-2deg)" }, { transform: "translate(-50%, -50%) rotate(1.5deg)" }, { transform: "translate(-50%, -50%) rotate(0)" }], { duration: 220 });
      }
    }
    i++;
    await wait(stepMs);
  }
  src.textContent = "";

  // Count up to the result, then slam.
  const n = t.final, steps = quick ? 4 : Math.min(10, 3 + Math.round(Math.log2(n + 1) * 1.2));
  for (let k = 1; k <= steps; k++) { final.textContent = String(Math.round((n * k) / steps)); await wait(quick ? 14 : 18); }
  final.textContent = String(n);
  const power = Math.min(1, Math.log10(Math.max(1, n)) / 2.6);   // 0 for 1, about 1 for 400+
  final.style.setProperty("--power", String(power));
  final.classList.add("slam");
  const fc = centre(final);
  if (kind === "attack") {
    sparks(fc.x, fc.y, { n: Math.round(8 + power * 22), reach: 50 + power * 110, size: 4 + power * 4 });
    if (n >= 20) shockwave(fc.x, fc.y, { size: 120 + power * 260 });
    if (!quick && n >= 25) sfx.slam();
    shake(n >= 20 ? power : 0);
    const call = !quick && CALLOUTS.find(([at]) => n >= at);
    if (call) {
      const el = h("div.callout", { style: { "--power": String(power) } }, call[1]);
      panel.append(el);
      setTimeout(() => el.remove(), 1000);
    }
  } else sparks(fc.x, fc.y, { n: 10, color: "var(--block)", reach: 50, size: 4 });
  await wait(quick ? 130 : 240 + power * 220);
  panel.animate([{ opacity: 1 }, { opacity: 0, transform: "translate(-50%, -60%) scale(0.92)" }], { duration: 140 }).onfinish = () => panel.remove();
}
