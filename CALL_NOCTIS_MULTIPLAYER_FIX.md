# CALL NOCTIS multiplayer fix

CALL NOCTIS is now an atomic Firebase action.

- The caller is stored using canonical Firebase player order.
- The next human player is activated in the same write.
- `calledBy`, `finalTurns`, current player, stage, players, deck and discard are synchronized together.
- Every client converts the canonical caller index back into its own locally rotated player order.
- Final-turn countdown can therefore continue correctly on every browser.

Use a new room after deployment.
