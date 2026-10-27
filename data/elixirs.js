// One-use elixirs. You carry up to 3. `target: "enemy"` elixirs are thrown at a monster.
export const ELIXIRS = Object.fromEntries([
  { id: "healing_draught", name: "Healing Draught", target: "self", price: 55, text: "Heal 20 HP.", use: api => api.heal(20) },
  { id: "fire_flask", name: "Fire Flask", target: "enemy", price: 60, text: "Deal 20 damage to an enemy.", use: (api, t) => api.rawDamage(t, 20) },
  { id: "swiftness", name: "Draught of Swiftness", target: "self", price: 50, text: "Draw 3 cards.", use: api => api.draw(3) },
  { id: "vigor", name: "Elixir of Vigor", target: "self", price: 60, text: "Gain 2 Energy.", use: api => api.energy(2) },
  { id: "stoneskin", name: "Stoneskin Tonic", target: "self", price: 50, text: "Gain 15 Block.", use: api => api.gainBlock(15) },
  { id: "giants_brew", name: "Giant's Brew", target: "self", price: 65, text: "Gain 3 Strength for this fight.", use: api => api.status(api.combat.player, "strength", 3) },
  { id: "rage_tonic", name: "Rage Tonic", target: "self", price: 55, text: "Your next attack gets +12 damage.", use: api => api.status(api.combat.player, "edge", 12) },
  { id: "witchbane", name: "Witchbane Oil", target: "enemy", price: 55, text: "Apply 3 Weak and 3 Vulnerable to an enemy.",
    use: (api, t) => { api.status(t, "weak", 3); api.status(t, "vulnerable", 3); } },
].map(e => [e.id, { ...e, art: "elixir_" + e.id }]));
