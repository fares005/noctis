# Background animation stability fix

The background could occasionally appear frozen/corrupted until Animation was toggled off/on.

Fixes:
- AnimatedBackground is reinitialized whenever the game phase, round, or animation setting changes.
- Returning to the browser tab/window restarts the canvas animation cleanly.
- Transient PEEK/SPY/SWAP/NOCTIS pulse state is cleared when changing screens or rounds.
- Removed a render-time `Date.now()` animation key that could cause unnecessary pulse remounting.
- Canvas is explicitly cleared during teardown.

This should remove the need to manually toggle background animation to recover it.
