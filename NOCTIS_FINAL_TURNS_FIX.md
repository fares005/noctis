# NOCTIS final-turn synchronization fix

For a 4-player room, calling NOCTIS gives the other 3 players exactly one final turn each.
The caller does not receive another turn.

Fixed:
- Human final turns now use live refs rather than stale React state.
- The player completing the last final turn triggers the shared Firebase round-end state.
- A bot completing the last final turn also ends the round globally.
- A 30-second timeout on the last final turn also ends the round globally.
- The host has a safety-net watcher: if Firebase reaches `finalTurns = 0`, it closes the round for everyone.
