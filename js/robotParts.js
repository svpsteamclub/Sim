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

export function initRobotParts() {
    const elems = getDOMElements();
    partsPalette = elems.robotPartsPalette;
    previewCanvas = elems.robotPreviewCanvas;
    previewCtx = previewCanvas.getContext('2d');

    if (!partsPalette || !previewCanvas) {
        console.error("Robot parts palette or preview canvas not found!");
        return;
    }

    // Load and create part elements
    PARTS.forEach(part => {
        loadAndScaleImage(getAssetPath(part.src), 40, 40, (img) => {
            const partElement = document.createElement('img');
            partElement.src = img.src;
            partElement.alt = part.name;
            partElement.title = part.name;
            partElement.draggable = true;
            partElement.dataset.partId = part.id;
            
            // Drag events
            partElement.addEventListener('dragstart', handleDragStart);
            partElement.addEventListener('dragend', handleDragEnd);
            
            partsPalette.appendChild(partElement);
        });
    });

    // Canvas drop events
    previewCanvas.addEventListener('dragover', handleDragOver);
    previewCanvas.addEventListener('drop', handleDrop);
    previewCanvas.addEventListener('click', handleCanvasClick);
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

    // Clear the canvas
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Draw the robot (this will be handled by the robot editor)
    // The robot editor will call this function after drawing the robot

    // Draw placed parts
    placedParts.forEach(part => {
        const x = part.x * previewCanvas.width;
        const y = part.y * previewCanvas.height;
        const size = 40; // Size of the part in pixels

        previewCtx.drawImage(part.img, x - size/2, y - size/2, size, size);
    });
}

export function getPlacedParts() {
    return [...placedParts];
}

export function clearPlacedParts() {
    placedParts = [];
    drawRobotPreview();
} 