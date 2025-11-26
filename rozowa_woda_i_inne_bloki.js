// script2.js – nowe bloki: RÓŻOWA WODA (pink_water), AMETYST (amethyst), DIAMENT (diamond_block)
// Wymaga z Game (rdzeń script.js musi to wystawić):
//   WORLD, BOUNDS, FLUID
//   BLOCK, BLOCK_INFO
//   world
//   gl, atlas, atlasTexture  (atlasTexture = WebGL texture atlasu)
//   (opcjonalnie) CREATIVE_ITEMS – wtedy pink_water, amethyst i diamond_block dodadzą się same do kreatywnego

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[PinkWaterMod] Brak globalnego Game – załaduj najpierw script.js');
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
    atlasTexture   // w script.js: Game.atlasTexture = glTex;
  } = Game;

  if (!WORLD || !BOUNDS || !FLUID || !BLOCK || !BLOCK_INFO || !world || !gl || !atlas) {
    console.error('[PinkWaterMod] Brak wymaganych pól w Game (WORLD/BOUNDS/FLUID/BLOCK/BLOCK_INFO/world/gl/atlas).');
    return;
  }

  // ===================== 1. NOWE BLOKI =====================
  // Zakładamy, że 31, 32, 33 są wolne. Jeśli nie – zmień tu ID lub zdefiniuj w rdzeniu.
  BLOCK.PINK_WATER = BLOCK.PINK_WATER ?? 31;
  BLOCK.AMETHYST   = BLOCK.AMETHYST   ?? 32;
  BLOCK.DIAMOND    = BLOCK.DIAMOND    ?? 33;

  BLOCK_INFO[BLOCK.PINK_WATER] = {
    name: 'Różowa woda',
    solid: false,
    transparent: true,
    // dodatkowe flagi, które silnik może wykorzystać do fizyki pływania
    liquid: true,
    fluid: true,
    isWater: true
  };

  BLOCK_INFO[BLOCK.AMETHYST] = {
    name: 'Ametyst',
    solid: true,
    transparent: false
    // zwykły stały blok
  };

  BLOCK_INFO[BLOCK.DIAMOND] = {
    name: 'Diament',
    solid: true,
    transparent: false
    // jasnoniebieski blok, bez specjalnej fizyki
  };

  // ===================== 2. TEKSTURY W ATLASIE =====================

  function registerPinkWaterTexture() {
    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    // wybieramy pierwszy wolny slot
    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    // różowy gradient pionowy
    const g = ctx.createLinearGradient(0, y0, 0, y0 + tileSize);
    g.addColorStop(0.0, 'rgba(255,200,230,0.9)');
    g.addColorStop(0.4, 'rgba(255,160,220,0.9)');
    g.addColorStop(1.0, 'rgba(255,110,200,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    // parę białych „błysków” na powierzchni
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 20; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize * 0.4;
      ctx.fillRect(rx, ry, 1, 1);
    }

    // zarejestruj w atlas.map pod nazwą 'pink_water'
    atlas.map['pink_water'] = { u, v };

    // aktualizacja tekstury w GPU
    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[PinkWaterMod] Game.atlasTexture nie jest ustawione – tekstura pink_water może się nie odświeżyć.');
    }

    // mapping bloku -> tekstura
    atlas.blockTex[BLOCK.PINK_WATER] = { all: 'pink_water' };
  }

  function registerAmethystTexture() {
    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    // kolejny wolny slot
    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    // tło – fioletowy gradient
    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, '#2a003d');   // bardzo ciemny fiolet
    g.addColorStop(0.4, '#6a1b9a');   // średni fiolet
    g.addColorStop(1.0, '#d1c4e9');   // jasny fiolet z bielą
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    // kryształy – losowe "rombowe" odłamki w bieli / jasnym fiolecie
    const crystalColors = ['#ffffff', '#f3e5f5', '#e1bee7', '#b39ddb'];

    for (let i = 0; i < 14; i++) {
      const cx = x0 + Math.random() * tileSize;
      const cy = y0 + Math.random() * tileSize;
      const w = 2 + Math.random() * (tileSize * 0.3);
      const h = w * (1.4 + Math.random()); // wydłużone odłamki
      const angle = Math.random() * Math.PI * 2;
      const col = crystalColors[(Math.random() * crystalColors.length) | 0];

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.5);
      ctx.lineTo(w * 0.5, 0);
      ctx.lineTo(0, h * 0.5);
      ctx.lineTo(-w * 0.5, 0);
      ctx.closePath();
      ctx.fill();

      // jaśniejsza krawędź "błysku"
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.5);
      ctx.lineTo(w * 0.5, 0);
      ctx.stroke();

      ctx.restore();
    }

    // drobne białe iskry
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 35; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      ctx.fillRect(rx, ry, 1, 1);
    }

    // zapis w atlasie
    atlas.map['amethyst'] = { u, v };

    // aktualizacja tekstury w GPU
    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[PinkWaterMod] Game.atlasTexture nie jest ustawione – tekstura amethyst może się nie odświeżyć.');
    }

    // mapping bloku -> tekstura
    atlas.blockTex[BLOCK.AMETHYST] = { all: 'amethyst' };
  }

  // ORYGINALNA TEKSTURA DIAMENTU – gradient + fasety / refleksy
  function registerDiamondTexture() {
    const tileSize = atlas.tile;
    const cols = atlas.cols;
    const ctx = atlas.canvas.getContext('2d');

    // kolejny wolny slot
    const idx = Object.keys(atlas.map).length;
    const u = idx % cols;
    const v = (idx / cols) | 0;

    const x0 = u * tileSize;
    const y0 = v * tileSize;

    // tło – jasnoniebieski / turkusowy gradient
    const g = ctx.createLinearGradient(x0, y0, x0 + tileSize, y0 + tileSize);
    g.addColorStop(0.0, '#004a7c');   // ciemniejszy niebieski
    g.addColorStop(0.4, '#00a9e0');   // średni turkus
    g.addColorStop(1.0, '#e0f7ff');   // prawie biała błękitna
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, tileSize, tileSize);

    // "fasety" diamentu – geometryczne, jasne kształty
    const facetColors = ['#ffffff', '#e0f7ff', '#b3e5fc', '#81d4fa'];

    for (let i = 0; i < 12; i++) {
      const cx = x0 + Math.random() * tileSize;
      const cy = y0 + Math.random() * tileSize;
      const w = 3 + Math.random() * (tileSize * 0.35);
      const h = w * (0.9 + Math.random() * 0.5);
      const angle = (Math.random() * Math.PI * 2);
      const col = facetColors[(Math.random() * facetColors.length) | 0];

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.5);
      ctx.lineTo(w * 0.5, -h * 0.15);
      ctx.lineTo(w * 0.35, h * 0.4);
      ctx.lineTo(-w * 0.35, h * 0.4);
      ctx.lineTo(-w * 0.5, -h * 0.15);
      ctx.closePath();
      ctx.fill();

      // mocniejszy błysk na jednej krawędzi
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -h * 0.15);
      ctx.lineTo(0, -h * 0.5);
      ctx.lineTo(w * 0.5, -h * 0.15);
      ctx.stroke();

      ctx.restore();
    }

    // małe jasne piksele imitujące refleksy
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++) {
      const rx = x0 + Math.random() * tileSize;
      const ry = y0 + Math.random() * tileSize;
      ctx.fillRect(rx, ry, 1, 1);
    }

    // zapis w atlasie
    atlas.map['diamond_block'] = { u, v };

    // aktualizacja tekstury w GPU
    if (atlasTexture) {
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      console.warn('[PinkWaterMod] Game.atlasTexture nie jest ustawione – tekstura diamond_block może się nie odświeżyć.');
    }

    // mapping bloku -> tekstura
    atlas.blockTex[BLOCK.DIAMOND] = { all: 'diamond_block' };
  }

  registerPinkWaterTexture();
  registerAmethystTexture();
  registerDiamondTexture();

  // ===================== 3. POMOCNICZE =====================

  function inBoundsLocal(x,y,z){
    return y >= 0 && y < WORLD.SIZE_Y &&
           x >= -BOUNDS.HALF_X && x < BOUNDS.HALF_X &&
           z >= -BOUNDS.HALF_Z && z < BOUNDS.HALF_Z;
  }

  // ===================== 4. FIZYKA RÓŻOWEJ WODY (ROZLEWANIE) =====================

  // własna kolejka
  if (!world.pinkWaterQueue) world.pinkWaterQueue = [];

  world.schedulePinkWaterUpdate = function(x,y,z){
    this.pinkWaterQueue.push({x,y,z,depth:0});
  };

  world.processPinkWaterQueue = function(maxSteps = 64){
    const radius = FLUID.WATER_SPREAD_RADIUS || 16;
    let steps = 0;

    while (steps < maxSteps && this.pinkWaterQueue.length) {
      const cell = this.pinkWaterQueue.shift();
      steps++;
      const {x,y,z,depth} = cell;

      if (!inBoundsLocal(x,y,z)) continue;
      if (depth > radius) continue;
      if (this.getBlock(x,y,z) !== BLOCK.PINK_WATER) continue;

      // 1) spływ w dół – jak normalna woda
      let flowedDown = false;
      if (y > 0){
        const belowId = this.getBlock(x,y-1,z);
        if (belowId === BLOCK.AIR){
          this.setBlock(x,y-1,z,BLOCK.PINK_WATER,{fromLiquid:true});
          if (this.getBlock(x,y-1,z) === BLOCK.PINK_WATER){
            this.pinkWaterQueue.push({x:x,y:y-1,z:z,depth});
          }
          flowedDown = true;
        } else if (belowId === BLOCK.LAVA){
          // różowa woda na lawę -> obsydian
          this.setBlock(x,y-1,z,BLOCK.OBSIDIAN,{fromLiquid:true});
        }
      }
      if (flowedDown) continue;

      // 2) rozlew na boki – jak normalna woda
      if (depth < radius){
        const dirs=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
        for (const [dx,dy,dz] of dirs){
          const nx=x+dx, ny=y+dy, nz=z+dz;
          if (!inBoundsLocal(nx,ny,nz)) continue;
          const tid=this.getBlock(nx,ny,nz);

          if (tid===BLOCK.AIR){
            this.setBlock(nx,ny,nz,BLOCK.PINK_WATER,{fromLiquid:true});
            if (this.getBlock(nx,ny,nz) === BLOCK.PINK_WATER){
              this.pinkWaterQueue.push({x:nx,y:ny,z:nz,depth:depth+1});
            }
          } else if (tid===BLOCK.LAVA){
            // lawa w styku -> obsydian
            this.setBlock(nx,ny,nz,BLOCK.OBSIDIAN,{fromLiquid:true});

            // spróbuj dalej tym samym kierunkiem
            const nx2 = nx+dx, ny2=ny+dy, nz2=nz+dz;
            if (!inBoundsLocal(nx2,ny2,nz2)) continue;
            const tid2=this.getBlock(nx2,ny2,nz2);

            if (tid2===BLOCK.AIR){
              this.setBlock(nx2,ny2,nz2,BLOCK.PINK_WATER,{fromLiquid:true});
              if (this.getBlock(nx2,ny2,nz2) === BLOCK.PINK_WATER){
                this.pinkWaterQueue.push({x:nx2,y:ny2,z:nz2,depth:depth+1});
              }
            } else if (tid2===BLOCK.LAVA){
              this.setBlock(nx2,ny2,nz2,BLOCK.OBSIDIAN,{fromLiquid:true});
            }
          }
        }
      }
    }
  };

  // ===================== 5. PATCHING setBlock =====================

  if (!world._pinkWaterPatchedSetBlock) {
    world._pinkWaterPatchedSetBlock = true;

    const origSetBlock = world.setBlock.bind(world);

    world.setBlock = function(x,y,z,id,options){
      const prev = this.getBlock(x,y,z);
      origSetBlock(x,y,z,id,options);

      // nie nakręcamy rekurencji przy wewnętrznym ticku cieczy
      if (options && options.fromLiquid) return;

      const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      const scheduleNeighbors = () => {
        for (const [dx,dy,dz] of dirs){
          const nx=x+dx, ny=y+dy, nz=z+dz;
          if (!inBoundsLocal(nx,ny,nz)) continue;
          if (this.getBlock(nx,ny,nz) === BLOCK.PINK_WATER){
            this.schedulePinkWaterUpdate(nx,ny,nz);
          }
        }
      };

      if (id === BLOCK.PINK_WATER){
        this.schedulePinkWaterUpdate(x,y,z);
        scheduleNeighbors();
      }
      if (prev === BLOCK.PINK_WATER && id !== BLOCK.PINK_WATER){
        scheduleNeighbors();
      }
      if (prev !== BLOCK.AIR && id === BLOCK.AIR){
        // usunięcie bloku przy różowej wodzie może pozwolić jej się rozlać
        scheduleNeighbors();
      }
    };
  }

  // ===================== 6. PODPIĘCIE POD WODĘ (KOLEJKA CIECZY) =====================

  if (typeof world.processWaterQueue === 'function' && !world._pinkWaterWrappedWaterQueue) {
    world._pinkWaterWrappedWaterQueue = true;
    const origProcWater = world.processWaterQueue.bind(world);

    world.processWaterQueue = function(maxSteps){
      // najpierw zwykła woda
      origProcWater(maxSteps);
      // potem różowa
      this.processPinkWaterQueue(maxSteps);
    };
  }

  // ===================== 7. KREATYWNY EKWIPUNEK =====================

  // Jeśli rdzeń wystawił CREATIVE_ITEMS do Game,
  // dołóż różową wodę, ametyst i diament automatycznie.
  if (Array.isArray(Game.CREATIVE_ITEMS)) {
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.PINK_WATER)) {
      Game.CREATIVE_ITEMS.push(BLOCK.PINK_WATER);
    }
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.AMETHYST)) {
      Game.CREATIVE_ITEMS.push(BLOCK.AMETHYST);
    }
    if (!Game.CREATIVE_ITEMS.includes(BLOCK.DIAMOND)) {
      Game.CREATIVE_ITEMS.push(BLOCK.DIAMOND);
    }
  } else {
    console.warn('[PinkWaterMod] Game.CREATIVE_ITEMS nie jest tablicą – dodaj BLOCK.PINK_WATER, BLOCK.AMETHYST i BLOCK.DIAMOND ręcznie do CREATIVE_ITEMS w script.js.');
  }

  // ===================== 8. INTEGRACJA Z FIZYKĄ PŁYWANIA =====================

  (function integrateFluidPhysics() {
    if (!FLUID) return;

    if (Array.isArray(FLUID.WATER_BLOCKS) && !FLUID.WATER_BLOCKS.includes(BLOCK.PINK_WATER)) {
      FLUID.WATER_BLOCKS.push(BLOCK.PINK_WATER);
    }
    if (Array.isArray(FLUID.LIQUID_BLOCKS) && !FLUID.LIQUID_BLOCKS.includes(BLOCK.PINK_WATER)) {
      FLUID.LIQUID_BLOCKS.push(BLOCK.PINK_WATER);
    }
    if (Array.isArray(FLUID.SWIMMABLE) && !FLUID.SWIMMABLE.includes(BLOCK.PINK_WATER)) {
      FLUID.SWIMMABLE.push(BLOCK.PINK_WATER);
    }
    if (Array.isArray(FLUID.SWIMMABLE_IDS) && !FLUID.SWIMMABLE_IDS.includes(BLOCK.PINK_WATER)) {
      FLUID.SWIMMABLE_IDS.push(BLOCK.PINK_WATER);
    }

    if (typeof FLUID.isWater === 'function' && !FLUID._pinkWaterWrappedIsWater) {
      FLUID._pinkWaterWrappedIsWater = true;
      const origIsWater = FLUID.isWater.bind(FLUID);
      FLUID.isWater = function (id) {
        return id === BLOCK.PINK_WATER || origIsWater(id);
      };
    }

    if (typeof FLUID.isLiquid === 'function' && !FLUID._pinkWaterWrappedIsLiquid) {
      FLUID._pinkWaterWrappedIsLiquid = true;
      const origIsLiquid = FLUID.isLiquid.bind(FLUID);
      FLUID.isLiquid = function (id) {
        return id === BLOCK.PINK_WATER || origIsLiquid(id);
      };
    }

    if (typeof FLUID.isSwimmable === 'function' && !FLUID._pinkWaterWrappedIsSwimmable) {
      FLUID._pinkWaterWrappedIsSwimmable = true;
      const origIsSwimmable = FLUID.isSwimmable.bind(FLUID);
      FLUID.isSwimmable = function (id) {
        return id === BLOCK.PINK_WATER || origIsSwimmable(id);
      };
    }
  })();

  (function integrateGameFluidHelpers() {
    if (typeof Game.isWaterBlock === 'function' && !Game._pinkWaterWrappedIsWaterBlock) {
      Game._pinkWaterWrappedIsWaterBlock = true;
      const orig = Game.isWaterBlock.bind(Game);
      Game.isWaterBlock = function (id) {
        return id === BLOCK.PINK_WATER || orig(id);
      };
    }

    if (typeof Game.isLiquidBlock === 'function' && !Game._pinkWaterWrappedIsLiquidBlock) {
      Game._pinkWaterWrappedIsLiquidBlock = true;
      const orig = Game.isLiquidBlock.bind(Game);
      Game.isLiquidBlock = function (id) {
        return id === BLOCK.PINK_WATER || orig(id);
      };
    }

    if (typeof Game.isSwimmableBlock === 'function' && !Game._pinkWaterWrappedIsSwimmableBlock) {
      Game._pinkWaterWrappedIsSwimmableBlock = true;
      const orig = Game.isSwimmableBlock.bind(Game);
      Game.isSwimmableBlock = function (id) {
        return id === BLOCK.PINK_WATER || orig(id);
      };
    }

    if (Array.isArray(Game.SWIMMABLE_BLOCKS) && !Game.SWIMMABLE_BLOCKS.includes(BLOCK.PINK_WATER)) {
      Game.SWIMMABLE_BLOCKS.push(BLOCK.PINK_WATER);
    }
    if (Array.isArray(Game.WATER_BLOCKS) && !Game.WATER_BLOCKS.includes(BLOCK.PINK_WATER)) {
      Game.WATER_BLOCKS.push(BLOCK.PINK_WATER);
    }
  })();

  // ===================== 9. REJESTRACJA W Game =====================

  Game.pinkWaterMod = {
    blockId: BLOCK.PINK_WATER,
    scheduleUpdate: world.schedulePinkWaterUpdate.bind(world),
    processQueue: world.processPinkWaterQueue.bind(world)
  };

  Game.amethystBlockId = BLOCK.AMETHYST;
  Game.diamondBlockId  = BLOCK.DIAMOND;

  console.log('[PinkWaterMod] Załadowano różową wodę. ID:', BLOCK.PINK_WATER);
  console.log('[PinkWaterMod] Załadowano ametyst. ID:', BLOCK.AMETHYST);
  console.log('[PinkWaterMod] Załadowano diament. ID:', BLOCK.DIAMOND);

})(typeof window !== 'undefined' ? window : this);