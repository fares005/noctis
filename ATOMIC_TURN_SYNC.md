# Atomic multiplayer turn synchronization

The freeze after each player completed a turn was caused by multiple asynchronous Firebase updates for one action. An older `stage: waiting` or special-clear update could arrive after the next-turn update and leave every client waiting.

This build:
- completes each normal turn with one Firebase update
- PEEK/SPY/SWAP use the same single completion update
- replacement without a power no longer sends an intermediate `waiting` state
- discard passes its newest discard pile into the same turn-completion write
- older game revisions are ignored when a newer revision has already been processed

Countdown remains; READY system remains removed.
