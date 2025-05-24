// js/main.js
import { getDOMElements, setupTabs, updateTelemetry, updateLapTimerDisplay } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, PIXELS_PER_METER } from './config.js';
import { Simulation } from './simulation.js';
import { initCodeEditor, loadUserCode, executeUserSetup, executeUserLoop, getMotorPWMOutputs, getSerialOutput, clearSerial } from './codeEditor.js';
import { initRobotEditor, getCurrentRobotGeometry } from './robotEditor.js';
import { initTrackEditor } from './trackEditor.js';
import { loadAndScaleImage, getAssetPath } from './utils.js';


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

    // --- Main App Interface for modules ---
    const mainAppInterface = {
        // Called by TrackEditor when "Use this Track" is clicked
        loadTrackFromEditor: (trackCanvas, startX_m, startY_m, startAngle_rad) => {
            if (simulationInstance) {
                simulationInstance.loadTrack(trackCanvas, startX_m, startY_m, startAngle_rad, 
                    (success, trackWidth, trackHeight) => {
                    if (success) {
                        elems.simulationDisplayCanvas.width = trackWidth;
                        elems.simulationDisplayCanvas.height = trackHeight;
                        // Simulation state is reset within loadTrack
                        drawCurrentSimulationState(); // Draw initial state of new track
                    } else {
                        alert("Error al cargar la pista del editor en la simulación.");
                    }
                });
            }
        },
        // Called by RobotEditor when geometry is applied
        updateRobotGeometry: (newGeometry) => {
            if (simulationInstance) {
                const currentSimParams = getSimulationParamsFromUI();
                currentSimParams.robotGeometry = newGeometry;
                simulationInstance.updateParameters(currentSimParams);
                // Resetting simulation is often needed if robot size changes drastically
                // For now, just update. User should click Reset Sim if major changes.
                // Or, force reset:
                if (simulationInstance.track.imageData) { // Only if a track is loaded
                    const currentPose = {x: simulationInstance.robot.x_m, y: simulationInstance.robot.y_m, angle: simulationInstance.robot.angle_rad};
                    simulationInstance.resetSimulationState(currentPose.x, currentPose.y, currentPose.angle, newGeometry);
                }
                 drawCurrentSimulationState();
            }
        },
        // Called by RobotEditor to load assets for preview
        loadRobotAssets: (callback) => {
            // This assumes assets are already being loaded or are loaded by main init
            // Let's ensure they are loaded here if not already.
            if (robotBodyImage && robotWheelImage) {
                if (callback) callback(robotBodyImage, robotWheelImage);
            } else {
                // This is a simplified load, ideally use a Promise.all for multiple assets
                loadAndScaleImage(getAssetPath('robot_body.png'), null, null, (bodyImg) => {
                    robotBodyImage = bodyImg;
                    loadAndScaleImage(getAssetPath('robot_wheel.png'), null, null, (wheelImg) => {
                        robotWheelImage = wheelImg;
                        if (callback) callback(robotBodyImage, robotWheelImage);
                    });
                });
            }
        },
        // switchToTab: (tabId) => { /* ... implementation ... */ } 
    };

    // --- Initialization Functions ---
    async function initializeSimulator() {
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
            { body: robotBodyImage, wheel: robotWheelImage }, 
            watermarkTrackImage,
            initialSimParams.robotGeometry
        );
        simulationInstance.updateParameters(initialSimParams);

        // Initialize other modules that depend on simulation state
        const codeLoaded = initCodeEditor(simulationInstance); // Pass full sim instance for API access
        if (!codeLoaded) {
            alert("Error al cargar el código inicial del robot. Revisa la consola.");
        }

        initRobotEditor(mainAppInterface);
        initTrackEditor(mainAppInterface); // Track editor might generate a default track

        // Load a default track or wait for user
        // For now, let's assume track editor handles its default view.
        // Simulation will start with no track until one is exported from editor.
        elems.simulationDisplayCanvas.width = 700; // Default size
        elems.simulationDisplayCanvas.height = 500;
        drawCurrentSimulationState(); // Draw empty state initially
        updateLapTimerDisplay(simulationInstance.lapTimer.getDisplayData()); // Initial lap display
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
            console.error("Error en el loop del usuario, deteniendo simulación:", e);
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
            console.warn("Robot fuera de pista. Deteniendo simulación.");
            // stopSimulation(); // Optionally stop
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
        if (!loadUserCode(elems.codeEditorArea.value)) {
             alert("Error en el código del robot. No se puede iniciar la simulación. Revisa el Monitor Serial.");
             return;
        }
        
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
        elems.codeEditorArea.disabled = true; // Disable code editing while running
        elems.applySimParamsButton.disabled = true;
        // Robot editor and track editor controls could also be disabled

        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(simulationLoop);
        console.log("Simulación iniciada.");
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
        elems.codeEditorArea.disabled = false;
        elems.applySimParamsButton.disabled = false;
        console.log("Simulación detenida.");
    }

    function resetSimulation() {
        stopSimulation(); // Ensure it's stopped
        if (simulationInstance) {
            const currentGeo = simulationInstance.getCurrentRobotGeometry(); // Preserve current geometry
            // Reset to the track's defined start pose, or a default if none
            const startPose = simulationInstance.lapTimer.isActive ? 
                { x: simulationInstance.lapTimer.startLine.x1 / PIXELS_PER_METER, // approx start X
                  y: simulationInstance.lapTimer.startLine.y1 / PIXELS_PER_METER, // approx start Y
                  // angle needs to be derived from start line orientation or stored
                  angle_rad: simulationInstance.robot.angle_rad // placeholder, ideally store initial angle
                } : { x: 0.1, y: 0.1, angle_rad: 0}; // Fallback default start

            // If track is loaded, use its start. Otherwise, a generic start for an empty canvas.
            let startX = 0.1, startY = 0.1, startAngle = 0;
            if (simulationInstance.track.imageData) { // Track is loaded
                // Try to get start position from lapTimer if initialized
                if(simulationInstance.lapTimer.startLine && simulationInstance.lapTimer.startLine.x1 !== undefined){
                    // A more robust way to get the original start pose used for lapTimer.initialize is needed.
                    // For now, let's assume the robot is reset to its current position if a track is loaded,
                    // or to a default if no track is loaded.
                    // Or better: reset to the *original* start position of the current track.
                    // This requires storing that original start pose when a track is loaded.
                    // For now, let's just reset the robot state at its current position if track loaded.
                     startX = simulationInstance.robot.x_m;
                     startY = simulationInstance.robot.y_m;
                     startAngle = simulationInstance.robot.angle_rad;
                }
            }

            simulationInstance.resetSimulationState(startX, startY, startAngle, currentGeo);
            
            // Reload user code and re-run setup for a clean state
            if (loadUserCode(elems.codeEditorArea.value)) {
                executeUserSetup().catch(e => alert("Error en setup() durante el reinicio."));
            } else {
                alert("Error recargando código durante reinicio.");
            }
            clearSerial(); // Clear serial monitor on reset

            drawCurrentSimulationState();
            updateLapTimerDisplay(simulationInstance.lapTimer.getDisplayData());
            updateTelemetry({}); // Clear telemetry
        }
        console.log("Simulación reiniciada.");
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
            console.log("Parámetros de simulación aplicados:", params);
        }
    }

    // --- Event Listeners for UI ---
    elems.startSimButton.addEventListener('click', startSimulation);
    elems.stopSimButton.addEventListener('click', stopSimulation);
    elems.resetSimButton.addEventListener('click', resetSimulation);
    elems.applySimParamsButton.addEventListener('click', applySimulationParameters);
    
    // --- Start Everything ---
    initializeSimulator().then(() => {
        console.log("Simulador inicializado y listo.");
    }).catch(err => {
        console.error("Fallo en la inicialización del simulador:", err);
        alert("Error crítico durante la inicialización. Revisa la consola.");
    });
});