// Small DOM helpers, icons, and painting slots.

/** h("div.card.selected", {onclick, style, dataset...}, ...children) */
export function h(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split(".");
  const el = document.createElement(tag || "div");
  if (classes.length) el.className = classes.join(" ");
  if (attrs === null || typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs)) { children.unshift(attrs); attrs = {}; }
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") for (const [p, val] of Object.entries(v)) el.style.setProperty(p.replace(/[A-Z]/g, m => "-" + m.toLowerCase()), val);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "class") el.className += " " + v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const svg = (name, cls = "") => {
  const span = document.createElement("span");
  span.innerHTML = ICONS[name] || "";
  const el = span.firstElementChild;
  if (el && cls) el.setAttribute("class", cls);
  return el || document.createTextNode("");
};

/** A painting slot. Falls back to a lettered placeholder until the art exists. */
export function art(id, { cls = "", glyph = "" } = {}) {
  const box = h(`div.art${cls ? "." + cls : ""}`, { dataset: { glyph } });
  const img = h("img", { alt: "", loading: "lazy", decoding: "async", draggable: "false" });
  img.onerror = () => box.classList.add("noart");
  img.src = `assets/art/${id}.webp`;
  box.append(img);
  return box;
}

export function toast(text, parent = document.getElementById("app")) {
  const t = h("div.toast", text);
  parent.append(t);
  setTimeout(() => t.remove(), 1900);
}

const S = (inner, extra = "") => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" ${extra}>${inner}</svg>`;
const ST = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const ICONS = {
  sword: S('<path d="M19.5 2.5 21.5 4.5 10 16l-2-2zM6.3 13.3l4.4 4.4-1.4 1.4-1.1-1.1-3.2 3.2-1.8-1.8 3.2-3.2-1.1-1.1z"/>'),
  swords: ST('<path d="M4 4l11 11M15 15l2 4 2-2-4-2M20 4 9 15M9 15l-2 4-2-2 4-2M4 4h3v3M20 4h-3v3"/>'),
  shield: S('<path d="M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z"/>'),
  heart: S('<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>'),
  coin: S('<circle cx="12" cy="12" r="9" fill="#e9c46a"/><circle cx="12" cy="12" r="6" fill="none" stroke="#9a7426" stroke-width="2"/>'),
  skull: S('<path fill-rule="evenodd" d="M12 2a8 8 0 0 0-8 8c0 3 1.4 5 3 6.2V20h2v-2h2v2h2v-2h2v2h2v-3.8c1.6-1.2 3-3.2 3-6.2a8 8 0 0 0-8-8zM8.8 12.6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6.4 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>'),
  flame: S('<path d="M12 2c1 4 5.5 5.5 5.5 11.2a5.5 5.5 0 0 1-11 0c0-2.7 1.3-4.3 2.7-5.4.2 2.1 1 3.2 2.1 3.7C10.8 9 10.4 5 12 2z"/>'),
  question: S('<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 16h-2v-2h2zm2.1-7.7-.9.9c-.7.7-1.2 1.3-1.2 2.8h-2v-.5c0-1.1.4-2.1 1.2-2.8l1.2-1.3c.4-.4.6-.9.6-1.4a2 2 0 0 0-4 0H8a4 4 0 0 1 8 0c0 .9-.4 1.7-.9 2.3z"/>'),
  chest: S('<path d="M4 4h16l1.5 6H2.5zM2.5 11h19v9h-19zM10.5 12.5h3v4h-3z"/>'),
  crown: S('<path d="M3 18h18l-1.6-11-4.6 4.2L12 4l-2.8 7.2L4.6 7zM3 19.5h18V21H3z"/>'),
  bag: S('<path d="M7 7a5 5 0 0 1 10 0h3l1 14H3L4 7zm2 0h6a3 3 0 0 0-6 0z"/>'),
  deck: S('<path d="M7 3h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM4 6v14a1 1 0 0 0 1 1h12v-1.5H5.5V6z"/>'),
  up: S('<path d="M12 3l7 8h-4v9H9v-9H5z"/>'),
  down: S('<path d="M12 21l-7-8h4V4h6v9h4z"/>'),
  swirl: ST('<path d="M12 12a2 2 0 1 0 2 2 4 4 0 1 0-4 4 6 6 0 1 0 6-6 8 8 0 1 0-8 8"/>'),
  plus: S('<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>'),
  drop: S('<path d="M12 2s7 7.6 7 12.5A7 7 0 0 1 5 14.5C5 9.6 12 2 12 2z"/>'),
  bolt: S('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'),
  crack: S('<path d="M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5zm-1 4-2 5 3 1-2 6 5-8-3-1 1.5-3z" fill-rule="evenodd"/>'),
  spike: S('<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>'),
  menu: S('<path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z"/>'),
  hammer: S('<path d="M3 7l5-5 4 4-2 2 9.5 9.5-2.5 2.5L7.5 10.5l-2 2z"/>'),
  bed: S('<path d="M3 6h2v7h16v6h-2v-2H5v2H3zM7 9h4v3H7zM12 10h7a2 2 0 0 1 2 2H12z"/>'),
};

// Which icon and colour each status uses.
export const STATUS_ICON = {
  strength: "sword", dexterity: "shield", vulnerable: "crack", weak: "down", frail: "crack",
  bleed: "drop", plating: "shield", ritual: "flame", berserk: "flame", edge: "sword", thorns: "spike",
};
export const ROOM_ICON = { fight: "swords", elite: "skull", event: "question", shop: "bag", rest: "flame", vault: "chest", boss: "crown" };
export const ROOM_NAME = { fight: "Fight", elite: "Elite", event: "Unknown", shop: "Merchant", rest: "Campfire", vault: "Vault", boss: "Boss" };
