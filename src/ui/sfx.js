// Small synthesized sound effects (no audio files): hits, blocks, coins, card swishes, the tally's ticks.
// Sound starts only after the first tap (browsers require it) and can be muted from the menu.
let ctx = null;
const settings = (() => { try { return JSON.parse(localStorage.getItem("dungeoncard.settings") || "{}"); } catch { return {}; } })();
export const prefs = { muted: !!settings.muted, speed: settings.speed || 1 };
export function savePrefs() { try { localStorage.setItem("dungeoncard.settings", JSON.stringify(prefs)); } catch { /* ignore */ } }

function audio() {
  if (prefs.muted) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
window.addEventListener("pointerdown", () => audio(), { once: true });

function tone({ freq = 440, type = "sine", dur = 0.12, vol = 0.18, slide = 0, delay = 0 }) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise({ dur = 0.15, vol = 0.25, filter = 1200, delay = 0, q = 0.8 }) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = "bandpass"; f.frequency.value = filter; f.Q.value = q; g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  card: () => noise({ dur: 0.12, vol: 0.12, filter: 2600, q: 0.5 }),
  hit: big => { noise({ dur: big ? 0.35 : 0.18, vol: big ? 0.45 : 0.3, filter: big ? 500 : 900 }); tone({ freq: big ? 90 : 140, type: "triangle", dur: big ? 0.3 : 0.15, vol: 0.25, slide: -60 }); },
  hurt: () => { noise({ dur: 0.25, vol: 0.35, filter: 400 }); tone({ freq: 110, type: "sawtooth", dur: 0.2, vol: 0.12, slide: -50 }); },
  block: () => { tone({ freq: 880, type: "square", dur: 0.08, vol: 0.06 }); tone({ freq: 1320, type: "triangle", dur: 0.25, vol: 0.08, delay: 0.01 }); },
  tick: n => tone({ freq: 520 + n * 70, type: "triangle", dur: 0.07, vol: 0.09 }),
  mult: n => tone({ freq: 300 + n * 90, type: "sawtooth", dur: 0.1, vol: 0.07 }),
  dice: () => { noise({ dur: 0.04, vol: 0.12, filter: 3200, q: 2 }); noise({ dur: 0.03, vol: 0.08, filter: 2200, q: 2, delay: 0.03 }); },
  crit: () => [880, 1175, 1568].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.09, delay: i * 0.05 })),
  slam: () => { tone({ freq: 70, type: "sine", dur: 0.4, vol: 0.35, slide: -30 }); noise({ dur: 0.2, vol: 0.2, filter: 300 }); },
  coin: () => { tone({ freq: 1200, type: "square", dur: 0.06, vol: 0.05 }); tone({ freq: 1800, type: "square", dur: 0.12, vol: 0.05, delay: 0.06 }); },
  heal: () => { tone({ freq: 520, dur: 0.18, vol: 0.1 }); tone({ freq: 780, dur: 0.25, vol: 0.08, delay: 0.08 }); },
  death: () => { tone({ freq: 220, type: "sawtooth", dur: 0.6, vol: 0.1, slide: -170 }); noise({ dur: 0.5, vol: 0.15, filter: 250 }); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.3, vol: 0.1, delay: i * 0.1 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, type: "sine", dur: 0.5, vol: 0.12, delay: i * 0.22 })),
  buff: () => tone({ freq: 400, type: "triangle", dur: 0.3, vol: 0.08, slide: 400 }),
  debuff: () => tone({ freq: 500, type: "sawtooth", dur: 0.3, vol: 0.06, slide: -300 }),
};
