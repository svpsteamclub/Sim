// js/codeEditor.js
import { getDOMElements } from './ui.js';

let userSetupFunction = () => {};
let userLoopFunction = async () => {};

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

    begin: function(baudRate) {
        this.println(`Serial communication started at ${baudRate} baud (simulated).`);
    },
    print: function(msg) {
        this._buffer += String(msg);
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

export function initCodeEditor(simulationState) {
    sharedSimulationState = simulationState; // Give API access to robot state
    const elems = getDOMElements();
    ArduinoSerial._outputElement = elems.serialMonitorOutput;

    elems.clearSerialButton.addEventListener('click', () => {
        ArduinoSerial.clear();
    });
    
    // Load initial code from textarea
    return loadUserCode(elems.codeEditorArea.value);
}

export function loadUserCode(code) {
    ArduinoSerial.clear(); // Clear serial on new code load
    _pinModes = {};
    _motorPWMValues = {[SIM_MOTOR_LEFT_PWM_PIN]: 0, [SIM_MOTOR_RIGHT_PWM_PIN]: 0};

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
            ArduinoSerial.println("Error en setup(): " + e.message);
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