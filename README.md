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

## Roles

### Good Team (好人阵营)

| Role | Description |
|------|-------------|
| **Loyal Servant** (忠臣) | No special abilities. Must work together to figure out who is evil. |
| **Merlin** (梅林) | Knows who all the evil players are (except Mordred). Must stay hidden — if the Assassin identifies Merlin at the end, evil wins. |
| **Percival** (派西维尔) | Sees both Merlin and Morgana, but can't tell which is which. Tries to protect the real Merlin. |

### Evil Team (坏人阵营)

| Role | Description |
|------|-------------|
| **Minion of Mordred** (爪牙) | Knows the other evil players. Tries to sabotage quests without being caught. |
| **Assassin** (刺客) | Knows the other evil players. If good wins 3 quests, the Assassin gets one final chance to guess who Merlin is — a correct guess wins the game for evil. |
| **Morgana** (莫甘娜) | Appears as Merlin to Percival. Creates confusion about who the real Merlin is. |
| **Mordred** (莫德雷德) | Invisible to Merlin. The most hidden evil player — Merlin cannot identify Mordred. |
| **Oberon** (奥伯伦) | A lone wolf. Doesn't know the other evil players, and they don't know Oberon either. |

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
