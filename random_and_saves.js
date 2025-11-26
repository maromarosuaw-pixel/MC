// random_and_saves.js
// System światów z seedem (10 cyfr), spawnem w (0,0) i zapisem zmian bloków.
// Każdy świat ma inny seed -> inny teren, bo wywołujemy Game.setWorldSeed(seed).
//
// Wymaga z Game (script.js):
//   WORLD, BLOCK, world, startGame(), setWorldSeed()

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[RandomAndSaves] Brak globalnego Game – załaduj najpierw script.js');
    return;
  }

  const { WORLD, BLOCK, world } = Game;
  if (!WORLD || !BLOCK || !world) {
    console.error('[RandomAndSaves] Brak wymaganych pól w Game (WORLD/BLOCK/world).');
    return;
  }

  // ===================== 1. STORAGE =====================

  const STORAGE_PREFIX = 'VoxelSaves';
  const META_KEY    = `${STORAGE_PREFIX}.worlds.meta`;
  const CURRENT_KEY = `${STORAGE_PREFIX}.currentWorldId`;

  function modsKeyForWorld(id) {
    return `${STORAGE_PREFIX}.world.${id}.mods`;
  }

  function loadMetaList() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd odczytu meta:', e);
      return [];
    }
  }

  function saveMetaList(list) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd zapisu meta:', e);
    }
  }

  function findMeta(id) {
    return loadMetaList().find(w => w.id === id) || null;
  }

  function upsertMeta(meta) {
    const list = loadMetaList();
    const idx = list.findIndex(w => w.id === meta.id);
    if (idx >= 0) list[idx] = meta; else list.push(meta);
    saveMetaList(list);
  }

  function deleteMeta(id) {
    const list = loadMetaList().filter(w => w.id !== id);
    saveMetaList(list);
    try {
      localStorage.removeItem(modsKeyForWorld(id));
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd usuwania danych świata:', e);
    }
  }

  function setCurrentWorldId(id) {
    try {
      localStorage.setItem(CURRENT_KEY, id || '');
      Game.currentWorldId = id || null;
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd zapisu currentWorldId:', e);
    }
  }

  function getCurrentWorldId() {
    if (Game.currentWorldId) return Game.currentWorldId;
    try {
      const id = localStorage.getItem(CURRENT_KEY);
      return id || null;
    } catch (e) {
      return null;
    }
  }

  // ===================== 2. SEED 10-CYFROWY =====================

  function randomSeed10() {
    let s = '';
    for (let i = 0; i < 10; i++) {
      let d = Math.floor(Math.random() * 10);
      if (i === 0 && d === 0) d = 1 + Math.floor(Math.random() * 9);
      s += d;
    }
    return s;
  }

  // ===================== 3. MAPA ZMIAN BLOKÓW =====================

  const WorldSaves = {
    _currentMeta: null,
    _mods: null
  };

  function loadModsForWorld(id) {
    try {
      const raw = localStorage.getItem(modsKeyForWorld(id));
      if (!raw) {
        WorldSaves._mods = {};
        return;
      }
      const obj = JSON.parse(raw);
      WorldSaves._mods = obj && typeof obj === 'object' ? obj : {};
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd odczytu zmian bloków:', e);
      WorldSaves._mods = {};
    }
  }

  function saveModsForWorld(id) {
    if (!id || !WorldSaves._mods) return;
    try {
      localStorage.setItem(modsKeyForWorld(id), JSON.stringify(WorldSaves._mods));
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd zapisu zmian bloków:', e);
    }
  }

  function recordBlockChange(x, y, z, id) {
    if (!WorldSaves._mods || !WorldSaves._currentMeta) return;
    const key = `${x}|${y}|${z}`;
    WorldSaves._mods[key] = id;
  }

  function applyModsToChunk(chunk) {
    const mods = WorldSaves._mods;
    if (!mods) return;

    const CHX = WORLD.CHUNK_X || 16;
    const CHY = WORLD.CHUNK_Y || WORLD.SIZE_Y || 256;
    const CHZ = WORLD.CHUNK_Z || 16;

    const x0 = chunk.x0;
    const z0 = chunk.z0;
    const x1 = x0 + CHX;
    const z1 = z0 + CHZ;

    let touched = false;

    for (const key in mods) {
      const [sxStr, syStr, szStr] = key.split('|');
      const sx = sxStr | 0, sy = syStr | 0, sz = szStr | 0;
      if (sx < x0 || sx >= x1 || sz < z0 || sz >= z1) continue;
      if (sy < 0 || sy >= CHY) continue;
      const id = mods[key];
      const lx = sx - x0;
      const lz = sz - z0;
      chunk.set(lx, sy, lz, id);
      touched = true;
    }

    if (touched) chunk.dirty = true;
  }

  // ===================== 4. PATCH world.setBlock + ensureChunk =====================

  // Dodajemy reset stanu świata na potrzeby przełączania światów
  if (!world.resetForNewWorld) {
    world.resetForNewWorld = function () {
      // wyczyść generowane chunki
      if (this.chunks && typeof this.chunks.clear === 'function') {
        this.chunks.clear();
      }
      // wyczyść pochodnie
      if (this.torches && typeof this.torches.clear === 'function') {
        this.torches.clear();
      }
      // wyczyść dropy
      if (Array.isArray(this.drops)) {
        this.drops.length = 0;
      }
      // wyczyść źródła lawy (używane do światła)
      if (this.lavaSources && typeof this.lavaSources.clear === 'function') {
        this.lavaSources.clear();
      }
    };
  }

  if (!world._savesPatchedSetBlock) {
    world._savesPatchedSetBlock = true;

    const origSetBlock = world.setBlock.bind(world);

    world.setBlock = function (x, y, z, id, options) {
      const prev = this.getBlock(x, y, z);
      origSetBlock(x, y, z, id, options);

      const opt = options || {};
      // Zmiany pochodzące z generatora / cieczy / innych modów – nie zapisujemy ich do save'a
      if (opt.fromGenerator || opt.fromLiquid || opt.fromWinterMod ||
          opt.fromDesertMod || opt.fromSave) {
        return;
      }

      if (prev === id) return;
      recordBlockChange(x, y, z, id);
    };
  }

  if (!world._savesPatchedEnsureChunk) {
    world._savesPatchedEnsureChunk = true;

    const origEnsureChunk = world.ensureChunk.bind(world);

    world.ensureChunk = function (cx, cz) {
      const ch = origEnsureChunk(cx, cz);
      if (!ch) return ch;
      if (WorldSaves._mods) {
        applyModsToChunk(ch);
      }
      return ch;
    };
  }

  // ===================== 5. START ŚWIATA Z META =====================

  function startWorld(meta) {
    WorldSaves._currentMeta = meta;
    setCurrentWorldId(meta.id);
    loadModsForWorld(meta.id);

    // Każdy świat ma spawn w (0,0) – jeśli brak w meta, ustaw teraz.
    if (typeof meta.spawnX !== 'number') meta.spawnX = 0;
    if (typeof meta.spawnZ !== 'number') meta.spawnZ = 0;
    upsertMeta(meta); // dopisz spawnX/spawnZ do meta w storage

    // Ustaw seed generatora świata (wpływa na fbm2/hash2 w script.js)
    if (typeof Game.setWorldSeed === 'function') {
      Game.setWorldSeed(meta.seed);
    } else {
      // awaryjnie – tylko nadpisz WORLD.SEED
      WORLD.SEED = parseInt(meta.seed, 10) || 0;
    }

    // Bardzo ważne: wyczyść aktualny stan świata, żeby chunki
    // były wygenerowane od nowa na podstawie nowego seeda.
    if (typeof world.resetForNewWorld === 'function') {
      world.resetForNewWorld();
    }

    // Przekaż spawn do rdzenia – script.js użyje Game.spawnOverride w Game.startGame()
    Game.spawnOverride = { x: meta.spawnX, z: meta.spawnZ };

    if (typeof Game.startGame === 'function') {
      Game.startGame();
    } else {
      console.warn('[RandomAndSaves] Game.startGame nie jest funkcją – upewnij się, że zaktualizowany script.js jest załadowany.');
    }
  }

  function saveCurrentWorld() {
    const meta = WorldSaves._currentMeta;
    if (!meta) return;
    meta.lastPlayedAt = Date.now();
    upsertMeta(meta);
    saveModsForWorld(meta.id);
  }

  // ===================== 6. MENU WYBORU ŚWIATA =====================

  let menuOverlay = null;
  let worldSelectEl = null;
  let seedLabelEl = null;
  let playBtn = null;
  let newBtn = null;
  let delBtn = null;

  function ensureMenuUI() {
    if (menuOverlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'world-menu-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      background: 'rgba(0,0,0,0.85)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      zIndex: '9000',
      fontFamily: 'sans-serif',
      color: '#fff'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: '#222',
      padding: '20px 24px',
      borderRadius: '6px',
      boxShadow: '0 0 16px rgba(0,0,0,0.7)',
      minWidth: '260px',
      maxWidth: '420px'
    });

    const title = document.createElement('div');
    title.textContent = 'Wybierz świat';
    Object.assign(title.style, {
      fontSize: '18px',
      marginBottom: '12px',
      textAlign: 'center'
    });

    const select = document.createElement('select');
    Object.assign(select.style, {
      width: '100%',
      padding: '6px',
      marginBottom: '8px',
      background: '#111',
      color: '#fff',
      border: '1px solid #555'
    });

    const seedInfo = document.createElement('div');
    seedInfo.style.fontSize = '12px';
    seedInfo.style.marginBottom = '12px';
    seedInfo.textContent = 'Seed: ';
    const seedSpan = document.createElement('span');
    seedSpan.textContent = '-';
    seedSpan.style.fontFamily = 'monospace';
    seedInfo.appendChild(seedSpan);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.justifyContent = 'space-between';

    function mkButton(text, bg) {
      const b = document.createElement('button');
      b.textContent = text;
      Object.assign(b.style, {
        flex: '1',
        padding: '6px',
        background: bg,
        color: '#fff',
        border: 'none',
        cursor: 'pointer'
      });
      return b;
    }

    const btnPlay = mkButton('Graj', '#4caf50');
    const btnNew  = mkButton('Nowy świat', '#2196f3');
    const btnDel  = mkButton('Usuń świat', '#f44336');

    btnRow.appendChild(btnPlay);
    btnRow.appendChild(btnNew);
    btnRow.appendChild(btnDel);

    panel.appendChild(title);
    panel.appendChild(select);
    panel.appendChild(seedInfo);
    panel.appendChild(btnRow);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    menuOverlay = overlay;
    worldSelectEl = select;
    seedLabelEl = seedSpan;
    playBtn = btnPlay;
    newBtn = btnNew;
    delBtn = btnDel;

    select.addEventListener('change', () => {
      const meta = getSelectedMeta();
      seedLabelEl.textContent = meta ? meta.seed : '-';
    });

    btnPlay.addEventListener('click', () => {
      let meta = getSelectedMeta();
      const worlds = loadMetaList();
      if (!meta && worlds.length === 0) {
        meta = createNewWorld();
      } else if (!meta && worlds.length > 0) {
        meta = worlds[0];
      }
      if (!meta) return;
      menuOverlay.style.display = 'none';
      startWorld(meta);
    });

    btnNew.addEventListener('click', () => {
      const meta = createNewWorld();
      refreshWorldList(meta.id);
    });

    btnDel.addEventListener('click', () => {
      const meta = getSelectedMeta();
      if (!meta) return;
      if (!confirm(`Na pewno usunąć "${meta.name || meta.id}"?`)) return;
      deleteMeta(meta.id);
      if (getCurrentWorldId() === meta.id) {
        setCurrentWorldId('');
        WorldSaves._currentMeta = null;
        WorldSaves._mods = null;
      }
      refreshWorldList();
    });
  }

  function getSelectedMeta() {
    if (!worldSelectEl) return null;
    const id = worldSelectEl.value;
    if (!id) return null;
    return findMeta(id);
  }

  function createNewWorld() {
    const seed = randomSeed10();
    const list = loadMetaList();
    const id   = `world-${Date.now()}-${list.length + 1}`;
    const meta = {
      id,
      name: `Świat ${list.length + 1}`,
      seed,
      spawnX: 0,
      spawnZ: 0,
      createdAt: Date.now(),
      lastPlayedAt: Date.now()
    };
    upsertMeta(meta);
    return meta;
  }

  function refreshWorldList(selectId) {
    if (!worldSelectEl || !seedLabelEl) return;

    const worlds = loadMetaList().slice().sort((a, b) =>
      (a.createdAt || 0) - (b.createdAt || 0)
    );

    worldSelectEl.innerHTML = '';

    if (worlds.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Brak światów (zostanie utworzony nowy)';
      worldSelectEl.appendChild(opt);
      worldSelectEl.disabled = true;
      delBtn.disabled = true;
      seedLabelEl.textContent = '-';
      return;
    }

    worldSelectEl.disabled = false;
    delBtn.disabled = false;

    for (const w of worlds) {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name || w.id;
      worldSelectEl.appendChild(opt);
    }

    const current = selectId || getCurrentWorldId();
    if (current) {
      const found = worlds.find(w => w.id === current);
      if (found) worldSelectEl.value = current;
    }

    const meta = getSelectedMeta();
    seedLabelEl.textContent = meta ? meta.seed : '-';
  }

  function showWorldMenu() {
    ensureMenuUI();
    refreshWorldList();
    if (menuOverlay) menuOverlay.style.display = 'flex';
  }

  // ===================== 7. HOOKI =====================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showWorldMenu);
  } else {
    showWorldMenu();
  }

  global.addEventListener('beforeunload', () => {
    saveCurrentWorld();
  });

  // ===================== 8. EKSPORT =====================

  WorldSaves.listWorlds       = loadMetaList;
  WorldSaves.createWorld      = createNewWorld;
  WorldSaves.startWorld       = startWorld;
  WorldSaves.saveCurrentWorld = saveCurrentWorld;
  WorldSaves.showWorldMenu    = showWorldMenu;

  Game.WorldSaves = WorldSaves;

  console.log('[RandomAndSaves] Załadowano random_and_saves.js – seed 10 cyfr, spawn (0,0), różne mapy dla różnych światów.');

})(typeof window !== 'undefined' ? window : this);