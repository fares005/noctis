# Private multiplayer action state

Fixed UI/gameplay privacy:
- A player's drawn card is no longer stored in the shared `/game/drawn` field.
- PEEK / SPY / SWAP selection state is no longer stored in shared `/game/special`.
- Each browser listens only to `/rooms/<room>/private/<its-own-uid>`.
- Other players receive only the final public game result (discard, swapped hands, next turn).
- Private state is cleared after discard, magic resolution, turn completion, or CALL NOCTIS.

Important security note:
The shared Phase 2A game node still contains the complete deck/hands internally, so a technically sophisticated player could inspect Firebase traffic. True anti-cheat privacy requires a host/server-authoritative hidden deck (Phase 2B server model). This build fixes normal gameplay/UI leakage first.
