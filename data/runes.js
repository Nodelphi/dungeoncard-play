// Runes are set into a single card for the rest of the run, like Balatro's card enhancements.
// One rune per card. onHit/onBlock add to that card's tally; onPlay fires when the card is played.
export const RUNES = Object.fromEntries([
  { id: "ember", name: "Ember Rune", color: "#E8743B", text: "+4 damage on attacks, +3 Block on Block.",
    onHit: () => ({ kind: "add", value: 4, label: "Ember" }), onBlock: () => ({ kind: "add", value: 3, label: "Ember" }) },
  { id: "blood", name: "Blood Rune", color: "#B3263A", text: "×1.5 Mult on this card's attacks.",
    onHit: () => ({ kind: "xmult", value: 1.5, label: "Blood" }) },
  { id: "storm", name: "Storm Rune", color: "#6FA8DC", text: "+2 Mult on this card's attacks and Block.",
    onHit: () => ({ kind: "mult", value: 2, label: "Storm" }), onBlock: () => ({ kind: "mult", value: 2, label: "Storm" }) },
  { id: "gilded", name: "Gilded Rune", color: "#E9C46A", text: "Gain 3 gold when this card is played.",
    onPlay: api => api.gold(3) },
  { id: "swift", name: "Swift Rune", color: "#8BD3A8", text: "This card costs 1 less (handled in cardCost)." },
  { id: "warding", name: "Warding Rune", color: "#9FB4C7", text: "Gain 4 Block when this card is played.",
    onPlay: api => api.gainBlock(4) },
].map(r => [r.id, r]));
