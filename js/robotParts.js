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
            // Get exact pixel coordinates (1:1 mapping)
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
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
                selectedPart = part;
                isDragging = true;
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
            const rect = previewCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            selectedPart.x = x - dragOffset.x;
            selectedPart.y = y - dragOffset.y;
            drawRobotPreview();
        }
    });

    previewCanvas.addEventListener('mouseup', () => {
        isDragging = false;
        selectedPart = null;
    });

    // Click to remove parts
    previewCanvas.addEventListener('click', (e) => {
        if (!isDragging) {
            const rect = previewCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if clicked on a part
            for (let i = placedParts.length - 1; i >= 0; i--) {
                const part = placedParts[i];
                const partSize = 40; // Size of the part in pixels (40mm)
                if (Math.abs(x - part.x) < partSize/2 && Math.abs(y - part.y) < partSize/2) {
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

    // Clear the canvas before drawing parts
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Draw placed parts
    placedParts.forEach(part => {
        const size = 40; // Size of the part in pixels (40mm)

        previewCtx.save();
        previewCtx.globalAlpha = 0.8; // Make parts slightly transparent
        if (part === selectedPart) {
            previewCtx.globalAlpha = 0.6; // Make selected part more transparent
        }
        previewCtx.drawImage(part.img, part.x - size/2, part.y - size/2, size, size);
        previewCtx.restore();
    });
}

export function getPlacedParts() {
    return placedParts.map(part => ({
        id: part.id,
        name: part.name,
        img: part.img, // Keep the image reference
        // Convert pixel coordinates to meters for simulation
        x: (part.x - previewCanvas.width/2) / PIXELS_PER_METER,
        y: (part.y - previewCanvas.height/2) / PIXELS_PER_METER
    }));
}

export function clearPlacedParts() {
    placedParts = [];
    drawRobotPreview();
} 