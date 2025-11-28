// menu.js
// Menu pauzy (ESC) + Suwak od 1 chunka

(function (global) {
    const Game = global.Game;
    if (!Game) return;

    const { input, WORLD, gl, world } = Game;

    // =================================================================
    // 1. CONFIG
    // =================================================================
    
    let currentDist = WORLD.VIEW_RADIUS_CHUNKS || 5;

    function applyRenderSettings(dist) {
        dist = parseInt(dist);
        currentDist = dist;

        console.log(`[MENU] Ustawianie VIEW_RADIUS_CHUNKS na: ${dist}`);

        // 1. ZMIANA ZASIĘGU W SILNIKU
        WORLD.VIEW_RADIUS_CHUNKS = dist;
        
        // 2. AKTUALIZACJA MGŁY (FOG)
        try {
            // Obliczamy dystans. 
            // 1 chunk = 16 bloków.
            // Odejmujemy trochę, żeby mgła zaczynała się płynnie.
            // Math.max(8.0, ...) zapewnia, że przy 1 chunku mgła nie wejdzie nam w oczy (zostawi 8 kratek widoczności).
            const fogDistance = Math.max(8.0, (dist * 16) - 12.0);

            if (typeof Game.setFog === 'function') {
                Game.setFog(fogDistance);
            } 
            else if (gl && Game.shaderProgram) {
                const uFogDist = gl.getUniformLocation(Game.shaderProgram, "uFogDist");
                if (uFogDist) gl.uniform1f(uFogDist, fogDistance);
                
                const uViewDist = gl.getUniformLocation(Game.shaderProgram, "uViewDist");
                if (uViewDist) gl.uniform1f(uViewDist, fogDistance);
            }
        } catch (e) {
            console.warn("Błąd aktualizacji mgły:", e);
        }

        // 3. WYMUSZENIE PRZEŁADOWANIA CHUNKÓW
        if (world) {
            if (typeof world.reloadChunks === 'function') {
                world.reloadChunks();
            } else if (typeof world.updateChunks === 'function' && Game.player) {
                world.updateChunks(Game.player.pos[0], Game.player.pos[2]);
            }
        }
    }

    // =================================================================
    // 2. GUI
    // =================================================================
    
    let menuRoot = null;
    let rangeInput = null;
    let valLabel = null;

    function createMenu() {
        if (menuRoot) return;

        menuRoot = document.createElement('div');
        menuRoot.id = 'game-menu-overlay';
        menuRoot.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(5px);
            display: none; flex-direction: column; justify-content: center; align-items: center;
            z-index: 999999; font-family: monospace; color: white; user-select: none;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            width: 450px; padding: 30px; background: rgba(20, 20, 20, 0.9);
            border: 2px solid #888; display: flex; flex-direction: column; gap: 20px; text-align: center;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
        `;

        const title = document.createElement('h1');
        title.innerText = "PAUZA";
        title.style.margin = "0 0 10px 0";
        title.style.letterSpacing = "2px";

        // SUWAK
        const settingsBox = document.createElement('div');
        
        const labelTitle = document.createElement('div');
        labelTitle.innerText = "Zasięg Renderowania (Chunki)";
        labelTitle.style.marginBottom = "10px"; 
        labelTitle.style.color = "#bbb";

        valLabel = document.createElement('div');
        valLabel.innerText = `${currentDist}`;
        valLabel.style.fontWeight = "bold";
        valLabel.style.fontSize = "24px";
        valLabel.style.marginBottom = "10px";
        valLabel.style.color = "#4CAF50";

        rangeInput = document.createElement('input');
        rangeInput.type = "range";
        rangeInput.min = "1";   // <--- TU ZMIANA NA 1
        rangeInput.max = "24"; 
        rangeInput.value = currentDist;
        rangeInput.style.width = "100%";
        rangeInput.style.cursor = "pointer";
        rangeInput.style.accentColor = "#4CAF50";

        rangeInput.oninput = (e) => {
            valLabel.innerText = e.target.value;
        };
        
        rangeInput.onchange = (e) => {
            applyRenderSettings(e.target.value);
        };

        settingsBox.appendChild(labelTitle);
        settingsBox.appendChild(valLabel);
        settingsBox.appendChild(rangeInput);

        // PRZYCISK
        const backBtn = document.createElement('button');
        backBtn.innerText = "WRÓĆ DO GRY";
        backBtn.style.cssText = `
            padding: 15px; font-size: 18px; cursor: pointer;
            background: #388E3C; border: none; color: white; font-weight: bold; margin-top: 15px;
            border-radius: 4px; transition: background 0.2s;
        `;
        backBtn.onmouseover = () => backBtn.style.background = "#4CAF50";
        backBtn.onmouseout = () => backBtn.style.background = "#388E3C";
        backBtn.onclick = closeMenu;

        container.appendChild(title);
        container.appendChild(settingsBox);
        container.appendChild(backBtn);

        menuRoot.appendChild(container);
        document.body.appendChild(menuRoot);
    }

    function openMenu() {
        createMenu();
        menuRoot.style.display = 'flex';
        input.uiOpen = true;
        if (document.exitPointerLock) document.exitPointerLock();
    }

    function closeMenu() {
        if (!menuRoot) return;
        menuRoot.style.display = 'none';
        input.uiOpen = false;
        const c = document.querySelector('canvas');
        if (c) c.requestPointerLock();
    }

    // =================================================================
    // 3. ESC KEY
    // =================================================================

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            
            if (menuRoot && menuRoot.style.display === 'flex') {
                e.preventDefault(); e.stopPropagation();
                closeMenu();
                return;
            }

            if (input.uiOpen) {
                return;
            }

            e.preventDefault(); e.stopPropagation();
            openMenu();
        }
    }, true);

    console.log("[MOD] Menu Loaded (Min Dist: 1).");

})(typeof window !== "undefined" ? window : this);