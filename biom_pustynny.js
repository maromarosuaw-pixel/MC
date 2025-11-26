// script4.js – biom pustynny: piaskowiec, czerwony piach
// Wymaga z Game (rdzeń script.js musi to wystawić):
//   WORLD, BOUNDS
//   BLOCK, BLOCK_INFO
//   world
//   gl, atlas, atlasTexture
//   (opcjonalnie) CREATIVE_ITEMS

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[DesertBiomeMod] Brak globalnego Game – załaduj najpierw script.js');
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
    console.error('[DesertBiomeMod] Brak wymaganych pól w Game (WORLD/BOUNDS/BLOCK/BLOCK_INFO/world/gl/atlas).');
    return;
  }

  // Upewnij się, że globalny Game ma dostęp do "generatora świata"
  if (!Game.worldGenerator && WORLD) {
    Game.worldGenerator = WORLD;
  }

  // ===================== 1. NOWE BLOKI: PIASKOWIEC, CZERWONY PIACH =====================

  // Zakładamy, że 36–37 są wolne. Jeśli nie – zmień ID lub zdefiniuj w rdzeniu.
  BLOCK.SANDSTONE = BLOCK.SANDSTONE ?? 36;
  BLOCK.RED_SAND  = BLOCK.RED_SAND  ?? 37;

  BLOCK_INFO[BLOCK.SANDSTONE] = {
    name: 'Piaskowiec',
    solid: true,
    transparent: false,
    rock: true
  };

  BLOCK_INFO[BLOCK.RED_SAND] = {
    name: 'Czerwony piach',
    solid: true,
    transparent: false,
    sandy: true
  };

  // ===================== 2. TEKSTURY: PIASKOWIEC, CZERWONY PIACH =====================

  function registerSandstoneTexture() {
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

    // delikatne poziome warstwy
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[DesertBiomeMod] Game.atlasTexture nie jest ustawione – tekstura sandstone może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.SANDSTONE] = { all: 'sandstone' };
  }

  function registerRedSandTexture() {
    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;
    const x0 = u * tileSize;
    const y0 = v * tileSize;

    // rdzawo-czerwony piach
    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, '#b84722');   // rdzawa czerwień
    g.addColorStop(0.5, '#c9632a');   // jaśniejszy rdzawy pomarańcz
    g.addColorStop(1.0, '#d8823a');   // jasny piaskowo-rdzawy
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    // drobne ciemniejsze ziarenka
    ctx.fillStyle = 'rgba(120,40,20,0.55)';
    for (let i = 0; i < 35; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      ctx.fillRect(rx, ry, 1, 1);
    }

    atlas.map['red_sand'] = { u, v };

    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[DesertBiomeMod] Game.atlasTexture nie jest ustawione – tekstura red_sand może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.RED_SAND] = { all: 'red_sand' };
  }

  registerSandstoneTexture();
  registerRedSandTexture();

  // ===================== 3. POMOCNICZE =====================

  function inBoundsLocal(x,y,z){
    return y >= 0 && y < WORLD.SIZE_Y &&
           x >= -BOUNDS.HALF_X && x < BOUNDS.HALF_X &&
           z >= -BOUNDS.HALF_Z && z < BOUNDS.HALF_Z;
  }

  // ===================== 4. BIOM PUSTYNIA =====================

  // Prosty podział: południowa część świata (większe Z) to pustynia
  const DESERT_EDGE_Z = (typeof WORLD.DESERT_BIOME_EDGE_Z === 'number')
    ? WORLD.DESERT_BIOME_EDGE_Z
    : Math.floor(BOUNDS.HALF_Z * 0.3);

  function isDesertBiomeAt(x, z) {
    return z > DESERT_EDGE_Z;
  }

  WORLD.isDesertBiome = WORLD.isDesertBiome || isDesertBiomeAt;
  Game.isDesertBiome  = Game.isDesertBiome  || isDesertBiomeAt;

  // ===================== 5. PATCHING setBlock – GENEROWANIE PUSTYNI =====================

  if (!world._desertBiomePatchedSetBlock) {
    world._desertBiomePatchedSetBlock = true;

    // zapamiętujemy aktualne setBlock (może już być zmodowane np. przez różową wodę)
    const baseSetBlock = world.setBlock.bind(world);

    world.setBlock = function(x,y,z,id,options){
      // wewnętrzne zmiany tego modułu – bez dodatkowej logiki
      if (options && options.fromDesertMod) {
        baseSetBlock(x,y,z,id,options);
        return;
      }

      const prev = this.getBlock(x,y,z);
      baseSetBlock(x,y,z,id,options);
      const current = this.getBlock(x,y,z);

      if (!Game.isDesertBiome || !Game.isDesertBiome(x,z)) return;

      const sandId = BLOCK.SAND; // bazowy piach z rdzenia script.js
      if (sandId == null) {
        console.warn('[DesertBiomeMod] BLOCK.SAND nie jest zdefiniowany w rdzeniu – nie można generować pustyni.');
        return;
      }

      const aboveY = y + 1;
      if (aboveY >= WORLD.SIZE_Y) return;
      const aboveId = this.getBlock(x,aboveY,z);

      // interesuje nas tylko powierzchnia (nad blokiem musi być powietrze)
      if (aboveId !== BLOCK.AIR) return;

      // jeśli na powierzchni była trawa / ziemia / śnieg / kamień – zamień na piasek / czerwony piasek
      const soilCandidates = new Set();
      if (BLOCK.GRASS != null) soilCandidates.add(BLOCK.GRASS);
      if (BLOCK.DIRT  != null) soilCandidates.add(BLOCK.DIRT);
      if (BLOCK.SNOW  != null) soilCandidates.add(BLOCK.SNOW);
      if (BLOCK.STONE != null) soilCandidates.add(BLOCK.STONE);

      if (!soilCandidates.has(current)) return;

      const useRed = (BLOCK.RED_SAND != null) && Math.random() < 0.25; // ~25% czerwonego piachu
      const newId = useRed ? BLOCK.RED_SAND : sandId;

      // zamiana powierzchni na piasek / czerwony piasek
      this.setBlock(x,y,z,newId,{fromDesertMod:true});

      // poniżej piasku – szansa na piaskowiec
      if (BLOCK.SANDSTONE != null && y > 0) {
        const belowY = y - 1;
        if (belowY >= 0 && belowY < WORLD.SIZE_Y) {
          const belowId = this.getBlock(x,belowY,z);
          if (belowId === sandId ||
              belowId === BLOCK.RED_SAND ||
              belowId === BLOCK.DIRT ||
              belowId === BLOCK.STONE) {
            if (Math.random() < 0.5) { // ~50% warstwy piaskowca pod piaskiem
              this.setBlock(x,belowY,z,BLOCK.SANDSTONE,{fromDesertMod:true});
            }
          }
        }
      }
    };
  }

  // ===================== 6. KREATYWNY EKWIPUNEK =====================

  if (Array.isArray(Game.CREATIVE_ITEMS)) {
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.SANDSTONE)) {
      Game.CREATIVE_ITEMS.push(BLOCK.SANDSTONE);
    }
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.RED_SAND)) {
      Game.CREATIVE_ITEMS.push(BLOCK.RED_SAND);
    }
  } else {
    console.warn('[DesertBiomeMod] Game.CREATIVE_ITEMS nie jest tablicą – dodaj BLOCK.SANDSTONE i BLOCK.RED_SAND ręcznie do CREATIVE_ITEMS w script.js.');
  }

  // ===================== 7. REJESTRACJA W Game =====================

  Game.desertBiomeMod = {
    sandstoneBlockId: BLOCK.SANDSTONE,
    redSandBlockId: BLOCK.RED_SAND,
    isDesertBiome: isDesertBiomeAt
  };

  console.log('[DesertBiomeMod] Załadowano biom pustynny. Piaskowiec ID:', BLOCK.SANDSTONE, 'Czerwony piach ID:', BLOCK.RED_SAND);

})(typeof window !== 'undefined' ? window : this);