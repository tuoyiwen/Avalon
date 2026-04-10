# Avalon

A web-based companion app for the board game **The Resistance: Avalon**. Players join a room on their phones, get assigned roles secretly, and play through quests digitally.

## Features

- **Role Assignment** — Merlin, Percival, Assassin, Morgana, Mordred, Oberon, Loyal Servants, Minions
- **Voice Narration** — Automatic "close your eyes / open your eyes" script via speech synthesis
- **Digital Quest Flow** — Leader selects team, all players vote, team members secretly play success/fail
- **Assassin Phase** — If good wins 3 quests, the Assassin gets one chance to guess Merlin
- **Bilingual** — Full Chinese/English toggle (中文/EN)
- **Mobile-Friendly** — Designed for phones, works on any device with a browser
- **Flexible Players** — Supports 5-10 players with configurable good/evil ratio

## How to Play

1. One person creates a game and shares the room code
2. Others join by entering the code on their phone
3. Host configures roles and starts the game
4. Voice narration plays the night phase (close eyes, reveal roles)
5. Each player sees their role and secret info on their own screen
6. A random leader picks a quest team each round
7. Everyone votes to approve/reject the team
8. Approved team members secretly play success or fail cards
9. First to 3 quest wins/losses determines the outcome
10. If good wins, the Assassin gets a final guess at Merlin

## Setup

```bash
npm install
node server.js
```

Open `http://localhost:3000` in your browser.

## Deployment

Deployed on [Render](https://render.com). The app uses Express + Socket.io with no database — game state lives in memory.

## Tech Stack

- **Server:** Node.js, Express, Socket.io
- **Client:** Plain HTML/CSS/JS (no build step)
- **Font:** EB Garamond + Inter
