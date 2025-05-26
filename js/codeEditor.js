// js/codeEditor.js
import { getDOMElements } from './ui.js';

let userSetupFunction = () => {};
let userLoopFunction = async () => {};
let currentCodeType = 'onoff'; // Track the current code type

let sharedSimulationState = null; // To access robot sensors and track

// Arduino Pin constants from user's code (will be defined there)
// We need to know which PWM pins map to which motor. This is hardcoded for now.
const SIM_MOTOR_LEFT_PWM_PIN = 6;
const SIM_MOTOR_RIGHT_PWM_PIN = 5;
const SIM_LEFT_SENSOR_PIN = 2;
const SIM_CENTER_SENSOR_PIN = 3;
const SIM_RIGHT_SENSOR_PIN = 4;


// Store pin modes (not strictly necessary for this sim, but good for API completeness)
let _pinModes = {};
// Store motor PWM values set by user's analogWrite
let _motorPWMValues = {
    [SIM_MOTOR_LEFT_PWM_PIN]: 0,
    [SIM_MOTOR_RIGHT_PWM_PIN]: 0,
};

// Serial object for user code
const ArduinoSerial = {
    _buffer: "",
    _outputElement: null, // Will be set to the serialMonitorOutput pre element
    _maxLines: 10, // Maximum number of lines to keep

    begin: function(baudRate) {
        this.println(`Serial communication started at ${baudRate} baud (simulated).`);
    },
    print: function(msg) {
        this._buffer += String(msg);
        this._trimBuffer();
        if (this._outputElement) {
            this._outputElement.textContent = this._buffer;
            this._outputElement.scrollTop = this._outputElement.scrollHeight; // Auto-scroll
        }
    },
    println: function(msg = "") {
        this.print(String(msg) + '\n');
    },
    clear: function() {
        this._buffer = "";
        if (this._outputElement) {
            this._outputElement.textContent = "";
        }
    },
    getOutput: function() { // For external UI update if needed
        return this._buffer;
    },
    _trimBuffer: function() {
        // Split into lines and keep only the last _maxLines
        const lines = this._buffer.split('\n');
        if (lines.length > this._maxLines) {
            this._buffer = lines.slice(-this._maxLines).join('\n');
        }
    }
};

