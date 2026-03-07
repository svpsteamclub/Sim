// js/robotEditor.js
console.log("Robot Editor Version: 1.1 - Zoom Fix Loading...");
import { getDOMElements, updateDynamicCodeHelp } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, PIXELS_PER_METER } from './config.js';
import { Robot } from './robot.js';
import { initRobotParts, drawRobotPreview, getPlacedParts } from './robotParts.js';

let previewCanvas, previewCtx;
let previewRobot;
let currentGeometry = { ...DEFAULT_ROBOT_GEOMETRY };
let mainAppInterface;
let previewZoom = 1.0;
const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4.0;

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
    console.log("Zoom buttons found:", { in: !!elems.zoomInBtn, out: !!elems.zoomOutBtn, reset: !!elems.zoomResetBtn });
    window.renderRobotPreview = renderRobotPreview;

    // Set fixed canvas size to 500x300 pixels (50cm x 30cm)
    previewCanvas.width = 500;
    previewCanvas.height = 300;

    // Set display size to match canvas size exactly (1:1 pixel mapping)
    previewCanvas.style.width = '500px';
    previewCanvas.style.height = '300px';

    console.log("Canvas size set to:", { width: previewCanvas.width, height: previewCanvas.height });

    // Initialize preview robot with default geometry
    previewRobot = new Robot(previewCanvas.width / 2 / PIXELS_PER_METER, previewCanvas.height / 2 / PIXELS_PER_METER, -Math.PI / 2);
    previewRobot.updateGeometry(DEFAULT_ROBOT_GEOMETRY);
    updateDynamicCodeHelp(DEFAULT_ROBOT_GEOMETRY);

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
        window.forceGeometrySync();
        // Get decorative parts and pass them to the simulation
        const decorativeParts = getPlacedParts();
        console.log("Decorative parts:", decorativeParts);
        mainAppInterface.updateRobotGeometry(currentGeometry, decorativeParts);
        alert("Geometría del robot actualizada y aplicada a la simulación (requiere reinicio de sim).");
    });

    // Zoom Controls
    const setZoom = (newZoom) => {
        previewZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        console.log("Preview zoom set to:", previewZoom);
        renderRobotPreview();
    };

    if (elems.zoomInBtn) {
        elems.zoomInBtn.addEventListener('click', () => setZoom(previewZoom + ZOOM_STEP));
    }
    if (elems.zoomOutBtn) {
        elems.zoomOutBtn.addEventListener('click', () => setZoom(previewZoom - ZOOM_STEP));
    }
    if (elems.zoomResetBtn) {
        elems.zoomResetBtn.addEventListener('click', () => setZoom(1.0));
    }

    window.getPreviewZoom = () => previewZoom;

    window.forceGeometrySync = () => {
        currentGeometry = getFormValues();
        previewRobot.updateGeometry(currentGeometry);
        syncDecorativeSensorsWithGeometry();
        renderRobotPreview();
        updateDynamicCodeHelp(currentGeometry);
    };

    // --- Dynamic UI for Connections ---
    // Genera un <select> de pines Arduino UNO con optgroups
    function pinSelect(id, defaultVal, pwmOnly = false) {
        const pwmPins = [3, 5, 6, 9, 10, 11];
        const allPins = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        const pins = pwmOnly ? pwmPins : allPins;
        const pwmSet = new Set(pwmPins);
        const opts = pins.map(p => {
            const label = pwmSet.has(p) ? `${p} — PWM~ / Digital` : `${p} — Digital`;
            return `<option value="${p}"${p == defaultVal ? ' selected' : ''}>${label}</option>`;
        }).join('');
        return `<select id="${id}">${opts}</select>`;
    }

    function updateMotorConnectionsUI() {
        if (!elems.motorDriverTypeSelect || !elems.motorConnectionsContainer) return;
        const type = elems.motorDriverTypeSelect.value;
        let html = '';
        if (type === 'l298n') {
            html = `
                <div class="pin-row">
                    <span><strong>Motor Izq.</strong> — ENA (PWM~):</span>
                    ${pinSelect('pinMotorLeftEn', 3, true)}
                </div>
                <div class="pin-row">
                    <span>IN1 (dirección):</span>
                    ${pinSelect('pinMotorLeftIn1', 11)}
                </div>
                <div class="pin-row">
                    <span>IN2 (dirección):</span>
                    ${pinSelect('pinMotorLeftIn2', 9)}
                </div>
                <div class="pin-row" style="margin-top:0.5em;">
                    <span><strong>Motor Der.</strong> — ENB (PWM~):</span>
                    ${pinSelect('pinMotorRightEn', 5, true)}
                </div>
                <div class="pin-row">
                    <span>IN3 (dirección):</span>
                    ${pinSelect('pinMotorRightIn3', 10)}
                </div>
                <div class="pin-row">
                    <span>IN4 (dirección):</span>
                    ${pinSelect('pinMotorRightIn4', 6)}
                </div>`;
        } else if (type === 'mx1616') {
            html = `
                <div class="pin-row">
                    <span><strong>Motor Izq.</strong> — IN1 (PWM~):</span>
                    ${pinSelect('pinMotorLeftIn1', 11, true)}
                </div>
                <div class="pin-row">
                    <span>IN2 (PWM~):</span>
                    ${pinSelect('pinMotorLeftIn2', 9, true)}
                </div>
                <div class="pin-row" style="margin-top:0.5em;">
                    <span><strong>Motor Der.</strong> — IN3 (PWM~):</span>
                    ${pinSelect('pinMotorRightIn3', 10, true)}
                </div>
                <div class="pin-row">
                    <span>IN4 (PWM~):</span>
                    ${pinSelect('pinMotorRightIn4', 6, true)}
                </div>`;
        } else { // single / ESCs
            html = `
                <div class="pin-row">
                    <span><strong>Motor Izq. (ESC)</strong> — PWM~:</span>
                    ${pinSelect('pinMotorLeftPWM', 9, true)}
                </div>
                <div class="pin-row">
                    <span><strong>Motor Der. (ESC)</strong> — PWM~:</span>
                    ${pinSelect('pinMotorRightPWM', 10, true)}
                </div>`;
        }
        elems.motorConnectionsContainer.innerHTML = html;

        // Re-bind listeners for the newly injected selects
        const selects = elems.motorConnectionsContainer.querySelectorAll('select');
        selects.forEach(sel => {
            sel.addEventListener('change', () => { window.forceGeometrySync(); });
        });
    }

    if (elems.motorDriverTypeSelect) {
        elems.motorDriverTypeSelect.addEventListener('change', () => {
            updateMotorConnectionsUI();
            window.forceGeometrySync();
        });
        updateMotorConnectionsUI(); // Initial call

        // Bind sensor selects to trigger sync (selects use 'change', not 'input')
        [elems.pinSensorFarLeftInput, elems.pinSensorLeftInput, elems.pinSensorCenterInput, elems.pinSensorRightInput, elems.pinSensorFarRightInput].forEach(sel => {
            if (sel) sel.addEventListener('change', () => { window.forceGeometrySync(); });
        });
    }

    function updateSensorConnectionsUI(count) {
        const rowFarLeft = document.getElementById('rowSensorFarLeft');
        const rowCenter = document.getElementById('rowSensorCenter');
        const rowFarRight = document.getElementById('rowSensorFarRight');
        if (rowFarLeft) rowFarLeft.style.display = (count >= 4) ? 'flex' : 'none';
        if (rowCenter) rowCenter.style.display = (count % 2 !== 0) ? 'flex' : 'none'; // 3 or 5
        if (rowFarRight) rowFarRight.style.display = (count >= 4) ? 'flex' : 'none';
    }

    // --- Sensor count dropdown logic ---
    if (elems.sensorCountSelect) {
        elems.sensorCountSelect.addEventListener('change', () => {
            const count = parseInt(elems.sensorCountSelect.value);
            currentGeometry.sensorCount = count;
            updateSensorConnectionsUI(count);
            previewRobot.updateGeometry(currentGeometry);
            syncDecorativeSensorsWithGeometry();
            renderRobotPreview();
        });
        updateSensorConnectionsUI(parseInt(elems.sensorCountSelect.value) || 3);
    }

    // Update preview dynamically as user types
    const inputs = [elems.robotWidthInput, elems.sensorOffsetInput, elems.sensorSpreadInput, elems.sensorDiameterInput, elems.robotMassInput, elems.comOffsetInput, elems.tireGripInput];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                currentGeometry = getFormValues();
                previewRobot.updateGeometry(currentGeometry);
                syncDecorativeSensorsWithGeometry();
                renderRobotPreview();
            });
        }
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

    // Custom Parts Dialog Logic
    if (elems.addCustomWheelsBtn) {
        elems.addCustomWheelsBtn.addEventListener('click', () => {
            elems.customPartTitle.textContent = 'Añadir Ruedas Custom';
            elems.customPartType.value = 'wheels';
            elems.customPartOffsetContainer.style.display = 'none'; // Solo X y Largo
            elems.customPartLengthInput.value = 65;
            elems.customPartWidthInput.value = 25;
            elems.customPartColorInput.value = '#000000';
            elems.customPartDialog.showModal();
        });

        elems.addCustomBodyBtn.addEventListener('click', () => {
            elems.customPartTitle.textContent = 'Añadir Cuerpo Custom';
            elems.customPartType.value = 'body';
            elems.customPartOffsetContainer.style.display = 'block';
            elems.customPartLengthInput.value = 120;
            elems.customPartWidthInput.value = 80;
            elems.customPartOffsetInput.value = 0;
            elems.customPartColorInput.value = '#3366cc';
            elems.customPartDialog.showModal();
        });

        elems.cancelCustomPartBtn.addEventListener('click', () => {
            elems.customPartDialog.close();
        });

        elems.customPartForm.addEventListener('submit', () => {
            const type = elems.customPartType.value;
            const length_mm = parseFloat(elems.customPartLengthInput.value);
            const width_mm = parseFloat(elems.customPartWidthInput.value);
            const offset_mm = parseFloat(elems.customPartOffsetInput.value) || 0;
            const color = elems.customPartColorInput.value;

            if (type === 'wheels') {
                currentGeometry.customWheels = { length_m: length_mm / 1000, width_m: width_mm / 1000, color };
                previewRobot.updateGeometry(currentGeometry);
                renderRobotPreview();
            } else if (type === 'body') {
                if (window.addParametricBodyPart) {
                    window.addParametricBodyPart(width_mm, length_mm, offset_mm, color);
                }
            }
        });
    }

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
            } catch (err) { }
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

    // Connections state extraction
    const driverType = elems.motorDriverTypeSelect ? elems.motorDriverTypeSelect.value : 'legacy';
    let motorPins = {};
    if (driverType === 'l298n') {
        motorPins = {
            leftEn: document.getElementById('pinMotorLeftEn')?.value || '3',
            leftIn1: document.getElementById('pinMotorLeftIn1')?.value || '11',
            leftIn2: document.getElementById('pinMotorLeftIn2')?.value || '9',
            rightIn3: document.getElementById('pinMotorRightIn3')?.value || '10',
            rightIn4: document.getElementById('pinMotorRightIn4')?.value || '6',
            rightEn: document.getElementById('pinMotorRightEn')?.value || '5'
        };
    } else if (driverType === 'mx1616') {
        motorPins = {
            leftIn1: document.getElementById('pinMotorLeftIn1')?.value || '11',
            leftIn2: document.getElementById('pinMotorLeftIn2')?.value || '9',
            rightIn3: document.getElementById('pinMotorRightIn3')?.value || '10',
            rightIn4: document.getElementById('pinMotorRightIn4')?.value || '6'
        };
    } else { // single / ESCs
        motorPins = {
            leftPWM: document.getElementById('pinMotorLeftPWM')?.value || '9',
            rightPWM: document.getElementById('pinMotorRightPWM')?.value || '10'
        };
    }

    const connections = {
        sensorPins: {
            farLeft: elems.pinSensorFarLeftInput?.value || 'A0',
            left: elems.pinSensorLeftInput?.value || 'A2',
            center: elems.pinSensorCenterInput?.value || 'A4',
            right: elems.pinSensorRightInput?.value || 'A3',
            farRight: elems.pinSensorFarRightInput?.value || 'A5',
        },
        driverType: driverType,
        motorPins: motorPins
    };

    // Leer valores en milímetros y convertir a metros (o valores por default)
    return {
        width_m: parseFloat(elems.robotWidthInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.width_m,
        sensorOffset_m: parseFloat(elems.sensorOffsetInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.sensorOffset_m,
        sensorSpread_m: parseFloat(elems.sensorSpreadInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.sensorSpread_m,
        sensorDiameter_m: parseFloat(elems.sensorDiameterInput.value) / 1000 || DEFAULT_ROBOT_GEOMETRY.sensorDiameter_m,
        sensorCount: parseInt(elems.sensorCountSelect?.value) || 3,
        robotMass_kg: elems.robotMassInput ? parseFloat(elems.robotMassInput.value) : DEFAULT_ROBOT_GEOMETRY.robotMass_kg,
        comOffset_m: elems.comOffsetInput ? (parseFloat(elems.comOffsetInput.value) / 1000) : DEFAULT_ROBOT_GEOMETRY.comOffset_m,
        tireGrip: elems.tireGripInput ? parseFloat(elems.tireGripInput.value) : DEFAULT_ROBOT_GEOMETRY.tireGrip,
        customWheels: currentGeometry ? currentGeometry.customWheels : null,
        connections: connections
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

    // Configurar campos físicos que quizás falten en robots JSON antiguos
    if (elems.robotMassInput) elems.robotMassInput.value = geometry.robotMass_kg ?? DEFAULT_ROBOT_GEOMETRY.robotMass_kg;
    if (elems.comOffsetInput) elems.comOffsetInput.value = ((geometry.comOffset_m ?? DEFAULT_ROBOT_GEOMETRY.comOffset_m) * 1000).toFixed(1);
    if (elems.tireGripInput) elems.tireGripInput.value = geometry.tireGrip ?? DEFAULT_ROBOT_GEOMETRY.tireGrip;

    if (geometry.customWheels !== undefined) {
        currentGeometry.customWheels = geometry.customWheels;
    } else {
        currentGeometry.customWheels = null;
    }

    // Set Connections
    if (geometry.connections) {
        const c = geometry.connections;
        if (elems.pinSensorFarLeftInput && c.sensorPins.farLeft) elems.pinSensorFarLeftInput.value = c.sensorPins.farLeft;
        if (elems.pinSensorLeftInput && c.sensorPins.left) elems.pinSensorLeftInput.value = c.sensorPins.left;
        if (elems.pinSensorCenterInput && c.sensorPins.center) elems.pinSensorCenterInput.value = c.sensorPins.center;
        if (elems.pinSensorRightInput && c.sensorPins.right) elems.pinSensorRightInput.value = c.sensorPins.right;
        if (elems.pinSensorFarRightInput && c.sensorPins.farRight) elems.pinSensorFarRightInput.value = c.sensorPins.farRight;

        if (elems.motorDriverTypeSelect && c.driverType) {
            elems.motorDriverTypeSelect.value = c.driverType;
            // Force UI update for motor connections container so the inputs exist
            if (typeof updateMotorConnectionsUI === 'function') updateMotorConnectionsUI();
            // The listener for change triggered it in getFormValues context but here we must manually set values
            // Workaround since updateMotorConnectionsUI might not be in scope if not careful, actually we can just re-dispatch the event
            const event = new Event('change');
            elems.motorDriverTypeSelect.dispatchEvent(event);

            // Now populate the inputs if they exist
            setTimeout(() => { // wait a tick for DOM update
                if (c.driverType === 'l298n') {
                    const lEn = document.getElementById('pinMotorLeftEn'); if (lEn) lEn.value = c.motorPins.leftEn || '3';
                    const lIn1 = document.getElementById('pinMotorLeftIn1'); if (lIn1) lIn1.value = c.motorPins.leftIn1 || '11';
                    const lIn2 = document.getElementById('pinMotorLeftIn2'); if (lIn2) lIn2.value = c.motorPins.leftIn2 || '9';
                    const rIn3 = document.getElementById('pinMotorRightIn3'); if (rIn3) rIn3.value = c.motorPins.rightIn3 || '10';
                    const rIn4 = document.getElementById('pinMotorRightIn4'); if (rIn4) rIn4.value = c.motorPins.rightIn4 || '6';
                    const rEn = document.getElementById('pinMotorRightEn'); if (rEn) rEn.value = c.motorPins.rightEn || '5';
                } else if (c.driverType === 'mx1616') {
                    const lIn1 = document.getElementById('pinMotorLeftIn1'); if (lIn1) lIn1.value = c.motorPins.leftIn1 || '11';
                    const lIn2 = document.getElementById('pinMotorLeftIn2'); if (lIn2) lIn2.value = c.motorPins.leftIn2 || '9';
                    const rIn3 = document.getElementById('pinMotorRightIn3'); if (rIn3) rIn3.value = c.motorPins.rightIn3 || '10';
                    const rIn4 = document.getElementById('pinMotorRightIn4'); if (rIn4) rIn4.value = c.motorPins.rightIn4 || '6';
                } else { // single / ESCs
                    const lPWM = document.getElementById('pinMotorLeftPWM'); if (lPWM) lPWM.value = c.motorPins.leftPWM || '9';
                    const rPWM = document.getElementById('pinMotorRightPWM'); if (rPWM) rPWM.value = c.motorPins.rightPWM || '10';
                }
                // Trigger geometry sync after setting values
                if (window.forceGeometrySync) { window.forceGeometrySync(); }
            }, 0);
        }
    }

    // Visually show/hide sensor rows
    if (typeof updateSensorConnectionsUI === 'function') {
        updateSensorConnectionsUI(geometry.sensorCount || 3);
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
    ctx.lineTo(startX + Math.cos(angle + Math.PI - Math.PI / 6) * arrowSize,
        startY + Math.sin(angle + Math.PI - Math.PI / 6) * arrowSize);
    ctx.lineTo(startX + Math.cos(angle + Math.PI + Math.PI / 6) * arrowSize,
        startY + Math.sin(angle + Math.PI + Math.PI / 6) * arrowSize);
    ctx.closePath();
    ctx.fill();

    // Flecha 2
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX + Math.cos(angle - Math.PI / 6) * arrowSize,
        endY + Math.sin(angle - Math.PI / 6) * arrowSize);
    ctx.lineTo(endX + Math.cos(angle + Math.PI / 6) * arrowSize,
        endY + Math.sin(angle + Math.PI / 6) * arrowSize);
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
    // Center the robot in the preview canvas and apply zoom
    previewCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
    previewCtx.scale(previewZoom, previewZoom);

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
    const wheelbaseStartX = -previewRobot.wheelbase_m / 2 * PIXELS_PER_METER;
    const wheelbaseEndX = previewRobot.wheelbase_m / 2 * PIXELS_PER_METER;
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
    drawRobotPreview(previewZoom);

    // Draw sensors on top
    previewCtx.save();
    previewCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
    previewCtx.scale(previewZoom, previewZoom);

    // Draw Center of Mass Symbol
    const comY_px = -previewRobot.comOffset_m * PIXELS_PER_METER;
    previewCtx.save();
    previewCtx.translate(0, comY_px);

    // CG circle with alternating quadrants
    const cgRadius = 6;
    previewCtx.beginPath();
    previewCtx.arc(0, 0, cgRadius, 0, Math.PI * 2);
    previewCtx.fillStyle = 'white';
    previewCtx.fill();
    previewCtx.lineWidth = 1;
    previewCtx.strokeStyle = 'black';
    previewCtx.stroke();

    // Q1 (Black)
    previewCtx.beginPath();
    previewCtx.moveTo(0, 0);
    previewCtx.arc(0, 0, cgRadius, 0, Math.PI / 2);
    previewCtx.lineTo(0, 0);
    previewCtx.fillStyle = 'black';
    previewCtx.fill();

    // Q3 (Black)
    previewCtx.beginPath();
    previewCtx.moveTo(0, 0);
    previewCtx.arc(0, 0, cgRadius, Math.PI, Math.PI * 1.5);
    previewCtx.lineTo(0, 0);
    previewCtx.fill();

    // Cross lines extending slightly outward
    previewCtx.beginPath();
    previewCtx.moveTo(-cgRadius - 3, 0);
    previewCtx.lineTo(cgRadius + 3, 0);
    previewCtx.moveTo(0, -cgRadius - 3);
    previewCtx.lineTo(0, cgRadius + 3);
    previewCtx.lineWidth = 1.5;
    previewCtx.stroke();

    previewCtx.restore();

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