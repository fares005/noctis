# NOCTIS — Midnight Neon React Prototype

React + TypeScript + Vite + Framer Motion + Firebase scaffold.

## Run

```bash
npm install
npm run dev
```

## Included
- playable local game against bots
- generated room codes + invite link / copy / share UI
- pre-game lobby with up to four player slots
- add/remove bots before starting
- settings modal
- English, German, French and Arabic selection
- RTL layout support for Arabic
- background MP3 with music toggle and volume slider
- sound-effects toggle
- loading screen, opening memory phase, Peek/Spy/Swap, Cabo, scoring, rounds, winner/rematch

## Multiplayer note
The room-code and invite interface is ready, but cross-device friend joining still requires connecting a real Firebase project. The existing `src/firebase/config.ts` is prepared for environment variables. Once Firebase credentials are added, the lobby can store rooms/players in Realtime Database and synchronize the game state between devices.

## Animated background update
- moving midnight nebula layers
- drifting/twinkling canvas stars
- subtle mouse parallax
- occasional shooting stars
- reactive cyan/violet/magenta/CABO pulse effects
- Background Animation On/Off setting (saved in localStorage)
- respects reduced-motion preferences


## Final card deck
Values 0–6 and 13 use the final single card artwork. Values 7–12 each contain four copies: two normal and two magic copies. Magic 7–8 = PEEK, 9–10 = SPY, 11–12 = SWAP.
