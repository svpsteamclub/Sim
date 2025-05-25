import { getDOMElements } from './ui.js';
import { loadAndScaleImage, getAssetPath } from './utils.js';
import { PIXELS_PER_METER } from './config.js';

const PARTS = [
    { id: 'antenna', name: 'Antena', src: 'parts/antenna.png' },
    { id: 'lights', name: 'Luces', src: 'parts/lights.png' },
    { id: 'decals', name: 'Calcomanías', src: 'parts/decals.png' },
    { id: 'bumper', name: 'Parachoques', src: 'parts/bumper.png' }
];

let partsPalette;
let previewCanvas;
let previewCtx;
let draggedPart = null;
let placedParts = [];
let selectedPart = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

export function initRobotParts() {
    const elems = getDOMElements();
    previewCanvas = elems.robotPreviewCanvas;
    previewCtx = previewCanvas.getContext('2d');
    partsPalette = elems.robotPartsPalette;

    if (!partsPalette || !previewCanvas) {
        console.error("Robot parts palette or preview canvas not found!");
        return;
    }

    // Load parts into palette
    PARTS.forEach(part => {
        const img = new Image();
        img.src = getAssetPath(part.src);
        img.onload = () => {
            const partElement = document.createElement('img');
            partElement.src = img.src;
            partElement.draggable = true;
            partElement.dataset.partId = part.id;
            partElement.title = part.name;
            
            // Add drag event listeners
            partElement.addEventListener('dragstart', (e) => {
                draggedPart = {
                    id: part.id,
                    name: part.name,
                    img: img
                };
                e.dataTransfer.setData('text/plain', part.id);
                e.dataTransfer.effectAllowed = 'copy';
            });
            
            partElement.addEventListener('dragend', () => {
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
            const rect = previewCanvas.getBoundingClientRect();
            // Convertir coordenadas del canvas a metros (1px = 1mm)
            const x = (e.clientX - rect.left - previewCanvas.width/2) / PIXELS_PER_METER;
            const y = (e.clientY - rect.top - previewCanvas.height/2) / PIXELS_PER_METER;
            
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

    // Mouse events for moving placed parts
    previewCanvas.addEventListener('mousedown', (e) => {
        const rect = previewCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - previewCanvas.width/2) / PIXELS_PER_METER;
        const mouseY = (e.clientY - rect.top - previewCanvas.height/2) / PIXELS_PER_METER;

        // Check if clicked on a part
        for (let i = placedParts.length - 1; i >= 0; i--) {
            const part = placedParts[i];
            const partSize = 40 / PIXELS_PER_METER; // Tamaño de la parte en metros
            if (Math.abs(mouseX - part.x) < partSize/2 && Math.abs(mouseY - part.y) < partSize/2) {
                selectedPart = part;
                isDragging = true;
                dragOffset = {
                    x: mouseX - part.x,
                    y: mouseY - part.y
                };
                break;
            }
        }
    });

    previewCanvas.addEventListener('mousemove', (e) => {
        if (isDragging && selectedPart) {
            const rect = previewCanvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - previewCanvas.width/2) / PIXELS_PER_METER;
            const mouseY = (e.clientY - rect.top - previewCanvas.height/2) / PIXELS_PER_METER;
            
            selectedPart.x = mouseX - dragOffset.x;
            selectedPart.y = mouseY - dragOffset.y;
            drawRobotPreview();
        }
    });

    previewCanvas.addEventListener('mouseup', () => {
        isDragging = false;
        selectedPart = null;
    });

    // Click to remove part
    previewCanvas.addEventListener('click', (e) => {
        if (!isDragging) {
            const rect = previewCanvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - previewCanvas.width/2) / PIXELS_PER_METER;
            const mouseY = (e.clientY - rect.top - previewCanvas.height/2) / PIXELS_PER_METER;

            // Check if clicked on a part
            for (let i = placedParts.length - 1; i >= 0; i--) {
                const part = placedParts[i];
                const partSize = 40 / PIXELS_PER_METER;
                if (Math.abs(mouseX - part.x) < partSize/2 && Math.abs(mouseY - part.y) < partSize/2) {
                    placedParts.splice(i, 1);
                    drawRobotPreview();
                    break;
                }
            }
        }
    });
}

export function drawRobotPreview() {
    if (!previewCtx || !previewCanvas) return;

    // Draw placed parts
    placedParts.forEach(part => {
        const x = part.x * PIXELS_PER_METER;
        const y = part.y * PIXELS_PER_METER;
        const size = 40; // Tamaño de la parte en píxeles

        previewCtx.save();
        previewCtx.globalAlpha = 0.8; // Make parts slightly transparent
        if (part === selectedPart) {
            previewCtx.globalAlpha = 0.6; // Make selected part more transparent
        }
        previewCtx.drawImage(part.img, x - size/2, y - size/2, size, size);
        previewCtx.restore();
    });
}

export function getPlacedParts() {
    return placedParts.map(part => ({
        ...part,
        // Las coordenadas ya están en metros relativas al centro del robot
        x: part.x,
        y: part.y
    }));
}

export function clearPlacedParts() {
    placedParts = [];
    drawRobotPreview();
} 