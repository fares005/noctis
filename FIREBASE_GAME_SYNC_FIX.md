# Firebase game synchronization fix

Realtime Database rejects JavaScript `undefined` values. Normal NOCTIS cards use an optional `special` property, so many cards contained `special: undefined`. The host could start locally, while the initial shared `/game` write failed and guests stayed on the countdown/lobby.

This build sanitizes every shared game payload with JSON serialization before `set()` / `update()`, which strips undefined properties while preserving all game data. It also logs Firebase game-sync failures to the browser console instead of silently swallowing them.
