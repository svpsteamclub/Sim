document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('simulationCanvas');
    const ctx = canvas.getContext('2d');
    const codeEditor = document.getElementById('codeEditor');
    const serialOutput = document.getElementById('serialOutput');

    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const resetButton = document.getElementById('resetButton');

    // Simulation state
    let simulationRunning = false;
    let animationFrameId;

    // Robot properties
    const robot = {
        x: 0, // Will be set in resetSimulation
        y: 0, // Will be set in resetSimulation
        width: 30,
        height: 40,
        angle: 0, // Will be set in resetSimulation
        color: 'blue',
        wheelBase: 28,
        speedL: 0,
        speedR: 0,
        maxSpeedSim: 2,

        sensors: [
            { x: -12, y: -18, value: 1, color: 'gray' }, // Left
            { x: 0,   y: -20, value: 1, color: 'gray' }, // Center
            { x: 12,  y: -18, value: 1, color: 'gray' }  // Right
        ],
        sensorRadius: 3
    };

    // Track properties
    const track = {
        lineColor: 'black',
        lineWidth: 10, // Made thinner
        // Rounded rectangle path
        path: (context) => {
            const margin = 40;
            const cornerRadius = 30;
            const rectX = margin;
            const rectY = margin;
            const rectWidth = context.canvas.width - 2 * margin;
            const rectHeight = context.canvas.height - 2 * margin;

            context.beginPath();
            context.strokeStyle = track.lineColor;
            context.lineWidth = track.lineWidth;

            // Start at top-left after corner
            context.moveTo(rectX + cornerRadius, rectY);
            // Top edge
            context.lineTo(rectX + rectWidth - cornerRadius, rectY);
            // Top-right corner
            context.arcTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + cornerRadius, cornerRadius);
            // Right edge
            context.lineTo(rectX + rectWidth, rectY + rectHeight - cornerRadius);
            // Bottom-right corner
            context.arcTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - cornerRadius, rectY + rectHeight, cornerRadius);
            // Bottom edge
            context.lineTo(rectX + cornerRadius, rectY + rectHeight);
            // Bottom-left corner
            context.arcTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - cornerRadius, cornerRadius);
            // Left edge
            context.lineTo(rectX, rectY + cornerRadius);
            // Top-left corner
            context.arcTo(rectX, rectY, rectX + cornerRadius, rectY, cornerRadius);
            
            context.stroke(); // Draw the path
        }
    };
    track.offscreenCanvas = null; // Initialize offscreen canvas

    // --- Arduino API Shim ---
    let _pinModes = {};

    const arduinoAPI = {
        // Core API functions
        pinMode: (pin, mode) => {
            _pinModes[pin] = mode;
        },
        digitalRead: (pin) => {
            // User defines constants like LEFT_SENSOR_PIN = 2;
            // The simulator maps these numbers to actual sensors.
            if (pin === 2) return robot.sensors[0].value; // Left
            if (pin === 3) return robot.sensors[1].value; // Center
            if (pin === 4) return robot.sensors[2].value; // Right
            return arduinoAPI.LOW; // Default
        },
        analogWrite: (pin, value) => {
            value = Math.max(0, Math.min(255, value));
            // User defines constants like MOTOR_LEFT_PWM = 5;
            if (pin === 5) robot.speedL = value;
            if (pin === 6) robot.speedR = value;
        },
        delay: async (ms) => {
            if (!simulationRunning) return;
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        Serial: {
            _buffer: "",
            begin: function(baud) {
                this.println(`Serial.begin(${baud})`);
            },
            print: function(msg) {
                this._buffer += String(msg);
                serialOutput.textContent += String(msg);
                serialOutput.scrollTop = serialOutput.scrollHeight;
            },
            println: function(msg = "") {
                this.print(String(msg) + '\n');
            }
        },
        // Standard Arduino constants
        HIGH: 1,
        LOW: 0,
        INPUT: 0, // Typically represented as strings "INPUT", "OUTPUT" but numbers are fine here
        OUTPUT: 1,
        // NOTE: Pin number constants like LEFT_SENSOR_PIN are NOT part of arduinoAPI.
        // The user's code is expected to define them (e.g., const LEFT_SENSOR_PIN = 2;).
        // This resolves the "already declared" error.
    };

    let userSetupFunction = () => {};
    let userLoopFunction = async () => {};

    function loadUserCode() {
        const code = codeEditor.value;
        serialOutput.textContent = "";
        arduinoAPI.Serial._buffer = "";

        try {
            const userScript = new Function(
                ...Object.keys(arduinoAPI),
                code + '; return { setup, loop };'
            );
            const { setup: loadedSetup, loop: loadedLoop } = userScript(...Object.values(arduinoAPI));

            if (typeof loadedSetup !== 'function') throw new Error("setup() function not found or not a function.");
            if (typeof loadedLoop !== 'function') throw new Error("loop() function not found or not a function.");

            userSetupFunction = loadedSetup;
            userLoopFunction = loadedLoop;
            console.log("User code loaded successfully.");
            serialOutput.textContent += "User code parsed successfully.\n";
            return true;
        } catch (e) {
            console.error("Error processing user code:", e);
            serialOutput.textContent = "Error in user code: " + e.message + "\n" + (e.stack || '');
            userSetupFunction = () => {};
            userLoopFunction = async () => {};
            return false;
        }
    }

    function resetSimulation() {
        stopSimulation();

        // Initial robot position for the rounded square track
        const margin = 40;
        robot.x = canvas.width / 2; // Start in the middle of the bottom edge
        robot.y = margin + (canvas.height - 2 * margin); // Bottom edge Y
        robot.angle = 0; // Pointing right

        robot.speedL = 0;
        robot.speedR = 0;
        robot.sensors.forEach(s => s.value = 1);
        _pinModes = {};
        serialOutput.textContent = "";
        arduinoAPI.Serial._buffer = "";

        // Prepare offscreen canvas for track detection
        if (!track.offscreenCanvas) {
            track.offscreenCanvas = document.createElement('canvas');
            track.offscreenCanvas.width = canvas.width;
            track.offscreenCanvas.height = canvas.height;
        }
        const offCtx = track.offscreenCanvas.getContext('2d');
        offCtx.fillStyle = 'white'; // Background
        offCtx.fillRect(0, 0, canvas.width, canvas.height);
        track.path(offCtx); // Draw the track onto the offscreen canvas

        if (loadUserCode()) {
            try {
                userSetupFunction(); // Call user's setup
                serialOutput.textContent += "setup() executed.\n";
            } catch (e) {
                console.error("Error in user setup():", e);
                serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                stopSimulation();
                return;
            }
        }
        draw(); // Draw initial state
    }

    function updateRobot(dt) {
        const vL = (robot.speedL / 255) * robot.maxSpeedSim;
        const vR = (robot.speedR / 255) * robot.maxSpeedSim;

        const V = (vL + vR) / 2;
        const omega = (vR - vL) / robot.wheelBase;

        // dt is in seconds, scale movement appropriately
        const effectiveDt = dt * 60; // Assuming target 60fps for scaling factor

        robot.x += V * Math.cos(robot.angle) * effectiveDt;
        robot.y += V * Math.sin(robot.angle) * effectiveDt;
        robot.angle += omega * effectiveDt;


        // Keep robot on canvas (very basic boundary, can be improved)
        if (robot.x < 0) robot.x = 0;
        if (robot.x > canvas.width) robot.x = canvas.width;
        if (robot.y < 0) robot.y = 0;
        if (robot.y > canvas.height) robot.y = canvas.height;

        const offCtx = track.offscreenCanvas.getContext('2d');
        robot.sensors.forEach(sensor => {
            const cosA = Math.cos(robot.angle);
            const sinA = Math.sin(robot.angle);
            const worldX = robot.x + (sensor.x * cosA - sensor.y * sinA);
            const worldY = robot.y + (sensor.x * sinA + sensor.y * cosA);

            if (worldX >= 0 && worldX < canvas.width && worldY >= 0 && worldY < canvas.height) {
                const pixelData = offCtx.getImageData(Math.round(worldX), Math.round(worldY), 1, 1).data;
                const isBlack = pixelData[0] < 128 && pixelData[1] < 128 && pixelData[2] < 128;
                sensor.value = isBlack ? arduinoAPI.LOW : arduinoAPI.HIGH;
                sensor.color = isBlack ? 'red' : 'lime';
            } else {
                sensor.value = arduinoAPI.HIGH;
                sensor.color = 'gray';
            }
        });
    }

    function draw() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        track.path(ctx); // Draw track on main canvas

        ctx.save();
        ctx.translate(robot.x, robot.y);
        ctx.rotate(robot.angle);

        ctx.fillStyle = robot.color;
        ctx.fillRect(-robot.width / 2, -robot.height / 2, robot.width, robot.height);

        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(0, -robot.height / 2 - 2); // Tip adjusted
        ctx.lineTo(-5, -robot.height / 2 + 5); // Base of arrow head
        ctx.lineTo(5, -robot.height / 2 + 5);  // Base of arrow head
        ctx.closePath();
        ctx.fill();

        robot.sensors.forEach(sensor => {
            ctx.fillStyle = sensor.color;
            ctx.beginPath();
            ctx.arc(sensor.x, sensor.y, robot.sensorRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        ctx.restore();
    }

    let lastTime = 0;
    async function simulationLoop(timestamp) {
        if (!simulationRunning) return;

        const deltaTime = (timestamp - (lastTime || timestamp)) / 1000; // Handle first frame
        lastTime = timestamp;

        if (userLoopFunction) {
            try {
                await userLoopFunction();
            } catch (e) {
                console.error("Error in user loop():", e);
                serialOutput.textContent += "Error in loop(): " + e.message + "\n";
                stopSimulation();
            }
        }

        updateRobot(deltaTime);
        draw();

        animationFrameId = requestAnimationFrame(simulationLoop);
    }

    function startSimulation() {
        if (simulationRunning) return;
        
        let codeLoadedAndSetupRun = false;
        if (startButton.dataset.freshStart !== "false") { // If it's a true start or after reset
            if (!loadUserCode()) {
                 serialOutput.textContent += "Failed to load code. Cannot start.\n";
                 return;
            }
            try {
                 userSetupFunction();
                 serialOutput.textContent += "setup() executed.\n";
                 codeLoadedAndSetupRun = true;
            } catch (e) {
                 console.error("Error in user setup():", e);
                 serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                 return; 
            }
        } else { // Resuming
            codeLoadedAndSetupRun = true; // Assume code is fine and setup was run
            serialOutput.textContent += "Resuming...\n";
        }
        
        if(!codeLoadedAndSetupRun && !startButton.dataset.freshStart) {
            // This case might happen if trying to resume a failed load, ensure proper handling
            if (!loadUserCode()) {
                 serialOutput.textContent += "Failed to load code. Cannot start.\n";
                 return;
            }
             try {
                 userSetupFunction();
                 serialOutput.textContent += "setup() executed.\n";
            } catch (e) {
                 console.error("Error in user setup():", e);
                 serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                 return; 
            }
        }


        simulationRunning = true;
        startButton.disabled = true;
        startButton.dataset.freshStart = "false"; // Mark that we are running/paused, not a fresh start
        stopButton.disabled = false;
        resetButton.disabled = true;
        codeEditor.disabled = true;
        lastTime = performance.now(); // Reset lastTime for deltaTime calculation
        animationFrameId = requestAnimationFrame(simulationLoop);
        serialOutput.textContent += "Simulation started/resumed.\n";
    }

    function stopSimulation() {
        simulationRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        startButton.disabled = false;
        // stopButton.disabled = true; // Keep enabled to show it's paused state
        resetButton.disabled = false;
        codeEditor.disabled = false; // Allow code editing when stopped
        // Don't clear serial unless resetting.
        if (userSetupFunction !== (() => {})) { // Only if code was loaded
             if(serialOutput.textContent.slice(-20).indexOf("stopped") === -1 && serialOutput.textContent.slice(-20).indexOf("resumed") === -1 ){
                serialOutput.textContent += "Simulation stopped.\n";
             }
        }
    }

    // Event Listeners
    startButton.addEventListener('click', startSimulation);
    stopButton.addEventListener('click', stopSimulation);
    resetButton.addEventListener('click', () => {
        startButton.dataset.freshStart = "true"; // Mark that next start is fresh
        resetSimulation();
        startButton.disabled = false;
        stopButton.disabled = true;
        resetButton.disabled = false;
        codeEditor.disabled = false;
        serialOutput.textContent += "Simulation reset.\n";
    });

    // Initial setup
    startButton.dataset.freshStart = "true";
    stopButton.disabled = true;
    resetSimulation();
    serialOutput.textContent += "Simulator ready. Press Start.\n";
});