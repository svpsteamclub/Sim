import { getDOMElements } from './ui.js';
import { loadAndScaleImage, getAssetPath } from './utils.js';
import { PIXELS_PER_METER } from './config.js';
import { renderRobotPreview } from './robotEditor.js';

const PARTS = [
    { id: 'chassis3', name: 'Chassis 3', src: 'parts/Chassis3.png' },
    { id: '18650', name: 'Batería 18650', src: 'parts/18650.png' },
    { id: 'motor', name: 'Motor DC con Reductor', src: 'parts/MotorDCwithGearBox.png' },
    { id: 'chassis2', name: 'Chassis 2', src: 'parts/Chassis2.png' },
    { id: 'sensor', name: 'Sensor', src: 'parts/sensor.png' },
    { id: 'robot_body', name: 'Cuerpo Robot', src: 'parts/robot_body.png' },
    { id: 'arduino_uno', name: 'Arduino Uno', src: 'parts/arduino_uno.png' },
    { id: 'l298n', name: 'L298N Driver', src: 'parts/l298n.png' }
];

let partsPalette;
let previewCanvas;
let previewCtx;
let draggedPart = null;
let placedParts = [];
window.placedParts = placedParts;
let selectedPart = null;
let isDragging = false;
let wasDragging = false;
let dragOffset = { x: 0, y: 0 };
let eraseMode = false;
let suppressNextClick = false;

// --- TOUCH SUPPORT FOR MOBILE ---
let touchDragPart = null;
let touchDragImg = null;
let touchDragOffset = { x: 0, y: 0 };
let lastTapTime = 0;
let tapTimeout = null;

// Helper: get touch position relative to an element
function getTouchPos(e, el) {
    const rect = el.getBoundingClientRect();
    const t = e.touches[0] || e.changedTouches[0];
    return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top
    };
}

