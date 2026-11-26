# Global Perfect Eclipse / round-end synchronization

- `endRound()` now publishes a shared Firebase `roundEnd` phase.
- Every client receives the same updated scores, player totals, and Perfect Eclipse winner by player ID.
- Perfect Eclipse therefore appears on every connected player's screen, not just the player who triggered it.
- A Perfect Eclipse sets a shared automatic advance time ~9 seconds later.
- Only the host performs the authoritative next-round transition, and `beginRound(..., broadcast=true)` sends the new round to everybody.
- On the final configured round, the host publishes `gameEnd` so all players reach the champion screen together.
