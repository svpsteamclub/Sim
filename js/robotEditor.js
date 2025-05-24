// js/robotEditor.js
import { getDOMElements } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, PIXELS_PER_METER } from './config.js';
import { Robot } from './robot.js'; // To use Robot's drawing logic for preview

let previewCanvas, previewCtx;
let previewRobot; // A Robot instance for previewing
let currentGeometry = { ...DEFAULT_ROBOT_GEOMETRY }; // Local copy of geometry
let mainAppInterface; // To communicate geometry changes

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
    // Scale geometry for preview drawing if needed, or draw 1:1 in meters and scale canvas view
    // For simplicity, we'll draw the robot as if its dimensions are in pixels for the small preview.
    // Or, use a fixed scale for the preview canvas.
    previewRobot = new Robot(previewCanvas.width / 2 / PIXELS_PER_METER, previewCanvas.height / 2 / PIXELS_PER_METER, -Math.PI / 2); // Centered, facing up
    previewRobot.updateGeometry(DEFAULT_ROBOT_GEOMETRY);


    // Load default geometry into input fields
    setFormValues(DEFAULT_ROBOT_GEOMETRY);

    // Event listeners
    elems.applyRobotGeometryButton.addEventListener('click', () => {
        currentGeometry = getFormValues();
        previewRobot.updateGeometry(currentGeometry);
        renderRobotPreview();
        mainAppInterface.updateRobotGeometry(currentGeometry); // Notify main app
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

    // Update preview dynamically as user types (optional, can be intensive)
    const inputs = [elems.robotWidthInput, elems.robotLengthInput, elems.sensorOffsetInput, elems.sensorSpreadInput, elems.sensorDiameterInput];
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            currentGeometry = getFormValues();
            previewRobot.updateGeometry(currentGeometry); // Update preview robot's geometry
            renderRobotPreview(); // Re-render the preview
        });
    });
    
    // Initial render
    mainAppInterface.loadRobotAssets((bodyImg, wheelImg) => {
        previewRobot.setImages(bodyImg, wheelImg);
        renderRobotPreview();
    });
}

function getFormValues() {
    const elems = getDOMElements();
    return {
        width_m: parseFloat(elems.robotWidthInput.value) || DEFAULT_ROBOT_GEOMETRY.width_m,
        length_m: parseFloat(elems.robotLengthInput.value) || DEFAULT_ROBOT_GEOMETRY.length_m,
        sensorOffset_m: parseFloat(elems.sensorOffsetInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorOffset_m,
        sensorSpread_m: parseFloat(elems.sensorSpreadInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorSpread_m,
        sensorDiameter_m: parseFloat(elems.sensorDiameterInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorDiameter_m,
    };
}

function setFormValues(geometry) {
    const elems = getDOMElements();
    elems.robotWidthInput.value = geometry.width_m.toFixed(3);
    elems.robotLengthInput.value = geometry.length_m.toFixed(3);
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

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.save();

    // Center the robot in the preview canvas
    const previewArea_m = 0.3; 
    const scale = Math.min(previewCanvas.width, previewCanvas.height) / previewArea_m;

    // Primero dibujamos el robot sin escala
    previewCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);

    // Draw robot
    const tempX = previewRobot.x_m;
    const tempY = previewRobot.y_m;
    const tempAngle = previewRobot.angle_rad;

    previewRobot.x_m = 0;
    previewRobot.y_m = 0;
    previewRobot.angle_rad = -Math.PI / 2;

    // Dibujar el robot sin escala
    previewRobot.draw(previewCtx, previewRobot.sensors);

    // Restore robot's original position
    previewRobot.x_m = tempX;
    previewRobot.y_m = tempY;
    previewRobot.angle_rad = tempAngle;

    // Ahora aplicamos la escala para las líneas de cota
    previewCtx.scale(scale, scale);

    // Draw dimension lines
    previewCtx.strokeStyle = 'black';
    previewCtx.fillStyle = 'black';
    previewCtx.lineWidth = 1 / scale; // Ajustar el grosor de línea para la escala
    previewCtx.font = `${10 / scale}px Arial`; // Ajustar el tamaño de fuente para la escala

    // Ancho del robot (wheelbase)
    const wheelbaseStartX = -previewRobot.wheelbase_m/2;
    const wheelbaseEndX = previewRobot.wheelbase_m/2;
    drawDimensionLine(previewCtx, 
        wheelbaseStartX, -previewRobot.length_m/2 - 0.02,
        wheelbaseEndX, -previewRobot.length_m/2 - 0.02,
        0.02, `${(previewRobot.wheelbase_m * 100).toFixed(1)} cm`);

    // Largo del robot
    const lengthStartY = -previewRobot.length_m/2;
    const lengthEndY = previewRobot.length_m/2;
    drawDimensionLine(previewCtx,
        previewRobot.wheelbase_m/2 + 0.02, lengthStartY,
        previewRobot.wheelbase_m/2 + 0.02, lengthEndY,
        0.02, `${(previewRobot.length_m * 100).toFixed(1)} cm`);

    // Offset de sensores
    const sensorLineY = previewRobot.length_m/2 + previewRobot.sensorForwardProtrusion_m;
    drawDimensionLine(previewCtx,
        -previewRobot.wheelbase_m/2 - 0.02, previewRobot.length_m/2,
        -previewRobot.wheelbase_m/2 - 0.02, sensorLineY,
        0.02, `${(previewRobot.sensorForwardProtrusion_m * 100).toFixed(1)} cm`);

    // Spread de sensores (ahora en la parte superior)
    const sensorSpreadStartX = -previewRobot.sensorSideSpread_m;
    const sensorSpreadEndX = previewRobot.sensorSideSpread_m;
    drawDimensionLine(previewCtx,
        sensorSpreadStartX, -previewRobot.length_m/2 - 0.02,
        sensorSpreadEndX, -previewRobot.length_m/2 - 0.02,
        0.02, `${(previewRobot.sensorSideSpread_m * 200).toFixed(1)} cm`);

    previewCtx.restore();

    // Dibujar ejes y leyenda de escala en coordenadas de pantalla
    previewCtx.save();
    previewCtx.strokeStyle = "#aaa";
    previewCtx.lineWidth = 0.5;
    previewCtx.beginPath();
    previewCtx.moveTo(previewCanvas.width / 2, 0); 
    previewCtx.lineTo(previewCanvas.width / 2, previewCanvas.height);
    previewCtx.moveTo(0, previewCanvas.height / 2); 
    previewCtx.lineTo(previewCanvas.width, previewCanvas.height / 2);
    previewCtx.stroke();

    // Scale legend (e.g., 5cm line)
    const legendLength_m = 0.05; // 5 cm
    const legendLength_px = legendLength_m * scale;
    previewCtx.fillStyle = "black";
    previewCtx.fillRect(10, previewCanvas.height - 20, legendLength_px, 2);
    previewCtx.font = "10px Arial";
    previewCtx.fillText(`${legendLength_m*100} cm`, 10, previewCanvas.height - 25);
    previewCtx.restore();
}

export function getCurrentRobotGeometry() {
    return { ...currentGeometry };
}