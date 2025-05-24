import { getDOMElements } from './ui.js';
import { loadAndScaleImage, getAssetPath } from './utils.js';

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
            partsPalette.appendChild(partElement);
        };
    });

    // Drag and drop event listeners
    previewCanvas.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    previewCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedPart) {
            const rect = previewCanvas.getBoundingClientRect();
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
            const partSize = 40 / PIXELS_PER_METER; // Convert pixel size to meters
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

function handleDragStart(e) {
    draggedPart = {
        id: e.target.dataset.partId,
        name: e.target.alt,
        img: e.target
    };
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.partId);
    e.dataTransfer.effectAllowed = 'copy';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedPart = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
    e.preventDefault();
    if (!draggedPart) return;

    const rect = previewCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / previewCanvas.width;
    const y = (e.clientY - rect.top) / previewCanvas.height;

    // Add the part to placed parts
    placedParts.push({
        id: draggedPart.id,
        name: draggedPart.name,
        x: x,
        y: y,
        img: draggedPart.img
    });

    // Redraw the preview
    drawRobotPreview();
}

function handleCanvasClick(e) {
    const rect = previewCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / previewCanvas.width;
    const y = (e.clientY - rect.top) / previewCanvas.height;

    // Check if clicked on a part to remove it
    for (let i = placedParts.length - 1; i >= 0; i--) {
        const part = placedParts[i];
        const partX = part.x * previewCanvas.width;
        const partY = part.y * previewCanvas.height;
        const partSize = 40; // Size of the part in pixels

        if (Math.abs(x * previewCanvas.width - partX) < partSize/2 &&
            Math.abs(y * previewCanvas.height - partY) < partSize/2) {
            placedParts.splice(i, 1);
            drawRobotPreview();
            break;
        }
    }
}

export function drawRobotPreview() {
    if (!previewCtx || !previewCanvas) return;

    // Draw placed parts
    placedParts.forEach(part => {
        const x = part.x * previewCanvas.width;
        const y = part.y * previewCanvas.height;
        const size = 40; // Size of the part in pixels

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
        // Convert coordinates to be relative to robot center
        x: part.x,
        y: part.y
    }));
}

export function clearPlacedParts() {
    placedParts = [];
    drawRobotPreview();
} 