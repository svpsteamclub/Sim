// js/robotEditor.js
import { getDOMElements } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, PIXELS_PER_METER } from './config.js';
import { Robot } from './robot.js';
import { initRobotParts, drawRobotPreview } from './robotParts.js';

let previewCanvas, previewCtx;
let previewRobot;
let currentGeometry = { ...DEFAULT_ROBOT_GEOMETRY };
let mainAppInterface;

export function initRobotEditor(appInterface) {
    mainAppInterface = appInterface;
    const elems = getDOMElements();
    previewCanvas = elems.robotPreviewCanvas;
    if (!previewCanvas) {
        console.error("Robot Preview Canvas not found!");
        return;
    }
    previewCtx = previewCanvas.getContext('2d');

    // Initialize preview robot with default geometry
    previewRobot = new Robot(previewCanvas.width / 2 / PIXELS_PER_METER, previewCanvas.height / 2 / PIXELS_PER_METER, -Math.PI / 2);
    previewRobot.updateGeometry(DEFAULT_ROBOT_GEOMETRY);

    // Load default geometry into input fields
    setFormValues(DEFAULT_ROBOT_GEOMETRY);

    // Initialize robot parts
    initRobotParts();

    // Event listeners
    elems.applyRobotGeometryButton.addEventListener('click', () => {
        currentGeometry = getFormValues();
        previewRobot.updateGeometry(currentGeometry);
        renderRobotPreview();
        mainAppInterface.updateRobotGeometry(currentGeometry);
        alert("Geometría del robot actualizada y aplicada a la simulación (requiere reinicio de sim).");
    });

    elems.resetRobotGeometryButton.addEventListener('click', () => {
        currentGeometry = { ...DEFAULT_ROBOT_GEOMETRY };
        setFormValues(currentGeometry);
        previewRobot.updateGeometry(currentGeometry);
        renderRobotPreview();
        mainAppInterface.updateRobotGeometry(currentGeometry);
        alert("Geometría del robot restaurada a valores por defecto.");
    });

    // Update preview dynamically as user types
    const inputs = [elems.robotWidthInput, elems.sensorOffsetInput, elems.sensorSpreadInput, elems.sensorDiameterInput];
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            currentGeometry = getFormValues();
            previewRobot.updateGeometry(currentGeometry);
            renderRobotPreview();
        });
    });
    
    // Initial render
    mainAppInterface.loadRobotAssets((wheelImg) => {
        previewRobot.setImages(wheelImg);
        renderRobotPreview();
    });
}

function getFormValues() {
    const elems = getDOMElements();
    return {
        width_m: parseFloat(elems.robotWidthInput.value) || DEFAULT_ROBOT_GEOMETRY.width_m,
        sensorOffset_m: parseFloat(elems.sensorOffsetInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorOffset_m,
        sensorSpread_m: parseFloat(elems.sensorSpreadInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorSpread_m,
        sensorDiameter_m: parseFloat(elems.sensorDiameterInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorDiameter_m,
    };
}

function setFormValues(geometry) {
    const elems = getDOMElements();
    elems.robotWidthInput.value = geometry.width_m.toFixed(3);
    elems.sensorOffsetInput.value = geometry.sensorOffset_m.toFixed(3);
    elems.sensorSpreadInput.value = geometry.sensorSpread_m.toFixed(3);
    elems.sensorDiameterInput.value = geometry.sensorDiameter_m.toFixed(3);
}

function drawDimensionLine(ctx, startX, startY, endX, endY, offset, text) {
    const arrowSize = 5 / ctx.getTransform().a; // Ajustar tamaño de flecha para la escala
    const textOffset = 10 / ctx.getTransform().a; // Ajustar offset de texto para la escala
    
    // Dibujar línea principal
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Dibujar flechas
    const angle = Math.atan2(endY - startY, endX - startX);
    
    // Flecha 1
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + Math.cos(angle + Math.PI - Math.PI/6) * arrowSize, 
               startY + Math.sin(angle + Math.PI - Math.PI/6) * arrowSize);
    ctx.lineTo(startX + Math.cos(angle + Math.PI + Math.PI/6) * arrowSize,
               startY + Math.sin(angle + Math.PI + Math.PI/6) * arrowSize);
    ctx.closePath();
    ctx.fill();
    
    // Flecha 2
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX + Math.cos(angle - Math.PI/6) * arrowSize,
               endY + Math.sin(angle - Math.PI/6) * arrowSize);
    ctx.lineTo(endX + Math.cos(angle + Math.PI/6) * arrowSize,
               endY + Math.sin(angle + Math.PI/6) * arrowSize);
    ctx.closePath();
    ctx.fill();
    
    // Dibujar texto
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, -textOffset);
    ctx.restore();
}

function renderRobotPreview() {
    if (!previewCtx || !previewRobot) return;

    // Clear the canvas only once
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.save();

    // Center the robot in the preview canvas
    const previewArea_m = 0.3;
    const scale = Math.min(previewCanvas.width, previewCanvas.height) / previewArea_m;

    // Draw robot
    const tempX = previewRobot.x_m;
    const tempY = previewRobot.y_m;
    const tempAngle = previewRobot.angle_rad;

    previewRobot.x_m = previewCanvas.width / 2 / PIXELS_PER_METER;
    previewRobot.y_m = previewCanvas.height / 2 / PIXELS_PER_METER;
    previewRobot.angle_rad = -Math.PI / 2;

    previewRobot.draw(previewCtx, previewRobot.sensors);

    // Restore robot's original position
    previewRobot.x_m = tempX;
    previewRobot.y_m = tempY;
    previewRobot.angle_rad = tempAngle;

    previewCtx.restore();

    // Draw decorative parts
    drawRobotPreview();
}

export function getCurrentRobotGeometry() {
    return { ...currentGeometry };
}