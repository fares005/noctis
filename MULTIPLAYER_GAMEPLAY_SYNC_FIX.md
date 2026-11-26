# Multiplayer gameplay synchronization fix

Root cause fixed:
- Firebase `/game/phase` stayed `opening` after a player locally confirmed their starting memory cards.
- Any later Firebase update (such as drawing from the deck) re-delivered `phase: opening`, throwing both clients back to the selection screen.

New flow:
1. Every human player privately chooses two starting cards.
2. Confirm writes `openingReady/<uid> = true` and that player's memory indices to Firebase.
3. The host waits until every human has confirmed.
4. Only then does the host promote the shared game phase to `game`.
5. Gameplay updates explicitly carry `phase: game`, preventing stale phase regression.
6. Turn completion now synchronizes deck, discard, drawn-card clearing, players and turn pointer together.

This is still the Phase 2A shared-state model. Secure hidden-information isolation for PEEK/SPY/private hands remains Phase 2B.
