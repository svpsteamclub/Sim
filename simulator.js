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
        x: canvas.width / 2,
        y: canvas.height - 50,
        width: 30,
        height: 40,
        angle: -Math.PI / 2, // Pointing upwards
        color: 'blue',
        wheelBase: 28, // Distance between wheels, slightly less than width
        speedL: 0, // Left motor speed (0-255 from analogWrite)
        speedR: 0, // Right motor speed (0-255 from analogWrite)
        maxSpeedSim: 2, // Max pixels per frame at 255 input

        sensors: [ // Relative to robot center, {x, y}, angle (0 is forward)
            { x: -12, y: -18, value: 1, color: 'gray' }, // Left
            { x: 0,   y: -20, value: 1, color: 'gray' }, // Center
            { x: 12,  y: -18, value: 1, color: 'gray' }  // Right
        ],
        sensorRadius: 3
    };

    // Track properties
    const track = {
        lineColor: 'black',
        lineWidth: 20,
        // Simple horizontal line for this example
        path: (ctx) => {
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.strokeStyle = track.lineColor;
            ctx.lineWidth = track.lineWidth;
            ctx.stroke();
        }
        // For a more complex track, you'd draw it onto an offscreen canvas
        // and then check pixel data from there.
    };

    // --- Arduino API Shim ---
    let _pinModes = {};
    let _pinValues = {}; // For digital outputs if we add them

    const arduinoAPI = {
        pinMode: (pin, mode) => {
            // console.log(`pinMode(${pin}, ${mode === arduinoAPI.INPUT ? 'INPUT' : 'OUTPUT'})`);
            _pinModes[pin] = mode;
        },
        digitalRead: (pin) => {
            // Map pins to sensors
            if (pin === 2) return robot.sensors[0].value; // Left
            if (pin === 3) return robot.sensors[1].value; // Center
            if (pin === 4) return robot.sensors[2].value; // Right
            // console.warn(`digitalRead on unmapped pin: ${pin}`);
            return arduinoAPI.LOW; // Default to LOW if unmapped
        },
        analogWrite: (pin, value) => {
            value = Math.max(0, Math.min(255, value)); // Clamp value
            // Map pins to motors
            if (pin === 5) robot.speedL = value; // Motor Left PWM
            if (pin === 6) robot.speedR = value; // Motor Right PWM
            // console.log(`analogWrite(${pin}, ${value})`);
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
        // Constants
        HIGH: 1,
        LOW: 0,
        INPUT: 0,
        OUTPUT: 1,
        // User-defined pin names (from default code)
        LEFT_SENSOR_PIN: 2,
        CENTER_SENSOR_PIN: 3,
        RIGHT_SENSOR_PIN: 4,
        MOTOR_LEFT_PWM: 5,
        MOTOR_RIGHT_PWM: 6,
    };

    let userSetupFunction = () => {};
    let userLoopFunction = async () => {}; // loop must be async for await delay()

    function loadUserCode() {
        const code = codeEditor.value;
        serialOutput.textContent = ""; // Clear serial output
        arduinoAPI.Serial._buffer = "";

        try {
            // Create a function with access to the Arduino API shims
            // The user code defines 'setup' and 'loop' globally in its own scope
            const userScript = new Function(
                ...Object.keys(arduinoAPI), // Make API functions available as arguments
                code + '; return { setup, loop };' // User code + return statement
            );
            // Call the function, passing the API objects/functions as arguments
            const { setup: loadedSetup, loop: loadedLoop } = userScript(...Object.values(arduinoAPI));

            if (typeof loadedSetup !== 'function') throw new Error("setup() function not found or not a function.");
            if (typeof loadedLoop !== 'function') throw new Error("loop() function not found or not a function.");

            userSetupFunction = loadedSetup;
            userLoopFunction = loadedLoop; // This will be an async function if user used `await delay`
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
        robot.x = canvas.width / 2;
        robot.y = canvas.height - 80; // Start a bit further from the bottom
        robot.angle = -Math.PI / 2;
        robot.speedL = 0;
        robot.speedR = 0;
        robot.sensors.forEach(s => s.value = 1); // Reset sensor values
        _pinModes = {};
        _pinValues = {};
        serialOutput.textContent = "";
        arduinoAPI.Serial._buffer = "";

        if (loadUserCode()) {
            try {
                userSetupFunction();
                serialOutput.textContent += "setup() executed.\n";
            } catch (e) {
                console.error("Error in user setup():", e);
                serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                stopSimulation(); // Stop if setup fails
                return;
            }
        }
        draw(); // Draw initial state
    }

    function updateRobot(dt) {
        // Convert 0-255 speed to simulation speed
        const vL = (robot.speedL / 255) * robot.maxSpeedSim;
        const vR = (robot.speedR / 255) * robot.maxSpeedSim;

        const V = (vL + vR) / 2; // Average linear speed
        const omega = (vR - vL) / robot.wheelBase; // Angular speed

        robot.x += V * Math.cos(robot.angle) * dt * 10; // dt is small, scale it
        robot.y += V * Math.sin(robot.angle) * dt * 10;
        robot.angle += omega * dt * 10;

        // Keep robot on canvas (basic boundary)
        if (robot.x < 0) robot.x = 0;
        if (robot.x > canvas.width) robot.x = canvas.width;
        if (robot.y < 0) robot.y = 0;
        if (robot.y > canvas.height) robot.y = canvas.height;

        // Update sensors
        // Create a temporary canvas for line detection if not already done
        if (!track.offscreenCanvas) {
            track.offscreenCanvas = document.createElement('canvas');
            track.offscreenCanvas.width = canvas.width;
            track.offscreenCanvas.height = canvas.height;
            const offCtx = track.offscreenCanvas.getContext('2d');
            offCtx.fillStyle = 'white'; // Background
            offCtx.fillRect(0, 0, canvas.width, canvas.height);
            track.path(offCtx); // Draw the track onto the offscreen canvas
        }
        const offCtx = track.offscreenCanvas.getContext('2d');

        robot.sensors.forEach(sensor => {
            // Calculate world position of sensor
            const cosA = Math.cos(robot.angle);
            const sinA = Math.sin(robot.angle);
            const worldX = robot.x + (sensor.x * cosA - sensor.y * sinA);
            const worldY = robot.y + (sensor.x * sinA + sensor.y * cosA);

            // Check pixel color under sensor
            if (worldX >= 0 && worldX < canvas.width && worldY >= 0 && worldY < canvas.height) {
                const pixelData = offCtx.getImageData(Math.round(worldX), Math.round(worldY), 1, 1).data;
                // Assuming black line (R,G,B close to 0) on white background
                // If sum of RGB < 3 * 128 (mid gray), consider it on the line
                const isBlack = pixelData[0] < 128 && pixelData[1] < 128 && pixelData[2] < 128;
                sensor.value = isBlack ? arduinoAPI.LOW : arduinoAPI.HIGH; // LOW (0) on line, HIGH (1) off line
                sensor.color = isBlack ? 'red' : 'lime';
            } else {
                sensor.value = arduinoAPI.HIGH; // Off canvas, so off line
                sensor.color = 'gray';
            }
        });
    }

    function draw() {
        // Clear canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw track
        track.path(ctx);

        // Draw robot
        ctx.save();
        ctx.translate(robot.x, robot.y);
        ctx.rotate(robot.angle);

        // Robot body
        ctx.fillStyle = robot.color;
        ctx.fillRect(-robot.width / 2, -robot.height / 2, robot.width, robot.height);

        // Robot direction indicator (front)
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(0, -robot.height / 2 - 2); // Tip of the arrow
        ctx.lineTo(-5, -robot.height / 2 + 5);
        ctx.lineTo(5, -robot.height / 2 + 5);
        ctx.closePath();
        ctx.fill();


        // Draw sensors
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

        const deltaTime = (timestamp - lastTime) / 1000; // Delta time in seconds
        lastTime = timestamp;

        if (userLoopFunction) {
            try {
                // Ensure the loop doesn't run too fast if delay isn't used properly
                // or if user code is very quick.
                // A more robust solution might involve a fixed time step.
                await userLoopFunction();
            } catch (e) {
                console.error("Error in user loop():", e);
                serialOutput.textContent += "Error in loop(): " + e.message + "\n";
                stopSimulation(); // Stop on error
            }
        }

        updateRobot(deltaTime || 0.016); // Pass deltaTime, default to ~60fps if first frame
        draw();

        animationFrameId = requestAnimationFrame(simulationLoop);
    }

    function startSimulation() {
        if (simulationRunning) return;
        if (!loadUserCode()) { // Try to load/reload code before starting
             serialOutput.textContent += "Failed to load code. Cannot start.\n";
             return;
        }
        // Re-run setup if it's a fresh start after a reset/load
        // This check ensures setup() is only called once per "run" cycle
        if (!stopButton.disabled) { // If stop button is enabled, means we were paused
             serialOutput.textContent += "Resuming...\n";
        } else {
             try {
                 userSetupFunction();
                 serialOutput.textContent += "setup() executed.\n";
             } catch (e) {
                 console.error("Error in user setup():", e);
                 serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                 return; // Don't start if setup fails
             }
        }

        simulationRunning = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        resetButton.disabled = true;
        codeEditor.disabled = true;
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(simulationLoop);
        serialOutput.textContent += "Simulation started.\n";
    }

    function stopSimulation() {
        simulationRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        startButton.disabled = false;
        stopButton.disabled = true;
        resetButton.disabled = false;
        codeEditor.disabled = false;
        if (userSetupFunction !== (() => {})) { // Only if code was loaded
            serialOutput.textContent += "Simulation stopped.\n";
        }
    }

    // Event Listeners
    startButton.addEventListener('click', startSimulation);
    stopButton.addEventListener('click', stopSimulation);
    resetButton.addEventListener('click', () => {
        resetSimulation();
        // After reset, UI should be ready for a new "start"
        startButton.disabled = false;
        stopButton.disabled = true;
        resetButton.disabled = false;
        codeEditor.disabled = false;
    });

    // Initial setup
    stopButton.disabled = true; // Initially stopped
    resetSimulation(); // Load code, run setup, draw initial state
});