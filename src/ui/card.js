// Draws a card element from a card instance.
import { h, art } from "./dom.js";
import { CARDS, cardText, cardName, cardCost } from "../../data/cards.js";
import { RUNES } from "../../data/runes.js";

/** Longer card text gets a smaller size so it always fits the parchment. */
const textSize = n => (n > 62 ? ".longest" : n > 42 ? ".longer" : n > 22 ? ".long" : "");
const TYPE_LABEL = { attack: "Attack", skill: "Skill", power: "Power", curse: "Curse" };

/** Card text with keywords and numbers lightly emphasised. Upgraded numbers show green. */
function richText(card) {
  const def = CARDS[card.id];
  const text = cardText(card);
  const upKeys = card.upgraded && def.up ? Object.keys(def.up) : [];
  const upVals = new Set(upKeys.filter(k => k !== "cost").map(k => String(def.up[k])));
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    // Dice notation ("2d6+3") stays together as one highlighted unit.
    .replace(/\b(\d+d\d+(?:[+-]\d+)?)|\b(\d+)\b/g, (m, dice) => dice
      ? `<span class="dice-txt${upVals.has(dice) ? " up" : ""}">${dice}</span>`
      : upVals.has(m) ? `<span class="up">${m}</span>` : `<b>${m}</b>`)
    .replace(/\b(Heavy|Exhaust|Vulnerable|Weak|Bleed|Momentum|Block|Strength|Dexterity|Energy|ALL|Mult|Unplayable|Advantage|Critical)\b/g, "<b>$1</b>");
}

export function cardEl(card, { playable = true, onClick, cls = "" } = {}) {
  const def = CARDS[card.id];
  const cost = cardCost(card);
  const el = h(`div.card${cls ? "." + cls : ""}`, {
    tabindex: "0", role: "button",
    dataset: { uid: card.uid, type: def.type, rarity: def.rarity },
    "aria-label": `${cardName(card)}, ${TYPE_LABEL[def.type]}, costs ${cost ?? "nothing"}. ${cardText(card)}`,
    title: `${TYPE_LABEL[def.type]} · ${def.rarity}`,
    onclick: onClick,
  },
    h("div.frame",
      h(`div.name${cardName(card).length > 15 ? ".longer" : cardName(card).length > 11 ? ".long" : ""}`, cardName(card)),
      art(def.art, { glyph: def.name[0] }),
      h("div.gem"),
      h(`div.text.parchment${textSize(cardText(card).length)}`, { html: `<span>${richText(card)}</span>` }),
    ),
    cost !== null && h(`div.cost${cost < def.cost ? ".cheaper" : ""}`, String(cost)),
    card.rune && h("div.rune", { style: { "--rune": RUNES[card.rune].color }, title: RUNES[card.rune].name }),
  );
  if (card.upgraded) el.classList.add("upgraded");
  if (!playable) el.classList.add("unplayable");
  el.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && onClick) { e.preventDefault(); onClick(e); } });
  return el;
}
