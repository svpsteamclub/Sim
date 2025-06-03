// js/robotEditor.js
import { getDOMElements } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, PIXELS_PER_METER } from './config.js';
import { Robot } from './robot.js';
import { initRobotParts, drawRobotPreview, getPlacedParts } from './robotParts.js';

let previewCanvas, previewCtx;
let previewRobot;
let currentGeometry = { ...DEFAULT_ROBOT_GEOMETRY };
let mainAppInterface;

export function initRobotEditor(appInterface) {
    console.log("Initializing robot editor...");
    mainAppInterface = appInterface;
    const elems = getDOMElements();
    previewCanvas = elems.robotPreviewCanvas;
    if (!previewCanvas) {
        console.error("Robot Preview Canvas not found!");
        return;
    }
    previewCtx = previewCanvas.getContext('2d');

    // Set fixed canvas size to 350x350 pixels (35cm x 35cm)
    previewCanvas.width = 350;
    previewCanvas.height = 350;
    
    // Set display size to match canvas size exactly (1:1 pixel mapping)
    previewCanvas.style.width = '350px';
    previewCanvas.style.height = '350px';

    console.log("Canvas size set to:", { width: previewCanvas.width, height: previewCanvas.height });

    // Initialize preview robot with default geometry
    previewRobot = new Robot(previewCanvas.width / 2 / PIXELS_PER_METER, previewCanvas.height / 2 / PIXELS_PER_METER, -Math.PI / 2);
    previewRobot.updateGeometry(DEFAULT_ROBOT_GEOMETRY);

    console.log("Preview robot initialized with geometry:", DEFAULT_ROBOT_GEOMETRY);

    // Load default geometry into input fields
    setFormValues(DEFAULT_ROBOT_GEOMETRY);

    // Initialize robot parts
    initRobotParts();

    // Initialize robot selection dropdown
    initRobotSelectionDropdown();

    // Event listeners
    elems.applyRobotGeometryButton.addEventListener('click', () => {
        console.log("Applying robot geometry...");
        currentGeometry = getFormValues();
        previewRobot.updateGeometry(currentGeometry);
        syncDecorativeSensorsWithGeometry();
        renderRobotPreview();
        // Get decorative parts and pass them to the simulation
        const decorativeParts = getPlacedParts();
        console.log("Decorative parts:", decorativeParts);
        mainAppInterface.updateRobotGeometry(currentGeometry, decorativeParts);
        alert("Geometría del robot actualizada y aplicada a la simulación (requiere reinicio de sim).");
    });

    // --- Sensor count dropdown logic ---
    if (elems.sensorCountSelect) {
        elems.sensorCountSelect.addEventListener('change', () => {
            currentGeometry.sensorCount = parseInt(elems.sensorCountSelect.value);
            previewRobot.updateGeometry(currentGeometry);
            syncDecorativeSensorsWithGeometry();
            renderRobotPreview();
        });
    }

    // Update preview dynamically as user types
    const inputs = [elems.robotWidthInput, elems.sensorOffsetInput, elems.sensorSpreadInput, elems.sensorDiameterInput];
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            currentGeometry = getFormValues();
            previewRobot.updateGeometry(currentGeometry);
            syncDecorativeSensorsWithGeometry();
            renderRobotPreview();
        });
    });
    
    // Initial render
    console.log("Loading robot assets...");
    mainAppInterface.loadRobotAssets((wheelImg) => {
        console.log("Robot assets loaded, setting images...");
        previewRobot.setImages(wheelImg);
        // Load default robot JSON only on first load
        if (!window._defaultRobotLoaded) {
            window._defaultRobotLoaded = true;
            loadDefaultRobotJSON();
        } else {
            renderRobotPreview();
        }
    });

    // Setup tab change observer
    const robotEditorTab = document.getElementById('robot-editor');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (robotEditorTab.classList.contains('active')) {
                    renderRobotPreview();
                }
            }
        });
    });
    observer.observe(robotEditorTab, { attributes: true });

    // Guardar y cargar robot
    elems.saveRobotButton.addEventListener('click', () => {
        const geometry = getFormValues();
        const parts = window.getPlacedPartsRaw ? window.getPlacedPartsRaw() : getPlacedPartsRaw();
        const robotData = {
            geometry,
            parts
        };
        const jsonData = JSON.stringify(robotData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'robot.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    elems.loadRobotInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const robotData = JSON.parse(e.target.result);
                if (robotData.geometry) {
                    setFormValues(robotData.geometry);
                    currentGeometry = getFormValues();
                    previewRobot.updateGeometry(currentGeometry);
                }
                if (robotData.parts && window.restorePlacedPartsRaw) {
                    window.restorePlacedPartsRaw(robotData.parts);
                }
                renderRobotPreview();
            } catch (err) {}
        };
        reader.readAsText(file);
        event.target.value = null;
    });
}

