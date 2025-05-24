// js/trackEditor.js
import { getDOMElements } from './ui.js'; // ui.js for DOM elements
import { TRACK_PART_SIZE_PX, AVAILABLE_TRACK_PARTS, PIXELS_PER_METER } from './config.js';
import { loadAndScaleImage } from './utils.js'; // utils.js for image loading

let editorCanvas, ctx;
let grid = []; // Stores { partInfo, rotation_deg, image }
let currentGridSize = { rows: 4, cols: 4 }; 
let trackPartsImages = {}; // Cache for loaded track part images { 'fileName.png': ImageElement }
let selectedTrackPart = null; // { ...partInfo, image: ImageElement }
let isEraseModeActive = false; 
let lastGeneratedTrackStartPosition = null; // { r, c, angle_rad } for the simulator

// Directions for connection logic
const OPPOSITE_DIRECTIONS = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIRECTIONS = [
    { name: 'N', dr: -1, dc: 0 }, // North (Up)
    { name: 'E', dr: 0, dc: 1 },  // East (Right)
    { name: 'S', dr: 1, dc: 0 },  // South (Down)
    { name: 'W', dr: 0, dc: -1 }  // West (Left)
];

// Main application interface for communication (e.g., loading track to simulator)
let mainAppInterface;

export function initTrackEditor(appInterface) {
    mainAppInterface = appInterface;
    const elems = getDOMElements();
    editorCanvas = elems.trackEditorCanvas;

    if (!editorCanvas) {
        console.error("Track Editor Canvas not found!");
        return;
    }
    ctx = editorCanvas.getContext('2d');
    console.log("Track Editor Initialized");

    const initialGridSizeValue = elems.trackGridSizeSelect.value.split('x');
    currentGridSize = { rows: parseInt(initialGridSizeValue[0]), cols: parseInt(initialGridSizeValue[1]) };

    loadTrackPartAssets(() => {
        populateTrackPartsPalette(elems.trackPartsPalette);
        setupGrid(); // This will also call renderEditor
    });

    elems.trackGridSizeSelect.addEventListener('change', (e) => {
        const size = e.target.value.split('x');
        currentGridSize = { rows: parseInt(size[0]), cols: parseInt(size[1]) };
        lastGeneratedTrackStartPosition = null; 
        setupGrid();
    });

    elems.generateRandomTrackButton.addEventListener('click', () => { 
        lastGeneratedTrackStartPosition = null; 
        if (isEraseModeActive) toggleEraseMode(elems.toggleEraseModeButton); 
        generateRandomTrackWithRetry(); 
    });
    
    elems.toggleEraseModeButton.addEventListener('click', () => toggleEraseMode(elems.toggleEraseModeButton)); 

    elems.exportTrackToSimulatorButton.addEventListener('click', () => {
        if (isEraseModeActive) toggleEraseMode(elems.toggleEraseModeButton);
        
        const trackValidation = validateTrack();
        if (!trackValidation.isValid) { 
            let errorMsg = "La pista puede tener problemas:\n";
            if (trackValidation.connectionMismatches > 0) errorMsg += `- ${trackValidation.connectionMismatches / 2} conexiones incompatibles.\n`;
            if (trackValidation.danglingConnections > 0) errorMsg += `- ${trackValidation.danglingConnections} conexiones abiertas.\n`;
            if (!confirm(errorMsg + "¿Exportar de todos modos al simulador?")) {
                return;
            }
        }
        const exportedCanvas = exportTrackAsCanvas();
        if (exportedCanvas) {
            let startX_m, startY_m, startAngle_rad;
            if (lastGeneratedTrackStartPosition) {
                // Convert grid cell (r, c) and angle to simulator's world coordinates (meters)
                // Assuming robot starts in the center of the cell. TRACK_PART_SIZE_PX is in mm effectively.
                startX_m = (lastGeneratedTrackStartPosition.c + 0.5) * TRACK_PART_SIZE_PX / PIXELS_PER_METER;
                startY_m = (lastGeneratedTrackStartPosition.r + 0.5) * TRACK_PART_SIZE_PX / PIXELS_PER_METER;
                startAngle_rad = lastGeneratedTrackStartPosition.angle_rad;
            } else {
                // Default start position if none generated (e.g. top-left cell, facing right)
                startX_m = (0.5 * TRACK_PART_SIZE_PX) / PIXELS_PER_METER;
                startY_m = (0.5 * TRACK_PART_SIZE_PX) / PIXELS_PER_METER;
                startAngle_rad = 0; // Facing right along X-axis
                alert("No se generó una posición inicial específica. Usando posición por defecto (0,0) orientada al Este. Ajusta en simulación si es necesario.");
            }
            
            mainAppInterface.loadTrackFromEditor(exportedCanvas, startX_m, startY_m, startAngle_rad);
            alert("Pista del editor cargada en el simulador. Ve a la pestaña 'Simulación'.");
            // Optionally, switch to the simulation tab
            // mainAppInterface.switchToTab('simulation');
        }
    });

    elems.saveTrackDesignButton.addEventListener('click', saveTrackDesign);
    elems.loadTrackDesignInput.addEventListener('change', (event) => {
        lastGeneratedTrackStartPosition = null; 
        if (isEraseModeActive) toggleEraseMode(elems.toggleEraseModeButton);
        loadTrackDesign(event, elems.trackGridSizeSelect, elems.trackEditorTrackNameInput);
    });

    editorCanvas.addEventListener('click', (event) => {
        if (!isEraseModeActive) lastGeneratedTrackStartPosition = null; 
        onGridSingleClick(event);
    });
    editorCanvas.addEventListener('dblclick', (event) => {
        if (!isEraseModeActive) lastGeneratedTrackStartPosition = null; 
        if(isEraseModeActive) return; 
        onGridDoubleClick(event);
    });
}

