# Multiplayer start synchronization fix

Fixed a React state timing bug where the host's initial game state could be written
to the previous/default room code instead of the lobby's actual Firebase room code.

The host now passes the lobby room code directly into beginRound(), and the initial
shared `/rooms/<room>/game` state is written to that exact room. Joined clients
listening to the real room can therefore receive the game phase and transition out
of the lobby when the host starts the game.
