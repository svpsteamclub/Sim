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
        angle: 0, // Will be set in resetSimulation to point LEFT
        color: 'blue',
        wheelBase: 28,
        speedL: 0,
        speedR: 0,
        maxSpeedSim: 2, // Max pixels per frame factor at 255 input

        sensors: [ // Relative to robot center, {x, y} (y is "forward")
            { x: -12, y: -18, value: 1, color: 'gray' }, // Left
            { x: 0,   y: -20, value: 1, color: 'gray' }, // Center
            { x: 12,  y: -18, value: 1, color: 'gray' }  // Right
        ],
        sensorRadius: 3
    };

    // Track properties
    const track = {
        lineColor: 'black',
        lineWidth: 10, // Track line thickness
        // Rounded rectangle path
        path: (context) => {
            const margin = 40; // Margin from canvas edge to the track
            const cornerRadius = 30;
            const rectX = margin;
            const rectY = margin;
            const rectWidth = context.canvas.width - 2 * margin;
            const rectHeight = context.canvas.height - 2 * margin;

            context.beginPath();
            context.strokeStyle = track.lineColor;
            context.lineWidth = track.lineWidth;

            // Start at top-left after corner (for drawing, actual robot start is different)
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
    track.offscreenCanvas = null; // Initialize offscreen canvas for pixel detection

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
            return arduinoAPI.LOW; // Default if pin not mapped
        },
        analogWrite: (pin, value) => {
            value = Math.max(0, Math.min(255, value)); // Clamp value
            // User defines constants like MOTOR_LEFT_PWM = 5;
            if (pin === 5) robot.speedL = value;
            if (pin === 6) robot.speedR = value;
        },
        delay: async (ms) => {
            if (!simulationRunning) return; // Don't delay if simulation stopped
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
                serialOutput.scrollTop = serialOutput.scrollHeight; // Auto-scroll
            },
            println: function(msg = "") {
                this.print(String(msg) + '\n');
            }
        },
        // Standard Arduino constants
        HIGH: 1,
        LOW: 0,
        INPUT: "INPUT", // Using strings for pinMode clarity, could be numbers
        OUTPUT: "OUTPUT",
    };

    let userSetupFunction = () => {};
    let userLoopFunction = async () => {}; // loop must be async for await delay()

    function loadUserCode() {
        const code = codeEditor.value;
        serialOutput.textContent = ""; // Clear serial output on new load
        arduinoAPI.Serial._buffer = "";

        try {
            // Create a function with access to the Arduino API shims
            // The user code defines 'setup' and 'loop' globally in its own scope
            const userScript = new Function(
                ...Object.keys(arduinoAPI), // Make API functions available as arguments
                code + '; return { setup, loop };' // User code + return statement to get setup/loop
            );
            // Call the function, passing the API objects/functions as arguments
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
            userSetupFunction = () => {}; // Reset to prevent running broken code
            userLoopFunction = async () => {};
            return false;
        }
    }

    function resetSimulation() {
        stopSimulation();

        // Initial robot position for the rounded square track
        const margin = 40; // Margin from canvas edge to track
        const trackBottomSegmentY = margin + (canvas.height - 2 * margin); // Y-coordinate of the bottom track segment's centerline

        robot.x = canvas.width / 2; // Start horizontally centered
        
        // Adjust robot's center Y so sensors are on the line when robot points left
        // robot.sensors[1] is the center sensor. Its y is typically -20 (local coord "forward").
        // When robot.angle = Math.PI (pointing left), local -Y (forward) points DOWN in world coords.
        // The offset from robot center to sensor in world Y is -robot.sensors[1].y (e.g., -(-20) = 20).
        // So, we want robot_center_y + (-robot.sensors[1].y) = trackBottomSegmentY
        // robot_center_y = trackBottomSegmentY + robot.sensors[1].y
        // Since robot.sensors[1].y is negative, this moves the robot center UP from the track line.
        robot.y = trackBottomSegmentY + robot.sensors[1].y; 

        robot.angle = Math.PI; // Pointing LEFT

        robot.speedL = 0;
        robot.speedR = 0;
        robot.sensors.forEach(s => s.value = 1); // Reset sensor values (1 = off line)
        _pinModes = {};
        serialOutput.textContent = ""; // Clear serial on reset
        arduinoAPI.Serial._buffer = "";

        // Prepare offscreen canvas for track detection (done once or on resize)
        if (!track.offscreenCanvas || track.offscreenCanvas.width !== canvas.width || track.offscreenCanvas.height !== canvas.height) {
            track.offscreenCanvas = document.createElement('canvas');
            track.offscreenCanvas.width = canvas.width;
            track.offscreenCanvas.height = canvas.height;
            const offCtx = track.offscreenCanvas.getContext('2d');
            offCtx.fillStyle = 'white'; // Background
            offCtx.fillRect(0, 0, canvas.width, canvas.height);
            track.path(offCtx); // Draw the track onto the offscreen canvas
        }
        
        if (loadUserCode()) { // Load code and then run setup
            try {
                userSetupFunction(); // Call user's setup
                serialOutput.textContent += "setup() executed.\n";
            } catch (e) {
                console.error("Error in user setup():", e);
                serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                stopSimulation(); // Stop if setup fails
                return;
            }
        }
        draw(); // Draw initial state after reset and setup
    }

    function updateRobot(dt) { // dt is delta time in seconds
        // Convert 0-255 speed from analogWrite to simulation movement units
        const vL = (robot.speedL / 255) * robot.maxSpeedSim;
        const vR = (robot.speedR / 255) * robot.maxSpeedSim;

        const V = (vL + vR) / 2; // Average linear speed
        const omega = (vR - vL) / robot.wheelBase; // Angular speed

        // Scale dt to make movement speed reasonable. Adjust factor as needed.
        const effectiveDtScaling = 60; // Arbitrary factor for speed control

        robot.x += V * Math.cos(robot.angle) * dt * effectiveDtScaling;
        robot.y += V * Math.sin(robot.angle) * dt * effectiveDtScaling;
        robot.angle += omega * dt * effectiveDtScaling;

        // Update sensors based on new position
        const offCtx = track.offscreenCanvas.getContext('2d');
        robot.sensors.forEach(sensor => {
            // Calculate world position of sensor
            const cosA = Math.cos(robot.angle);
            const sinA = Math.sin(robot.angle);
            // Sensor position relative to robot center, rotated by robot's angle
            const worldX = robot.x + (sensor.x * cosA - sensor.y * sinA);
            const worldY = robot.y + (sensor.x * sinA + sensor.y * cosA);

            // Check pixel color under sensor
            if (worldX >= 0 && worldX < canvas.width && worldY >= 0 && worldY < canvas.height) {
                const pixelData = offCtx.getImageData(Math.round(worldX), Math.round(worldY), 1, 1).data;
                // Assuming black line (R,G,B < 128) on white background
                const isBlack = pixelData[0] < 128 && pixelData[1] < 128 && pixelData[2] < 128;
                sensor.value = isBlack ? arduinoAPI.LOW : arduinoAPI.HIGH; // LOW (0) on line, HIGH (1) off line
                sensor.color = isBlack ? 'red' : 'lime';
            } else {
                sensor.value = arduinoAPI.HIGH; // Off canvas, so off line
                sensor.color = 'gray'; // Default color if off-canvas
            }
        });
    }

    function draw() {
        // Clear main canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw track on main canvas
        track.path(ctx);

        // Draw robot
        ctx.save(); // Save current transformation state
        ctx.translate(robot.x, robot.y); // Move origin to robot's position
        ctx.rotate(robot.angle); // Rotate coordinate system

        // Robot body (origin is center of robot)
        ctx.fillStyle = robot.color;
        ctx.fillRect(-robot.width / 2, -robot.height / 2, robot.width, robot.height);

        // Robot direction indicator (front - local negative Y)
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(0, -robot.height / 2 - 2); // Tip of the arrow (slightly beyond body)
        ctx.lineTo(-5, -robot.height / 2 + 5); // Left base of arrow head
        ctx.lineTo(5, -robot.height / 2 + 5);  // Right base of arrow head
        ctx.closePath();
        ctx.fill();


        // Draw sensors (in robot's local coordinate system)
        robot.sensors.forEach(sensor => {
            ctx.fillStyle = sensor.color;
            ctx.beginPath();
            ctx.arc(sensor.x, sensor.y, robot.sensorRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        ctx.restore(); // Restore transformation state
    }

    let lastTime = 0;
    async function simulationLoop(timestamp) {
        if (!simulationRunning) return;

        const deltaTime = (timestamp - (lastTime || timestamp)) / 1000; // Delta time in seconds (handle first frame)
        lastTime = timestamp;

        if (userLoopFunction) {
            try {
                await userLoopFunction(); // Execute user's Arduino-like loop
            } catch (e) {
                console.error("Error in user loop():", e);
                serialOutput.textContent += "Error in loop(): " + e.message + "\n";
                stopSimulation(); // Stop on error in user loop
            }
        }

        updateRobot(deltaTime || 0.016); // Update robot state (provide default dt if first frame issues)
        draw(); // Redraw everything

        animationFrameId = requestAnimationFrame(simulationLoop); // Request next frame
    }

    function startSimulation() {
        if (simulationRunning) return;
        
        let codeLoadedAndSetupRun = false;
        // Check if this is a fresh start (not a resume from pause)
        // `data-fresh-start` attribute helps manage this state
        if (startButton.dataset.freshStart !== "false") { 
            if (!loadUserCode()) { // Load or reload code
                 serialOutput.textContent += "Failed to load code. Cannot start.\n";
                 return;
            }
            try {
                 userSetupFunction(); // Run user's setup
                 serialOutput.textContent += "setup() executed.\n";
                 codeLoadedAndSetupRun = true;
            } catch (e) {
                 console.error("Error in user setup():", e);
                 serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                 return; // Don't start if setup fails
            }
        } else { // Resuming from pause
            codeLoadedAndSetupRun = true; // Assume code is fine and setup was run
            serialOutput.textContent += "Resuming...\n";
        }
        
        // This block is a bit redundant with the one above but ensures setup runs if somehow skipped
        if(!codeLoadedAndSetupRun && startButton.dataset.freshStart === "true") {
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
        startButton.dataset.freshStart = "false"; // Mark that simulation is running or paused
        stopButton.disabled = false;
        resetButton.disabled = true; // Disable reset while running
        codeEditor.disabled = true; // Disable code editing while running
        lastTime = performance.now(); // Reset lastTime for deltaTime calculation
        animationFrameId = requestAnimationFrame(simulationLoop);
        if (serialOutput.textContent.slice(-20).indexOf("started") === -1 && serialOutput.textContent.slice(-20).indexOf("resumed") === -1) {
            serialOutput.textContent += "Simulation started.\n";
        }
    }

    function stopSimulation() {
        simulationRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        startButton.disabled = false; // Enable start (to resume)
        stopButton.disabled = true;   // Disable stop (it's already stopped)
        resetButton.disabled = false; // Enable reset
        codeEditor.disabled = false; // Allow code editing when stopped
        
        // Only print "stopped" if it wasn't an error that stopped it or already printed
        if (userSetupFunction !== (() => {}) && serialOutput.textContent.slice(-30).indexOf("Error") === -1) { 
            if(serialOutput.textContent.slice(-20).indexOf("stopped") === -1 && serialOutput.textContent.slice(-20).indexOf("resumed") === -1 ){
               serialOutput.textContent += "Simulation stopped (paused).\n";
            }
        }
    }

    // Event Listeners
    startButton.addEventListener('click', startSimulation);
    stopButton.addEventListener('click', stopSimulation);
    resetButton.addEventListener('click', () => {
        startButton.dataset.freshStart = "true"; // Mark that next start is fresh
        resetSimulation(); // Full reset logic
        startButton.disabled = false;
        stopButton.disabled = true;
        resetButton.disabled = false;
        codeEditor.disabled = false;
        serialOutput.textContent += "Simulation reset. Ready to start.\n";
    });

    // Initial setup on page load
    startButton.dataset.freshStart = "true"; // Initialize the state for the start button
    stopButton.disabled = true; // Initially stopped
    resetSimulation(); // Load code, run setup, draw initial state
    serialOutput.textContent += "Simulator ready. Press Start.\n";
});