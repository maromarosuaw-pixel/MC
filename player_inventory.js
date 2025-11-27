(function (global) {
    const Game = global.Game;
    if (!Game) return;

    const { atlas, inventory, input, player, MODE } = Game; // Dodano MODE

    // --- DANE CRAFTINGU ---
    let pCraftGrid = new Array(4).fill(null);
    let pCraftRes  = [null];

    function updateResult() {
        if (Game.Crafting && Game.Crafting.check) {
            pCraftRes[0] = Game.Crafting.check(pCraftGrid);
        }
    }

    // --- GUI ---
    let guiRoot = null, craftSection = null, craftGridEl = null, craftResEl = null, playerGrid = null;
    
    let modCursor = document.getElementById('mod-cursor-global');
    if (!modCursor) {
        modCursor = document.createElement('div');
        modCursor.id = 'mod-cursor-global';
        modCursor.style.cssText='position:fixed;width:48px;height:48px;pointer-events:none;z-index:200000;display:none;';
        const mcCanv=document.createElement('canvas'); mcCanv.width=48; mcCanv.height=48; modCursor.appendChild(mcCanv);
        document.body.appendChild(modCursor);
    }

    function getIconName(id){const t=atlas.blockTex[id]||{};return t.top||t.all||t.side||'stone';}
    function drawItem(cv,it){
        const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);
        if(!it)return;
        const t=atlas.map[getIconName(it.id)];
        if(t){c.imageSmoothingEnabled=false;c.drawImage(atlas.canvas,t.u*atlas.tile,t.v*atlas.tile,atlas.tile,atlas.tile,0,0,cv.width,cv.height);}
        if(it.count>1){c.fillStyle='white';c.font='bold 12px monospace';c.fillText(it.count,4,cv.height-4);}
    }

    function createGUI() {
        if (guiRoot) return;
        guiRoot = document.createElement('div');
        guiRoot.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#c6c6c6;border:4px solid #373737;padding:10px;display:none;flex-direction:column;gap:10px;z-index:100000;font-family:monospace;color:black;user-select:none;min-width:380px;max-height:80vh;overflow-y:auto;";
        guiRoot.oncontextmenu = e => { e.preventDefault(); return false; };

        const header = document.createElement('div');
        header.style.cssText = "display:flex;justify-content:space-between;width:100%;";
        header.innerHTML = '<b>Ekwipunek</b>';
        const closeBtn = document.createElement('div');
        closeBtn.innerText = "X";
        closeBtn.style.cssText = "width:24px;height:24px;background:#d32f2f;color:white;font-weight:bold;text-align:center;line-height:22px;border:2px solid #8b0000;cursor:pointer;";
        closeBtn.onmousedown = (e) => { e.stopPropagation(); close(); };
        header.appendChild(closeBtn);
        guiRoot.appendChild(header);

        // Sekcja Craftingu (Zapisujemy referencję craftSection, żeby ją ukrywać)
        craftSection = document.createElement('div');
        craftSection.style.cssText = "display:flex; gap:15px; align-items:center; background:#a0a0a0; padding:10px; border:2px solid #555; justify-content:center;";
        
        craftGridEl = document.createElement('div');
        craftGridEl.style.cssText = "display:grid; grid-template-columns:repeat(2,40px); gap:4px;";
        const arrow = document.createElement('div');
        arrow.innerText = "->"; arrow.style.fontSize="24px"; arrow.style.fontWeight="bold";
        craftResEl = document.createElement('div');

        craftSection.appendChild(craftGridEl); craftSection.appendChild(arrow); craftSection.appendChild(craftResEl);
        guiRoot.appendChild(craftSection);

        // Siatka przedmiotów (wspólna dla obu trybów, ale inna zawartość)
        playerGrid = document.createElement('div');
        playerGrid.style.cssText = "display:grid;grid-template-columns:repeat(9,40px);gap:4px;background:#8b8b8b;padding:5px;overflow-y:auto;max-height:400px;";
        guiRoot.appendChild(playerGrid);

        document.body.appendChild(guiRoot);
        document.addEventListener('mousemove',e=>{
            if(guiRoot.style.display==='flex'){
                modCursor.style.left=(e.clientX+10)+'px'; modCursor.style.top=(e.clientY+10)+'px';
            }
        });
    }

    function render() {
        const pList = inventory.slots;
        const isCreative = (player.mode === 'creative' || player.mode === MODE.CREATIVE);

        const makeSlot=(it,cb,isRes=false)=>{
            const d=document.createElement('div');
            d.style.cssText=`width:40px;height:40px;border:2px solid #373737;background:${isRes?'#dcdcdc':'#8b8b8b'};cursor:pointer;flex-shrink:0;`;
            d.oncontextmenu = (e) => { e.preventDefault(); return false; };
            d.onmousedown = e => { e.preventDefault(); e.stopPropagation(); cb(e.button); };
            if(it){const cv=document.createElement('canvas');cv.width=40;cv.height=40;drawItem(cv,it);d.appendChild(cv);}
            return d;
        };

        // Wyczyść
        craftGridEl.innerHTML=''; craftResEl.innerHTML=''; playerGrid.innerHTML='';

        if (isCreative) {
            // === TRYB KREATYWNY ===
            
            // 1. Ukryj crafting
            craftSection.style.display = 'none';
            // Zwiększ nieco okno jeśli trzeba
            guiRoot.style.width = '420px';

            // 2. Wyświetl listę wszystkich bloków (CREATIVE_ITEMS)
            const allItems = Game.CREATIVE_ITEMS || [];
            
            allItems.forEach(id => {
                // Tworzymy "sztuczny" item do wyświetlenia
                const itemObj = { id: id, count: 1 };
                // Kliknięcie daje stacka tego bloku do kursora
                playerGrid.appendChild(makeSlot(itemObj, (btn) => clkCreative(id, btn)));
            });

            // 3. Oddzielacz
            let sep=document.createElement('div');sep.style.gridColumn="1/-1";sep.style.height="4px";sep.style.background="#555";sep.style.margin="5px 0";
            playerGrid.appendChild(sep);

            // 4. Wyświetl Hotbar (Sloty 0-8) - żeby można było sobie ułożyć pasek
            for(let i=0;i<9;i++) playerGrid.appendChild(makeSlot(pList[i],(btn)=>clk(pList,i,btn)));

        } else {
            // === TRYB SURVIVAL ===
            
            // 1. Pokaż crafting
            craftSection.style.display = 'flex';
            guiRoot.style.width = '380px';

            // 2. Renderuj Crafting
            pCraftGrid.forEach((it,i)=>craftGridEl.appendChild(makeSlot(it,(btn)=>clk(pCraftGrid,i,btn,true))));
            craftResEl.appendChild(makeSlot(pCraftRes[0],(btn)=>clkResult(btn), true));

            // 3. Plecak (9-35)
            for(let i=9;i<36;i++)playerGrid.appendChild(makeSlot(pList[i],(btn)=>clk(pList,i,btn)));
            
            let sep=document.createElement('div');sep.style.gridColumn="1/-1";sep.style.height="4px";playerGrid.appendChild(sep);
            
            // 4. Hotbar (0-8)
            for(let i=0;i<9;i++)playerGrid.appendChild(makeSlot(pList[i],(btn)=>clk(pList,i,btn)));
        }

        // Kursor
        const cur=inventory.cursor;
        const ctx=modCursor.querySelector('canvas').getContext('2d');ctx.clearRect(0,0,48,48);
        if(cur){modCursor.style.display='block';drawItem(modCursor.querySelector('canvas'),cur);}
        else modCursor.style.display='none';
    }

    // Logika kliknięcia w Survivalu
    function clk(list, idx, btn, isCraft) {
        if (Game.SlotLogic && Game.SlotLogic.click) {
            Game.SlotLogic.click(list, idx, btn, () => { if(isCraft) updateResult(); });
        }
        render();
    }
    function clkResult(btn) {
        if (Game.SlotLogic && Game.SlotLogic.craftResultClick) {
            Game.SlotLogic.craftResultClick(pCraftGrid, pCraftRes, btn);
            updateResult();
        }
        render();
    }

    // Logika kliknięcia w Kreatywnym (Lista bloków)
    function clkCreative(id, btn) {
        // Kliknięcie w listę daje stacka do kursora
        // Niezależnie czy LPM czy PPM
        Game.inventory.cursor = { id: id, count: 64 };
        render();
    }

    function open() {
        createGUI(); input.uiOpen = true;
        if(document.exitPointerLock) document.exitPointerLock();
        guiRoot.style.display = 'flex'; render();
    }
    function close() {
        if(guiRoot) guiRoot.style.display = 'none';
        input.uiOpen = false; modCursor.style.display = 'none';
        const c=document.querySelector('canvas');if(c)c.requestPointerLock();
    }
    function toggle() {
        if (guiRoot && guiRoot.style.display === 'flex') close();
        else open();
    }

    // KLAWISZE
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (e.key === 'e' || e.key === 'E' || e.keyCode === 69) {
            const chestGUI = document.getElementById('chest-gui');
            if (chestGUI && chestGUI.style.display === 'flex') return;

            e.preventDefault(); e.stopPropagation();
            toggle();
        }
        if ((e.key === 'Escape' || e.keyCode === 27) && guiRoot && guiRoot.style.display === 'flex') {
            e.preventDefault(); e.stopPropagation();
            close();
        }
    }, true);

    console.log("[MOD] Player Inventory (Creative/Survival Mode Support) Loaded.");

})(typeof window !== "undefined" ? window : this);