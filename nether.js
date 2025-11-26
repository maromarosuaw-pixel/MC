// nether.js
// Wymiar Nether w tym samym świecie, z takimi samymi X/Z jak overworld.
// - Nowy blok: NETHERRACK.
// - Generacja: podłoga + sufit z netherracka, zagłębienia z prawdziwą lawą
//   (stawianą przez world.setBlock -> działa fizyka lawy z script.js).
// - Komendy: /world 0 (overworld), /world 1 (nether).
//
// Silnik dalej używa Y 0..255. W Netherze podłoga jest wewnętrznie ok. y≈40,
// ale script.js przesuwa widoczne Y o Game.NETHER_Y_OFFSET (np. -540),
// więc w HUD i komendach wygląda to jak y≈-500.

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[Nether] Brak globalnego Game – załaduj najpierw script.js');
    return;
  }

  const {
    WORLD,
    BOUNDS,
    BLOCK,
    BLOCK_INFO,
    world,
    gl,
    atlas,
    atlasTexture
  } = Game;

  if (!WORLD || !BOUNDS || !BLOCK || !BLOCK_INFO || !world || !gl || !atlas) {
    console.error('[Nether] Brak wymaganych pól w Game (WORLD/BOUNDS/BLOCK/BLOCK_INFO/world/gl/atlas).');
    return;
  }

  const CHX = WORLD.CHUNK_X || 16;
  const CHY = WORLD.CHUNK_Y || WORLD.SIZE_Y || 256;
  const CHZ = WORLD.CHUNK_Z || 16;

  const DIM = { OVERWORLD: 0, NETHER: 1 };

  // Spawn logiczny – takie same X/Z jak overworld (0,0)
  const NETHER_SPAWN_X = 0;
  const NETHER_SPAWN_Z = 0;

  // Zapamiętujemy ostatnie pozycje w wymiarach (tylko w RAM)
  const dimPos = {
    [DIM.OVERWORLD]: null,
    [DIM.NETHER]: null
  };

  // ===================================================================
  // 1. Blok NETHERRACK + tekstura
  // ===================================================================

  BLOCK.NETHERRACK = BLOCK.NETHERRACK ?? 38;

  BLOCK_INFO[BLOCK.NETHERRACK] = {
    name: 'Netherrack',
    solid: true,
    transparent: false
  };

  function registerNetherrackTexture() {
    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    // Tło – ciemnoczerwony gradient
    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, '#290000');
    g.addColorStop(0.5, '#5a0202');
    g.addColorStop(1.0, '#7b1010');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    // Jaśniejsze "żyły"
    ctx.strokeStyle = 'rgba(220,60,60,0.65)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      const sx = x0 + Math.random() * tileSize;
      const sy = y0 + Math.random() * tileSize;
      const ex = sx + (Math.random() - 0.5) * tileSize * 0.8;
      const ey = sy + (Math.random() - 0.5) * tileSize * 0.8;
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // Jasne drobinki
    ctx.fillStyle = 'rgba(245,230,230,0.95)';
    for (let i = 0; i < 30; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      const w = 1 + Math.floor(Math.random() * 2);
      const h = 1 + Math.floor(Math.random() * 2);
      ctx.fillRect(rx, ry, w, h);
    }

    // Ciemne drobinki
    ctx.fillStyle = 'rgba(15,0,0,0.9)';
    for (let i = 0; i < 38; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      ctx.fillRect(rx, ry, 1, 1);
    }

    atlas.map['netherrack'] = { u, v };

    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[Nether] Game.atlasTexture nie jest ustawione – tekstura netherrack może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.NETHERRACK] = { all: 'netherrack' };
  }

  registerNetherrackTexture();

  if (Array.isArray(Game.CREATIVE_ITEMS)) {
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.NETHERRACK)) {
      Game.CREATIVE_ITEMS.push(BLOCK.NETHERRACK);
    }
  }

  // ===================================================================
  // 2. Szum dla Netheru i helpery
  // ===================================================================

  function clamp(v,a,b){ return v<a?a: v>b?b: v; }

  function rand2(ix, iz, salt) {
    const seed = (WORLD.SEED | 0) ^ (salt | 0);
    let x = ix | 0;
    let z = iz | 0;
    let h = x * 374761393 + z * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h >>> 0) / 4294967295; // [0,1)
  }

  // Wysokość podłogi i sufitu dla danego X,Z (wewnętrzne y)
  function netherHeights(gx, gz) {
    const cellX = Math.floor(gx / 8);
    const cellZ = Math.floor(gz / 8);

    const nBase = (rand2(cellX, cellZ, 444) - 0.5) * 12;  // -6..6
    let floorH = 40 + Math.floor(nBase);                  // ok. 34..46
    floorH = clamp(floorH, 24, CHY - 80);

    const nRoof = (rand2(cellX, cellZ, 445) - 0.5) * 16;  // -8..8
    let roofH = 96 + Math.floor(nRoof);                   // ok. 88..104
    roofH = clamp(roofH, floorH + 20, CHY - 4);

    return { floorH, roofH };
  }

  // Główny generator chunków netherowych.
  // - w 1. przejściu robimy netherrack + sufity + powietrze,
  // - w 2. przejściu robimy zagłębienia i stawiamy źródła lawy przez world.setBlock
  //   z opcją {fromGenerator:true} – żeby:
  //     * nie zanieczyszczać save'ów,
  //     * odpaliła się fizyka lawy i oświetlenie.
  function netherifyChunk(chunk) {
    const x0 = chunk.x0;
    const z0 = chunk.z0;

    const LAKE_CELL = 32; // wielkość "komórki" jeziora – spore plamy

    // 1) Podstawa – netherrack + sufit
    for (let lx = 0; lx < CHX; lx++) {
      for (let lz = 0; lz < CHZ; lz++) {
        const gx = x0 + lx;
        const gz = z0 + lz;
        const { floorH, roofH } = netherHeights(gx, gz);

        for (let y = 0; y < CHY; y++) {
          let id;
          if (y < floorH)       id = BLOCK.NETHERRACK;
          else if (y > roofH)   id = BLOCK.NETHERRACK;
          else                  id = BLOCK.AIR;
          chunk.set(lx, y, lz, id);
        }
      }
    }

    // 2) Zagłębienia + źródła lawy
    for (let lx = 0; lx < CHX; lx++) {
      for (let lz = 0; lz < CHZ; lz++) {
        const gx = x0 + lx;
        const gz = z0 + lz;

        const { floorH } = netherHeights(gx, gz);

        const cx = Math.floor(gx / LAKE_CELL);
        const cz = Math.floor(gz / LAKE_CELL);
        const nBase   = rand2(cx, cz, 777);   // duże plamy
        const nDetail = rand2(gx, gz, 778);   // detal brzegu
        const lakeMask = nBase * 0.7 + nDetail * 0.3;

        const inLake = lakeMask < 0.30; // ~30% powierzchni w jeziorach
        if (!inLake) continue;

        const pitDepth = 3;
        const pitBottom = floorH - pitDepth;
        const pitTop    = floorH - 1;

        if (pitBottom < 4) continue; // bezpieczeństwo

        // wykop dół: usuń netherrack w zagłębieniu
        for (let y = pitBottom; y <= pitTop; y++) {
          chunk.set(lx, y, lz, BLOCK.AIR);
        }

        // Wstaw źródło lawy na dnie do świata (world.setBlock -> fizyka)
        world.setBlock(
          gx, pitBottom, gz,
          BLOCK.LAVA,
          { fromGenerator: true }
        );
      }
    }

    chunk.dirty = true;
    chunk._isNether = true;
  }

  // ===================================================================
  // 3. Patch world.ensureChunk – generacja w zależności od wymiaru
  // ===================================================================

  if (!world._netherPatchedEnsureChunk) {
    world._netherPatchedEnsureChunk = true;

    const prevEnsureChunk = world.ensureChunk.bind(world);

    world.ensureChunk = function (cx, cz) {
      const ch = prevEnsureChunk(cx, cz);
      if (!ch) return ch;

      if (Game.currentDimension === DIM.NETHER && !ch._isNether) {
        // Ustaw flagę przed generacją, żeby ewentualne world.setBlock
        // wewnątrz netherifyChunk nie odpaliły netherifyChunk rekurencyjnie.
        ch._isNether = true;
        netherifyChunk(ch);
      }

      return ch;
    };
  }

  // ===================================================================
  // 4. Teleportacja i przełączanie wymiarów
  // ===================================================================

  function teleportPlayerTo(x, y, z) {
    if (!Game.player) return;
    const p = Game.player;
    p.pos[0] = x;
    p.pos[1] = y;
    p.pos[2] = z;
    p.vel[0] = p.vel[1] = p.vel[2] = 0;
    p.onGround = false;
    p.fallStartY = null;
  }

  function resetWorldState() {
    world.chunks.clear();
    world.torches.clear();
    world.lavaSources.clear();
    world.drops.length = 0;
    world.waterQueue = [];
    world.lavaQueue = [];
  }

  function getOverworldSpawn() {
    const x = 0, z = 0;
    const cx = Math.floor(x / CHX);
    const cz = Math.floor(z / CHX);
    world.ensureChunk(cx, cz);

    let y = WORLD.SEA_LEVEL || 48;
    for (let yy = WORLD.SIZE_Y - 1; yy >= 0; yy--) {
      const id = world.getBlock(x, yy, z);
      if (BLOCK_INFO[id]?.solid) {
        y = yy + 1;
        break;
      }
    }
    return { x: x + 0.5, y: y + 0.1, z: z + 0.5 };
  }

  function getNetherSpawn() {
    const x = NETHER_SPAWN_X;
    const z = NETHER_SPAWN_Z;
    const cx = Math.floor(x / CHX);
    const cz = Math.floor(z / CHX);

    world.ensureChunk(cx, cz);
    const { floorH } = netherHeights(x, z);
    const y = floorH + 3;
    return { x: x + 0.5, y: y + 0.1, z: z + 0.5 };
  }

  function gotoOverworld() {
    const p = Game.player;
    if (!p) return;

    if (Game.currentDimension === DIM.NETHER) {
      dimPos[DIM.NETHER] = { x: p.pos[0], y: p.pos[1], z: p.pos[2] };
    }

    resetWorldState();
    Game.currentDimension = DIM.OVERWORLD;

    let target = dimPos[DIM.OVERWORLD];
    if (!target) {
      target = getOverworldSpawn();
      dimPos[DIM.OVERWORLD] = target;
    }

    teleportPlayerTo(target.x, target.y, target.z);
    console.log('[Nether] Przełączono na Overworld.');
  }

  function gotoNether() {
    const p = Game.player;
    if (!p) return;

    if (Game.currentDimension === DIM.OVERWORLD) {
      dimPos[DIM.OVERWORLD] = { x: p.pos[0], y: p.pos[1], z: p.pos[2] };
    }

    resetWorldState();
    Game.currentDimension = DIM.NETHER;

    let target = dimPos[DIM.NETHER];
    if (!target) {
      target = getNetherSpawn();
      dimPos[DIM.NETHER] = target;
    }

    teleportPlayerTo(target.x, target.y, target.z);
    console.log('[Nether] Przełączono na Nether.');
  }

  // ===================================================================
  // 5. Komenda /world 0 | /world 1
  // ===================================================================

  function handleWorldCommand(dimStr) {
    if (dimStr === '0') {
      gotoOverworld();
    } else if (dimStr === '1') {
      gotoNether();
    } else {
      console.warn('[Nether] Nieprawidłowy numer wymiaru w /world:', dimStr);
    }
  }

  function hookChatCommand() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) {
      console.warn('[Nether] Nie znaleziono #chatInput – nie mogę podpiąć komendy /world.');
      return;
    }

    chatInput.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;

      const text = chatInput.value.trim();
      if (!text.toLowerCase().startsWith('/world')) return;

      ev.preventDefault();
      ev.stopImmediatePropagation();

      const parts = text.split(/\s+/);
      const dimStr = parts[1] || '0';

      handleWorldCommand(dimStr);

      chatInput.value = '';

      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true
      });
      chatInput.dispatchEvent(escEvent);
    }, { capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookChatCommand);
  } else {
    hookChatCommand();
  }

  // ===================================================================
  // 6. Eksport do Game
  // ===================================================================

  Game.NetherMod = {
    NETHERRACK_ID: BLOCK.NETHERRACK,
    netherifyChunk,
    gotoOverworld,
    gotoNether
  };

  console.log('[Nether] Załadowano nether.js – nether z dynamicznymi jeziorami lawy i komendą /world 0|1.');

})(typeof window !== 'undefined' ? window : this);