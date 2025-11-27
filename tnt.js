(function (global) {
    const Game = global.Game;
    if (!Game) return;

    const {
        BLOCK,
        BLOCK_INFO,
        CREATIVE_ITEMS,
        world,
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
    // 2. DEFINICJA TNT
    // =================================================================
    let tntID = 70; // Zaczynamy od 70, żeby nie wejść na Lucky Blocka
    while (BLOCK_INFO[tntID]) { tntID++; }

    BLOCK.TNT = tntID;
    BLOCK_INFO[tntID] = {
        name: "TNT",
        solid: true,
        transparent: false
    };

    injectTexture('tnt_block', tntID, (ctx, x, y, size) => {
        // 1. Czerwone tło
        ctx.fillStyle = '#D32F2F'; // Czerwień TNT
        ctx.fillRect(x, y, size, size);
        
        // 2. Biały pasek na środku
        ctx.fillStyle = '#FFFFFF';
        const bandHeight = size * 0.4;
        const bandY = y + (size - bandHeight) / 2;
        ctx.fillRect(x, bandY, size, bandHeight);

        // 3. Paski góra/dół (detale)
        ctx.fillStyle = '#B71C1C'; // Ciemniejsza czerwień
        const detailSize = size * 0.15;
        ctx.fillRect(x, y, size, detailSize); // Góra
        ctx.fillRect(x, y + size - detailSize, size, detailSize); // Dół

        // 4. Napis TNT
        ctx.fillStyle = '#000000';
        ctx.font = 'bold ' + (size * 0.5) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // size/2 to środek, +1px korekta optyczna
        ctx.fillText('TNT', x + (size / 2), y + (size / 2) + 1);
    });

    if (CREATIVE_ITEMS && CREATIVE_ITEMS.indexOf(tntID) === -1) {
        CREATIVE_ITEMS.push(tntID);
    }

    // =================================================================
    // 3. MECHANIKA WYBUCHU
    // =================================================================

    // Zabezpieczamy/tworzymy funkcję "czystego" stawiania bloków
    // Dzięki temu TNT zadziała nawet jak Lucky Block nie jest załadowany
    if (!world._originalSetBlockEngine) {
        world._originalSetBlockEngine = world.setBlock.bind(world);
    }

    // Hookujemy system bloków
    const previousSetBlock = world.setBlock; // Zapamiętujemy poprzedni hook (np. Lucky Block)

    world.setBlock = function(x, y, z, id, ...args) {
        const currentBlockId = this.getBlock(x, y, z);

        // Wykonaj standardową operację (to wywoła też Lucky Blocka jeśli jest w łańcuchu)
        previousSetBlock.apply(this, [x, y, z, id, ...args]);

        // LOGIKA TNT: Jeśli niszczymy TNT (zamieniamy na 0)
        if (currentBlockId === BLOCK.TNT && id === 0) {
            console.log("[TNT] Zapalono lont na " + x + ", " + y + ", " + z);
            startFuse(x, y, z);
        }
    };

    function startFuse(x, y, z) {
        // Odliczanie w konsoli
        setTimeout(() => console.log("[TNT] 3..."), 1000);
        setTimeout(() => console.log("[TNT] 2..."), 2000);
        setTimeout(() => console.log("[TNT] 1..."), 3000);
        
        // WYBUCH po 3.5 sekundy
        setTimeout(() => {
            explode(x, y, z, 4); // Promień wybuchu: 4 kratki
        }, 3500);
    }

    function explode(cx, cy, cz, radius) {
        console.log(`[TNT] BOOM na ${cx}, ${cy}, ${cz}!`);
        
        const set = world._originalSetBlockEngine; // Używamy najszybszej metody
        const r2 = radius * radius; // Promień do kwadratu (do obliczania kuli)

        // Pętla po sześcianie wokół środka
        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    
                    // Sprawdzamy czy punkt jest wewnątrz kuli (wzór na koło/kulę)
                    if (x*x + y*y + z*z <= r2) {
                        const targetX = cx + x;
                        const targetY = cy + y;
                        const targetZ = cz + z;

                        // Zabezpieczenie: Nie niszczymy dna świata (Y=0)
                        if (targetY > 0) {
                            // Zamieniamy blok na POWIETRZE (0)
                            set(targetX, targetY, targetZ, 0);
                        }
                    }
                }
            }
        }
    }

    console.log("[MOD] Załadowano TNT (ID: " + tntID + ")");

})(typeof window !== "undefined" ? window : this);