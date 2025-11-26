// generate_forest.js
// Generowanie lasów (drzew) jako osobny moduł.
// Używa globalnego Game, nie rusza rdzenia script.js.
//
// Działa tak:
//  - podmienia world.ensureChunk tak, żeby po wygenerowaniu terenu
//    dodać drzewa w tym chunku (tylko raz, flagą _forestGenerated),
//  - używa własnego szumu opartego na WORLD.SEED,
//  - nie robi nic w biomie pustynnym (jeśli istnieje Game.isDesertBiome).

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[ForestGen] Brak globalnego Game – załaduj najpierw script.js');
    return;
  }

  const { WORLD, BLOCK, world } = Game;

  if (!WORLD || !BLOCK || !world) {
    console.error('[ForestGen] Brak wymaganych pól w Game (WORLD/BLOCK/world).');
    return;
  }

  // ----------------- Lokalne pomocnicze -----------------

  const CHUNK_X = WORLD.CHUNK_X || 16;
  const CHUNK_Y = WORLD.CHUNK_Y || WORLD.SIZE_Y || 256;
  const CHUNK_Z = WORLD.CHUNK_Z || 16;
  const SEA_LEVEL = WORLD.SEA_LEVEL || 48;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // Czy w danym X,Z mamy pustynię? (jeśli moduł pustyni istnieje)
  function isDesertAt(x, z) {
    if (typeof Game.isDesertBiome === 'function') {
      return Game.isDesertBiome(x, z);
    }
    if (typeof Game.getBiomeAt === 'function') {
      return Game.getBiomeAt(x, z) === 'desert';
    }
    return false;
  }

  // ----------------- Szum i hash (kopie z rdzenia) -----------------

  function seededPRNG(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makePerlin(seed) {
    const rand = seededPRNG(seed);
    const p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

    function fade(t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
    function lerp(a, b, t) { return a + t * (b - a); }
    function grad(h, x, y) {
      switch (h & 3) {
        case 0: return x + y;
        case 1: return -x + y;
        case 2: return x - y;
        default: return -x - y;
      }
    }

    return function noise(x, y) {
      let X = Math.floor(x) & 255;
      let Y = Math.floor(y) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const aa = p[p[X] + Y],
            ab = p[p[X] + Y + 1],
            ba = p[p[X + 1] + Y],
            bb = p[p[X + 1] + Y + 1];
      const g1 = grad(aa, x, y);
      const g2 = grad(ba, x - 1, y);
      const g3 = grad(ab, x, y - 1);
      const g4 = grad(bb, x - 1, y - 1);
      return lerp(lerp(g1, g2, u), lerp(g3, g4, u), v);
    };
  }

  const noise2d = makePerlin(WORLD.SEED || 1337);

  function fbm2(x, z, oct = 4, lac = 2, gain = 0.5, freq = 0.01) {
    let amp = 1, f = freq, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += noise2d(x * f, z * f) * amp;
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return sum / norm;
  }

  function hash2(x, z) {
    let h = x * 374761393 + z * 668265263 + (WORLD.SEED || 0) * 374761393;
    h = (h ^ (h >> 13)) | 0;
    h = (h * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  // ----------------- Logika lasu (jak w starym script.js) -----------------

  function forestMask(gx, gz) {
    return fbm2(gx, gz, 4, 2, 0.55, 0.0025);
  }

  function treeSpeciesAt(gx, gz) {
    const n = fbm2(gx * 0.03 + 4000, gz * 0.03 - 4000, 3, 2, 0.5, 0.05);
    if (n < -0.4) return 'spruce';
    if (n < -0.1) return 'birch';
    if (n <  0.2) return 'acacia';
    if (n <  0.5) return 'mangrove';
    return 'cherry';
  }

  function speciesBlocks(name) {
    switch (name) {
      case 'birch':   return { log: BLOCK.BIRCH_LOG,   leaves: BLOCK.BIRCH_LEAVES   };
      case 'acacia':  return { log: BLOCK.ACACIA_LOG,  leaves: BLOCK.ACACIA_LEAVES  };
      case 'cherry':  return { log: BLOCK.CHERRY_LOG,  leaves: BLOCK.CHERRY_LEAVES  };
      case 'mangrove':return { log: BLOCK.MANGROVE_LOG,leaves: BLOCK.MANGROVE_LEAVES};
      case 'spruce':
      default:        return { log: BLOCK.SPRUCE_LOG,  leaves: BLOCK.SPRUCE_LEAVES  };
    }
  }

  // Buduje drzewo WYŁĄCZNIE wewnątrz podanego chunku (brak rozlewania poza chunk)
  function buildTreeInChunk(chunk, lx, lz, groundY, gx, gz) {
    const sp = speciesBlocks(treeSpeciesAt(gx, gz));
    const hRand = hash2(gx + 1000, gz - 1000);
    const trunkH = 4 + Math.floor(hRand * 3); // 4..6

    // pień
    for (let ty = 1; ty <= trunkH; ty++) {
      const y = groundY + ty;
      if (y < 0 || y >= CHUNK_Y) return;
      chunk.set(lx, y, lz, sp.log);
    }

    const topY = groundY + trunkH;
    // korona (prostokąt 5x5, trochę ograniczony)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const dist = Math.abs(dx) + Math.abs(dz);
        for (let dy = -1; dy <= 2; dy++) {
          const y = topY + dy;
          const ax = lx + dx;
          const az = lz + dz;
          if (ax < 0 || az < 0 || ax >= CHUNK_X || az >= CHUNK_Z || y < 0 || y >= CHUNK_Y) continue;
          if (dist + Math.max(0, dy) > 3) continue;

          const cur = chunk.get(ax, y, az);
          if (cur === BLOCK.AIR || cur === BLOCK.WATER) {
            chunk.set(ax, y, az, sp.leaves);
          }
        }
      }
    }
  }

  // Znajdź najwyższy blok GRASS w kolumnie (lokalnie w chunku)
  function findGrassSurfaceY(chunk, lx, lz) {
    for (let y = CHUNK_Y - 1; y >= 0; y--) {
      const id = chunk.get(lx, y, lz);
      if (id === BLOCK.GRASS) return y;
    }
    return -1;
  }

  function generateForestInChunk(chunk) {
    const x0 = chunk.x0;
    const z0 = chunk.z0;

    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const gx = x0 + lx;
        const gz = z0 + lz;

        // Nie sadzimy drzew w biomie pustynnym, jeśli jest.
        if (isDesertAt(gx, gz)) continue;

        const groundY = findGrassSurfaceY(chunk, lx, lz);
        if (groundY < 0) continue;

        // Tylko trochę powyżej poziomu morza i nie za wysoko
        if (groundY <= SEA_LEVEL + 1) continue;
        if (groundY >= 95) continue;

        const forest = forestMask(gx, gz);
        if (forest <= 0.20) continue;

        const density = clamp((forest - 0.20) / 0.8, 0, 1);
        const r = hash2(gx, gz);

        // Szansa na drzewo jak w oryginale: 2% + density*10%
        if (r < 0.02 + density * 0.10) {
          buildTreeInChunk(chunk, lx, lz, groundY, gx, gz);
        }
      }
    }

    chunk.dirty = true;
    chunk._forestGenerated = true;
  }

  // ----------------- Patchowanie world.ensureChunk -----------------

  if (!world._forestGenPatchedEnsureChunk) {
    world._forestGenPatchedEnsureChunk = true;

    const origEnsureChunk = world.ensureChunk.bind(world);

    world.ensureChunk = function (cx, cz) {
      const ch = origEnsureChunk(cx, cz);
      if (!ch) return ch;

      if (!ch._forestGenerated) {
        generateForestInChunk(ch);
      }

      return ch;
    };
  }

  // ----------------- Export do Game -----------------

  Game.forestMod = {
    generateForestInChunk,
    enableForWorld: () => { /* już włączone przez patch ensureChunk */ }
  };

  console.log('[ForestGen] Załadowano generate_forest.js – generowanie lasów (drzew).');

})(typeof window !== 'undefined' ? window : this);