function loadTrackPartAssets(callback) {
    let loadedCount = 0;
    const totalParts = AVAILABLE_TRACK_PARTS.length;
    if (totalParts === 0) {
        console.warn("No hay partes de pista definidas en config.js (AVAILABLE_TRACK_PARTS).");
        if (typeof callback === 'function') callback();
        return;
    }

    AVAILABLE_TRACK_PARTS.forEach(partInfo => {
        // Images are expected to be TRACK_PART_SIZE_PX square already.
        // If not, loadAndScaleImage would resize them. Here, we assume they are correct.
        loadAndScaleImage(`assets/track_parts/${partInfo.file}`, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX, (img) => {
            if (img) {
                trackPartsImages[partInfo.file] = img;
            } else {
                console.error(`Fallo al cargar imagen para la pieza: ${partInfo.file}`);
            }
            loadedCount++;
            if (loadedCount === totalParts) {
                if (typeof callback === 'function') callback();
            }
        });
    });
}

function populateTrackPartsPalette(paletteElement) {
    if (!paletteElement) return;
    paletteElement.innerHTML = ''; // Clear existing parts

    AVAILABLE_TRACK_PARTS.forEach(partInfo => {
        const imgContainer = document.createElement('div');
        const imgElement = trackPartsImages[partInfo.file]?.cloneNode() || new Image(70, 70); // Use cached image
        
        if (!trackPartsImages[partInfo.file]) {
            imgElement.alt = `${partInfo.name} (imagen no cargada)`;
            imgElement.style.border = "1px dashed red";
        } else {
            imgElement.alt = partInfo.name;
        }
        imgElement.title = partInfo.name;
        imgElement.dataset.partFile = partInfo.file; // Store file name for identification

        imgElement.addEventListener('click', () => {
            const elems = getDOMElements();
            if (isEraseModeActive) toggleEraseMode(elems.toggleEraseModeButton); // Exit erase mode

            document.querySelectorAll('#trackPartsPalette img').forEach(p => p.classList.remove('selected'));
            imgElement.classList.add('selected');
            
            if (trackPartsImages[partInfo.file]) {
                selectedTrackPart = { ...partInfo, image: trackPartsImages[partInfo.file] };
            } else {
                selectedTrackPart = null;
                alert(`Imagen para '${partInfo.name}' no disponible.`);
            }
        });
        imgContainer.appendChild(imgElement);
        paletteElement.appendChild(imgContainer);
    });
}

