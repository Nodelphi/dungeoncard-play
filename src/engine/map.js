// The act map: 15 floors of branching paths, then the boss (floor 16). Like Slay the Spire, paths
// are traced upward from the bottom row, so every room is reachable and leads somewhere.
export const FLOORS = 15;
export const COLS = 7;

/** Room types: fight, elite, event, shop, rest, vault, boss. */
export function generateMap(rng) {
  const nodes = {};
  const key = (f, c) => `${f}:${c}`;
  const get = (f, c) => (nodes[key(f, c)] ||= { id: key(f, c), floor: f, col: c, type: null, next: [] });

  // Trace six paths from bottom to top; each step moves up-left, up or up-right.
  const starts = [];
  for (let p = 0; p < 6; p++) {
    let c = p < 2 ? [1, 5][p] : rng.int(COLS);
    starts.push(c);
    for (let f = 1; f < FLOORS; f++) {
      const from = get(f, c);
      let nc;
      for (let tries = 0; tries < 8; tries++) {
        nc = Math.max(0, Math.min(COLS - 1, c + rng.range(-1, 1)));
        // Don't cross an existing edge (keeps the map readable).
        const crosses = Object.values(nodes).some(n => n.floor === f && n.next.some(id => {
          const t = nodes[id];
          return (n.col < c && t.col > nc) || (n.col > c && t.col < nc);
        }));
        if (!crosses) break;
      }
      const to = get(f + 1, nc);
      if (!from.next.includes(to.id)) from.next.push(to.id);
      c = nc;
    }
  }
  const boss = { id: "boss", floor: FLOORS + 1, col: 3, type: "boss", next: [] };
  Object.values(nodes).filter(n => n.floor === FLOORS).forEach(n => n.next.push("boss"));
  nodes.boss = boss;

  assignRooms(nodes, rng);
  Object.values(nodes).forEach(n => n.next.sort((a, b) => (nodes[a].col ?? 0) - (nodes[b].col ?? 0)));
  return { nodes, start: [...new Set(starts)].map(c => key(1, c)).sort() };
}

function assignRooms(nodes, rng) {
  const parents = id => Object.values(nodes).filter(n => n.next.includes(id));
  const list = Object.values(nodes).filter(n => n.type === null).sort((a, b) => a.floor - b.floor || a.col - b.col);
  for (const n of list) {
    const f = n.floor;
    if (f === 1) { n.type = "fight"; continue; }
    if (f === 8) { n.type = "vault"; continue; }
    if (f === FLOORS) { n.type = "rest"; continue; }
    const weights = { fight: 45, event: 22, elite: f >= 5 ? 14 : 0, shop: f >= 3 ? 7 : 0, rest: f >= 5 && f <= 13 ? 12 : 0 };
    // Avoid two special rooms of the same kind in a row on any path, and resting right before the final campfire.
    for (const p of parents(n.id)) if (["elite", "shop", "rest"].includes(p.type)) weights[p.type] = 0;
    if (f === FLOORS - 1) weights.rest = 0;
    n.type = rng.weighted(weights);
  }
}

/** Rooms the hero can move to next (from the start, any bottom-row room). */
export function reachable(map, current) {
  return current ? map.nodes[current].next : map.start;
}
