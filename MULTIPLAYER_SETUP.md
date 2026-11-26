# NOCTIS multiplayer setup

This build adds the first real Firebase room layer: anonymous sign-in, room creation, joining by room code, live lobby members, host-controlled round/memory settings, and synchronized game start.

1. Create/select a Firebase project.
2. Enable **Anonymous** sign-in in Firebase Authentication.
3. Create a **Realtime Database**.
4. Copy `.env.example` to `.env` and fill in the Firebase web-app values.
5. Apply `firebase-database.rules.json` to the Realtime Database rules.
6. Run the app normally (`npm install`, then `npm run dev`).

Important: this is the multiplayer foundation/lobby synchronization. The existing gameplay engine is still client-local after the synchronized start. The next multiplayer stage is authoritative turn/card/deck synchronization, reconnect handling, and synchronized chat/emotes.