export function initRobotParts() {
    console.log("Initializing robot parts...");
    const elems = getDOMElements();
    previewCanvas = elems.robotPreviewCanvas;
    previewCtx = previewCanvas.getContext('2d');
    partsPalette = elems.robotPartsPalette;

    if (!partsPalette || !previewCanvas) {
        console.error("Robot parts palette or preview canvas not found!");
        return;
    }

    // --- BLOQUEAR SCROLL Y GESTOS EN MOBILE DURANTE TOUCH ---
    // Esto previene el scroll y zoom nativo durante interacción touch
    partsPalette.style.touchAction = 'none';
    previewCanvas.style.touchAction = 'none';

    // Add erase mode button under the palette
    let eraseBtn = document.createElement('button');
    eraseBtn.textContent = 'Modo Borrar';
    eraseBtn.style.marginTop = '8px';
    eraseBtn.style.display = 'block';
    eraseBtn.style.width = '100%';
    eraseBtn.onclick = () => {
        eraseMode = !eraseMode;
        eraseBtn.classList.toggle('active', eraseMode);
        eraseBtn.style.background = eraseMode ? '#e66' : '';
    };
    // Insertar después del texto de ayuda si existe
    const helpDiv = partsPalette.parentNode.querySelector('.robot-editor-help');
    if (helpDiv) {
        helpDiv.parentNode.insertBefore(eraseBtn, helpDiv.nextSibling);
    } else {
        partsPalette.parentNode.appendChild(eraseBtn);
    }

    console.log("Loading parts into palette...");
    // Load parts into palette
    PARTS.forEach(part => {
        const img = new Image();
        img.src = getAssetPath(part.src);
        img.onload = () => {
            console.log(`Loaded part image: ${part.name}`);
            const partElement = document.createElement('img');
            partElement.src = img.src;
            partElement.draggable = true;
            partElement.dataset.partId = part.id;
            partElement.title = part.name;
            
            // Add drag event listeners
            partElement.addEventListener('dragstart', (e) => {
                console.log(`Starting drag of part: ${part.name}`);
                draggedPart = {
                    id: part.id,
                    name: part.name,
                    img: img
                };
                e.dataTransfer.setData('text/plain', part.id);
                e.dataTransfer.effectAllowed = 'copy';
            });
            
            partElement.addEventListener('dragend', () => {
                console.log(`Ended drag of part: ${part.name}`);
                draggedPart = null;
            });
            
            partsPalette.appendChild(partElement);
        };
    });

    // Drag and drop event listeners
    previewCanvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    previewCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedPart) {
            console.log(`Dropping part: ${draggedPart.name}`);
            const rect = previewCanvas.getBoundingClientRect();
            // Get exact pixel coordinates (1:1 mapping)
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            console.log(`Part dropped at coordinates:`, { x, y });
            
            placedParts.push({
                id: draggedPart.id,
                name: draggedPart.name,
                img: draggedPart.img,
                x: x,
                y: y
            });
            
            draggedPart = null;
            drawRobotPreview();
        }
    });

    // Mouse interaction for moving parts
    previewCanvas.addEventListener('mousedown', (e) => {
        const rect = previewCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicked on a part
        for (let i = placedParts.length - 1; i >= 0; i--) {
            const part = placedParts[i];
            const partSize = 40; // Size of the part in pixels (40mm)
            if (Math.abs(x - part.x) < partSize/2 && Math.abs(y - part.y) < partSize/2) {
                console.log(`Selected part for moving: ${part.name}`);
                selectedPart = part;
                isDragging = true;
                wasDragging = false;
                dragOffset = {
                    x: x - part.x,
                    y: y - part.y
                };
                break;
            }
        }
    });

    previewCanvas.addEventListener('mousemove', (e) => {
        if (isDragging && selectedPart) {
            wasDragging = true;
            const rect = previewCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            selectedPart.x = x - dragOffset.x;
            selectedPart.y = y - dragOffset.y;
            renderRobotPreview();
        }
    });

    previewCanvas.addEventListener('mouseup', () => {
        if (isDragging) {
            console.log(`Finished moving part: ${selectedPart?.name}`);
            isDragging = false;
            selectedPart = null;
        }
    });

    // Click to remove parts
    previewCanvas.addEventListener('click', (e) => {
        if (suppressNextClick) {
            suppressNextClick = false;
            return;
        }
        // No erase logic here; single-click does not erase parts anymore
        wasDragging = false;
    });

    // Double-click to rotate or erase parts
    previewCanvas.addEventListener('dblclick', (e) => {
        const rect = previewCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        for (let i = placedParts.length - 1; i >= 0; i--) {
            const part = placedParts[i];
            const partSize = part.img.width; // Use width for hit area
            if (Math.abs(x - part.x) < partSize/2 && Math.abs(y - part.y) < partSize/2) {
                if (eraseMode) {
                    console.log(`Erasing part: ${part.name}`);
                    placedParts.splice(i, 1);
                } else {
                    part.rotation = ((part.rotation || 0) + Math.PI/2) % (2*Math.PI);
                    console.log(`Rotated part: ${part.name} to ${part.rotation} radians`);
                }
                renderRobotPreview();
                suppressNextClick = true;
                break;
            }
        }
    });

    // Touch drag from palette
    partsPalette.addEventListener('touchstart', function(e) {
        const target = e.target.closest('img[data-part-id]');
        if (!target) return;
        e.preventDefault();
        const partId = target.dataset.partId;
        const partInfo = PARTS.find(pt => pt.id === partId);
        if (!partInfo) return;
        touchDragPart = partInfo;
        // Create drag image for feedback
        touchDragImg = document.createElement('img');
        touchDragImg.src = getAssetPath(partInfo.src);
        touchDragImg.style.position = 'fixed';
        touchDragImg.style.pointerEvents = 'none';
        touchDragImg.style.opacity = '0.7';
        touchDragImg.style.zIndex = '9999';
        touchDragImg.style.width = '40px';
        touchDragImg.style.height = '40px';
        document.body.appendChild(touchDragImg);
        const pos = getTouchPos(e, document.body);
        touchDragImg.style.left = (pos.x - 20) + 'px';
        touchDragImg.style.top = (pos.y - 20) + 'px';
        touchDragOffset = { x: 20, y: 20 };
    }, { passive: false });

    partsPalette.addEventListener('touchmove', function(e) {
        if (!touchDragImg) return;
        e.preventDefault();
        const pos = getTouchPos(e, document.body);
        touchDragImg.style.left = (pos.x - touchDragOffset.x) + 'px';
        touchDragImg.style.top = (pos.y - touchDragOffset.y) + 'px';
    }, { passive: false });

    partsPalette.addEventListener('touchend', function(e) {
        if (!touchDragPart || !touchDragImg) return;
        const pos = getTouchPos(e, previewCanvas);
        // Check if touch ended over the canvas
        const rect = previewCanvas.getBoundingClientRect();
        const t = e.changedTouches[0];
        if (t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom) {
            // Drop part on canvas
            placedParts.push({
                id: touchDragPart.id,
                name: touchDragPart.name,
                img: new window.Image(),
                x: pos.x,
                y: pos.y
            });
            placedParts[placedParts.length-1].img.src = getAssetPath(touchDragPart.src);
            drawRobotPreview();
        }
        document.body.removeChild(touchDragImg);
        touchDragImg = null;
        touchDragPart = null;
    }, { passive: false });

    partsPalette.addEventListener('touchcancel', function() {
        if (touchDragImg) document.body.removeChild(touchDragImg);
        touchDragImg = null;
        touchDragPart = null;
    });

    // Touch move/drag for parts already on canvas
    let touchMovePart = null;
    let touchMoveOffset = { x: 0, y: 0 };
    previewCanvas.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) return; // Ignore multi-touch
        const pos = getTouchPos(e, previewCanvas);
        // Check if touching a part
        for (let i = placedParts.length - 1; i >= 0; i--) {
            const part = placedParts[i];
            const partSize = 40;
            if (Math.abs(pos.x - part.x) < partSize/2 && Math.abs(pos.y - part.y) < partSize/2) {
                touchMovePart = part;
                touchMoveOffset = { x: pos.x - part.x, y: pos.y - part.y };
                // Double tap detection for rotate/erase
                const now = Date.now();
                if (now - lastTapTime < 350) {
                    clearTimeout(tapTimeout);
                    lastTapTime = 0;
                    if (eraseMode) {
                        placedParts.splice(i, 1);
                    } else {
                        part.rotation = ((part.rotation || 0) + Math.PI/2) % (2*Math.PI);
                    }
                    drawRobotPreview();
                    e.preventDefault();
                    return;
                } else {
                    lastTapTime = now;
                    tapTimeout = setTimeout(() => { lastTapTime = 0; }, 400);
                }
                e.preventDefault();
                break;
            }
        }
    }, { passive: false });

    previewCanvas.addEventListener('touchmove', function(e) {
        if (!touchMovePart) return;
        e.preventDefault();
        const pos = getTouchPos(e, previewCanvas);
        touchMovePart.x = pos.x - touchMoveOffset.x;
        touchMovePart.y = pos.y - touchMoveOffset.y;
        drawRobotPreview();
    }, { passive: false });

    previewCanvas.addEventListener('touchend', function(e) {
        if (touchMovePart) {
            touchMovePart = null;
        }
    });
    previewCanvas.addEventListener('touchcancel', function() {
        touchMovePart = null;
    });
}

