// player_posiction.js
// Zapamiętuje pozycję gracza per świat i przy starcie świata
// ustawia go w ostatnim miejscu zamiast na spawnie.
//
// Wymaga z Game:
//   WORLD, world, startGame(), player (script.js: Game.player = player)
//   Game.currentWorldId (ustawiany przez random_and_saves.js)

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[PlayerPosition] Brak globalnego Game – załaduj najpierw script.js');
    return;
  }

  const { WORLD, world } = Game;
  if (!WORLD || !world) {
    console.error('[PlayerPosition] Brak wymaganych pól w Game (WORLD/world).');
    return;
  }

  if (!Game.player) {
    console.warn('[PlayerPosition] Game.player nie jest zdefiniowane. ' +
                 'Dodaj w script.js na końcu: Game.player = player;');
    return;
  }

  const player = Game.player;

  // ===================== 1. STORAGE =====================

  const POS_PREFIX = 'VoxelSaves.playerPos.';

  function posKeyForWorld(id) {
    return POS_PREFIX + id;
  }

  function loadPosForWorld(id) {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(posKeyForWorld(id));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      const { x, y, z, yaw, pitch } = obj;
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
        return null;
      }
      return {
        x, y, z,
        yaw: typeof yaw === 'number' ? yaw : null,
        pitch: typeof pitch === 'number' ? pitch : null
      };
    } catch (e) {
      console.warn('[PlayerPosition] Błąd odczytu pozycji gracza:', e);
      return null;
    }
  }

  function savePosForWorld(id, pos) {
    if (!id || !pos) return;
    try {
      localStorage.setItem(posKeyForWorld(id), JSON.stringify(pos));
    } catch (e) {
      console.warn('[PlayerPosition] Błąd zapisu pozycji gracza:', e);
    }
  }

  // ===================== 2. ZAPIS POZYCJI =====================

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function saveCurrentPlayerPos() {
    const worldId = Game.currentWorldId;
    if (!worldId) return;
    if (!Game.player) return;

    const p = Game.player;
    const pos = {
      x: clamp(p.pos[0], -WORLD.SIZE_X / 2 + 0.5, WORLD.SIZE_X / 2 - 0.5),
      y: clamp(p.pos[1], 0.1, WORLD.SIZE_Y + 20),
      z: clamp(p.pos[2], -WORLD.SIZE_Z / 2 + 0.5, WORLD.SIZE_Z / 2 - 0.5),
      yaw: p.yaw,
      pitch: p.pitch
    };

    savePosForWorld(worldId, pos);
  }

  // ===================== 3. ODTWARZANIE POZYCJI PRZY STARcie ŚWIATA =====================

  function applyLastPosIfExists() {
    const worldId = Game.currentWorldId;
    if (!worldId) return;
    if (!Game.player) return;

    const stored = loadPosForWorld(worldId);
    if (!stored) return;

    const p = Game.player;

    // Ustaw pozycję z zapisu
    p.pos[0] = stored.x;
    p.pos[1] = stored.y;
    p.pos[2] = stored.z;

    if (typeof stored.yaw === 'number')   p.yaw   = stored.yaw;
    if (typeof stored.pitch === 'number') p.pitch = stored.pitch;

    console.log('[PlayerPosition] Przywrócono pozycję gracza dla świata', worldId,
                'na', stored.x.toFixed(1), stored.y.toFixed(1), stored.z.toFixed(1));
  }

  // ===================== 4. PATCH Game.startGame =====================

  if (typeof Game.startGame === 'function' && !Game._playerPosPatchedStartGame) {
    Game._playerPosPatchedStartGame = true;

    const origStartGame = Game.startGame.bind(Game);

    Game.startGame = function () {
      // Uruchom oryginalny start gry (generacja, pętla, spawn itp.)
      origStartGame();

      // Następnie spróbuj przesunąć gracza na ostatnią pozycję
      // (jeśli istnieje zapis dla tego świata).
      try {
        applyLastPosIfExists();
      } catch (e) {
        console.warn('[PlayerPosition] Błąd przy przywracaniu pozycji:', e);
      }
    };
  } else if (typeof Game.startGame !== 'function') {
    console.warn('[PlayerPosition] Game.startGame nie jest funkcją – ' +
                 'player_posiction.js musi być załadowany PO script.js.');
  }

  // ===================== 5. HOOK beforeunload (auto-zapis) =====================

  global.addEventListener('beforeunload', () => {
    try {
      saveCurrentPlayerPos();
    } catch (e) {
      console.warn('[PlayerPosition] Błąd auto-zapisu pozycji przy beforeunload:', e);
    }
  });

  // ===================== 6. Eksport API =====================

  Game.PlayerPositionMod = {
    saveNow: saveCurrentPlayerPos,
    loadNow: applyLastPosIfExists
  };

  console.log('[PlayerPosition] Załadowano player_posiction.js – zapamiętywanie pozycji gracza per świat.');

})(typeof window !== 'undefined' ? window : this);