# NOCTIS Multiplayer Phase 2A

This build introduces the shared live-game transport layer:
- host creates the single shuffled deck/deal
- shared deck/discard state in Firebase Realtime Database
- shared current-turn pointer
- synchronized draw and replace/discard updates
- per-client player rotation so each human sees themselves at the bottom

This is a foundation build. PEEK/SPY/SWAP private information, authoritative validation, reconnect recovery, and full round-result synchronization belong to Phase 2B. Do not treat the current Firebase client state as cheat-resistant.
