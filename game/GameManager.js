const { Game } = require('./Game');

class GameManager {
  constructor() {
    this.games = new Map();
  }

  createGame(hostId, hostName) {
    const id = this._generateCode();
    const game = new Game(id, hostId, hostName);
    this.games.set(id, game);
    return game;
  }

  getGame(id) {
    return this.games.get(id?.toUpperCase()) || null;
  }

  removeGame(id) {
    this.games.delete(id);
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.games.has(code));
    return code;
  }
}

module.exports = new GameManager();