// Arduino API shim for user code
const arduinoAPI = {
    pinMode: (pin, mode) => {
        _pinModes[pin] = mode;
        // ArduinoSerial.println(`Pin ${pin} mode set to ${mode}.`);
    },
    digitalRead: (pin) => {
        if (!sharedSimulationState || !sharedSimulationState.robot) return 1; // Default to off-line if no sim state

        // Robot sensors: 0 = on line, 1 = off line
        if (pin === SIM_LEFT_SENSOR_PIN) return sharedSimulationState.robot.sensors.left;
        if (pin === SIM_CENTER_SENSOR_PIN) return sharedSimulationState.robot.sensors.center;
        if (pin === SIM_RIGHT_SENSOR_PIN) return sharedSimulationState.robot.sensors.right;
        
        // ArduinoSerial.println(`Warning: digitalRead from unmapped pin ${pin}. Returning HIGH.`);
        return 1; // Default to HIGH (off line) for unmapped pins
    },
    analogWrite: (pin, value) => {
        const pwmValue = Math.max(0, Math.min(255, Math.round(value)));
        if (pin === SIM_MOTOR_LEFT_PWM_PIN) {
            _motorPWMValues[SIM_MOTOR_LEFT_PWM_PIN] = pwmValue;
            if (sharedSimulationState && sharedSimulationState.robot) { // Update robot's target PWM directly
                 sharedSimulationState.robot.motorPWMSpeeds.left = pwmValue;
            }
        } else if (pin === SIM_MOTOR_RIGHT_PWM_PIN) {
            _motorPWMValues[SIM_MOTOR_RIGHT_PWM_PIN] = pwmValue;
             if (sharedSimulationState && sharedSimulationState.robot) { // Update robot's target PWM directly
                 sharedSimulationState.robot.motorPWMSpeeds.right = pwmValue;
            }
        } else {
            // ArduinoSerial.println(`Warning: analogWrite to unmapped pin ${pin} with value ${pwmValue}.`);
        }
    },
    delay: async (ms) => {
        // In a real Arduino, delay blocks. In JS, we must use async/await.
        // The simulation loop will control actual timing. This delay is more for user code structure.
        // For this simulator, we'll make it a true JS delay, but the simulation step time is fixed.
        // If sim is not running, this promise might not resolve as expected if sim controls it.
        // For now, a simple JS timeout.
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    Serial: ArduinoSerial,
    // Constants for user code (these are usually #defined in Arduino C++)
    HIGH: 1,
    LOW: 0,
    INPUT: "INPUT",
    OUTPUT: "OUTPUT",
    // User code might also define their own constants like LEFT_SENSOR_PIN etc.
};

// Define the custom code template
const customCodeTemplate = `// Pin Definitions (as used in the simulator)
const LEFT_SENSOR_PIN = 2;   // Digital (Connected to Robot's Left Sensor)
const CENTER_SENSOR_PIN = 3; // Digital (Connected to Robot's Center Sensor)
const RIGHT_SENSOR_PIN = 4;  // Digital (Connected to Robot's Right Sensor)

const MOTOR_LEFT_PWM = 6;    // analogWrite for Left Motor Speed
const MOTOR_RIGHT_PWM = 5;   // analogWrite for Right Motor Speed

const SPEED = 200;      // Velocidad de velocidad de motores

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. Continuous Turn Control.");
}

async function loop() {
    //Escribe aqui el codigo de lectura de sensores y logica de control
    
    //Fuciones minimas para el accionamiento de motores (ambos adelane)
    analogWrite(MOTOR_LEFT_PWM, SPEED);
    analogWrite(MOTOR_RIGHT_PWM, SPEED);          
    await delay(10);
}`;

export function initCodeEditor(simulationState) {
    sharedSimulationState = simulationState; // Give API access to robot state
    const elems = getDOMElements();
    ArduinoSerial._outputElement = elems.serialMonitorOutput;

    elems.clearSerialButton.addEventListener('click', () => {
        ArduinoSerial.clear();
    });
    
    // Load initial code
    if (!window.monacoEditor) {
        console.error("Monaco Editor no está disponible");
        return false;
    }
    
    return loadUserCode(window.monacoEditor.getValue());
}

export function loadUserCode(code) {
    ArduinoSerial.clear(); // Clear serial on new code load
    _pinModes = {};
    _motorPWMValues = {[SIM_MOTOR_LEFT_PWM_PIN]: 0, [SIM_MOTOR_RIGHT_PWM_PIN]: 0};

    // Check if the code matches any of the templates
    if (code.includes('Robot Setup Complete. On/Off Control.')) {
        currentCodeType = 'onoff';
    } else if (code.includes('Robot Setup Complete. Continuous Turn Control.')) {
        currentCodeType = 'continuous-turn';
    } else if (code.includes('Robot Setup Complete. Proportional Control.')) {
        currentCodeType = 'proportional';
    } else if (code.includes('Robot Setup Complete. PID Line Follower.')) {
        currentCodeType = 'pid';
    } else {
        currentCodeType = 'custom';
    }

    try {
        // Create a function scope for the user's code, injecting the Arduino API
        // The user code should define setup() and loop()
        const userScript = new Function(
            ...Object.keys(arduinoAPI), // Argument names for the API objects/functions
            code + '; return { setup, loop, constrain };' // User code + return the functions
        );
        
        // Call the created function, passing the actual API implementations
        const scriptExports = userScript(...Object.values(arduinoAPI));

        if (typeof scriptExports.setup !== 'function') {
            throw new Error("La función setup() no fue encontrada o no es una función.");
        }
        if (typeof scriptExports.loop !== 'function') {
            throw new Error("La función loop() no fue encontrada o no es una función.");
        }
        userSetupFunction = scriptExports.setup;
        userLoopFunction = scriptExports.loop;

        // If user defines constrain, use it. Otherwise, provide a default one.
        if (typeof scriptExports.constrain === 'function') {
            arduinoAPI.constrain = scriptExports.constrain;
        } else {
            arduinoAPI.constrain = (value, minVal, maxVal) => Math.min(Math.max(value, minVal), maxVal);
        }

        ArduinoSerial.println("Código de usuario cargado y parseado con éxito.");
        ArduinoSerial.println(`Tipo de código: ${currentCodeType}`);
        return true;
    } catch (e) {
        console.error("Error procesando código de usuario:", e);
        ArduinoSerial.println("Error en el código de usuario: " + e.message + "\n" + (e.stack || ''));
        userSetupFunction = () => { ArduinoSerial.println("Error: setup() no pudo cargarse."); };
        userLoopFunction = async () => { ArduinoSerial.println("Error: loop() no pudo cargarse."); await arduinoAPI.delay(100); }; // Prevent fast error loop
        return false;
    }
}

export async function executeUserSetup() {
    if (typeof userSetupFunction === 'function') {
        try {
            await userSetupFunction(); // setup might be async if it uses delay
            ArduinoSerial.println("setup() ejecutado.");
        } catch (e) {
            console.error("Error ejecutando setup() del usuario:", e);
            Arduinoln("Error en setup(): " + e.message);
            throw e; // Re-throw to stop simulation if setup fails
        }
    }
}

export async function executeUserLoop() {
    if (typeof userLoopFunction === 'function') {
        try {
            await userLoopFunction();
        } catch (e) {
            console.error("Error ejecutando loop() del usuario:", e);
            ArduinoSerial.println("Error en loop(): " + e.message);
            throw e; // Re-throw to stop simulation if loop fails
        }
    }
}

// Allows main simulation to get the motor PWMs set by user's analogWrite
export function getMotorPWMOutputs() {
    return {
        leftPWM: _motorPWMValues[SIM_MOTOR_LEFT_PWM_PIN],
        rightPWM: _motorPWMValues[SIM_MOTOR_RIGHT_PWM_PIN]
    };
}

export function getSerialOutput() {
    return ArduinoSerial.getOutput();
}

export function clearSerial() {
    ArduinoSerial.clear();
}

export function getCurrentCodeType() {
    return currentCodeType;
}

// Add event listener for simulation code selection
document.addEventListener('DOMContentLoaded', () => {
    const simulationCodeSelect = document.getElementById('simulationCodeSelect');
    const codeTemplate = document.getElementById('codeTemplate');
    
    if (simulationCodeSelect) {
        // Set initial code type display
        updateCodeTypeDisplay('onoff');
        
        simulationCodeSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            if (selectedType !== 'custom') {
                // Update the code template selector in the code editor tab
                if (codeTemplate) {
                    codeTemplate.value = selectedType;
                    // Trigger the template change event
                    codeTemplate.dispatchEvent(new Event('change'));
                }
            }
            // Update the current code type display
            updateCodeTypeDisplay(selectedType);
        });
    }
    
    // Add event listener for code template changes
    if (codeTemplate) {
        codeTemplate.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            if (selectedType === 'custom' && window.monacoEditor) {
                window.monacoEditor.setValue(customCodeTemplate);
            }
            // Update the simulation code selector if it exists
            if (simulationCodeSelect) {
                simulationCodeSelect.value = selectedType;
            }
            // Update the current code type display
            updateCodeTypeDisplay(selectedType);
        });
    }
});