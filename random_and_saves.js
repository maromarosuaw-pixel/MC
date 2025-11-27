// random_and_saves.js
// System światów, seeda, zapisu bloków, skrzynek ORAZ ustawień graficznych.

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

  // ===================== 1. STORAGE KEYS =====================

  const STORAGE_PREFIX = 'VoxelSaves';
  const META_KEY       = `${STORAGE_PREFIX}.worlds.meta`;
  const CURRENT_KEY    = `${STORAGE_PREFIX}.currentWorldId`;
  const SETTINGS_KEY   = `${STORAGE_PREFIX}.settings`; // Nowy klucz dla ustawień

  function modsKeyForWorld(id) {
    return `${STORAGE_PREFIX}.world.${id}.mods`;
  }
  function chestsKeyForWorld(id) {
    return `${STORAGE_PREFIX}.world.${id}.chests`;
  }

  // ===================== 2. OBSŁUGA USTAWIEŃ (RENDER DISTANCE) =====================

  function loadGlobalSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const settings = JSON.parse(raw);
        
        // Przywracanie Render Distance
        if (settings.viewDist) {
          const dist = parseInt(settings.viewDist);
          if (!isNaN(dist) && dist >= 1) {
            WORLD.VIEW_RADIUS_CHUNKS = dist;
            console.log(`[RandomAndSaves] Wczytano Render Distance: ${dist}`);
          }
        }
      }
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd odczytu ustawień:', e);
    }
  }

  function saveGlobalSettings() {
    try {
      const settings = {
        viewDist: WORLD.VIEW_RADIUS_CHUNKS // Zapisujemy aktualną wartość ze script.js
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[RandomAndSaves] Błąd zapisu ustawień:', e);
    }
  }

  // Wywołujemy ładowanie od razu po załadowaniu skryptu, 
  // żeby silnik gry zdążył to pobrać przed wygenerowaniem terenu.
  loadGlobalSettings();

  // ===================== 3. METADATA ŚWIATÓW =====================

  function loadMetaList() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveMetaList(list) {
    try { localStorage.setItem(META_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function findMeta(id) { return loadMetaList().find(w => w.id === id) || null; }

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
      localStorage.removeItem(chestsKeyForWorld(id));
    } catch (e) {}
  }

  function setCurrentWorldId(id) {
    try {
      localStorage.setItem(CURRENT_KEY, id || '');
      Game.currentWorldId = id || null;
    } catch (e) {}
  }

  function getCurrentWorldId() {
    if (Game.currentWorldId) return Game.currentWorldId;
    try { return localStorage.getItem(CURRENT_KEY) || null; } catch (e) { return null; }
  }

  // ===================== 4. SEED & MODS =====================

  function randomSeed10() {
    let s = '';
    for (let i = 0; i < 10; i++) {
      let d = Math.floor(Math.random() * 10);
      if (i === 0 && d === 0) d = 1 + Math.floor(Math.random() * 9);
      s += d;
    }
    return s;
  }

  const WorldSaves = { _currentMeta: null, _mods: null };

  function loadModsForWorld(id) {
    try {
      const raw = localStorage.getItem(modsKeyForWorld(id));
      if (!raw) { WorldSaves._mods = {}; return; }
      WorldSaves._mods = JSON.parse(raw) || {};
    } catch (e) { WorldSaves._mods = {}; }
  }

  function saveModsForWorld(id) {
    if (!id || !WorldSaves._mods) return;
    try { localStorage.setItem(modsKeyForWorld(id), JSON.stringify(WorldSaves._mods)); } catch (e) {}
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

    const x0 = chunk.x0; const z0 = chunk.z0;
    const x1 = x0 + CHX; const z1 = z0 + CHZ;
    let touched = false;

    for (const key in mods) {
      const [sxStr, syStr, szStr] = key.split('|');
      const sx = sxStr | 0, sy = syStr | 0, sz = szStr | 0;
      if (sx < x0 || sx >= x1 || sz < z0 || sz >= z1) continue;
      if (sy < 0 || sy >= CHY) continue;
      chunk.set(sx - x0, sy, sz - z0, mods[key]);
      touched = true;
    }
    if (touched) chunk.dirty = true;
  }

  // ===================== 5. CHESTS =====================

  function loadChestsForWorld(id) {
    Game.ChestSystem = Game.ChestSystem || {};
    Game.ChestSystem.data = {}; 
    try {
      const raw = localStorage.getItem(chestsKeyForWorld(id));
      if (raw) Game.ChestSystem.data = JSON.parse(raw);
    } catch (e) {}
  }

  function saveChestsForWorld(id) {
    if (!Game.ChestSystem || !Game.ChestSystem.data) return;
    try { localStorage.setItem(chestsKeyForWorld(id), JSON.stringify(Game.ChestSystem.data)); } catch (e) {}
  }

  // ===================== 6. PATCH GAME FUNCTIONS =====================

  if (!world.resetForNewWorld) {
    world.resetForNewWorld = function () {
      if (this.chunks && this.chunks.clear) this.chunks.clear();
      if (this.torches && this.torches.clear) this.torches.clear();
      if (Array.isArray(this.drops)) this.drops.length = 0;
      if (this.lavaSources && this.lavaSources.clear) this.lavaSources.clear();
    };
  }

  if (!world._savesPatchedSetBlock) {
    world._savesPatchedSetBlock = true;
    const origSetBlock = world.setBlock.bind(world);
    world.setBlock = function (x, y, z, id, options) {
      const prev = this.getBlock(x, y, z);
      origSetBlock(x, y, z, id, options);
      const opt = options || {};
      if (opt.fromGenerator || opt.fromLiquid || opt.fromWinterMod || opt.fromDesertMod || opt.fromSave) return;
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
      if (WorldSaves._mods) applyModsToChunk(ch);
      return ch;
    };
  }

  // ===================== 7. GAME LIFECYCLE =====================

  function startWorld(meta) {
    WorldSaves._currentMeta = meta;
    setCurrentWorldId(meta.id);
    
    loadModsForWorld(meta.id);
    loadChestsForWorld(meta.id);

    if (typeof meta.spawnX !== 'number') meta.spawnX = 0;
    if (typeof meta.spawnZ !== 'number') meta.spawnZ = 0;
    upsertMeta(meta);

    if (typeof Game.setWorldSeed === 'function') Game.setWorldSeed(meta.seed);
    else WORLD.SEED = parseInt(meta.seed, 10) || 0;

    if (typeof world.resetForNewWorld === 'function') world.resetForNewWorld();

    Game.spawnOverride = { x: meta.spawnX, z: meta.spawnZ };

    if (typeof Game.startGame === 'function') Game.startGame();
  }

  function saveCurrentWorld() {
    // ZAPISUJEMY USTAWIENIA (Render distance)
    saveGlobalSettings();

    const meta = WorldSaves._currentMeta;
    if (!meta) return;
    meta.lastPlayedAt = Date.now();
    upsertMeta(meta);
    
    saveModsForWorld(meta.id);
    saveChestsForWorld(meta.id);
  }

  // ===================== 8. MENU UI =====================
  // ... (Tutaj bez zmian w UI, skróciłem dla czytelności, ale funkcjonalność zostaje ta sama)
  
  let menuOverlay = null, worldSelectEl = null, seedLabelEl = null, playBtn = null, newBtn = null, delBtn = null;

  function ensureMenuUI() {
    if (menuOverlay) return;
    const overlay = document.createElement('div'); overlay.id='world-menu-overlay';
    Object.assign(overlay.style, { position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',display:'none',alignItems:'center',justifyContent:'center',flexDirection:'column',zIndex:'9000',fontFamily:'sans-serif',color:'#fff' });

    const panel = document.createElement('div');
    Object.assign(panel.style, { background:'#222',padding:'20px',borderRadius:'6px',minWidth:'300px' });

    const title = document.createElement('div'); title.textContent='Wybierz świat'; title.style.textAlign='center'; title.style.marginBottom='10px';
    const select = document.createElement('select'); select.style.width='100%'; select.style.marginBottom='10px'; select.style.padding='5px';
    const seedInf = document.createElement('div'); seedInf.textContent='Seed: -'; seedInf.style.fontSize='12px'; seedInf.style.marginBottom='10px';

    const btnRow = document.createElement('div'); btnRow.style.display='flex'; btnRow.style.gap='5px';
    const mkBtn=(t,c)=>{const b=document.createElement('button');b.textContent=t;b.style.flex='1';b.style.background=c;b.style.color='white';b.style.border='none';b.style.padding='5px';b.style.cursor='pointer';return b;};
    
    const bPlay = mkBtn('Graj','#4caf50');
    const bNew = mkBtn('Nowy','#2196f3');
    const bDel = mkBtn('Usuń','#f44336');

    btnRow.append(bPlay, bNew, bDel);
    panel.append(title, select, seedInf, btnRow);
    overlay.appendChild(panel); document.body.appendChild(overlay);

    menuOverlay=overlay; worldSelectEl=select; seedLabelEl=seedInf; playBtn=bPlay; newBtn=bNew; delBtn=bDel;

    select.onchange=()=>{const m=getSelectedMeta(); seedLabelEl.textContent=m?('Seed: '+m.seed):'Seed: -';};
    bPlay.onclick=()=>{
       let m=getSelectedMeta();
       const ws=loadMetaList();
       if(!m && ws.length===0) m=createNewWorld();
       else if(!m && ws.length>0) m=ws[0];
       if(m){ menuOverlay.style.display='none'; startWorld(m); }
    };
    bNew.onclick=()=>{ refreshWorldList(createNewWorld().id); };
    bDel.onclick=()=>{
       const m=getSelectedMeta(); if(!m)return;
       if(confirm('Usunąć?')) { deleteMeta(m.id); if(getCurrentWorldId()===m.id){ setCurrentWorldId(''); Game.ChestSystem.data={}; } refreshWorldList(); }
    };
  }

  function getSelectedMeta() { if(!worldSelectEl)return null; return findMeta(worldSelectEl.value); }
  
  function createNewWorld() {
    const seed = randomSeed10();
    const list = loadMetaList();
    const id = `world-${Date.now()}-${list.length+1}`;
    const meta = { id, name:`Świat ${list.length+1}`, seed, spawnX:0, spawnZ:0, createdAt:Date.now(), lastPlayedAt:Date.now() };
    upsertMeta(meta); return meta;
  }

  function refreshWorldList(selId) {
    if(!worldSelectEl)return;
    const worlds = loadMetaList().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    worldSelectEl.innerHTML='';
    if(worlds.length===0) {
        worldSelectEl.innerHTML='<option value="">Brak światów</option>';
        worldSelectEl.disabled=true; delBtn.disabled=true; seedLabelEl.textContent='Seed: -';
        return;
    }
    worldSelectEl.disabled=false; delBtn.disabled=false;
    for(const w of worlds){
        const o=document.createElement('option'); o.value=w.id; o.textContent=w.name; worldSelectEl.appendChild(o);
    }
    const cur = selId || getCurrentWorldId();
    if(cur && worlds.find(w=>w.id===cur)) worldSelectEl.value=cur;
    const m = getSelectedMeta();
    seedLabelEl.textContent = m ? ('Seed: ' + m.seed) : 'Seed: -';
  }

  function showWorldMenu() { ensureMenuUI(); refreshWorldList(); if(menuOverlay)menuOverlay.style.display='flex'; }

  // ===================== 9. EXPORTS & HOOKS =====================

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showWorldMenu);
  else showWorldMenu();

  global.addEventListener('beforeunload', saveCurrentWorld);

  WorldSaves.listWorlds = loadMetaList;
  WorldSaves.createWorld = createNewWorld;
  WorldSaves.startWorld = startWorld;
  WorldSaves.saveCurrentWorld = saveCurrentWorld;
  WorldSaves.showWorldMenu = showWorldMenu;

  Game.WorldSaves = WorldSaves;

  console.log('[RandomAndSaves] Załadowano. Ustawienia Render Distance zapisywane.');

})(typeof window !== 'undefined' ? window : this);