// crafting_and_PPMclick.js
// Obsługa logiki slotów (LPM/PPM) oraz system Craftingu 2x2 pod Twoje ID bloków.

(function (global) {
    const Game = global.Game;
    if (!Game) return;

    const { BLOCK } = Game;

    // =================================================================
    // 1. KONFIGURACJA PRZEPISÓW (TWOJE BLOKI)
    // =================================================================

    // Mapa: Kłoda (Log) -> Deski (Planks)
    // 1 Kłoda daje 4 Deski
    const LOG_TO_PLANKS = {
        [BLOCK.LOG]:            BLOCK.BIRCH_PLANKS, // Domyślne drewno -> Brzozowe deski
        [BLOCK.BIRCH_LOG]:      BLOCK.BIRCH_PLANKS,
        [BLOCK.ACACIA_LOG]:     BLOCK.ACACIA_PLANKS,
        [BLOCK.CHERRY_LOG]:     BLOCK.CHERRY_PLANKS,
        [BLOCK.MANGROVE_LOG]:   BLOCK.MANGROVE_PLANKS,
        [BLOCK.SPRUCE_LOG]:     BLOCK.SPRUCE_PLANKS
    };

    // Lista wszystkich desek (do przepisu na skrzynię)
    const ALL_PLANKS = [
        BLOCK.BIRCH_PLANKS,
        BLOCK.ACACIA_PLANKS,
        BLOCK.CHERRY_PLANKS,
        BLOCK.MANGROVE_PLANKS,
        BLOCK.SPRUCE_PLANKS
    ];

    const RECIPES = [];

    function addRecipe(pattern, result) {
        RECIPES.push({ pattern, result });
    }

    // --- GENEROWANIE PRZEPISÓW NA SKRZYNIĘ ---
    // 4 Deski (w kwadracie 2x2) -> 1 Skrzynia
    // Generujemy to dla każdego rodzaju desek
    
    ALL_PLANKS.forEach(plankID => {
        // Sprawdźmy czy Chest ID jest już nadane (moduł skrzyni ładuje się wcześniej/później)
        // Używamy dynamicznego gettera wewnątrz check(), ale tu definiujemy wzór.
        addRecipe(
            [plankID, plankID, 
             plankID, plankID], 
            { isChest: true, count: 1 } // isChest: true, bo ID skrzyni może się zmienić
        );
    });

    // =================================================================
    // 2. LOGIKA KLIKANIA (LPM / PPM)
    // =================================================================
    
    Game.SlotLogic = {};

    // sourceList: tablica slotów (np. inventory.slots)
    // index: który slot kliknięto
    // button: 0 (LPM) lub 2 (PPM)
    // craftingCallback: funkcja odświeżająca wynik craftingu
    Game.SlotLogic.click = function(list, index, button, craftingCallback) {
        const slotItem = list[index];
        const cursorItem = Game.inventory.cursor;

        // --- LEWY PRZYCISK MYSZY (LPM) ---
        if (button === 0) {
            if (!cursorItem && slotItem) {
                // Podnieś wszystko
                Game.inventory.cursor = slotItem;
                list[index] = null;
            } 
            else if (cursorItem && !slotItem) {
                // Połóż wszystko
                list[index] = cursorItem;
                Game.inventory.cursor = null;
            }
            else if (cursorItem && slotItem) {
                // Stackowanie lub zamiana
                if (cursorItem.id === slotItem.id) {
                    const max = 64;
                    const space = max - slotItem.count;
                    const toAdd = Math.min(space, cursorItem.count);
                    slotItem.count += toAdd;
                    cursorItem.count -= toAdd;
                    if (cursorItem.count <= 0) Game.inventory.cursor = null;
                } else {
                    // Zamiana (Swap)
                    list[index] = cursorItem;
                    Game.inventory.cursor = slotItem;
                }
            }
        }
        
        // --- PRAWY PRZYCISK MYSZY (PPM) - PRECYZYJNE ---
        else if (button === 2) {
            if (!cursorItem && slotItem) {
                // SPLIT: Weź połowę
                const half = Math.ceil(slotItem.count / 2);
                const rem = slotItem.count - half;
                Game.inventory.cursor = { id: slotItem.id, count: half };
                
                if (rem > 0) slotItem.count = rem;
                else list[index] = null;
            }
            else if (cursorItem && !slotItem) {
                // PLACE ONE: Połóż jeden
                list[index] = { id: cursorItem.id, count: 1 };
                cursorItem.count--;
                if (cursorItem.count <= 0) Game.inventory.cursor = null;
            }
            else if (cursorItem && slotItem) {
                // ADD ONE: Dodaj jeden do stacka
                if (cursorItem.id === slotItem.id && slotItem.count < 64) {
                    slotItem.count++;
                    cursorItem.count--;
                    if (cursorItem.count <= 0) Game.inventory.cursor = null;
                } else {
                    // Swap jeśli inne ID
                    list[index] = cursorItem;
                    Game.inventory.cursor = slotItem;
                }
            }
        }

        if (craftingCallback) craftingCallback();
    };

    // =================================================================
    // 3. SYSTEM SPRAWDZANIA CRAFTINGU (2x2)
    // =================================================================

    Game.Crafting = {};
    
    Game.Crafting.check = function(grid) {
        // grid to tablica [TL, TR, BL, BR]

        // 1. Policz itemy w gridzie
        let itemCount = 0;
        let singleItem = null;

        for(let item of grid) {
            if(item) {
                itemCount++;
                singleItem = item;
            }
        }

        // --- PRZEPIS 1: DREWNO -> 4 DESKI (Shapeless) ---
        // Jeśli jest tylko 1 item i jest on w mapie LOG_TO_PLANKS
        if (itemCount === 1 && singleItem) {
            const resultPlankID = LOG_TO_PLANKS[singleItem.id];
            if (resultPlankID) {
                return { id: resultPlankID, count: 4 };
            }
        }

        // --- PRZEPIS 2: SKRZYNIA (Shaped 2x2) ---
        for (let recipe of RECIPES) {
            let match = true;
            for (let i = 0; i < 4; i++) {
                const requiredID = recipe.pattern[i];
                const slot = grid[i];

                // 0 lub undefined w patternie oznacza pusty slot (ale my mamy pełne deski 2x2)
                // Tutaj pattern zawiera konkretne ID desek
                if (requiredID) {
                    if (!slot || slot.id !== requiredID) match = false;
                } else {
                    if (slot !== null) match = false;
                }
            }
            
            if (match) {
                // Znaleziono przepis!
                const resultID = recipe.result.isChest ? BLOCK.CHEST : recipe.result.id;
                // Zabezpieczenie jakby BLOCK.CHEST jeszcze nie istniał (chociaż powinien)
                if (!resultID) return null; 
                return { id: resultID, count: recipe.result.count };
            }
        }

        return null;
    };

    // Obsługa kliknięcia w wynik
    Game.SlotLogic.craftResultClick = function(grid, resultArr, button) {
        const resultItem = resultArr[0];
        if (!resultItem) return;
        if (button !== 0) return; // Tylko LPM bierze wynik

        const cursor = Game.inventory.cursor;

        if (!cursor) {
            Game.inventory.cursor = resultItem;
            resultArr[0] = null;
            consumeIngredients(grid);
        } else if (cursor.id === resultItem.id && cursor.count + resultItem.count <= 64) {
            cursor.count += resultItem.count;
            resultArr[0] = null;
            consumeIngredients(grid);
        }
    };

    function consumeIngredients(grid) {
        for (let i = 0; i < grid.length; i++) {
            if (grid[i]) {
                grid[i].count--;
                if (grid[i].count <= 0) grid[i] = null;
            }
        }
    }

    console.log('[MOD] Crafting Logic & PPM Loaded (Logs->Planks, Planks->Chest)');

})(typeof window !== "undefined" ? window : this);