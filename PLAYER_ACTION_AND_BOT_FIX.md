# Multiplayer player-action authorization + online bots

- DISCARD and USE MAGIC now require `current === 0` on that browser.
- PEEK / SPY / SWAP resolution also requires that it is truly that player's active turn.
- Private Firebase state is ignored whenever the local client is not the active player, preventing stale drawn cards from reappearing.
- Removed an accidental duplicate `finishTurn()` implementation from the previous build.
- Online turns no longer skip bots.
- Only the host browser executes bot AI; its result is then published to Firebase for every client.
- Bots draw, replace/discard, and advance the shared turn automatically.

For real Firebase privacy, deploy the included private-secure database rules; a broad parent `.read: auth != null` would otherwise allow authenticated clients to read private children through the API even if the UI hides them.
