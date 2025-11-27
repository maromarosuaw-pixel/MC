(function (global) {
    const Game = global.Game;
    if (!Game) return;

    const {
        BLOCK,
        BLOCK_INFO,
        CREATIVE_ITEMS,
        world,
        player,
        gl,
        atlas,
        atlasTexture
    } = Game;

    // =================================================================
    // 1. GRAFIKA (TEXTURE INJECTOR)
    // =================================================================
    function injectTexture(name, blockID, drawCallback) {
        if (!gl || !atlas || !atlasTexture) return;
        const ctx = atlas.canvas.getContext('2d');
        const tileSize = atlas.tile;
        const cols = atlas.cols;
        const idx = Object.keys(atlas.map).length;
        const u = idx % cols;
        const v = (idx / cols) | 0;
        const x = u * tileSize;
        const y = v * tileSize;
        drawCallback(ctx, x, y, tileSize);
        atlas.map[name] = { u, v };
        atlas.blockTex[blockID] = { all: name };
        gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
    }

    // =================================================================
    // 2. DEFINICJA BLOKU
    // =================================================================
    let luckyID = 60;
    while (BLOCK_INFO[luckyID]) { luckyID++; }

    BLOCK.LUCKY = luckyID;
    BLOCK_INFO[luckyID] = {
        name: "Lucky Block",
        solid: true,
        transparent: false
    };

    injectTexture('lucky_block', luckyID, (ctx, x, y, size) => {
        // Tło
        ctx.fillStyle = '#FFD700'; 
        ctx.fillRect(x, y, size, size);
        // Ramka
        ctx.strokeStyle = '#DAA520'; 
        ctx.lineWidth = size * 0.1;
        ctx.strokeRect(x, y, size, size);
        // Znak zapytania
        ctx.fillStyle = '#FFF';
        ctx.shadowColor = "black";
        ctx.shadowBlur = 2;
        ctx.font = 'bold ' + (size * 0.75) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + (size / 2), y + (size / 2) + 2);
        ctx.shadowBlur = 0;
    });

    if (CREATIVE_ITEMS && CREATIVE_ITEMS.indexOf(luckyID) === -1) {
        CREATIVE_ITEMS.push(luckyID);
    }

    // =================================================================
    // 3. LOGIKA LOSOWANIA
    // =================================================================

    if (!world._luckyBlockHooked) {
        world._luckyBlockHooked = true;
        // Zapisujemy czysty silnik
        world._originalSetBlockEngine = world.setBlock.bind(world);

        world.setBlock = function(x, y, z, id, ...args) {
            const currentBlockId = this.getBlock(x, y, z);
            
            // Najpierw niszczymy blok w silniku
            world._originalSetBlockEngine(x, y, z, id, ...args);

            // Jeśli zniszczono Lucky Block
            if (currentBlockId === BLOCK.LUCKY && id === 0) {
                // Losowanie z małym opóźnieniem dla efektu
                setTimeout(() => {
                    triggerRandomEvent(x, y, z);
                }, 50);
            }
        };
    }

    function triggerRandomEvent(x, y, z) {
        const set = world._originalSetBlockEngine;
        
        // Losujemy liczbę od 0 do 100
        const roll = Math.floor(Math.random() * 100);
        console.log(`[Lucky Block] Wylosowano: ${roll}`);

        // --- SCENARIUSZ 1: TROLL (Ziemia) - 30% szans ---
        if (roll < 30) {
            console.log(" -> Troll (Ziemia)");
            set(x, y, z, 2); // Trawa/Ziemia
        }
        // --- SCENARIUSZ 2: PUŁAPKA WODNA - 20% szans ---
        else if (roll < 50) {
            console.log(" -> Pułapka Wodna");
            const trapID = BLOCK.PINK_WATER || 8;
            // Woda 3 kratki wyżej
            set(x, y + 3, z, trapID);
            if (world.schedulePinkWaterUpdate && trapID === BLOCK.PINK_WATER) {
                world.schedulePinkWaterUpdate(x, y + 3, z);
            }
        }
        // --- SCENARIUSZ 3: TĘCZOWY BLOK - 20% szans ---
        else if (roll < 70) {
            console.log(" -> Rainbow Block");
            if (BLOCK.RAINBOW) {
                set(x, y, z, BLOCK.RAINBOW);
            } else {
                // Jak nie ma rainbow, dajemy złoto/piasek
                set(x, y, z, 18); 
            }
        }
        // --- SCENARIUSZ 4: BOGACTWO (Diamenty/Ametyst) - 15% szans ---
        else if (roll < 85) {
            console.log(" -> Bogactwo");
            const gemID = BLOCK.DIAMOND || BLOCK.AMETHYST || 20; // 20 to szkło w niektórych wersjach
            set(x, y, z, gemID);
        }
        // --- SCENARIUSZ 5: JACKPOT (Wieża bogactwa) - 15% szans ---
        else {
            console.log(" -> JACKPOT!");
            const diamond = BLOCK.DIAMOND || 1;
            const rainbow = BLOCK.RAINBOW || 1;
            const amethyst = BLOCK.AMETHYST || 1;

            set(x, y, z, diamond);
            set(x, y + 1, z, rainbow);
            set(x, y + 2, z, amethyst);
            set(x, y + 3, z, diamond);
        }
    }

    console.log("[MOD] Załadowano Lucky Block (Final Randomizer)");

})(typeof window !== "undefined" ? window : this);