function setupGrid() {
    grid = Array(currentGridSize.rows).fill(null).map(() => Array(currentGridSize.cols).fill(null));
    if (editorCanvas) {
        // Establecer el tamaño del canvas en píxeles
        editorCanvas.width = currentGridSize.cols * TRACK_PART_SIZE_PX;
        editorCanvas.height = currentGridSize.rows * TRACK_PART_SIZE_PX;
        
        // Calcular el tamaño máximo disponible para el contenedor
        const container = editorCanvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Calcular la escala para que el canvas se ajuste al contenedor manteniendo la proporción
        const scaleX = containerWidth / editorCanvas.width;
        const scaleY = containerHeight / editorCanvas.height;
        const scale = Math.min(scaleX, scaleY);
        
        // Aplicar la escala al canvas
        editorCanvas.style.width = `${editorCanvas.width * scale}px`;
        editorCanvas.style.height = `${editorCanvas.height * scale}px`;
        
        renderEditor();
    }
}

function renderEditor() {
    if (!ctx || !editorCanvas || editorCanvas.width === 0 || editorCanvas.height === 0) return;
    
    ctx.fillStyle = '#f0f0f0'; // Light grey background for empty grid
    ctx.fillRect(0, 0, editorCanvas.width, editorCanvas.height);

    const connIndicatorSize = Math.max(6, TRACK_PART_SIZE_PX * 0.02); 
    const connIndicatorOffset = Math.max(2, TRACK_PART_SIZE_PX * 0.005);

    for (let r = 0; r < currentGridSize.rows; r++) {
        for (let c = 0; c < currentGridSize.cols; c++) {
            const x_topLeft = c * TRACK_PART_SIZE_PX;
            const y_topLeft = r * TRACK_PART_SIZE_PX;
            
            // Draw grid cell border
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            ctx.strokeRect(x_topLeft, y_topLeft, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);

            const currentGridPart = grid[r][c];
            if (currentGridPart && currentGridPart.image) {
                const x_center = x_topLeft + TRACK_PART_SIZE_PX / 2;
                const y_center = y_topLeft + TRACK_PART_SIZE_PX / 2;
                
                ctx.save();
                ctx.translate(x_center, y_center);
                ctx.rotate(currentGridPart.rotation_deg * Math.PI / 180);
                ctx.drawImage(currentGridPart.image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                ctx.restore();

                // Draw connection indicators
                const actualConns = getRotatedConnections(currentGridPart, currentGridPart.rotation_deg);
                ctx.fillStyle = actualConns.N ? 'green' : 'rgba(200,0,0,0.6)'; 
                ctx.fillRect(x_center - connIndicatorSize / 2, y_topLeft + connIndicatorOffset, connIndicatorSize, connIndicatorSize);
                
                ctx.fillStyle = actualConns.E ? 'green' : 'rgba(200,0,0,0.6)';
                ctx.fillRect(x_topLeft + TRACK_PART_SIZE_PX - connIndicatorOffset - connIndicatorSize, y_center - connIndicatorSize / 2, connIndicatorSize, connIndicatorSize);
                
                ctx.fillStyle = actualConns.S ? 'green' : 'rgba(200,0,0,0.6)';
                ctx.fillRect(x_center - connIndicatorSize / 2, y_topLeft + TRACK_PART_SIZE_PX - connIndicatorOffset - connIndicatorSize, connIndicatorSize, connIndicatorSize);
                
                ctx.fillStyle = actualConns.W ? 'green' : 'rgba(200,0,0,0.6)';
                ctx.fillRect(x_topLeft + connIndicatorOffset, y_center - connIndicatorSize / 2, connIndicatorSize, connIndicatorSize);
            }
        }
    }
    if (AVAILABLE_TRACK_PARTS.length === 0 && editorCanvas.width > 0) {
         ctx.fillStyle = "rgba(0,0,0,0.7)";
         ctx.font = `bold ${Math.min(20, editorCanvas.width * 0.05)}px Arial`;
         ctx.textAlign = "center";
         ctx.fillText("No hay partes de pista en config.js", editorCanvas.width / 2, editorCanvas.height / 2);
    }
}

function toggleEraseMode(buttonElement) {
    isEraseModeActive = !isEraseModeActive;
    if (isEraseModeActive) {
        buttonElement.textContent = "Desactivar Modo Borrar";
        buttonElement.style.backgroundColor = "#d9534f"; 
        selectedTrackPart = null; // Deselect any part
        document.querySelectorAll('#trackPartsPalette img').forEach(p => p.classList.remove('selected'));
        editorCanvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"red\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><line x1=\\"18\\" y1=\\"6\\" x2=\\"6\\" y2=\\"18\\"></line><line x1=\\"6\\" y1=\\"6\\" x2=\\"18\\" y2=\\"18\\"></line></svg>") 12 12, auto';
    } else {
        buttonElement.textContent = "Activar Modo Borrar";
        buttonElement.style.backgroundColor = ""; // Reset to default
        editorCanvas.style.cursor = 'crosshair';
    }
}

