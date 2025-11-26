(function(global){
    const Game = global.Game;
    if (!Game) return;

    const { BLOCK, BLOCK_INFO, CREATIVE_ITEMS } = Game;

    // ---------- REJESTRACJA BLOKU ----------
    // Wybierz wolne ID (np. 500)
    const RAINBOW_ID = 500;
    BLOCK.RAINBOW = RAINBOW_ID;
    BLOCK_INFO[RAINBOW_ID] = {
        name: "Rainbow Block",
        all: "rainbow_block" // nazwa tekstury w atlasie
    };

    // Dodajemy do kreatywnego ekwipunku
    CREATIVE_ITEMS.push(RAINBOW_ID);

    // ---------- TWORZENIE TEKSTURY ----------
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');

    const colors = ['red','orange','yellow','green','blue','indigo','violet'];
    const stripeHeight = canvas.height / colors.length;

    colors.forEach((color, i)=>{
        ctx.fillStyle = color;
        ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
    });

    // ---------- DODANIE TEKSTURY DO ATLASU ----------
    if (typeof Game.addTextureToAtlas === 'function') {
        Game.addTextureToAtlas("rainbow_block", canvas.toDataURL().split(",")[1]);
    } else {
        console.warn("[RAINBOW_BLOCK] Game.addTextureToAtlas nie istnieje – upewnij się, że script.js jest załadowany przed modułem");
    }

    console.log("[RAINBOW_BLOCK] Załadowano moduł - blok tęczowy gotowy do użycia");
})(typeof window !== "undefined" ? window : this);