// Agrega partes decorativas 'sensor' en las posiciones de los sensores
function syncDecorativeSensorsWithGeometry() {
    // Elimina partes 'sensor' existentes sin reemplazar el array
    if (window.placedParts) {
        for (let i = window.placedParts.length - 1; i >= 0; i--) {
            if (window.placedParts[i].id === 'sensor') {
                window.placedParts.splice(i, 1);
            }
        }
    }
    // Obtiene las posiciones exactas de los sensores (en metros, sistema del canvas)
    const sensorPositions = previewRobot.getSensorPositions_world_m();
    // Carga la imagen del sensor
    const partInfo = window.PARTS ? window.PARTS.find(pt => pt.id === 'sensor') : null;
    let img = null;
    if (partInfo) {
        img = new window.Image();
        img.src = window.getAssetPath(partInfo.src);
    }
    // Ángulo de rotación del robot en el editor
    const editorAngle = -Math.PI / 2;
    // Coloca cada parte decorativa exactamente donde va el círculo de sensor, pero 1cm (0.01m) más abajo
    Object.values(sensorPositions).forEach(pos => {
        const px = pos.x_m * PIXELS_PER_METER;
        const py = (pos.y_m + 0.01) * PIXELS_PER_METER; // 1cm más abajo
        window.placedParts.push({
            id: 'sensor',
            name: 'Sensor',
            img,
            x: px,
            y: py,
            rotation: editorAngle
        });
    });
}