function onGridSingleClick(event) {
    if (!editorCanvas) return;
    const rect = editorCanvas.getBoundingClientRect();
    const x_canvas = event.clientX - rect.left;
    const y_canvas = event.clientY - rect.top;

    const c = Math.floor(x_canvas / TRACK_PART_SIZE_PX);
    const r = Math.floor(y_canvas / TRACK_PART_SIZE_PX);

    if (r >= 0 && r < currentGridSize.rows && c >= 0 && c < currentGridSize.cols) {
        if (isEraseModeActive) {
            if (grid[r][c]) {
                grid[r][c] = null; 
                renderEditor();
            }
        } else { 
            if (!selectedTrackPart || !selectedTrackPart.image) {
                return; 
            }
            // Permitir reemplazar piezas existentes
            grid[r][c] = {
                ...selectedTrackPart,
                rotation_deg: 0 // Initial rotation
            };
            renderEditor();
        }
    }
}

function onGridDoubleClick(event) {
    if (isEraseModeActive || !editorCanvas) return;
    const rect = editorCanvas.getBoundingClientRect();
    const x_canvas = event.clientX - rect.left;
    const y_canvas = event.clientY - rect.top;

    const c = Math.floor(x_canvas / TRACK_PART_SIZE_PX);
    const r = Math.floor(y_canvas / TRACK_PART_SIZE_PX);

    if (r >= 0 && r < currentGridSize.rows && c >= 0 && c < currentGridSize.cols && grid[r][c]) {
        // Implementar ciclo completo de rotación: 0° → 90° → 180° → 270° → 0°
        let currentRotation = grid[r][c].rotation_deg;
        
        // Asegurarse de que la rotación actual esté en el rango 0-359
        currentRotation = ((currentRotation % 360) + 360) % 360;
        
        // Calcular la siguiente rotación en el ciclo
        let nextRotation;
        if (currentRotation === 0) nextRotation = 90;
        else if (currentRotation === 90) nextRotation = 180;
        else if (currentRotation === 180) nextRotation = 270;
        else if (currentRotation === 270) nextRotation = 0;
        else nextRotation = 0; // Si por alguna razón no está en un ángulo válido, resetear a 0
        
        grid[r][c].rotation_deg = nextRotation;
        console.log(`Rotando pieza en [${r},${c}] de ${currentRotation}° a ${nextRotation}°`); // Debug log
        renderEditor();
    }
    event.preventDefault(); // Prevent text selection on double click
}

function getRotatedConnections(part, rotation_deg) {
    if (!part || !part.connections) return { N: false, S: false, E: false, W: false };
    
    // Normalizar la rotación a un valor entre 0 y 359
    rotation_deg = ((rotation_deg % 360) + 360) % 360;
    
    // Calcular el número de rotaciones de 90 grados (0, 1, 2, o 3)
    const numRotations = Math.round(rotation_deg / 90) % 4;
    
    const rotated = { N: false, S: false, E: false, W: false };
    
    // Mapear las conexiones originales a las rotadas
    const directions = ['N', 'E', 'S', 'W'];
    for (const dirKey of directions) {
        if (part.connections[dirKey]) {
            // Encontrar el índice de la dirección actual
            const currentIndex = directions.indexOf(dirKey);
            // Calcular el nuevo índice después de la rotación
            const newIndex = (currentIndex + numRotations) % 4;
            // Establecer la conexión en la nueva dirección
            rotated[directions[newIndex]] = true;
        }
    }
    
    console.log(`Rotando conexiones de ${rotation_deg}° (${numRotations} rotaciones):`, rotated); // Debug log
    return rotated;
}

