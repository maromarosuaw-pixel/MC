// fluid_and_physics_water_lava.js
// Fizyka wody i lawy + źródła lawy (światło).
// - kolejki wody/lawy
// - reakcje woda<->lawa (obsydian/kamień)
// - rozlewanie w dół i na boki
// - lavaSources dla gatherTorchLights
//
// Wymaga: script.js załadowanego wcześniej.

(function (global) {
  const Game = global.Game;
  if (!Game) {
    console.error('[Fluid] Brak Game – załaduj najpierw script.js');
    return;
  }

  const {
    WORLD,
    BOUNDS,
    FLUID,
    BLOCK,
    world
  } = Game;

  if (!WORLD || !BOUNDS || !FLUID || !BLOCK || !world) {
    console.error('[Fluid] Brak WORLD/BOUNDS/FLUID/BLOCK/world w Game.');
    return;
  }

  // ----------------- Pomocnicze -----------------

  function inBoundsLocal(x,y,z){
    return y >= 0 && y < WORLD.SIZE_Y &&
           x >= -BOUNDS.HALF_X && x < BOUNDS.HALF_X &&
           z >= -BOUNDS.HALF_Z && z < BOUNDS.HALF_Z;
  }

  // ----------------- Kolejki cieczy -----------------

  if (!world.waterQueue) world.waterQueue = [];
  if (!world.lavaQueue)  world.lavaQueue  = [];
  if (!world.lavaSources) world.lavaSources = new Set();

  function lavaKey(x,y,z){ return x+'|'+y+'|'+z; }
  world.addLava = function(x,y,z){ this.lavaSources.add(lavaKey(x,y,z)); };
  world.removeLava = function(x,y,z){ this.lavaSources.delete(lavaKey(x,y,z)); };

  world.scheduleWaterUpdate = function(x,y,z){
    this.waterQueue.push({x,y,z,depth:0});
  };

  world.processWaterQueue = function(maxSteps = 128){
    const radius = FLUID.WATER_SPREAD_RADIUS || 16;
    let steps = 0;

    while (steps < maxSteps && this.waterQueue.length) {
      const cell = this.waterQueue.shift();
      steps++;
      const {x,y,z,depth} = cell;

      if (!inBoundsLocal(x,y,z)) continue;
      if (depth > radius) continue;
      if (this.getBlock(x,y,z) !== BLOCK.WATER) continue;

      // 1) dół
      let flowedDown = false;
      if (y > 0){
        const belowId = this.getBlock(x,y-1,z);
        if (belowId === BLOCK.AIR){
          this.setBlock(x,y-1,z,BLOCK.WATER,{fromLiquid:true});
          if (this.getBlock(x,y-1,z) === BLOCK.WATER){
            this.waterQueue.push({x:x,y:y-1,z:z,depth});
          }
          flowedDown = true;
        } else if (belowId === BLOCK.LAVA){
          this.setBlock(x,y-1,z,BLOCK.OBSIDIAN,{fromLiquid:true});
        }
      }
      if (flowedDown) continue;

      // 2) boki
      if (depth < radius){
        const dirs=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
        for (const [dx,dy,dz] of dirs){
          const nx=x+dx, ny=y+dy, nz=z+dz;
          if (!inBoundsLocal(nx,ny,nz)) continue;
          const tid=this.getBlock(nx,ny,nz);

          if (tid===BLOCK.AIR){
            this.setBlock(nx,ny,nz,BLOCK.WATER,{fromLiquid:true});
            if (this.getBlock(nx,ny,nz) === BLOCK.WATER){
              this.waterQueue.push({x:nx,y:ny,z:nz,depth:depth+1});
            }
          } else if (tid===BLOCK.LAVA){
            this.setBlock(nx,ny,nz,BLOCK.OBSIDIAN,{fromLiquid:true});

            const nx2=nx+dx, ny2=ny+dy, nz2=nz+dz;
            if (!inBoundsLocal(nx2,ny2,nz2)) continue;
            const tid2=this.getBlock(nx2,ny2,nz2);

            if (tid2===BLOCK.AIR){
              this.setBlock(nx2,ny2,nz2,BLOCK.WATER,{fromLiquid:true});
              if (this.getBlock(nx2,ny2,nz2) === BLOCK.WATER){
                this.waterQueue.push({x:nx2,y:ny2,z:nz2,depth:depth+1});
              }
            } else if (tid2===BLOCK.LAVA){
              this.setBlock(nx2,ny2,nz2,BLOCK.OBSIDIAN,{fromLiquid:true});
            }
          }
        }
      }
    }
  };

  world.scheduleLavaUpdate = function(x,y,z){
    this.lavaQueue.push({x,y,z,depth:0});
  };

  world.processLavaQueue = function(maxSteps = 96){
    const radius = FLUID.LAVA_SPREAD_RADIUS || 18;
    let steps = 0;

    while (steps < maxSteps && this.lavaQueue.length){
      const cell = this.lavaQueue.shift();
      steps++;
      const {x,y,z,depth} = cell;

      if (!inBoundsLocal(x,y,z)) continue;
      if (depth > radius) continue;
      if (this.getBlock(x,y,z) !== BLOCK.LAVA) continue;

      let flowedDown = false;
      if (y > 0){
        const below = this.getBlock(x,y-1,z);
        if (below === BLOCK.AIR){
          this.setBlock(x,y-1,z,BLOCK.LAVA,{fromLiquid:true});
          if (this.getBlock(x,y-1,z) === BLOCK.LAVA){
            this.lavaQueue.push({x:x,y:y-1,z:z,depth});
          }
          flowedDown = true;
        } else if (below === BLOCK.WATER){
          this.setBlock(x,y-1,z,BLOCK.STONE,{fromLiquid:true});
        }
      }
      if (flowedDown) continue;

      if (depth < radius){
        const dirs=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
        for (const [dx,dy,dz] of dirs){
          const nx=x+dx, ny=y+dy, nz=z+dz;
          if (!inBoundsLocal(nx,ny,nz)) continue;
          const id = this.getBlock(nx,ny,nz);

          if (id === BLOCK.AIR){
            this.setBlock(nx,ny,nz,BLOCK.LAVA,{fromLiquid:true});
            if (this.getBlock(nx,ny,nz) === BLOCK.LAVA){
              this.lavaQueue.push({x:nx,y:ny,z:nz,depth:depth+1});
            }
          } else if (id === BLOCK.WATER){
            this.setBlock(nx,ny,nz,BLOCK.STONE,{fromLiquid:true});

            const nx2=nx+dx, ny2=ny+dy, nz2=nz+dz;
            if (!inBoundsLocal(nx2,ny2,nz2)) continue;
            const id2=this.getBlock(nx2,ny2,nz2);

            if (id2 === BLOCK.AIR){
              this.setBlock(nx2,ny2,nz2,BLOCK.LAVA,{fromLiquid:true});
              if (this.getBlock(nx2,ny2,nz2) === BLOCK.LAVA){
                this.lavaQueue.push({x:nx2,y:ny2,z:nz2,depth:depth+1});
              }
            } else if (id2 === BLOCK.WATER){
              this.setBlock(nx2,ny2,nz2,BLOCK.STONE,{fromLiquid:true});
            }
          }
        }
      }
    }
  };

  // ----------------- Patch setBlock (reakcje + scheduling) -----------------

  if (!world._fluidPatchedSetBlock) {
    world._fluidPatchedSetBlock = true;

    const origSetBlock = world.setBlock.bind(world);

    world.setBlock = function(x,y,z,id,options){
      const prev = this.getBlock(x,y,z);

      // reakcje woda<->lawa
      if ((prev === BLOCK.WATER && id === BLOCK.LAVA) ||
          (prev === BLOCK.LAVA  && id === BLOCK.WATER)) {
        id = (prev === BLOCK.WATER && id === BLOCK.LAVA)
          ? BLOCK.STONE
          : BLOCK.OBSIDIAN;
      }

      origSetBlock(x,y,z,id,options);

      const cur = this.getBlock(x,y,z);

      // aktualizacja lavaSources (do świateł)
      if (prev === BLOCK.LAVA && cur !== BLOCK.LAVA) {
        this.removeLava(x,y,z);
      }
      if (cur === BLOCK.LAVA && prev !== BLOCK.LAVA) {
        this.addLava(x,y,z);
      }

      // nie nakręcamy kolejki, jeśli wywołanie jest z fizyki
      if (options && options.fromLiquid) return;

      const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      const scheduleNeighborsIfType = (type, scheduleFn)=>{
        for (const [dx,dy,dz] of dirs){
          const nx=x+dx, ny=y+dy, nz=z+dz;
          if (!inBoundsLocal(nx,ny,nz)) continue;
          if (this.getBlock(nx,ny,nz)===type) scheduleFn.call(this,nx,ny,nz);
        }
      };

      if (cur === BLOCK.WATER){
        this.scheduleWaterUpdate(x,y,z);
        scheduleNeighborsIfType(BLOCK.WATER, this.scheduleWaterUpdate);
      }
      if (cur === BLOCK.LAVA){
        this.scheduleLavaUpdate(x,y,z);
        scheduleNeighborsIfType(BLOCK.LAVA, this.scheduleLavaUpdate);
      }
      if (prev === BLOCK.WATER && cur !== BLOCK.WATER){
        scheduleNeighborsIfType(BLOCK.WATER, this.scheduleWaterUpdate);
      }
      if (prev === BLOCK.LAVA && cur !== BLOCK.LAVA){
        scheduleNeighborsIfType(BLOCK.LAVA, this.scheduleLavaUpdate);
      }
      if (prev !== BLOCK.AIR && cur === BLOCK.AIR){
        scheduleNeighborsIfType(BLOCK.WATER, this.scheduleWaterUpdate);
        scheduleNeighborsIfType(BLOCK.LAVA,  this.scheduleLavaUpdate);
      }
    };
  }

  // ----------------- Tick cieczy (osobna pętla) -----------------

  const WATER_TICK_MS = 500;
  const LAVA_TICK_MS  = 1000;

  let lastWaterTick = performance.now();
  let lastLavaTick  = performance.now();

  function fluidLoop(){
    const now = performance.now();

    if (now - lastWaterTick >= WATER_TICK_MS) {
      world.processWaterQueue(128);
      lastWaterTick = now;
    }
    if (now - lastLavaTick >= LAVA_TICK_MS) {
      world.processLavaQueue(96);
      lastLavaTick = now;
    }

    requestAnimationFrame(fluidLoop);
  }

  fluidLoop();

  console.log('[Fluid] Załadowano fluid_and_physics_water_lava.js – fizyka wody i lawy przeniesiona do modułu.');

})(typeof window !== 'undefined' ? window : this);