(function (global) {
    const Game = global.Game;
    if (!Game) return;

    const {
        BLOCK,
        BLOCK_INFO,
        CREATIVE_ITEMS,
        gl,
        atlas,
        atlasTexture
    } = Game;

    // --------------------------------------------------------------------------------
    // HELPER DO TEKSTUR (WYMAGANY PRZY NOWYCH BLOKACH)
    // --------------------------------------------------------------------------------
    function injectTexture(name, blockID, drawCallback) {
        // Sprawdzamy dostępność API graficznego
        if (!gl || !atlas || !atlasTexture) return;

        const ctx = atlas.canvas.getContext('2d');
        const tileSize = atlas.tile;
        const cols = atlas.cols;

        // 1. Znajdź wolne miejsce w atlasie
        const idx = Object.keys(atlas.map).length;
        const u = idx % cols;
        const v = (idx / cols) | 0;
        const x = u * tileSize;
        const y = v * tileSize;

        // 2. Rysowanie (wywołanie funkcji rysującej z modułu)
        drawCallback(ctx, x, y, tileSize);

        // 3. Rejestracja w mapie
        atlas.map[name] = { u, v };
        atlas.blockTex[blockID] = { all: name };

        // 4. Aktualizacja GPU
        gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
    }
    // --------------------------------------------------------------------------------

    // 1. Znajdowanie wolnego ID (start od 35)
    let rainbowID = 35;
    while (BLOCK_INFO[rainbowID]) {
        rainbowID++;
    }

    // 2. Rejestracja bloku
    BLOCK.RAINBOW = rainbowID;
    BLOCK_INFO[rainbowID] = {
        name: "Rainbow Block",
        solid: true,
        transparent: false
    };

    // 3. Generowanie tekstury i wstrzykiwanie do Atlasu
    injectTexture('rainbow_block', rainbowID, (ctx, x, y, size) => {
        const colors = [
            '#FF0000', // Czerwony
            '#FFA500', // Pomarańczowy
            '#FFFF00', // Żółty
            '#008000', // Zielony
            '#0000FF', // Niebieski
            '#000080', // Granatowy
            '#800080'  // Fioletowy
        ];

        const stripeHeight = size / colors.length;

        colors.forEach((color, index) => {
            ctx.fillStyle = color;
            // Rysujemy paski (x, y to współrzędne kafelka w atlasie)
            // Dodajemy +0.5 do wysokości, żeby uniknąć pustych linii przy skalowaniu
            ctx.fillRect(x, y + (index * stripeHeight), size, stripeHeight + 0.5);
        });
    });

    // 4. Dodanie do ekwipunku kreatywnego
    if (CREATIVE_ITEMS) {
        if (CREATIVE_ITEMS.indexOf(rainbowID) === -1) {
            CREATIVE_ITEMS.push(rainbowID);
        }
    }

    console.log("[MOD] Załadowano moduł Rainbow Block (ID: " + rainbowID + ")");
})(typeof window !== "undefined" ? window : this);