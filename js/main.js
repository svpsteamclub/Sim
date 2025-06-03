// js/main.js
import { getDOMElements, setupTabs, updateTelemetry, updateLapTimerDisplay, updateCodeTypeDisplay } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, PIXELS_PER_METER } from './config.js';
import { Simulation } from './simulation.js';
import { initCodeEditor, loadUserCode, executeUserSetup, executeUserLoop, getMotorPWMOutputs, getSerialOutput, clearSerial, getCurrentCodeType } from './codeEditor.js';
import { initRobotEditor, getCurrentRobotGeometry } from './robotEditor.js';
import { initTrackEditor } from './trackEditor.js';
import { loadAndScaleImage, getAssetPath } from './utils.js';
import '../js/monaco-setup.js';

// Función para esperar a que Monaco esté listo
function waitForMonaco(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkMonaco = setInterval(() => {
            attempts++;
            if (window.monacoEditor) {
                clearInterval(checkMonaco);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkMonaco);
                reject(new Error("Monaco Editor no se pudo inicializar"));
            }
        }, 100);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const elems = getDOMElements();
    setupTabs();

    let simulationInstance = null;
    let simulationRunning = false;
    let animationFrameId;
    let lastFrameTime = 0;

    let robotBodyImage = null;
    let robotWheelImage = null;
    let watermarkTrackImage = null;

    let isPlacingStartLineSim = false;
    let lastPlacedStartLineSim = null;

    // --- Main App Interface for modules ---
    const mainAppInterface = {
        // Called by TrackEditor when "Use this Track" is clicked
        loadTrackFromEditor: (trackCanvas, startX_m, startY_m, startAngle_rad) => {
            if (simulationInstance) {
                // Marcar el canvas como proveniente del editor para evitar que se limpie el estado
                trackCanvas.dataset.fromEditor = 'true';
                simulationInstance.loadTrack(trackCanvas, startX_m, startY_m, startAngle_rad, 
                    (success, trackWidth, trackHeight) => {
                    if (success) {
                        elems.simulationDisplayCanvas.width = trackWidth;
                        elems.simulationDisplayCanvas.height = trackHeight;
                        drawCurrentSimulationState(); // Draw initial state of new track
                    } else {
                        alert("Error al cargar la pista del editor en la simulación.");
                    }
                });
            }
        },
        // Called by Simulation when a track is loaded
        loadTrackToEditor: (trackCanvas) => {
            if (window.trackEditorInstance) {
                window.trackEditorInstance.loadTrackFromSimulation(trackCanvas);
            }
        },
        // Called by RobotEditor when geometry is applied
        updateRobotGeometry: (newGeometry, decorativeParts = []) => {
            if (simulationInstance) {
                const currentSimParams = getSimulationParamsFromUI();
                currentSimParams.robotGeometry = newGeometry;
                simulationInstance.updateParameters(currentSimParams);
                // Resetting simulation is often needed if robot size changes drastically
                if (simulationInstance.track.imageData) {
                    const currentPose = {x: simulationInstance.robot.x_m, y: simulationInstance.robot.y_m, angle: simulationInstance.robot.angle_rad};
                    simulationInstance.resetSimulationState(currentPose.x, currentPose.y, currentPose.angle, newGeometry);
                }
                // Update decorative parts AFTER reset
                simulationInstance.robot.setDecorativeParts(decorativeParts);
                drawCurrentSimulationState();
            }
        },
        // Called by RobotEditor to load assets for preview
        loadRobotAssets: (callback) => {
            // This assumes assets are already being loaded or are loaded by main init
            // Let's ensure they are loaded here if not already.
            if (robotWheelImage) {
                if (callback) callback(robotWheelImage);
            } else {
                // Load only wheel image
                loadAndScaleImage(getAssetPath('robot_wheel.png'), null, null, (wheelImg) => {
                    robotWheelImage = wheelImg;
                    if (callback) callback(robotWheelImage);
                });
            }
        },
        // switchToTab: (tabId) => { /* ... implementation ... */ } 
    };

    // Store mainAppInterface globally for simulation to access
    window.mainAppInterface = mainAppInterface;

    // --- Initialization Functions ---
    async function initializeSimulator() {
        try {
            // Esperar a que Monaco esté listo
            await waitForMonaco();
            
            // Load robot assets
            await new Promise(resolve => {
                mainAppInterface.loadRobotAssets((b, w) => { resolve(); });
            });
            // Load watermark
            await new Promise(resolve => {
                loadAndScaleImage(getAssetPath('watermark.png'), null, null, (img) => {
                    watermarkTrackImage = img;
                    resolve();
                });
            });
            
            const initialSimParams = getSimulationParamsFromUI();
            initialSimParams.robotGeometry = getCurrentRobotGeometry(); // Get from robot editor
            
            simulationInstance = new Simulation(
                { wheel: robotWheelImage }, 
                watermarkTrackImage,
                initialSimParams.robotGeometry
            );
            simulationInstance.updateParameters(initialSimParams);

            // Initialize other modules that depend on simulation state
            const codeLoaded = initCodeEditor(simulationInstance); // Pass full sim instance for API access
            if (!codeLoaded) {
                throw new Error("Error al cargar el código inicial del robot.");
            }
            updateCodeTypeDisplay(getCurrentCodeType()); // Update code type display

            initRobotEditor(mainAppInterface);
            initTrackEditor(mainAppInterface); // Track editor might generate a default track

            // Esperar a que el editor cargue la pista por defecto y exportarla al simulador
            setTimeout(() => {
                const elems = getDOMElements();
                // Exportar la pista del editor al simulador
                if (window.trackEditorInstance && typeof exportTrackAsCanvas === 'function') {
                    const exportedCanvas = exportTrackAsCanvas();
                    if (exportedCanvas) {
                        mainAppInterface.loadTrackFromEditor(exportedCanvas, 0, 0, 0);
                    }
                }
            }, 500); // Espera breve para asegurar que la pista esté cargada

            // Load a default track or wait for user
            // For now, let's assume track editor handles its default view.
            // Simulation will start with no track until one is exported from editor.
            elems.simulationDisplayCanvas.width = 700; // Default size
            elems.simulationDisplayCanvas.height = 500;
            drawCurrentSimulationState();
            updateLapTimerDisplay(simulationInstance.lapTimer.getDisplayData()); // Initial lap display

        } catch (err) {
            alert("Error crítico durante la inicialización. Revisa la consola.");
        }
    }

    // --- Simulation Loop ---
    async function simulationLoop(timestamp) {
        if (!simulationRunning) return;

        const deltaTime = (timestamp - lastFrameTime) / 1000.0; // Seconds
        lastFrameTime = timestamp;

        // Execute user's Arduino-like code (loop function)
        try {
            await executeUserLoop(); // This will call analogWrite, updating robot.motorPWMSpeeds in simulationInstance
        } catch (e) {
            stopSimulation();
            alert("Error en tu función loop(). La simulación se ha detenido. Revisa la consola y el Monitor Serial.");
            return;
        }
        
        // Get PWMs that user code set (via analogWrite which updated robot.motorPWMSpeeds)
        const userPWMs = simulationInstance.robot.motorPWMSpeeds; // {left, right}
                                                                // Alternative: const userPWMs = getMotorPWMOutputs();

        // Step the simulation physics and logic with these PWMs
        const simData = simulationInstance.simulationStep(userPWMs.left, userPWMs.right);

        // Update UI
        drawCurrentSimulationState();
        updateTelemetry({ // Pass relevant data for display
            error: simData.pidTerms?.error, // If PID is internal to sim (not here)
            pidTerms: simData.pidTerms,    // If PID is internal to sim (not here)
            motorPWMs: {leftPWM: userPWMs.left, rightPWM: userPWMs.right, leftDirForward: true, rightDirForward:true}, // Assuming forward
            sensorStates: simData.sensorStates,
            simTime: simData.simTime_s,
            outOfBounds: simData.outOfBounds
        });
        updateLapTimerDisplay(simData.lapData);
        elems.serialMonitorOutput.textContent = getSerialOutput(); // Update serial from codeEditor module
        if (elems.serialMonitorOutput.textContent.length > 0) { // Auto-scroll serial
             elems.serialMonitorOutput.scrollTop = elems.serialMonitorOutput.scrollHeight;
        }


        if (simData.outOfBounds) {
            stopSimulation();
            // alert("¡El robot se salió de la pista!");
        }
        
        if (simulationRunning) { // Check again, as errors might stop it
            animationFrameId = requestAnimationFrame(simulationLoop);
        }
    }

    // --- Simulation Control Functions ---
    async function startSimulation() {
        if (simulationRunning) return;
        if (!simulationInstance || !simulationInstance.track.imageData) {
            alert("No hay una pista cargada en la simulación. Carga una desde el Editor de Pista.");
            return;
        }

        // Ensure latest code from editor is loaded
        if (!loadUserCode(window.monacoEditor.getValue())) {
             alert("Error en el código del robot. No se puede iniciar la simulación. Revisa el Monitor Serial.");
             return;
        }
        updateCodeTypeDisplay(getCurrentCodeType()); // Update code type display
        
        // Ensure latest simulation parameters are applied
        applySimulationParameters(); 

        try {
            await executeUserSetup(); // Run user's setup() function
        } catch (e) {
            alert("Error durante la ejecución de setup(). La simulación no comenzará. Revisa la consola y el Monitor Serial.");
            return;
        }

        simulationRunning = true;
        elems.startSimButton.disabled = true;
        elems.stopSimButton.disabled = false;
        elems.resetSimButton.disabled = true; // Disable reset while running
        if (window.monacoEditor) {
            window.monacoEditor.updateOptions({ readOnly: true });
        }
        elems.applySimParamsButton.disabled = true;
        // Robot editor and track editor controls could also be disabled

        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(simulationLoop);
    }

    function stopSimulation() {
        if (!simulationRunning) return;
        simulationRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        elems.startSimButton.disabled = false;
        elems.stopSimButton.disabled = true;
        elems.resetSimButton.disabled = false;
        if (window.monacoEditor) {
            window.monacoEditor.updateOptions({ readOnly: false });
        }
        elems.applySimParamsButton.disabled = false;
    }

    function resetSimulation() {
        stopSimulation(); // Ensure it's stopped
        if (simulationInstance) {
            const currentGeo = simulationInstance.getCurrentRobotGeometry(); // Preserve current geometry
            
            // Get the original start position from the lap timer's start line
            let startX = 0.1, startY = 0.1, startAngle = 0;
            if (simulationInstance.track.imageData && simulationInstance.lapTimer.startLine) {
                // Calculate the center point of the start line
                startX = (simulationInstance.lapTimer.startLine.x1 + simulationInstance.lapTimer.startLine.x2) / 2;
                startY = (simulationInstance.lapTimer.startLine.y1 + simulationInstance.lapTimer.startLine.y2) / 2;
                
                // Calculate angle perpendicular to the start line
                const dx = simulationInstance.lapTimer.startLine.x2 - simulationInstance.lapTimer.startLine.x1;
                const dy = simulationInstance.lapTimer.startLine.y2 - simulationInstance.lapTimer.startLine.y1;
                startAngle = Math.atan2(dy, dx) + Math.PI/2; // Perpendicular to line
            }

            simulationInstance.resetSimulationState(startX, startY, startAngle, currentGeo);
            
            // Reload user code and re-run setup for a clean state
            if (loadUserCode(window.monacoEditor.getValue())) {
                executeUserSetup().catch(e => alert("Error en setup() durante el reinicio."));
            } else {
                alert("Error recargando código durante reinicio.");
            }
            clearSerial(); // Clear serial monitor on reset

            drawCurrentSimulationState();
            updateLapTimerDisplay(simulationInstance.lapTimer.getDisplayData());
            updateTelemetry({}); // Clear telemetry
        }
    }

    function drawCurrentSimulationState() {
        if (simulationInstance && elems.simulationDisplayCanvas) {
            const ctx = elems.simulationDisplayCanvas.getContext('2d');
            simulationInstance.draw(ctx, elems.simulationDisplayCanvas.width, elems.simulationDisplayCanvas.height);
        }
    }
    
    function getSimulationParamsFromUI() {
        return {
            timeStep: parseFloat(elems.timeStepInput.value),
            maxRobotSpeedMPS: parseFloat(elems.maxRobotSpeedInput.value),
            motorEfficiency: parseFloat(elems.motorEfficiencyInput.value),
            motorResponseFactor: parseFloat(elems.motorResponseInput.value),
            sensorNoiseProb: parseFloat(elems.sensorNoiseInput.value),
            movementPerturbFactor: parseFloat(elems.movementPerturbInput.value),
            motorDeadbandPWM: parseInt(elems.motorDeadbandInput.value),
            lineThreshold: parseInt(elems.lineThresholdInput.value),
            // robotGeometry is handled by robotEditor
        };
    }

    function applySimulationParameters() {
        if (simulationInstance) {
            const params = getSimulationParamsFromUI();
            simulationInstance.updateParameters(params);
        }
    }

    // --- Event Listeners for UI ---
    elems.startSimButton.addEventListener('click', startSimulation);
    elems.stopSimButton.addEventListener('click', stopSimulation);
    elems.resetSimButton.addEventListener('click', resetSimulation);
    elems.applySimParamsButton.addEventListener('click', applySimulationParameters);

    // Botón para ubicar línea de comienzo en simulación
    const placeStartLineSimButton = document.getElementById('placeStartLineSimButton');
    let startLineStartPoint = null;

    placeStartLineSimButton.addEventListener('click', () => {
        isPlacingStartLineSim = !isPlacingStartLineSim;
        placeStartLineSimButton.textContent = isPlacingStartLineSim ? 'Cancelar Ubicación' : 'Ubicar Línea de Comienzo';
        placeStartLineSimButton.style.backgroundColor = isPlacingStartLineSim ? '#d9534f' : '';
        
        if (isPlacingStartLineSim) {
            elems.simulationDisplayCanvas.style.cursor = 'crosshair';
        } else {
            elems.simulationDisplayCanvas.style.cursor = 'default';
            startLineStartPoint = null;
        }
    });

    // --- Mouse Events ---
    elems.simulationDisplayCanvas.addEventListener('mousedown', (event) => {
        if (!isPlacingStartLineSim || !simulationInstance || !simulationInstance.track.imageData) return;

        const rect = elems.simulationDisplayCanvas.getBoundingClientRect();
        const scale = elems.simulationDisplayCanvas.width / rect.width;
        const x = (event.clientX - rect.left) * scale;
        const y = (event.clientY - rect.top) * scale;

        startLineStartPoint = { x, y };
    });

    elems.simulationDisplayCanvas.addEventListener('mousemove', (event) => {
        if (!isPlacingStartLineSim || !startLineStartPoint || !simulationInstance || !simulationInstance.track.imageData) return;

        const rect = elems.simulationDisplayCanvas.getBoundingClientRect();
        const scale = elems.simulationDisplayCanvas.width / rect.width;
        const x = (event.clientX - rect.left) * scale;
        const y = (event.clientY - rect.top) * scale;

        // Draw current track state
        const ctx = elems.simulationDisplayCanvas.getContext('2d');
        simulationInstance.draw(ctx, elems.simulationDisplayCanvas.width, elems.simulationDisplayCanvas.height);

        // Draw preview line
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "#FF00FF";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(startLineStartPoint.x, startLineStartPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
    });

    elems.simulationDisplayCanvas.addEventListener('mouseup', (event) => {
        if (!isPlacingStartLineSim || !startLineStartPoint || !simulationInstance || !simulationInstance.track.imageData) return;

        const rect = elems.simulationDisplayCanvas.getBoundingClientRect();
        const scale = elems.simulationDisplayCanvas.width / rect.width;
        const x = (event.clientX - rect.left) * scale;
        const y = (event.clientY - rect.top) * scale;

        // Convert to meters for simulation
        const x1_m = startLineStartPoint.x / PIXELS_PER_METER;
        const y1_m = startLineStartPoint.y / PIXELS_PER_METER;
        const x2_m = x / PIXELS_PER_METER;
        const y2_m = y / PIXELS_PER_METER;

        // Calculate angle for robot orientation (perpendicular to line)
        const dx = x2_m - x1_m;
        const dy = y2_m - y1_m;
        const angle_rad = Math.atan2(dy, dx) + Math.PI/2; // Perpendicular to line

        // Calculate center point of line for robot position
        const center_x_m = (x1_m + x2_m) / 2;
        const center_y_m = (y1_m + y2_m) / 2;

        // Reset simulation with new start position
        simulationInstance.resetSimulationState(center_x_m, center_y_m, angle_rad);
        
        // Initialize lap timer with new start line
        simulationInstance.lapTimer.initialize(
            { x_m: center_x_m, y_m: center_y_m, angle_rad: angle_rad },
            simulationInstance.totalSimTime_s,
            { x1: x1_m, y1: y1_m, x2: x2_m, y2: y2_m }
        );

        // Exit placement mode
        isPlacingStartLineSim = false;
        placeStartLineSimButton.textContent = 'Ubicar Línea de Comienzo';
        placeStartLineSimButton.style.backgroundColor = '';
        elems.simulationDisplayCanvas.style.cursor = 'default';
        startLineStartPoint = null;

        // Redraw final state
        drawCurrentSimulationState();
    });

    // --- Touch Events for Mobile ---
    elems.simulationDisplayCanvas.addEventListener('touchstart', (event) => {
        if (!isPlacingStartLineSim || !simulationInstance || !simulationInstance.track.imageData) return;
        if (event.touches.length !== 1) return;

        const rect = elems.simulationDisplayCanvas.getBoundingClientRect();
        const scale = elems.simulationDisplayCanvas.width / rect.width;
        const touch = event.touches[0];
        const x = (touch.clientX - rect.left) * scale;
        const y = (touch.clientY - rect.top) * scale;

        startLineStartPoint = { x, y };
        event.preventDefault();
    }, { passive: false });

    elems.simulationDisplayCanvas.addEventListener('touchmove', (event) => {
        if (!isPlacingStartLineSim || !startLineStartPoint || !simulationInstance || !simulationInstance.track.imageData) return;
        if (event.touches.length !== 1) return;

        const rect = elems.simulationDisplayCanvas.getBoundingClientRect();
        const scale = elems.simulationDisplayCanvas.width / rect.width;
        const touch = event.touches[0];
        const x = (touch.clientX - rect.left) * scale;
        const y = (touch.clientY - rect.top) * scale;

        // Draw current track state
        const ctx = elems.simulationDisplayCanvas.getContext('2d');
        simulationInstance.draw(ctx, elems.simulationDisplayCanvas.width, elems.simulationDisplayCanvas.height);

        // Draw preview line
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "#FF00FF";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(startLineStartPoint.x, startLineStartPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
        event.preventDefault();
    }, { passive: false });

    elems.simulationDisplayCanvas.addEventListener('touchend', (event) => {
        if (!isPlacingStartLineSim || !startLineStartPoint || !simulationInstance || !simulationInstance.track.imageData) return;

        // Use changedTouches if available, otherwise use last known position
        let x, y;
        const rect = elems.simulationDisplayCanvas.getBoundingClientRect();
        const scale = elems.simulationDisplayCanvas.width / rect.width;
        if (event.changedTouches && event.changedTouches.length > 0) {
            const touch = event.changedTouches[0];
            x = (touch.clientX - rect.left) * scale;
            y = (touch.clientY - rect.top) * scale;
        } else {
            x = startLineStartPoint.x;
            y = startLineStartPoint.y;
        }

        // Convert to meters for simulation
        const x1_m = startLineStartPoint.x / PIXELS_PER_METER;
        const y1_m = startLineStartPoint.y / PIXELS_PER_METER;
        const x2_m = x / PIXELS_PER_METER;
        const y2_m = y / PIXELS_PER_METER;

        // Calculate angle for robot orientation (perpendicular to line)
        const dx = x2_m - x1_m;
        const dy = y2_m - y1_m;
        const angle_rad = Math.atan2(dy, dx) + Math.PI/2; // Perpendicular to line

        // Calculate center point of line for robot position
        const center_x_m = (x1_m + x2_m) / 2;
        const center_y_m = (y1_m + y2_m) / 2;

        // Reset simulation with new start position
        simulationInstance.resetSimulationState(center_x_m, center_y_m, angle_rad);
        
        // Initialize lap timer with new start line
        simulationInstance.lapTimer.initialize(
            { x_m: center_x_m, y_m: center_y_m, angle_rad: angle_rad },
            simulationInstance.totalSimTime_s,
            { x1: x1_m, y1: y1_m, x2: x2_m, y2: y2_m }
        );

        // Exit placement mode
        isPlacingStartLineSim = false;
        placeStartLineSimButton.textContent = 'Ubicar Línea de Comienzo';
        placeStartLineSimButton.style.backgroundColor = '';
        elems.simulationDisplayCanvas.style.cursor = 'default';
        startLineStartPoint = null;

        // Redraw final state
        drawCurrentSimulationState();
        event.preventDefault();
    }, { passive: false });
    
    // --- Start Everything ---
    initializeSimulator().then(() => {
    }).catch(err => {
        alert("Error crítico durante la inicialización. Revisa la consola.");
    });
});