function getDirectionFromTo(r1, c1, r2, c2) {
    const dr = r2 - r1; const dc = c2 - c1;
    for (const dir of DIRECTIONS) { if (dir.dr === dr && dir.dc === dc) return dir.name; }
    return null;
}

function generateRandomTrackWithRetry(maxRetries = (currentGridSize.rows * currentGridSize.cols <= 9 ? 50 : 20)) {
    console.log(`Intentando generar pista aleatoria para grid ${currentGridSize.rows}x${currentGridSize.cols} con hasta ${maxRetries} intentos...`);
    for (let i = 0; i < maxRetries; i++) {
        const generationResult = generateRandomLoopTrackLogic();
        if (generationResult.success) {
            lastGeneratedTrackStartPosition = generationResult.startPosition;
            console.log(`Pista aleatoria generada con éxito en intento ${i + 1}`);
            renderEditor(); // Make sure grid is re-rendered
            return;
        }
    }
    console.warn(`No se pudo generar una pista en bucle válida después de ${maxRetries} intentos para grid ${currentGridSize.rows}x${currentGridSize.cols}.`);
    alert("No se pudo generar una pista en bucle válida después de varios intentos. Prueba un grid más grande o revisa las piezas.");
    lastGeneratedTrackStartPosition = null;
    setupGrid(); // Clear grid on failure
}

function generateCellPathAndConnections() {
    let path = []; 
    let visitedOnPath = new Set(); 
    // Ajustar la longitud mínima y máxima del camino según el tamaño del grid
    const minPathLength = (currentGridSize.rows * currentGridSize.cols <= 9) ? 4 : Math.max(3, Math.floor((currentGridSize.rows * currentGridSize.cols) * 0.30));
    const maxPathLength = (currentGridSize.rows * currentGridSize.cols <= 9) ? 8 : Math.floor((currentGridSize.rows * currentGridSize.cols) * 0.80); 
    
    let startR = Math.floor(Math.random() * currentGridSize.rows);
    let startC = Math.floor(Math.random() * currentGridSize.cols);
    let currentR = startR; let currentC = startC;
    
    path.push({ r: currentR, c: currentC }); 
    visitedOnPath.add(`${currentR},${currentC}`);
    
    let stuckCounter = 0; 
    const maxStuck = 8;

    for (let k = 0; k < maxPathLength * 2 && path.length < maxPathLength; k++) {
        const shuffledDirections = [...DIRECTIONS].sort(() => 0.5 - Math.random());
        let moved = false;
        for (const dir of shuffledDirections) {
            const nextR = currentR + dir.dr; 
            const nextC = currentC + dir.dc;
            if (nextR >= 0 && nextR < currentGridSize.rows && 
                nextC >= 0 && nextC < currentGridSize.cols && 
                !visitedOnPath.has(`${nextR},${nextC}`)) {
                
                currentR = nextR; currentC = nextC;
                path.push({ r: currentR, c: currentC }); 
                visitedOnPath.add(`${currentR},${currentC}`);
                moved = true; stuckCounter = 0; 
                break;
            }
        }
        if (!moved) {
            stuckCounter++;
            if (stuckCounter > maxStuck && path.length >= minPathLength) break; 
            if (stuckCounter > maxStuck * 2) break; // Hard break if too stuck
            
            if (path.length > 1) { // Backtrack
                visitedOnPath.delete(`${currentR},${currentC}`); 
                path.pop();
                currentR = path[path.length - 1].r; 
                currentC = path[path.length - 1].c;
            } else { break; } // Cannot backtrack from a single cell
        }
         if (path.length >= maxPathLength) break;
    }
    
    let loopClosed = false;
    if (path.length >= minPathLength -1 ) { 
        for (const dir of DIRECTIONS) {
            if (currentR + dir.dr === startR && currentC + dir.dc === startC) {
                path.push({ r: startR, c: startC }); // Close the loop by adding start cell again
                loopClosed = true; 
                break;
            }
        }
    }

    if (!loopClosed || path.length < minPathLength) {
        return null; 
    }
    
    const pathWithConnections = [];
    for (let i = 0; i < path.length - 1; i++) { // Iterate up to the second to last cell (connection to the last that is start)
        const cell = path[i];
        // For cell path[i], previous is path[i-1] (or path[path.length-2] if i=0 for loop)
        // and next is path[i+1]
        const prevCellInLogic = (i === 0) ? path[path.length - 2] : path[i - 1]; 
        const nextCellInLogic = path[i + 1];
        
        const dirFromPrevToCell = getDirectionFromTo(prevCellInLogic.r, prevCellInLogic.c, cell.r, cell.c);
        const dirFromCellToNext = getDirectionFromTo(cell.r, cell.c, nextCellInLogic.r, nextCellInLogic.c);

        if (!dirFromPrevToCell || !dirFromCellToNext) {
            console.error("Error determining directions for path connections during generation.");
            return null; 
        }
        pathWithConnections.push({
            r: cell.r, c: cell.c,
            connections: { 
                [OPPOSITE_DIRECTIONS[dirFromPrevToCell]]: true, 
                [dirFromCellToNext]: true 
            }
        });
    }
    return pathWithConnections;
}

