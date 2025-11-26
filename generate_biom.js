// generate_biom.js
// Biomy + nowe bloki śniegu, lodu, piaskowca i czerwonego piachu.
// - Rejestruje bloki: SNOW, ICE, SANDSTONE, RED_SAND (z teksturami).
// - Rozkład biomów: forest, snow, desert.
// - PODCZAS generowania chunku modyfikuje blocks:
//    * snow: śnieg na powierzchni, woda -> lód
//    * desert: trawa/ziemia -> piach/czerwony piach, głębiej piaskowiec
//
// Wymaga z Game (script.js):
//   WORLD, BOUNDS, BLOCK, BLOCK_INFO, world, gl, atlas, atlasTexture

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[BiomeGen] Brak globalnego Game – załaduj najpierw script.js');
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
    console.error('[BiomeGen] Brak wymaganych pól w Game (WORLD/BOUNDS/BLOCK/BLOCK_INFO/world/gl/atlas).');
    return;
  }

  const CHX = WORLD.CHUNK_X || 16;
  const CHY = WORLD.CHUNK_Y || WORLD.SIZE_Y || 256;
  const CHZ = WORLD.CHUNK_Z || 16;

  const SEA_LEVEL = WORLD.SEA_LEVEL || 48;

  // ===================================================================
  // 1. NOWE BLOKI (ŚNIEG, LÓD, PIASKOWIEC, CZERWONY PIACH)
  // ===================================================================

  // ID wg Twoich starych modułów
  BLOCK.SNOW      = BLOCK.SNOW      ?? 34;
  BLOCK.ICE       = BLOCK.ICE       ?? 35;
  BLOCK.SANDSTONE = BLOCK.SANDSTONE ?? 36;
  BLOCK.RED_SAND  = BLOCK.RED_SAND  ?? 37;

  BLOCK_INFO[BLOCK.SNOW] = BLOCK_INFO[BLOCK.SNOW] || {
    name: 'Śnieg',
    solid: true,
    transparent: false,
    snowy: true
  };

  BLOCK_INFO[BLOCK.ICE] = BLOCK_INFO[BLOCK.ICE] || {
    name: 'Lód',
    solid: true,
    transparent: true,
    slippery: true,
    isIce: true
  };

  BLOCK_INFO[BLOCK.SANDSTONE] = BLOCK_INFO[BLOCK.SANDSTONE] || {
    name: 'Piaskowiec',
    solid: true,
    transparent: false,
    rock: true
  };

  BLOCK_INFO[BLOCK.RED_SAND] = BLOCK_INFO[BLOCK.RED_SAND] || {
    name: 'Czerwony piach',
    solid: true,
    transparent: false,
    sandy: true
  };

  function registerSnowTexture() {
    if (atlas.blockTex[BLOCK.SNOW]) return;

    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, '#f6f8ff');
    g.addColorStop(0.5, '#e9f4ff');
    g.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    ctx.fillStyle = 'rgba(180,200,230,0.35)';
    for (let i = 0; i < 25; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      const w = 1 + Math.random() * 2;
      const h = 1 + Math.random() * 2;
      ctx.fillRect(rx, ry, w, h);
    }

    atlas.map['snow'] = { u, v };

    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                    gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[BiomeGen] Game.atlasTexture nie jest ustawione – tekstura snow może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.SNOW] = { all: 'snow' };
  }

  function registerIceTexture() {
    if (atlas.blockTex[BLOCK.ICE]) return;

    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, 'rgba(180,220,255,0.9)');
    g.addColorStop(0.5, 'rgba(150,200,245,0.8)');
    g.addColorStop(1.0, 'rgba(210,235,255,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const sx = x0 + Math.random() * tileSize;
      const sy = y0 + Math.random() * tileSize;
      const ex = sx + (Math.random() - 0.5) * tileSize * 0.8;
      const ey = sy + (Math.random() - 0.5) * tileSize * 0.8;
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 30; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      ctx.fillRect(rx, ry, 1, 1);
    }

    atlas.map['ice'] = { u, v };

    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                    gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[BiomeGen] Game.atlasTexture nie jest ustawione – tekstura ice może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.ICE] = { all: 'ice' };
  }

  function registerSandstoneTexture() {
    if (atlas.blockTex[BLOCK.SANDSTONE]) return;

    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;
    const x0 = u * tileSize;
    const y0 = v * tileSize;

    const g = ctx.createLinearGradient(x0, y0, x0, y0 + tileSize);
    g.addColorStop(0.0, '#f0e0b0');
    g.addColorStop(0.5, '#e0cc96');
    g.addColorStop(1.0, '#d1b77d');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    ctx.strokeStyle = 'rgba(180,150,90,0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const yy = y0 + (i + 1) * (tileSize / 5) + (Math.random() - 0.5) * 2;
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 + tileSize, yy + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }

    atlas.map['sandstone'] = { u, v };

    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                    gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[BiomeGen] Game.atlasTexture nie jest ustawione – tekstura sandstone może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.SANDSTONE] = { all: 'sandstone' };
  }

  function registerRedSandTexture() {
    if (atlas.blockTex[BLOCK.RED_SAND]) return;

    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;
    const x0 = u * tileSize;
    const y0 = v * tileSize;

    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, '#b84722');
    g.addColorStop(0.5, '#c9632a');
    g.addColorStop(1.0, '#d8823a');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    ctx.fillStyle = 'rgba(120,40,20,0.55)';
    for (let i = 0; i < 35; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      ctx.fillRect(rx, ry, 1, 1);
    }

    atlas.map['red_sand'] = { u, v };

    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                    gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[BiomeGen] Game.atlasTexture nie jest ustawione – tekstura red_sand może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.RED_SAND] = { all: 'red_sand' };
  }

  registerSnowTexture();
  registerIceTexture();
  registerSandstoneTexture();
  registerRedSandTexture();

  // Dodaj nowe bloki do kreatywnego ekwipunku
  if (Array.isArray(Game.CREATIVE_ITEMS)) {
    const pushIfMissing = (id) => {
      if (id == null) return;
      if (!Game.CREATIVE_ITEMS.includes(id)) {
        Game.CREATIVE_ITEMS.push(id);
      }
    };
    pushIfMissing(BLOCK.SNOW);
    pushIfMissing(BLOCK.ICE);
    pushIfMissing(BLOCK.SANDSTONE);
    pushIfMissing(BLOCK.RED_SAND);
  }

  const SNOW      = BLOCK.SNOW;
  const ICE       = BLOCK.ICE;
  const SANDSTONE = BLOCK.SANDSTONE;
  const RED_SAND  = BLOCK.RED_SAND;
  const SAND      = BLOCK.SAND;

  // ===================================================================
  // 2. Rozkład biomów (forest / snow / desert)
  // ===================================================================

  const SPAWN_X = 0;
  const SPAWN_Z = 0;

  const SAFE_RADIUS   = 32;
  const DESERT_INNER  = SAFE_RADIUS + 16;
  const DESERT_OUTER  = SAFE_RADIUS + 112;
  const SNOW_CELL_SIZE   = 64;
  const DESERT_CELL_SIZE = 48;

  function rand2biome(ix, iz, salt) {
    const seed = (WORLD.SEED | 0) ^ (salt | 0);
    let x = ix | 0;
    let z = iz | 0;
    let h = x * 374761393 + z * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h >>> 0) / 4294967295;
  }

  function chooseBiomeAt(x, z) {
    const dx = x - SPAWN_X;
    const dz = z - SPAWN_Z;
    const r  = Math.sqrt(dx * dx + dz * dz);

    if (r <= SAFE_RADIUS) return 'forest';

    if (r >= DESERT_INNER && r <= DESERT_OUTER) {
      const cx = Math.floor(x / DESERT_CELL_SIZE);
      const cz = Math.floor(z / DESERT_CELL_SIZE);
      const n  = rand2biome(cx, cz, 111);
      if (n < 0.8) return 'desert';
      return 'forest';
    }

    const cxSnow = Math.floor(x / SNOW_CELL_SIZE);
    const czSnow = Math.floor(z / SNOW_CELL_SIZE);
    const nSnow  = rand2biome(cxSnow, czSnow, 222);
    if (nSnow < 0.6) return 'snow';

    return 'forest';
  }

  function isDesertBiomeAt(x, z) { return chooseBiomeAt(x, z) === 'desert'; }
  function isSnowBiomeAt(x, z)   { return chooseBiomeAt(x, z) === 'snow';   }

  WORLD.getBiomeAt    = chooseBiomeAt;
  WORLD.isDesertBiome = isDesertBiomeAt;
  WORLD.isSnowBiome   = isSnowBiomeAt;
  Game.getBiomeAt     = chooseBiomeAt;
  Game.isDesertBiome  = isDesertBiomeAt;
  Game.isSnowBiome    = isSnowBiomeAt;

  // ===================================================================
  // 3. Modyfikacja chunku PODCZAS generacji
  // ===================================================================

  function applyBiomesToChunk(chunk) {
    const x0 = chunk.x0;
    const z0 = chunk.z0;

    for (let lx = 0; lx < CHX; lx++) {
      for (let lz = 0; lz < CHZ; lz++) {
        const gx = x0 + lx;
        const gz = z0 + lz;

        const biom = chooseBiomeAt(gx, gz);
        if (biom === 'forest') continue;

        // powierzchnia kolumny
        let topY = -1;
        for (let y = CHY - 1; y >= 0; y--) {
          const id = chunk.get(lx, y, lz);
          if (id !== BLOCK.AIR) {
            topY = y;
            break;
          }
        }
        if (topY < 0) continue;

        const surfaceId = chunk.get(lx, topY, lz);

        // ---------- BIOM ŚNIEŻNY ----------
        if (biom === 'snow') {
          if (SNOW != null && BLOCK_INFO[surfaceId]?.solid) {
            const aboveY = topY + 1;
            if (aboveY < CHY && chunk.get(lx, aboveY, lz) === BLOCK.AIR) {
              chunk.set(lx, aboveY, lz, SNOW);
            }
          }

          if (ICE != null) {
            for (let y = 0; y <= topY; y++) {
              const id = chunk.get(lx, y, lz);
              if (id === BLOCK.WATER) {
                chunk.set(lx, y, lz, ICE);
              }
            }
          }

          continue;
        }

        // ---------- BIOM PUSTYNIA ----------
        if (biom === 'desert') {
          const groundIds = new Set([
            BLOCK.GRASS,
            BLOCK.DIRT,
            SNOW
          ].filter(id => id != null));

          if (SAND != null && groundIds.has(surfaceId)) {
            const useRed = (RED_SAND != null && Math.random() < 0.30);
            const sandId = useRed ? RED_SAND : SAND;
            chunk.set(lx, topY, lz, sandId);

            if (SANDSTONE != null) {
              for (let dy = 1; dy <= 3; dy++) {
                const yy = topY - dy;
                if (yy <= 0) break;
                const id2 = chunk.get(lx, yy, lz);
                if (id2 === BLOCK.DIRT || id2 === BLOCK.STONE ||
                    id2 === SAND || id2 === RED_SAND) {
                  if (Math.random() < 0.6) {
                    chunk.set(lx, yy, lz, SANDSTONE);
                  }
                } else break;
              }
            }
          }

          if (surfaceId === BLOCK.WATER && SAND != null) {
            chunk.set(lx, topY, lz, SAND);
          }
        }
      }
    }

    chunk.dirty = true;
  }

  // ===================================================================
  // 4. Patch world.ensureChunk -> patchowanie Chunk.generate
  // ===================================================================

  if (!world._biomeGenPatchedEnsureChunk) {
    world._biomeGenPatchedEnsureChunk = true;

    const origEnsureChunk = world.ensureChunk.bind(world);

    world.ensureChunk = function (cx, cz) {
      const ch = origEnsureChunk(cx, cz);
      if (!ch) return ch;

      if (!ch._biomeGenPatchedGenerate) {
        ch._biomeGenPatchedGenerate = true;
        const origGenerate = ch.generate.bind(ch);

        ch.generate = function () {
          if (!this.generated) {
            origGenerate();          // bazowy teren z script.js
          }
          if (!this._biomeApplied) {
            applyBiomesToChunk(this); // modyfikacja wg biomów
            this._biomeApplied = true;
          }
        };
      }

      return ch;
    };
  }

  console.log('[BiomeGen] Załadowano generate_biom.js – biomy + bloki SNOW/ICE/SANDSTONE/RED_SAND.');

})(typeof window !== 'undefined' ? window : this);