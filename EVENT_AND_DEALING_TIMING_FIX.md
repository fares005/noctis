# Special-event timing + synchronized dealing

Perfect Eclipse:
- The event soundtrack is ~19.17 seconds long.
- The shared event now lasts ~20.5 seconds so the soundtrack and final visual beat can finish.
- All online players remain on the event screen during that window.
- The host advances the entire room after the shared timer; guests cannot independently skip the event.

Dealing:
- Multiplayer round state now begins as `phase: dealing`, not `phase: opening`.
- A shared `dealingEndsAt` timestamp keeps every browser on the dealing animation.
- Only the host changes Firebase to `opening` once the deal finishes.
- The deal itself was slowed slightly so all cards visibly travel from the deck to the seats.
- Local/offline mode still advances itself after the animation.
