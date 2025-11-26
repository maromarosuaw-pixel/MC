// script4.js – zimowy biom, śnieg, lód, zamarzanie wody
// Wymaga z Game (rdzeń script.js musi to wystawić):
//   WORLD, BOUNDS, FLUID
//   BLOCK, BLOCK_INFO
//   world
//   gl, atlas, atlasTexture
//   (opcjonalnie) CREATIVE_ITEMS

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[WinterBiomeMod] Brak globalnego Game – załaduj najpierw script.js');
    return;
  }

  const {
    WORLD,
    BOUNDS,
    FLUID,
    BLOCK,
    BLOCK_INFO,
    world,
    gl,
    atlas,
    atlasTexture
  } = Game;

  if (!WORLD || !BOUNDS || !FLUID || !BLOCK || !BLOCK_INFO || !world || !gl || !atlas) {
    console.error('[WinterBiomeMod] Brak wymaganych pól w Game (WORLD/BOUNDS/FLUID/BLOCK/BLOCK_INFO/world/gl/atlas).');
    return;
  }

  // Upewnij się, że globalny Game ma dostęp do "generatora świata" (WORLD)
  if (!Game.worldGenerator && WORLD) {
    Game.worldGenerator = WORLD;
  }

  // ===================== 1. NOWE BLOKI: ŚNIEG, LÓD =====================

  // Załóżmy, że 34 i 35 są wolne
  BLOCK.SNOW = BLOCK.SNOW ?? 34;
  BLOCK.ICE  = BLOCK.ICE  ?? 35;

  BLOCK_INFO[BLOCK.SNOW] = {
    name: 'Śnieg',
    solid: true,
    transparent: false,
    // dodatkowe flagi – jeśli silnik coś takiego używa:
    snowy: true
  };

  BLOCK_INFO[BLOCK.ICE] = {
    name: 'Lód',
    solid: true,
    transparent: true,
    slippery: true,
    // może być traktowany jako "szkło" / półprzezroczysty
    isIce: true
  };

  // ===================== 2. TEKSTURY: ŚNIEG, LÓD =====================

  function registerSnowTexture() {
    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    // delikatny niebiesko-biały śnieg
    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, '#f6f8ff');
    g.addColorStop(0.5, '#e9f4ff');
    g.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    // drobne niebieskawe cienie (lekka faktura)
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[WinterBiomeMod] Game.atlasTexture nie jest ustawione – tekstura snow może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.SNOW] = { all: 'snow' };
  }

  function registerIceTexture() {
    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    // jasnoniebieski, lekko przezroczysty lód
    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, 'rgba(180,220,255,0.9)');
    g.addColorStop(0.5, 'rgba(150,200,245,0.8)');
    g.addColorStop(1.0, 'rgba(210,235,255,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    // pęknięcia / refleksy
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

    // małe jasne punkty lodu
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 30; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      ctx.fillRect(rx, ry, 1, 1);
    }

    atlas.map['ice'] = { u, v };

    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[WinterBiomeMod] Game.atlasTexture nie jest ustawione – tekstura ice może się nie odświeżyć.');
    }

    atlas.blockTex[BLOCK.ICE] = { all: 'ice' };
  }

  registerSnowTexture();
  registerIceTexture();

  // ===================== 3. BIOM ZIMOWY =====================

  function inBoundsLocal(x,y,z){
    return y >= 0 && y < WORLD.SIZE_Y &&
           x >= -BOUNDS.HALF_X && x < BOUNDS.HALF_X &&
           z >= -BOUNDS.HALF_Z && z < BOUNDS.HALF_Z;
  }

  // Prosty podział świata: północna część (z < SNOW_EDGE_Z) to biom zimowy
  const SNOW_EDGE_Z = (typeof WORLD.SNOW_BIOME_EDGE_Z === 'number')
    ? WORLD.SNOW_BIOME_EDGE_Z
    : -Math.floor(BOUNDS.HALF_Z * 0.3); // ok. 30% świata "na północy"

  function isSnowBiomeAt(x, z) {
    return z < SNOW_EDGE_Z;
  }

  // Udostępnij test biomu
  WORLD.isSnowBiome = WORLD.isSnowBiome || isSnowBiomeAt;
  Game.isSnowBiome = Game.isSnowBiome || isSnowBiomeAt;

  // ===================== 4. ID WODY DO ZAMRAŻANIA =====================

  const freezableWaterIds = new Set();

  function addWaterIdsFromArray(arr){
    if (!Array.isArray(arr)) return;
    for (const id of arr){
      if (id == null) continue;
      if (BLOCK.PINK_WATER != null && id === BLOCK.PINK_WATER) continue; // nie mrozimy różowej
      freezableWaterIds.add(id);
    }
  }

  if (FLUID) {
    addWaterIdsFromArray(FLUID.WATER_BLOCKS);
    addWaterIdsFromArray(FLUID.LIQUID_BLOCKS);
  }
  addWaterIdsFromArray(Game.WATER_BLOCKS);

  if (BLOCK.WATER != null) freezableWaterIds.add(BLOCK.WATER);
  if (BLOCK.STILL_WATER != null) freezableWaterIds.add(BLOCK.STILL_WATER);

  function isFreezableWater(id){
    if (id == null) return false;
    if (BLOCK.PINK_WATER != null && id === BLOCK.PINK_WATER) return false;
    if (freezableWaterIds.size) return freezableWaterIds.has(id);

    // awaryjnie – użyj helperów FLUID/Game, jeśli są
    if (typeof FLUID.isWater === 'function' && id !== BLOCK.PINK_WATER) {
      return FLUID.isWater(id);
    }
    if (typeof Game.isWaterBlock === 'function' && id !== BLOCK.PINK_WATER) {
      return Game.isWaterBlock(id);
    }
    return false;
  }

  // ===================== 5. KOLEJKA ZAMARZANIA WODY =====================

  if (!world.freezeQueue) world.freezeQueue = [];

  world.scheduleFreezeCheck = function(x,y,z){
    if (!inBoundsLocal(x,y,z)) return;
    this.freezeQueue.push({x,y,z,age:0});
  };

  world.processFreezeQueue = function(maxSteps = 64){
    if (!this.freezeQueue.length) return;

    const MIN_AGE = 5; // ile "tików" zanim woda zamarznie
    let steps = 0;
    const next = [];

    while (steps < maxSteps && this.freezeQueue.length){
      const cell = this.freezeQueue.shift();
      steps++;

      let {x,y,z,age} = cell;
      if (!inBoundsLocal(x,y,z)) continue;
      if (!Game.isSnowBiome || !Game.isSnowBiome(x,z)) continue;

      const id = this.getBlock(x,y,z);
      if (!isFreezableWater(id)) {
        continue; // woda zniknęła / zmieniona
      }

      age++;
      if (age < MIN_AGE){
        next.push({x,y,z,age});
        continue;
      }

      // Zamroź wodę w lód
      this.setBlock(x,y,z,BLOCK.ICE,{fromWinterMod:true});

      // Jeżeli nad lodem jest powietrze – kładziemy śnieg
      if (y + 1 < WORLD.SIZE_Y) {
        const aboveId = this.getBlock(x,y+1,z);
        if (aboveId === BLOCK.AIR) {
          this.setBlock(x,y+1,z,BLOCK.SNOW,{fromWinterMod:true});
        }
      }
    }

    // Do kolejki wraca to, co nie zostało przerobione + reszta nieobsłużonych
    this.freezeQueue = next.concat(this.freezeQueue);
  };

  // ===================== 6. DODATKOWE NAKŁADANIE ŚNIEGU + SCHEDULING MROZU =====================

  // Zbiór "gruntów", na których może leżeć śnieg
  const groundIds = new Set();
  [
    'GRASS', 'DIRT', 'STONE', 'SAND', 'GRAVEL',
    'COBBLE', 'COBBLESTONE', 'SANDSTONE'
  ].forEach(name => {
    if (BLOCK[name] != null) groundIds.add(BLOCK[name]);
  });

  function isGroundBlock(id) {
    return groundIds.has(id);
  }

  if (!world._winterBiomePatchedSetBlock) {
    world._winterBiomePatchedSetBlock = true;

    const baseSetBlock = world.setBlock.bind(world);

    world.setBlock = function(x,y,z,id,options){
      // ścieżka wewnętrzna – wywołania z tego modułu (śnieg/lód), nie robimy nadmiarowej logiki
      if (options && options.fromWinterMod) {
        baseSetBlock(x,y,z,id,options);
        return;
      }

      const prev = this.getBlock(x,y,z);
      baseSetBlock(x,y,z,id,options);

      if (!Game.isSnowBiome || !Game.isSnowBiome(x,z)) return;

      const current = this.getBlock(x,y,z);

      // 1) ŚNIEG NA POWIERZCHNI GRUNTU
      if (isGroundBlock(current) && y + 1 < WORLD.SIZE_Y) {
        const aboveId = this.getBlock(x,y+1,z);
        if (aboveId === BLOCK.AIR) {
          this.setBlock(x,y+1,z,BLOCK.SNOW,{fromWinterMod:true});
        }
      }

      // 2) SCHEDULING ZAMARZANIA WODY
      if (isFreezableWater(current)) {
        this.scheduleFreezeCheck(x,y,z);

        // sąsiednie komórki w poziomie – żeby "plama" zamarzała całościowo
        const dirs = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
        for (const [dx,dy,dz] of dirs){
          const nx=x+dx, ny=y+dy, nz=z+dz;
          if (!inBoundsLocal(nx,ny,nz)) continue;
          const nid = this.getBlock(nx,ny,nz);
          if (isFreezableWater(nid)) {
            this.scheduleFreezeCheck(nx,ny,nz);
          }
        }
      }

      // jeśli woda znikła / została zastąpiona czymś innym – spróbuj zamrozić sąsiednią resztę
      if (isFreezableWater(prev) && !isFreezableWater(current)) {
        const dirs = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
        for (const [dx,dy,dz] of dirs){
          const nx=x+dx, ny=y+dy, nz=z+dz;
          if (!inBoundsLocal(nx,ny,nz)) continue;
          const nid = this.getBlock(nx,ny,nz);
          if (isFreezableWater(nid)) {
            this.scheduleFreezeCheck(nx,ny,nz);
          }
        }
      }
    };
  }

  // ===================== 7. PODPIĘCIE ZAMARZANIA POD KOLEJKĘ WODY =====================

  if (typeof world.processWaterQueue === 'function' && !world._winterWrappedWaterQueue) {
    world._winterWrappedWaterQueue = true;
    const baseProcWater = world.processWaterQueue.bind(world);

    world.processWaterQueue = function(maxSteps){
      // najpierw to, co już było (oryginalna woda + różowa woda, jeśli zmodowana)
      baseProcWater(maxSteps);
      // potem mrożenie wody w biomie zimowym
      this.processFreezeQueue(maxSteps);
    };
  }

  // ===================== 8. KREATYWNY EKWIPUNEK =====================

  if (Array.isArray(Game.CREATIVE_ITEMS)) {
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.SNOW)) {
      Game.CREATIVE_ITEMS.push(BLOCK.SNOW);
    }
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.ICE)) {
      Game.CREATIVE_ITEMS.push(BLOCK.ICE);
    }
  } else {
    console.warn('[WinterBiomeMod] Game.CREATIVE_ITEMS nie jest tablicą – dodaj BLOCK.SNOW i BLOCK.ICE ręcznie do CREATIVE_ITEMS w script.js.');
  }

  // ===================== 9. REJESTRACJA W Game =====================

  Game.winterBiomeMod = {
    snowBlockId: BLOCK.SNOW,
    iceBlockId: BLOCK.ICE,
    isSnowBiome: isSnowBiomeAt,
    scheduleFreeze: world.scheduleFreezeCheck.bind(world),
    processFreezeQueue: world.processFreezeQueue.bind(world)
  };

  console.log('[WinterBiomeMod] Załadowano: śnieg (ID: ' + BLOCK.SNOW + '), lód (ID: ' + BLOCK.ICE + '), biom zimowy, zamarzanie wody.');

})(typeof window !== 'undefined' ? window : this);