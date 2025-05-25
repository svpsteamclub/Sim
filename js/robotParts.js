import { getDOMElements } from './ui.js';
import { loadAndScaleImage, getAssetPath } from './utils.js';
import { PIXELS_PER_METER } from './config.js';
import { renderRobotPreview } from './robotEditor.js';

const PARTS = [
    { id: 'antenna', name: 'Antena', src: 'parts/antenna.png' },
    { id: 'lights', name: 'Luces', src: 'parts/lights.png' },
    { id: 'decals', name: 'Calcomanías', src: 'parts/decals.png' },
    { id: 'bumper', name: 'Parachoques', src: 'parts/bumper.png' },
    { id: 'arduino_uno', name: 'Arduino Uno', src: 'parts/arduino_uno.png' },
    { id: 'l298n', name: 'L298N Driver', src: 'parts/l298n.png' },
    { id: 'sensor', name: 'Sensor', src: 'parts/sensor.png' },
    { id: 'robot_body', name: 'Cuerpo Robot', src: 'parts/robot_body.png' }
];

let partsPalette;
let previewCanvas;
let previewCtx;
let draggedPart = null;
let placedParts = [];
let selectedPart = null;
let isDragging = false;
let wasDragging = false;
let dragOffset = { x: 0, y: 0 };
let eraseMode = false;
let suppressNextClick = false;

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
    partsPalette.parentNode.appendChild(eraseBtn);

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
            y: rotated.y
        };
    });
}

export function clearPlacedParts() {
    placedParts = [];
    drawRobotPreview();
}

window.PARTS = PARTS;
window.placedParts = placedParts;
window.clearPlacedParts = clearPlacedParts;
window.getAssetPath = getAssetPath;
window.getPlacedParts = getPlacedParts; 