# NOCTIS multiplayer ready system

Changes:
- Firebase `hostId` is the only authority for host controls.
- Guests cannot change rounds, memory mode, add bots, or remove bots.
- Every human member has a synchronized `ready` boolean.
- Bots do not have or require a ready state.
- The host's Begin the Night control unlocks only when at least two human players exist and every human is ready.
- Starting begins a shared 5-second Firebase countdown.
- At zero, only the host changes the room status to `playing`.
- Every client receives the same `playing` event and enters gameplay.
- Joined clients use their own Firebase member name when starting, not the host's start payload name.