function generateRandomLoopTrackLogic() {
    setupGrid(); // Clear existing grid content but keep canvas size
    
    const loopParts = AVAILABLE_TRACK_PARTS.filter(p => {
        if (!p.connections) return false;
        const connCount = Object.values(p.connections).filter(conn => conn === true).length;
        // Para todos los tamaños, solo permitir piezas con exactamente 2 conexiones
        return connCount === 2;
    });

    if (loopParts.length === 0) {
        console.error("No track parts with exactly 2 connections found for loop generation.");
        return { success: false, startPosition: null };
    }

    const cellPathWithConnections = generateCellPathAndConnections();
    if (!cellPathWithConnections || cellPathWithConnections.length === 0) {
        return { success: false, startPosition: null };
    }
    
    let allPartsPlaced = true;
    let placedCount = 0;
    let straightSegmentsForStart = []; // Store {r, c, rotation_deg} of straight parts

    for (const cellInfo of cellPathWithConnections) {
        const r = cellInfo.r; const c = cellInfo.c; const requiredConns = cellInfo.connections;
        let placedPiece = false;
        const shuffledLoopParts = [...loopParts].sort(() => 0.5 - Math.random());

        for (const partDef of shuffledLoopParts) {
            if (!trackPartsImages[partDef.file]) continue; // Skip if image not loaded

            const shuffledRotations = [0, 90, 180, 270].sort(() => 0.5 - Math.random());
            for (const rot of shuffledRotations) {
                const actualConns = getRotatedConnections(partDef, rot);
                let match = true;
                // Check if actualConns has exactly the same true connections as requiredConns
                for (const reqDir in requiredConns) { // Check required open
                    if (requiredConns[reqDir] && !actualConns[reqDir]) { match = false; break; }
                }
                if (!match) continue;
                for (const actDir in actualConns) { // Check actual open (ensure no extra openings)
                    if (actualConns[actDir] && !requiredConns[actDir]) { match = false; break; }
                }

                if (match) {
                    grid[r][c] = { ...partDef, image: trackPartsImages[partDef.file], rotation_deg: rot };
                    if (partDef.name.toLowerCase().includes("recta")) { // Identify straight parts
                        straightSegmentsForStart.push({ r, c, rotation_deg: rot });
                    }
                    placedPiece = true; 
                    placedCount++; 
                    break; 
                }
            }
            if (placedPiece) break; 
        }
        if (!placedPiece) { 
            allPartsPlaced = false; 
            // console.warn(`Could not place piece at [${r},${c}] needing ${JSON.stringify(requiredConns)}`);
            break; // Stop if a piece cannot be placed
        }
    }
    
    if (!allPartsPlaced || placedCount !== cellPathWithConnections.length) {
        return { success: false, startPosition: null };
    }

    // Determine start position for the simulator
    let foundStartPosition = null;
    if (straightSegmentsForStart.length > 0) {
        const randomStraight = straightSegmentsForStart[Math.floor(Math.random() * straightSegmentsForStart.length)];
        let angle_rad = 0; // Default for East-facing
        // Determine angle based on straight piece orientation (0 deg = N-S, 90 deg = E-W)
        // Assuming 'recta.png' connections are N:true, S:true
        // Rotation 0 (N-S): Start facing South (sim angle PI/2) or North (-PI/2)
        // Rotation 90 (E-W): Start facing East (sim angle 0) or West (PI)
        const partConns = getRotatedConnections(AVAILABLE_TRACK_PARTS.find(p => p.name.toLowerCase().includes("recta")), randomStraight.rotation_deg);
        if (partConns.S) angle_rad = Math.PI / 2;      // Facing South
        else if (partConns.N) angle_rad = -Math.PI / 2; // Facing North
        else if (partConns.E) angle_rad = 0;            // Facing East
        else if (partConns.W) angle_rad = Math.PI;      // Facing West
        
        foundStartPosition = { r: randomStraight.r, c: randomStraight.c, angle_rad: angle_rad };
    } else if (cellPathWithConnections.length > 0) { // Fallback to first path cell if no straights
        const firstPathCell = cellPathWithConnections[0];
        const firstPart = grid[firstPathCell.r][firstPathCell.c];
        let angle_rad = 0; 
        if (firstPart) {
            const conns = getRotatedConnections(firstPart, firstPart.rotation_deg);
            // Try to orient along one of its connections
            if (conns.S) angle_rad = Math.PI / 2; 
            else if (conns.E) angle_rad = 0; 
            else if (conns.N) angle_rad = -Math.PI / 2; 
            else if (conns.W) angle_rad = Math.PI;
        }
        foundStartPosition = { r: firstPathCell.r, c: firstPathCell.c, angle_rad: angle_rad };
    }

    return { success: true, startPosition: foundStartPosition };
}

