# Special-action intermittent freeze fix

Root cause: `publishCore()` refused to write while a Firebase snapshot was being applied (`applyingRemote.current`). PEEK/SPY/SWAP can resolve during that short window, so the critical next-turn write was sometimes silently dropped, leaving the room at `stage: special` until the 30-second timeout.

Fixes:
- Explicit player actions are no longer discarded just because a snapshot is currently being applied.
- PEEK/SPY/SWAP have a one-shot resolution guard to prevent double clicks/double completion.
- The guard resets after Firebase confirms the turn has left special state.
- Turn completion publishes `stage: draw` and the next player in the same authoritative update.
