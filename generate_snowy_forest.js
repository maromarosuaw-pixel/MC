// generate_snowy_forest.js
// Generowanie "śnieżnych lasów" – drzew tylko w BIOMIE ZIMOWYM (snow).
// Nie rusza pustyni ani zwykłych biomów.
// Używa globalnego Game i działa na chunkach już wygenerowanych przez script.js
// (i ewentualnie zmodyfikowanych przez biom_zimowy.js).
//
// Wymaga z Game:
//   WORLD, BLOCK, world
//   Game.isSnowBiome(x,z)  – z generate_biom.js
//   (opcjonalnie) Game.isDesertBiome(x,z)

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[SnowyForest] Brak globalnego Game – załaduj najpierw script.js');
    return;
  }

  const { WORLD, BLOCK, world } = Game;
  if (!WORLD || !BLOCK || !world) {
    console.error('[SnowyForest] Brak wymaganych pól w Game (WORLD/BLOCK/world).');
    return;
  }

  const CHUNK_X = WORLD.CHUNK_X || 16;
  const CHUNK_Y = WORLD.CHUNK_Y || WORLD.SIZE_Y || 256;
  const CHUNK_Z = WORLD.CHUNK_Z || 16;
  const SEA_LEVEL = WORLD.SEA_LEVEL || 48;

  const SNOW = BLOCK.SNOW;
  if (SNOW == null) {
    console.warn('[SnowyForest] BLOCK.SNOW nie jest zdefiniowany – załaduj najpierw biom_zimowy.js.');
    return;
  }

  const SPRUCE_LOG    = BLOCK.SPRUCE_LOG   ?? BLOCK.LOG;
  const SPRUCE_LEAVES = BLOCK.SPRUCE_LEAVES ?? BLOCK.LEAVES;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function isSnowBiome(x, z) {
    if (typeof Game.isSnowBiome === 'function') return Game.isSnowBiome(x, z);
    if (typeof Game.getBiomeAt === 'function') return Game.getBiomeAt(x, z) === 'snow';
    return false;
  }

  function isDesertBiome(x, z) {
    if (typeof Game.isDesertBiome === 'function') return Game.isDesertBiome(x, z);
    if (typeof Game.getBiomeAt === 'function') return Game.getBiomeAt(x, z) === 'desert';
    return false;
  }

  // ===================== Szum / maska gęstości =====================

  // Prosty hash 2D zależny od WORLD.SEED (zmienia się z seedem świata).
  function rand2(ix, iz, salt) {
    const seed = (WORLD.SEED | 0) ^ (salt | 0);
    let x = ix | 0;
    let z = iz | 0;
    let h = x * 374761393 + z * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h >>> 0) / 4294967295; // [0,1)
  }

  // Maska gęstości śnieżnych lasów – duże plamy (komórki 64x64).
  function snowyForestMask(gx, gz) {
    const cx = Math.floor(gx / 64);
    const cz = Math.floor(gz / 64);
    return rand2(cx, cz, 321); // [0,1)
  }

  // ===================== Narzędzia do drzew =====================

  function findSnowSurfaceY(chunk, lx, lz) {
    for (let y = CHUNK_Y - 1; y >= 0; y--) {
      const id = chunk.get(lx, y, lz);
      if (id === SNOW) return y;
    }
    return -1;
  }

  function buildSnowTreeInChunk(chunk, lx, lz, groundY, gx, gz) {
    // Wysokość pnia 5..8
    const hRand = rand2(gx + 1234, gz - 9876, 777);
    const trunkH = 5 + Math.floor(hRand * 4); // 5–8

    // Nie wychodzimy poza chunk w pionie
    if (groundY + trunkH + 3 >= CHUNK_Y) return;

    // Nie stawiamy drzew na wodzie/ lodzie pod śniegiem
    const belowId = groundY > 0 ? chunk.get(lx, groundY - 1, lz) : 0;
    if (belowId === BLOCK.WATER || belowId === BLOCK.ICE) return;

    // Pień – zawsze świerk (albo fallback LOG)
    for (let ty = 1; ty <= trunkH; ty++) {
      const y = groundY + ty;
      chunk.set(lx, y, lz, SPRUCE_LOG);
    }

    const topY = groundY + trunkH;

    // Korona – wysoka, wąska, "choinkowa"
    for (let dy = -1; dy <= 3; dy++) {
      const radius = clamp(3 - Math.abs(dy), 1, 3); // u góry mniejsza
      const y = topY + dy;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const ax = lx + dx;
          const az = lz + dz;
          if (ax < 0 || az < 0 || ax >= CHUNK_X || az >= CHUNK_Z) continue;

          // lekko "okrągła" korona
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;

          const cur = chunk.get(ax, y, az);
          if (cur === BLOCK.AIR || cur === SNOW) {
            chunk.set(ax, y, az, SPRUCE_LEAVES);
          }
        }
      }
    }

    chunk.dirty = true;
  }

  function generateSnowForestInChunk(chunk) {
    const x0 = chunk.x0;
    const z0 = chunk.z0;

    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const gx = x0 + lx;
        const gz = z0 + lz;

        if (!isSnowBiome(gx, gz)) continue;
        if (isDesertBiome(gx, gz)) continue; // bezpieczeństwo, gdyby coś poszło źle

        const snowY = findSnowSurfaceY(chunk, lx, lz);
        if (snowY < 0) continue;

        // Nie za nisko (poniżej morza) i nie absurdalnie wysoko
        if (snowY <= SEA_LEVEL) continue;
        if (snowY >= 120) continue;

        const mask = snowyForestMask(gx, gz);
        if (mask <= 0.3) continue; // większość obszarów bez lasu

        const density = (mask - 0.3) / 0.7; // 0..1
        const r = rand2(gx, gz, 999);

        // Szansa na drzewo – od 3% do ~13% w gęstych obszarach
        if (r < 0.03 + density * 0.10) {
          buildSnowTreeInChunk(chunk, lx, lz, snowY, gx, gz);
        }
      }
    }

    chunk._snowForestGenerated = true;
  }

  // ===================== Patch world.ensureChunk =====================

  if (!world._snowForestPatchedEnsureChunk) {
    world._snowForestPatchedEnsureChunk = true;

    const prevEnsureChunk = world.ensureChunk.bind(world);

    world.ensureChunk = function (cx, cz) {
      const ch = prevEnsureChunk(cx, cz);
      if (!ch) return ch;

      if (!ch._snowForestGenerated) {
        generateSnowForestInChunk(ch);
      }

      return ch;
    };
  }

  // ===================== Export do Game =====================

  Game.snowyForestMod = {
    generateSnowForestInChunk,
    enableForWorld: () => { /* już aktywne przez patch ensureChunk */ }
  };

  console.log('[SnowyForest] Załadowano generate_snowy_forest.js – śnieżne lasy w biomie zimowym.');

})(typeof window !== 'undefined' ? window : this);