export function drawRobotPreview() {
    if (!previewCtx || !previewCanvas) {
        console.error("Missing previewCtx or previewCanvas in drawRobotPreview");
        return;
    }
    // Do NOT clear the canvas here; it is cleared in renderRobotPreview
    console.log("Drawing robot preview with parts:", placedParts.length);
    // Draw placed parts
    placedParts.forEach(part => {
        const sizeW = part.img.width;
        const sizeH = part.img.height;
        const rotation = part.rotation || 0;
        console.log(`Drawing part ${part.name} at:`, { x: part.x, y: part.y, rotation });
        previewCtx.save();
        previewCtx.translate(part.x, part.y);
        previewCtx.rotate(rotation);
        // Always fully opaque
        previewCtx.drawImage(part.img, -sizeW/2, -sizeH/2, sizeW, sizeH);
        previewCtx.restore();
    });
}

function rotate90(x, y) {
    // Rotate (x, y) by +90 degrees (counterclockwise)
    return { x: -y, y: x };
}

export function getPlacedParts() {
    console.log("Getting placed parts for simulation:", placedParts.length);
    return placedParts.map(part => {
        // Convert pixel coordinates to meters for simulation
        let x_m = (part.x - previewCanvas.width/2) / PIXELS_PER_METER;
        let y_m = (part.y - previewCanvas.height/2) / PIXELS_PER_METER;
        // Rotate by +90deg to match simulation orientation
        const rotated = rotate90(x_m, y_m);
        return {
            id: part.id,
            name: part.name,
            img: part.img, // Keep the image reference
            x: rotated.x,
            y: rotated.y,
            rotation: (part.rotation || 0) + Math.PI/2 // Add 90 degrees to the rotation
        };
    });
}

export function clearPlacedParts() {
    placedParts = [];
    drawRobotPreview();
}

export function restorePlacedPartsRaw(partsArr) {
    placedParts.length = 0; // Vacía el array manteniendo la referencia
    const previewCanvas = getDOMElements().robotPreviewCanvas;
    partsArr.forEach(p => {
        // Solo convierte de metros a pixeles, sin rotar ejes
        const px = p.x * PIXELS_PER_METER + previewCanvas.width/2;
        const py = p.y * PIXELS_PER_METER + previewCanvas.height/2;
        const partInfo = PARTS.find(pt => pt.id === p.id);
        let img = null;
        if (partInfo) {
            img = new window.Image();
            img.src = getAssetPath(partInfo.src);
        }
        placedParts.push({
            id: p.id,
            name: p.name,
            img,
            x: px,
            y: py,
            rotation: p.rotation || 0
        });
    });
    renderRobotPreview();
}

// Devuelve las partes decorativas en coordenadas del editor (sin rotar)
export function getPlacedPartsRaw() {
    const previewCanvas = getDOMElements().robotPreviewCanvas;
    return placedParts.map(part => {
        // Convierte de pixeles a metros, sin rotar
        let x_m = (part.x - previewCanvas.width/2) / PIXELS_PER_METER;
        let y_m = (part.y - previewCanvas.height/2) / PIXELS_PER_METER;
        return {
            id: part.id,
            name: part.name,
            x: x_m,
            y: y_m,
            rotation: part.rotation || 0
        };
    });
}

window.PARTS = PARTS;
window.clearPlacedParts = clearPlacedParts;
window.getAssetPath = getAssetPath;
window.getPlacedParts = getPlacedParts;
window.restorePlacedPartsRaw = restorePlacedPartsRaw;
window.getPlacedPartsRaw = getPlacedPartsRaw;