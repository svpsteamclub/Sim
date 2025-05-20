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
        x: 0, 
        y: 0, 
        width: 30, 
        height: 40, 
        angle: 0, 
        color: 'blue',
        wheelBase: 28, 
        speedL: 0,
        speedR: 0,
        maxSpeedSim: 2,

        sensors: [ 
            { x: -12, y: -18, value: 1, color: 'gray' }, 
            { x: 0,   y: -20, value: 1, color: 'gray' }, 
            { x: 12,  y: -18, value: 1, color: 'gray' }  
        ],
        sensorRadius: 3
    };

    // Track properties
    const track = {
        lineColor: 'black',
        lineWidth: 10, 
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
            context.moveTo(rectX + cornerRadius, rectY);
            context.lineTo(rectX + rectWidth - cornerRadius, rectY);
            context.arcTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + cornerRadius, cornerRadius);
            context.lineTo(rectX + rectWidth, rectY + rectHeight - cornerRadius);
            context.arcTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - cornerRadius, rectY + rectHeight, cornerRadius);
            context.lineTo(rectX + cornerRadius, rectY + rectHeight);
            context.arcTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - cornerRadius, cornerRadius);
            context.lineTo(rectX, rectY + cornerRadius);
            context.arcTo(rectX, rectY, rectX + cornerRadius, rectY, cornerRadius);
            context.stroke(); 
        }
    };
    track.offscreenCanvas = null;
    track.sensorCache = new Map(); // Cache for sensor readings
    track.cacheResolution = 5; // Cache grid resolution in pixels

    // Performance settings
    const performanceSettings = {
        targetFPS: 60,
        frameTime: 1000 / 60,
        lastFrameTime: 0,
        sensorUpdateThreshold: 0.5, // Update sensors if robot moved more than this distance
        lastSensorUpdate: { x: 0, y: 0 }
    };

    // Helper function to get cache key for a position
    function getCacheKey(x, y) {
        const gridX = Math.floor(x / track.cacheResolution);
        const gridY = Math.floor(y / track.cacheResolution);
        return `${gridX},${gridY}`;
    }

    // Helper function to get sensor value from cache or calculate it
    function getSensorValue(worldX, worldY, offCtx) {
        const cacheKey = getCacheKey(worldX, worldY);
        if (track.sensorCache.has(cacheKey)) {
            return track.sensorCache.get(cacheKey);
        }

        if (worldX >= 0 && worldX < canvas.width && worldY >= 0 && worldY < canvas.height) {
            const pixelData = offCtx.getImageData(Math.round(worldX), Math.round(worldY), 1, 1).data;
            const isBlack = pixelData[0] < 128 && pixelData[1] < 128 && pixelData[2] < 128;
            const value = isBlack ? arduinoAPI.LOW : arduinoAPI.HIGH;
            track.sensorCache.set(cacheKey, value);
            return value;
        }
        return arduinoAPI.HIGH;
    }

    // --- Arduino API Shim ---
    let _pinModes = {};
    const arduinoAPI = {
        pinMode: (pin, mode) => { _pinModes[pin] = mode; },
        digitalRead: (pin) => {
            if (pin === 2) return robot.sensors[0].value; 
            if (pin === 3) return robot.sensors[1].value; 
            if (pin === 4) return robot.sensors[2].value; 
            return arduinoAPI.LOW; 
        },
        analogWrite: (pin, value) => {
            value = Math.max(0, Math.min(255, value)); 
            if (pin === 5) robot.speedL = value;
            if (pin === 6) robot.speedR = value;
        },
        delay: async (ms) => {
            if (!simulationRunning) return; 
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        Serial: {
            _buffer: "",
            begin: function(baud) { this.println(`Serial.begin(${baud})`); },
            print: function(msg) {
                this._buffer += String(msg);
                serialOutput.textContent += String(msg);
                serialOutput.scrollTop = serialOutput.scrollHeight; 
            },
            println: function(msg = "") { this.print(String(msg) + '\n'); }
        },
        HIGH: 1, LOW: 0, INPUT: "INPUT", OUTPUT: "OUTPUT",
    };

    let userSetupFunction = () => {};
    let userLoopFunction = async () => {};

    function loadUserCode() {
        const code = codeEditor.value;
        serialOutput.textContent = ""; 
        arduinoAPI.Serial._buffer = "";
        try {
            const userScript = new Function(...Object.keys(arduinoAPI), code + '; return { setup, loop };');
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

    function updateRobot(dt) {
        const vL = (robot.speedL / 255) * robot.maxSpeedSim;
        const vR = (robot.speedR / 255) * robot.maxSpeedSim;

        const V = (vL + vR) / 2; 
        const omega = (vR - vL) / robot.wheelBase; 
        
        const physicsMovementAngle = robot.angle - (Math.PI / 2);
        const effectiveDtScaling = 60; 

        robot.x += V * Math.cos(physicsMovementAngle) * dt * effectiveDtScaling;
        robot.y += V * Math.sin(physicsMovementAngle) * dt * effectiveDtScaling;
        robot.angle += omega * dt * effectiveDtScaling; 

        // Check if we need to update sensors based on movement
        const dx = robot.x - performanceSettings.lastSensorUpdate.x;
        const dy = robot.y - performanceSettings.lastSensorUpdate.y;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy);

        if (distanceMoved > performanceSettings.sensorUpdateThreshold) {
            const offCtx = track.offscreenCanvas.getContext('2d');
            const cosA = Math.cos(robot.angle);
            const sinA = Math.sin(robot.angle);

            robot.sensors.forEach(sensor => {
                const worldX = robot.x + (sensor.x * cosA - sensor.y * sinA);
                const worldY = robot.y + (sensor.x * sinA + sensor.y * cosA);

                const value = getSensorValue(worldX, worldY, offCtx);
                sensor.value = value;
                sensor.color = value === arduinoAPI.LOW ? 'red' : 'lime';
            });

            performanceSettings.lastSensorUpdate.x = robot.x;
            performanceSettings.lastSensorUpdate.y = robot.y;
        }
    }

    function draw() {
        // Only redraw if enough time has passed since last frame
        const now = performance.now();
        const elapsed = now - performanceSettings.lastFrameTime;
        
        if (elapsed < performanceSettings.frameTime) {
            return;
        }
        
        performanceSettings.lastFrameTime = now;

        // Clear the canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the track from offscreen canvas
        ctx.drawImage(track.offscreenCanvas, 0, 0);
        
        // Draw the robot
        ctx.save(); 
        ctx.translate(robot.x, robot.y); 
        ctx.rotate(robot.angle); 
        ctx.fillStyle = robot.color;
        ctx.fillRect(-robot.width / 2, -robot.height / 2, robot.width, robot.height);
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(0, -robot.height / 2 - 2); 
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

    function resetSimulation() {
        stopSimulation();

        const margin = 40; 
        const trackBottomSegmentY = margin + (canvas.height - 2 * margin); 

        robot.angle = -Math.PI / 2;
        robot.y = trackBottomSegmentY; 
        robot.x = (canvas.width / 2) - robot.sensors[1].y;
        
        robot.speedL = 0;
        robot.speedR = 0;
        robot.sensors.forEach(s => s.value = 1); 
        _pinModes = {};
        serialOutput.textContent = ""; 
        arduinoAPI.Serial._buffer = "";
        track.sensorCache.clear();
        performanceSettings.lastSensorUpdate = { x: robot.x, y: robot.y };

        if (!track.offscreenCanvas || track.offscreenCanvas.width !== canvas.width || track.offscreenCanvas.height !== canvas.height) {
            track.offscreenCanvas = document.createElement('canvas');
            track.offscreenCanvas.width = canvas.width;
            track.offscreenCanvas.height = canvas.height;
            const offCtx = track.offscreenCanvas.getContext('2d');
            offCtx.fillStyle = 'white'; 
            offCtx.fillRect(0, 0, canvas.width, canvas.height);
            track.path(offCtx); 
        }
        
        if (loadUserCode()) { 
            try {
                userSetupFunction(); 
                serialOutput.textContent += "setup() executed.\n";
            } catch (e) {
                console.error("Error in user setup():", e);
                serialOutput.textContent += "Error in setup(): " + e.message + "\n";
                stopSimulation(); 
                return;
            }
        }
        draw(); 
    }

    let lastTime = 0;
    async function simulationLoop(timestamp) {
        if (!simulationRunning) return;
        const deltaTime = (timestamp - (lastTime || timestamp)) / 1000; 
        lastTime = timestamp;
        if (userLoopFunction) {
            try { await userLoopFunction(); } 
            catch (e) {
                console.error("Error in user loop():", e);
                serialOutput.textContent += "Error in loop(): " + e.message + "\n";
                stopSimulation(); 
            }
        }
        updateRobot(deltaTime || 0.016); 
        draw(); 
        animationFrameId = requestAnimationFrame(simulationLoop); 
    }

    function startSimulation() {
        if (simulationRunning) return;
        let codeLoadedAndSetupRun = false;
        if (startButton.dataset.freshStart !== "false") { 
            if (!loadUserCode()) { 
                 serialOutput.textContent += "Failed to load code. Cannot start.\n"; return;
            }
            try {
                 userSetupFunction(); 
                 serialOutput.textContent += "setup() executed.\n";
                 codeLoadedAndSetupRun = true;
            } catch (e) {
                 console.error("Error in user setup():", e);
                 serialOutput.textContent += "Error in setup(): " + e.message + "\n"; return; 
            }
        } else { 
            codeLoadedAndSetupRun = true; 
            serialOutput.textContent += "Resuming...\n";
        }
        if(!codeLoadedAndSetupRun && startButton.dataset.freshStart === "true") { 
            if (!loadUserCode()) { serialOutput.textContent += "Failed to load code. Cannot start.\n"; return; }
             try { userSetupFunction(); serialOutput.textContent += "setup() executed.\n"; } 
             catch (e) { console.error("Error in user setup():", e); serialOutput.textContent += "Error in setup(): " + e.message + "\n"; return; }
        }
        simulationRunning = true;
        startButton.disabled = true;
        startButton.dataset.freshStart = "false"; 
        stopButton.disabled = false;
        resetButton.disabled = true; 
        codeEditor.disabled = true; 
        lastTime = performance.now(); 
        animationFrameId = requestAnimationFrame(simulationLoop);
        if (serialOutput.textContent.slice(-20).indexOf("started") === -1 && serialOutput.textContent.slice(-20).indexOf("resumed") === -1) {
            serialOutput.textContent += "Simulation started.\n";
        }
    }

    function stopSimulation() {
        simulationRunning = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        startButton.disabled = false; 
        stopButton.disabled = true;   
        resetButton.disabled = false; 
        codeEditor.disabled = false; 
        if (userSetupFunction !== (() => {}) && serialOutput.textContent.slice(-30).indexOf("Error") === -1) { 
            if(serialOutput.textContent.slice(-20).indexOf("stopped") === -1 && serialOutput.textContent.slice(-20).indexOf("resumed") === -1 ){
               serialOutput.textContent += "Simulation stopped (paused).\n";
            }
        }
    }

    startButton.addEventListener('click', startSimulation);
    stopButton.addEventListener('click', stopSimulation);
    resetButton.addEventListener('click', () => {
        startButton.dataset.freshStart = "true"; 
        resetSimulation(); 
        startButton.disabled = false;
        stopButton.disabled = true;
        resetButton.disabled = false;
        codeEditor.disabled = false;
        serialOutput.textContent += "Simulation reset. Ready to start.\n";
    });

    startButton.dataset.freshStart = "true"; 
    stopButton.disabled = true; 
    resetSimulation(); 
    serialOutput.textContent += "Simulator ready. Press Start.\n";
});