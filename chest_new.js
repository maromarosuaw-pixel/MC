(function (global) {
    const Game = global.Game;
    if (!Game) return;

    const {
        BLOCK, BLOCK_INFO, atlas, gl, atlasTexture,
        inventory, input, world, player
    } = Game;

    // --- Konfiguracja Skrzyni ---
    function findFreeID(s){let c=s;const u=Object.values(BLOCK);while(u.includes(c)||(BLOCK_INFO[c]&&BLOCK_INFO[c].name!=='Skrzynia'))c++;return c;}
    BLOCK.CHEST=findFreeID(35);
    BLOCK_INFO[BLOCK.CHEST]={name:'Skrzynia',solid:true,transparent:false};
    if(Array.isArray(Game.CREATIVE_ITEMS)&&!Game.CREATIVE_ITEMS.includes(BLOCK.CHEST))Game.CREATIVE_ITEMS.push(BLOCK.CHEST);

    // --- Manual Raycast ---
    function manualRaycast(maxDist){
        const px=player.pos[0], py=player.pos[1]+(player.eyeHeight||1.6), pz=player.pos[2];
        const yaw=player.yaw, pitch=player.pitch;
        const dx=Math.sin(yaw)*Math.cos(pitch), dy=Math.sin(pitch), dz=Math.cos(yaw)*Math.cos(pitch);
        let x=Math.floor(px), y=Math.floor(py), z=Math.floor(pz);
        const stepX=dx>0?1:-1, stepY=dy>0?1:-1, stepZ=dz>0?1:-1;
        const tDeltaX=Math.abs(1/(dx||1e-9)), tDeltaY=Math.abs(1/(dy||1e-9)), tDeltaZ=Math.abs(1/(dz||1e-9));
        let tMaxX=((stepX>0?(x+1-px):(px-x)))*tDeltaX, tMaxY=((stepY>0?(y+1-py):(py-y)))*tDeltaY, tMaxZ=((stepZ>0?(z+1-pz):(pz-z)))*tDeltaZ;
        let dist=0;
        while(dist<=maxDist){
            if(y>=0&&y<256){const id=world.getBlock(x,y,z);if(id!==0&&id!==BLOCK.AIR)return{x,y,z,id};}
            if(tMaxX<tMaxY){if(tMaxX<tMaxZ){x+=stepX;dist=tMaxX;tMaxX+=tDeltaX;}else{z+=stepZ;dist=tMaxZ;tMaxZ+=tDeltaZ;}}
            else{if(tMaxY<tMaxZ){y+=stepY;dist=tMaxY;tMaxY+=tDeltaY;}else{z+=stepZ;dist=tMaxZ;tMaxZ+=tDeltaZ;}}
        }return null;
    }

    // --- Tekstura ---
    function injectTexture(n,id,cb){
        const c=atlas.canvas.getContext('2d'), idx=Object.keys(atlas.map).length;
        const u=idx%atlas.cols, v=(idx/atlas.cols)|0;
        cb(c,u*atlas.tile,v*atlas.tile,atlas.tile);
        atlas.map[n]={u,v}; atlas.blockTex[id]={all:n};
        gl.bindTexture(gl.TEXTURE_2D,atlasTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas.canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
    }
    injectTexture('chest_front',BLOCK.CHEST,(c,x,y,s)=>{
        c.fillStyle='#6d4c30';c.fillRect(x,y,s,s);c.lineWidth=2;c.strokeStyle='#4a332a';c.strokeRect(x+2,y+2,s-4,s-4);
        c.fillStyle='#eebb33';c.fillRect(x+(s/2)-4,y+s/2-3,8,6);
    });

    // --- Dane ---
    Game.ChestSystem=Game.ChestSystem||{}; Game.ChestSystem.data=Game.ChestSystem.data||{};
    Game.ChestSystem.get=function(x,y,z){const k=`${x},${y},${z}`;if(!this.data[k])this.data[k]=new Array(27).fill(null);return this.data[k];};

    // --- GUI ---
    let guiRoot=null, chestGrid=null, playerGrid=null, activeChestCoords=null;
    
    // Kursor
    let modCursor = document.getElementById('mod-cursor-global');
    if (!modCursor) {
        modCursor=document.createElement('div');
        modCursor.id='mod-cursor-global';
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

    function createGUI(){
        if(guiRoot)return;
        guiRoot=document.createElement('div');
        guiRoot.id='chest-gui';
        guiRoot.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#c6c6c6;border:4px solid #373737;padding:10px;display:none;flex-direction:column;gap:5px;z-index:100000;font-family:monospace;color:black;user-select:none;min-width:400px;";
        guiRoot.oncontextmenu=e=>{e.preventDefault();return false;};

        const header=document.createElement('div');
        header.style.cssText="display:flex;justify-content:space-between;width:100%;margin-bottom:5px;";
        header.innerHTML='<div style="font-weight:bold">Skrzynia</div>';
        
        const closeBtn=document.createElement('div');
        closeBtn.innerText="X";
        closeBtn.style.cssText="width:24px;height:24px;background:#d32f2f;color:white;font-weight:bold;text-align:center;line-height:22px;border:2px solid #8b0000;cursor:pointer;";
        closeBtn.onmousedown=(e)=>{e.stopPropagation();close();};
        header.appendChild(closeBtn);
        guiRoot.appendChild(header);

        chestGrid=document.createElement('div');
        chestGrid.style.cssText="display:grid;grid-template-columns:repeat(9,40px);gap:4px;background:#8b8b8b;padding:5px;margin-bottom:10px;";
        guiRoot.appendChild(chestGrid);

        const l2=document.createElement('div');l2.innerText="Ekwipunek";guiRoot.appendChild(l2);
        playerGrid=document.createElement('div');
        playerGrid.style.cssText="display:grid;grid-template-columns:repeat(9,40px);gap:4px;background:#8b8b8b;padding:5px;";
        guiRoot.appendChild(playerGrid);

        document.body.appendChild(guiRoot);
        document.addEventListener('mousemove',e=>{
            if(guiRoot.style.display==='flex'){
                modCursor.style.left=(e.clientX+10)+'px';
                modCursor.style.top=(e.clientY+10)+'px';
            }
        });
    }

    function render(){
        if(!activeChestCoords)return;
        const cList=Game.ChestSystem.get(activeChestCoords.x,activeChestCoords.y,activeChestCoords.z);
        const pList=inventory.slots;
        
        const makeSlot=(it,cb)=>{
            const d=document.createElement('div');
            d.style.cssText=`width:40px;height:40px;border:2px solid #373737;background:'#8b8b8b';cursor:pointer;`;
            d.oncontextmenu=e=>{e.preventDefault();return false;};
            d.onmousedown=e=>{e.preventDefault();e.stopPropagation();cb(e.button);};
            if(it){const cv=document.createElement('canvas');cv.width=40;cv.height=40;drawItem(cv,it);d.appendChild(cv);}
            return d;
        };

        chestGrid.innerHTML='';playerGrid.innerHTML='';
        cList.forEach((it,i)=>chestGrid.appendChild(makeSlot(it,(btn)=>clk(cList,i,btn))));
        for(let i=9;i<36;i++)playerGrid.appendChild(makeSlot(pList[i],(btn)=>clk(pList,i,btn)));
        let sep=document.createElement('div');sep.style.gridColumn="1/-1";sep.style.height="4px";playerGrid.appendChild(sep);
        for(let i=0;i<9;i++)playerGrid.appendChild(makeSlot(pList[i],(btn)=>clk(pList,i,btn)));

        const cur=inventory.cursor;
        const ctx=modCursor.querySelector('canvas').getContext('2d');ctx.clearRect(0,0,48,48);
        if(cur){modCursor.style.display='block';drawItem(modCursor.querySelector('canvas'),cur);}
        else modCursor.style.display='none';
    }

    function clk(list, idx, btn) {
        if (Game.SlotLogic && Game.SlotLogic.click) {
            Game.SlotLogic.click(list, idx, btn, null); // Brak callbacku bo brak craftingu
        }
        render();
    }

    function open(x,y,z){
        createGUI(); activeChestCoords={x,y,z}; input.uiOpen=true;
        if(document.exitPointerLock)document.exitPointerLock();
        guiRoot.style.display='flex'; render();
    }
    function close(){
        if(guiRoot)guiRoot.style.display='none'; activeChestCoords=null; input.uiOpen=false; modCursor.style.display='none';
        const c=document.querySelector('canvas');if(c)c.requestPointerLock();
    }

    document.addEventListener('mousedown',(e)=>{
        if(e.button===2){
            try{
                const hit=manualRaycast(6.0);
                if(hit&&hit.id===BLOCK.CHEST){
                    e.preventDefault();e.stopPropagation();
                    if(guiRoot&&guiRoot.style.display==='flex')return;
                    open(hit.x,hit.y,hit.z);
                }
            }catch(e){}
        }
    },true);

    // Klawisze (ESC i E zamykają)
    document.addEventListener('keydown',(e)=>{
        if(guiRoot && guiRoot.style.display==='flex') {
            if(e.key==='Escape' || e.keyCode===27 || e.key==='e' || e.key==='E' || e.keyCode===69) {
                e.preventDefault();
                e.stopPropagation();
                close();
            }
        }
    },true);

    console.log("[MOD] Chest GUI (Clean Version - No Crafting).");

})(typeof window !== "undefined" ? window : this);