function getFormValues() {
    const elems = getDOMElements();
    // Leer valores en milímetros y convertir a metros
    return {
        width_m: parseFloat(elems.robotWidthInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.width_m,
        sensorOffset_m: parseFloat(elems.sensorOffsetInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.sensorOffset_m,
        sensorSpread_m: parseFloat(elems.sensorSpreadInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.sensorSpread_m,
        sensorDiameter_m: parseFloat(elems.sensorDiameterInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.sensorDiameter_m,
        sensorCount: parseInt(elems.sensorCountSelect?.value) || 3
    };
}

function setFormValues(geometry) {
    const elems = getDOMElements();
    // Mostrar valores en milímetros en los inputs
    elems.robotWidthInput.value = (geometry.width_m * 1000).toFixed(1);
    elems.robotWidthInput.placeholder = 'Ancho (mm)';
    elems.sensorOffsetInput.value = (geometry.sensorOffset_m * 1000).toFixed(1);
    elems.sensorOffsetInput.placeholder = 'Offset sensores (mm)';
    elems.sensorSpreadInput.value = (geometry.sensorSpread_m * 1000).toFixed(1);
    elems.sensorSpreadInput.placeholder = 'Separación sensores (mm)';
    elems.sensorDiameterInput.value = (geometry.sensorDiameter_m * 1000).toFixed(1);
    elems.sensorDiameterInput.placeholder = 'Diámetro sensor (mm)';
    if (elems.sensorCountSelect && geometry.sensorCount) {
        elems.sensorCountSelect.value = geometry.sensorCount;
    }
    syncDecorativeSensorsWithGeometry();
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

export function renderRobotPreview() {
    if (!previewCtx || !previewRobot) {
        console.error("Missing previewCtx or previewRobot:", { previewCtx: !!previewCtx, previewRobot: !!previewRobot });
        return;
    }

    console.log("Rendering robot preview...");
    console.log("Robot state:", {
        x: previewRobot.x_m,
        y: previewRobot.y_m,
        angle: previewRobot.angle_rad,
        wheelbase: previewRobot.wheelbase_m,
        sensorOffset: previewRobot.sensorForwardProtrusion_m,
        sensorSpread: previewRobot.sensorSideSpread_m
    });

    // Clear the canvas
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Draw center guides
    previewCtx.save();
    previewCtx.strokeStyle = '#bbb';
    previewCtx.lineWidth = 1;
    previewCtx.setLineDash([5, 5]); // Dashed line
    // Vertical center line
    previewCtx.beginPath();
    previewCtx.moveTo(previewCanvas.width / 2, 0);
    previewCtx.lineTo(previewCanvas.width / 2, previewCanvas.height);
    previewCtx.stroke();
    // Horizontal center line
    previewCtx.beginPath();
    previewCtx.moveTo(0, previewCanvas.height / 2);
    previewCtx.lineTo(previewCanvas.width, previewCanvas.height / 2);
    previewCtx.stroke();
    previewCtx.setLineDash([]); // Reset dash
    previewCtx.restore();

    previewCtx.save();
    // Center the robot in the preview canvas
    previewCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);

    // Draw robot
    const tempX = previewRobot.x_m;
    const tempY = previewRobot.y_m;
    const tempAngle = previewRobot.angle_rad;

    previewRobot.x_m = 0;
    previewRobot.y_m = 0;
    previewRobot.angle_rad = -Math.PI / 2;

    console.log("Drawing robot at center...");
    // Draw the robot with its current sensor states
    previewRobot.draw(previewCtx, previewRobot.sensors);

    // Draw dimension lines
    previewCtx.strokeStyle = 'black';
    previewCtx.fillStyle = 'black';
    previewCtx.lineWidth = 1;
    previewCtx.font = '10px Arial';

    // Convert meters to pixels
    const wheelbaseOffset = (previewRobot.wheelbase_m / 2 + 0.03) * PIXELS_PER_METER; // 3cm extra outside robot
    const sensorSpreadYOffset = (-previewRobot.sensorForwardProtrusion_m - 0.03) * PIXELS_PER_METER; // 3cm above sensors

    console.log("Drawing dimension lines...");
    // Robot width (wheelbase)
    const wheelbaseStartX = -previewRobot.wheelbase_m/2 * PIXELS_PER_METER;
    const wheelbaseEndX = previewRobot.wheelbase_m/2 * PIXELS_PER_METER;
    drawDimensionLine(previewCtx, 
        wheelbaseStartX, 20, // Horizontal line above
        wheelbaseEndX, 20,
        20, `${(previewRobot.wheelbase_m * 100).toFixed(1)} cm`);

    // Sensor offset (vertical dimension, offset to the left)
    const sensorLineY = 0;
    const sensorLineYEnd = -previewRobot.sensorForwardProtrusion_m * PIXELS_PER_METER;
    drawDimensionLine(previewCtx,
        -wheelbaseOffset, sensorLineY, // Offset to the left
        -wheelbaseOffset, sensorLineYEnd,
        20, `${(previewRobot.sensorForwardProtrusion_m * 100).toFixed(1)} cm`);

    // Sensor spread (horizontal dimension, above sensors)
    const sensorSpreadStartX = -previewRobot.sensorSideSpread_m * PIXELS_PER_METER;
    const sensorSpreadEndX = previewRobot.sensorSideSpread_m * PIXELS_PER_METER;
    const sensorSpreadY = -previewRobot.sensorForwardProtrusion_m * PIXELS_PER_METER;
    drawDimensionLine(previewCtx,
        sensorSpreadStartX, sensorSpreadYOffset,
        sensorSpreadEndX, sensorSpreadYOffset,
        20, `${(previewRobot.sensorSideSpread_m * 200).toFixed(1)} cm`);

    // Restore robot's original position
    previewRobot.x_m = tempX;
    previewRobot.y_m = tempY;
    previewRobot.angle_rad = tempAngle;

    previewCtx.restore();

    console.log("Drawing decorative parts...");
    // Draw decorative parts
    drawRobotPreview();

    // Draw sensors on top
    previewCtx.save();
    previewCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
    previewRobot.x_m = 0;
    previewRobot.y_m = 0;
    previewRobot.angle_rad = -Math.PI / 2;
    previewRobot.drawSensorsForDisplay(previewCtx, previewRobot.sensors);
    previewRobot.x_m = tempX;
    previewRobot.y_m = tempY;
    previewRobot.angle_rad = tempAngle;
    previewCtx.restore();
}

export function getCurrentRobotGeometry() {
    return { ...currentGeometry };
}

// Devuelve las partes decorativas en formato serializable (sin la imagen)
function getPlacedPartsRaw() {
    const parts = window.getPlacedParts ? window.getPlacedParts() : [];
    return parts.map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        rotation: p.rotation || 0
    }));
}

export async function loadDefaultRobotJSON() {
    try {
        const response = await fetch('assets/robots/Robot Generico OnOff.json');
        if (!response.ok) throw new Error('No se pudo cargar Robot Generico OnOff.json');
        const robotData = await response.json();
        if (robotData.geometry) {
            setFormValues(robotData.geometry);
            currentGeometry = getFormValues();
            previewRobot.updateGeometry(currentGeometry);
        }
        if (robotData.parts && window.restorePlacedPartsRaw) {
            window.restorePlacedPartsRaw(robotData.parts);
        }
        renderRobotPreview();
        // Notificar a la simulación
        if (mainAppInterface && typeof mainAppInterface.updateRobotGeometry === 'function') {
            const decorativeParts = window.getPlacedParts ? window.getPlacedParts() : [];
            mainAppInterface.updateRobotGeometry(currentGeometry, decorativeParts);
        }
    } catch (err) {
        console.warn('No se pudo cargar el robot por defecto:', err);
    }
}

async function initRobotSelectionDropdown() {
    const elems = getDOMElements();
    const dropdown = elems.robotSelectionDropdown;
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccionar robot...';
    dropdown.appendChild(defaultOption);

    // Add predefined robots (Robot Genérico OnOff como primero y seleccionado por defecto)
    const robots = [
        { name: 'Robot Genérico OnOff', file: 'Robot Generico OnOff.json' },
        { name: 'SL Genérico', file: 'SL Generico.json' },
        { name: 'SLC SVP 2025', file: 'SLC_SVP_2025.json' }
    ];

    robots.forEach((robot, idx) => {
        const option = document.createElement('option');
        option.value = robot.file;
        option.textContent = robot.name;
        if (idx === 0) option.selected = true; // Selecciona por defecto el primero
        dropdown.appendChild(option);
    });

    // Add change event listener
    dropdown.addEventListener('change', async (event) => {
        const selectedFile = event.target.value;
        if (!selectedFile) return;

        try {
            const response = await fetch(`assets/robots/${selectedFile}`);
            if (!response.ok) throw new Error(`No se pudo cargar ${selectedFile}`);
            const robotData = await response.json();
            
            if (robotData.geometry) {
                setFormValues(robotData.geometry);
                currentGeometry = getFormValues();
                previewRobot.updateGeometry(currentGeometry);
            }
            
            if (robotData.parts && window.restorePlacedPartsRaw) {
                window.restorePlacedPartsRaw(robotData.parts);
                // Asegurarse de que las partes decorativas se dibujen
                renderRobotPreview();
            }
            
            // Notificar a la simulación
            if (mainAppInterface && typeof mainAppInterface.updateRobotGeometry === 'function') {
                const decorativeParts = window.getPlacedParts ? window.getPlacedParts() : [];
                mainAppInterface.updateRobotGeometry(currentGeometry, decorativeParts);
            }
        } catch (err) {
            console.error('Error al cargar el robot:', err);
            alert('Error al cargar el robot seleccionado');
        }
    });

    // Selecciona y carga el robot por defecto al iniciar
    dropdown.value = robots[0].file;
    const event = new Event('change');
    dropdown.dispatchEvent(event);
}