# 30-second multiplayer turns + active bots

- Every turn has a shared Firebase `turnEndsAt` timestamp.
- All clients display the same 30-second countdown.
- The final 10 seconds pulse visually.
- If time reaches zero, the host is the single timeout authority and advances to the next player, even when the timed-out human is AFK/disconnected.
- Bots are controlled by the host and act after a short 0.9–2.0 second thinking delay.
- Bots draw, replace/discard, and can use PEEK, SPY, and SWAP.
- Bots also participate in the same shared turn order and 30-second fallback timer.