function validateTrack() {
    let partCount = 0; 
    let danglingConnections = 0; 
    let connectionMismatches = 0;

    for (let r = 0; r < currentGridSize.rows; r++) { 
        for (let c = 0; c < currentGridSize.cols; c++) { 
            const currentPart = grid[r][c];
            if (currentPart) {
                partCount++;
                const currentConnections = getRotatedConnections(currentPart, currentPart.rotation_deg);
                
                for (const dir of DIRECTIONS) { // N, E, S, W
                    if (currentConnections[dir.name]) { // If current part has an opening in this direction
                        const nextR = r + dir.dr; 
                        const nextC = c + dir.dc;
                        
                        if (nextR < 0 || nextR >= currentGridSize.rows || nextC < 0 || nextC >= currentGridSize.cols) {
                            // Connection leads off the grid
                            danglingConnections++; 
                        } else {
                            const neighborPart = grid[nextR][nextC];
                            if (!neighborPart) { // Neighbor cell is empty
                                danglingConnections++; 
                            } else {
                                const neighborConnections = getRotatedConnections(neighborPart, neighborPart.rotation_deg);
                                const requiredFromNeighbor = OPPOSITE_DIRECTIONS[dir.name];
                                if (!neighborConnections[requiredFromNeighbor]) {
                                    // Neighbor has a part, but no matching opening
                                    connectionMismatches++;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    const isValid = partCount > 0 && connectionMismatches === 0 && (danglingConnections === 0 || partCount === 1); // Allow dangling for single piece track
    if (partCount === 0) alert("Validación: La pista está vacía.");
    
    return {
        isValid: isValid,
        partCount: partCount,
        danglingConnections: danglingConnections,
        connectionMismatches: connectionMismatches // Each mismatch is counted by both parts, so actual issues are /2
    };
}

function saveTrackDesign() {
    const { trackEditorTrackNameInput } = getDOMElements();
    const trackName = trackEditorTrackNameInput.value.trim() || "MiPistaEditada";
    
    const designData = {
        gridSize: { ...currentGridSize },
        gridParts: [],
        trackName: trackName
    };

    for (let r = 0; r < currentGridSize.rows; r++) {
        for (let c = 0; c < currentGridSize.cols; c++) {
            if (grid[r][c] && grid[r][c].file) { // Ensure it's a valid part object
                designData.gridParts.push({
                    r: r,
                    c: c,
                    partFile: grid[r][c].file, // Save original file name
                    rotation: grid[r][c].rotation_deg
                });
            }
        }
    }

    if (designData.gridParts.length === 0) {
        alert("La pista está vacía. Nada que guardar.");
        return;
    }

    const jsonData = JSON.stringify(designData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trackName}.trackdesign.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`Diseño "${trackName}" guardado.`);
}

function loadTrackDesign(event, gridSizeSelect, trackNameInput) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const designData = JSON.parse(e.target.result);
            if (!designData.gridSize || !designData.gridParts) {
                throw new Error("Formato de archivo de diseño de pista inválido.");
            }

            currentGridSize.rows = designData.gridSize.rows || 4;
            currentGridSize.cols = designData.gridSize.cols || 4;
            
            if (gridSizeSelect) { // Update UI if element provided
                 gridSizeSelect.value = `${currentGridSize.rows}x${currentGridSize.cols}`;
            }
            if (trackNameInput && designData.trackName) {
                trackNameInput.value = designData.trackName;
            } else if (trackNameInput) {
                 let fName = file.name.replace(/\.trackdesign\.json$|\.json$/i, '');
                 trackNameInput.value = fName || "PistaCargada";
            }


            setupGrid(); // Re-initializes grid array and canvas size

            designData.gridParts.forEach(partData => {
                if (partData.r < currentGridSize.rows && partData.c < currentGridSize.cols) {
                    const originalPartInfo = AVAILABLE_TRACK_PARTS.find(p => p.file === partData.partFile);
                    const partImage = trackPartsImages[partData.partFile]; // Get from cache

                    if (originalPartInfo && partImage) {
                        grid[partData.r][partData.c] = {
                            ...originalPartInfo, // Includes name, connections, file
                            image: partImage,
                            rotation_deg: partData.rotation || 0
                        };
                    } else {
                        console.warn(`Pieza de pista no encontrada o imagen no cargada: ${partData.partFile} en [${partData.r},${partData.c}]`);
                    }
                }
            });
            renderEditor();
            alert(`Diseño "${file.name}" cargado.`);

        } catch (error) {
            console.error("Error al cargar diseño de pista:", error);
            alert(`Error al cargar el diseño: ${error.message}`);
        }
    };
    reader.onerror = () => {
        alert("Error al leer el archivo de diseño de pista.");
    };
    reader.readAsText(file);
    event.target.value = null; // Reset file input
}

function exportTrackAsCanvas() {
    if (currentGridSize.rows === 0 || currentGridSize.cols === 0) {
        alert("Tamaño de grid inválido para exportar.");
        return null;
    }
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = currentGridSize.cols * TRACK_PART_SIZE_PX;
    exportCanvas.height = currentGridSize.rows * TRACK_PART_SIZE_PX;

    if (exportCanvas.width === 0 || exportCanvas.height === 0) {
        alert("No se puede exportar una pista vacía o de tamaño cero.");
        return null;
    }
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = 'white'; // Background color of the track image
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    let hasContent = false;
    for (let r = 0; r < currentGridSize.rows; r++) {
        for (let c = 0; c < currentGridSize.cols; c++) {
            const part = grid[r][c];
            if (part && part.image) {
                hasContent = true;
                const x_center = c * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                const y_center = r * TRACK_PART_SIZE_PX + TRACK_PART_SIZE_PX / 2;
                
                exportCtx.save();
                exportCtx.translate(x_center, y_center);
                exportCtx.rotate(part.rotation_deg * Math.PI / 180);
                exportCtx.drawImage(part.image, -TRACK_PART_SIZE_PX / 2, -TRACK_PART_SIZE_PX / 2, TRACK_PART_SIZE_PX, TRACK_PART_SIZE_PX);
                exportCtx.restore();
            }
        }
    }

    if (!hasContent) {
        alert("El editor de pistas está vacío. No hay nada para exportar.");
        return null;
    }
    return exportCanvas;
}