# NOCTIS multiplayer simplification + special-action fix

- Removed the READY system from the lobby.
- Host can start when there are at least 2 players.
- Shared 5-second countdown remains.
- Guests still cannot change host-only lobby settings.
- PEEK / SPY / SWAP now explicitly synchronize `special`, player memory/state, and turn completion.
- Remote clients now receive `special` state from Firebase.
- finishTurn clears the shared special state before advancing to the next human player.

Use a new room after deployment.
