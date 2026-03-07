// js/codeEditor.js
import { getDOMElements } from './ui.js';

let userSetupFunction = () => { };
let userLoopFunction = async () => { };
let currentCodeType = 'onoff'; // Track the current code type

let sharedSimulationState = null; // To access robot sensors and track

// We will determine pins on the fly from sharedSimulationState.robot.geometry.connections
// but we need a way to track PWM states on any pin the user targets.
let _pinModes = {};
let _motorPWMValues = {}; // Will store whatever pins the user writes to

// Serial object for user code
const ArduinoSerial = {
    _buffer: "",
    _outputElement: null, // Will be set to the serialMonitorOutput pre element
    _maxLines: 10, // Maximum number of lines to keep

    begin: function (baudRate) {
        this.println(`Serial communication started at ${baudRate} baud (simulated).`);
    },
    print: function (msg) {
        this._buffer += String(msg);
        this._trimBuffer();
        if (this._outputElement) {
            this._outputElement.textContent = this._buffer;
            this._outputElement.scrollTop = this._outputElement.scrollHeight; // Auto-scroll
        }
    },
    println: function (msg = "") {
        this.print(String(msg) + '\n');
    },
    clear: function () {
        this._buffer = "";
        if (this._outputElement) {
            this._outputElement.textContent = "";
        }
    },
    getOutput: function () { // For external UI update if needed
        return this._buffer;
    },
    _trimBuffer: function () {
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
        if (!sharedSimulationState || !sharedSimulationState.robot || !sharedSimulationState.robot.connections) return 1;

        const conns = sharedSimulationState.robot.connections.sensorPins;
        // The user code pin might be A2 (which equates to 2 due to injected constants)
        // We match `pin` to the mapped value of whatever the user typed in the UI
        // Since the UI might have "A2", and our API parses "A2" to 2, we need a helper:
        const resolveUIPin = (uiVal) => {
            if (typeof uiVal === 'string' && uiVal.startsWith('A')) {
                // Return the constant defined in API
                return arduinoAPI[uiVal];
            }
            return parseInt(uiVal);
        }

        let val = 1;
        if (pin === resolveUIPin(conns.left)) val = sharedSimulationState.robot.sensors.left;
        else if (pin === resolveUIPin(conns.center)) val = sharedSimulationState.robot.sensors.center;
        else if (pin === resolveUIPin(conns.right)) val = sharedSimulationState.robot.sensors.right;
        else if (pin === resolveUIPin(conns.farLeft)) val = sharedSimulationState.robot.sensors.farLeft;
        else if (pin === resolveUIPin(conns.farRight)) val = sharedSimulationState.robot.sensors.farRight;

        // Debug
        // ArduinoSerial.println(`digitalRead(${pin}) -> ${val} (left: ${resolveUIPin(conns.left)}, center: ${resolveUIPin(conns.center)}, right: ${resolveUIPin(conns.right)})`);

        return val;
    },
    // Add digitalWrite for completeness, as some use it for full forward/reverse on L298N
    digitalWrite: (pin, value) => {
        arduinoAPI.analogWrite(pin, value === arduinoAPI.HIGH ? 255 : 0);
    },
    analogWrite: (pin, value) => {
        const pwmValue = Math.max(-255, Math.min(255, Math.round(value)));

        // Update the tracked PWM for the specific pin dynamically
        _motorPWMValues[pin] = pwmValue;

        if (sharedSimulationState && sharedSimulationState.robot && sharedSimulationState.robot.connections) {
            const conns = sharedSimulationState.robot.connections;

            let finalLeftPWM = 0;
            let finalRightPWM = 0;

            if (conns.driverType === 'l298n') {
                const lIn1 = parseInt(conns.motorPins.leftIn1);
                const lIn2 = parseInt(conns.motorPins.leftIn2);
                const lEn = parseInt(conns.motorPins.leftEn);
                const rIn3 = parseInt(conns.motorPins.rightIn3);
                const rIn4 = parseInt(conns.motorPins.rightIn4);
                const rEn = parseInt(conns.motorPins.rightEn);

                const dirL = ((_motorPWMValues[lIn1] > 0) ? 1 : 0) - ((_motorPWMValues[lIn2] > 0) ? 1 : 0);
                const dirR = ((_motorPWMValues[rIn3] > 0) ? 1 : 0) - ((_motorPWMValues[rIn4] > 0) ? 1 : 0);

                finalLeftPWM = (_motorPWMValues[lEn] || 0) * dirL;
                finalRightPWM = (_motorPWMValues[rEn] || 0) * dirR;

                // Debug logging to serial monitor
                // ArduinoSerial.println(`L298N Update | pin: ${pin} | lEn: ${lEn} = ${_motorPWMValues[lEn]}, lIn1: ${lIn1} = ${_motorPWMValues[lIn1]}, lIn2: ${lIn2} = ${_motorPWMValues[lIn2]} | dirL: ${dirL} | finalLeft: ${finalLeftPWM}`);


            } else if (conns.driverType === 'mx1616') {
                const lIn1 = parseInt(conns.motorPins.leftIn1);
                const lIn2 = parseInt(conns.motorPins.leftIn2);
                const rIn3 = parseInt(conns.motorPins.rightIn3);
                const rIn4 = parseInt(conns.motorPins.rightIn4);

                finalLeftPWM = (_motorPWMValues[lIn1] || 0) - (_motorPWMValues[lIn2] || 0);
                finalRightPWM = (_motorPWMValues[rIn3] || 0) - (_motorPWMValues[rIn4] || 0);

            } else { // single, legacy, ESCs
                const lPWM = parseInt(conns.motorPins.leftPWM);
                const rPWM = parseInt(conns.motorPins.rightPWM);
                finalLeftPWM = _motorPWMValues[lPWM] || 0;
                finalRightPWM = _motorPWMValues[rPWM] || 0;
            }

            sharedSimulationState.robot.motorPWMSpeeds.left = finalLeftPWM;
            sharedSimulationState.robot.motorPWMSpeeds.right = finalRightPWM;
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
    A0: 0, A1: 1, A2: 2, A3: 4, A4: 3, A5: 5, // Map analog pins. A2=Left, A4=Center, A3=Right
    // User code might also define their own constants like LEFT_SENSOR_PIN etc.
};

// Define the custom code template
const customCodeTemplate = `// Pines de Sensores (0 = LOW = Negro, 1 = HIGH = Blanco)
const SENSOR_IZQ = A2;
const SENSOR_CEN = A4;
const SENSOR_DER = A3;

// Pines L298N Motor Izquierdo
const IN1 = 11;
const IN2 = 9;
const ENA = 3;

// Pines L298N Motor Derecho
const IN3 = 10;
const IN4 = 6;
const ENB = 5;

// Velocidad base
const SPEED = 120;

void setup() {
    Serial.begin(9600);
    
    // Configurar Sensores
    pinMode(SENSOR_IZQ, INPUT);
    pinMode(SENSOR_CEN, INPUT);
    pinMode(SENSOR_DER, INPUT);

    // Configurar Motores
    pinMode(IN1, OUTPUT);
    pinMode(IN2, OUTPUT);
    pinMode(ENA, OUTPUT);
    pinMode(IN3, OUTPUT);
    pinMode(IN4, OUTPUT);
    pinMode(ENB, OUTPUT);
    
    Serial.println("Robot Line Follower Listo.");
}

void loop() {
    int izq = digitalRead(SENSOR_IZQ);
    int cen = digitalRead(SENSOR_CEN);
    int der = digitalRead(SENSOR_DER);
    
    // Activar potencia en ambos motores
    analogWrite(ENA, SPEED);
    analogWrite(ENB, SPEED);
    
    // LOGICA DE SEGUIDOR DE LINEA (0 = LOW = Negra)
    if (cen == LOW) {
        // El centro está en la línea: Avanzar
        digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
        digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
    }
    else if (izq == LOW) {
        // La línea está a la izquierda: Girar a la izquierda
        digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH); // Invierte rueda izquierda
        digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);  // Rueda derecha avanza
    }
    else if (der == LOW) {
        // La línea está a la derecha: Girar a la derecha
        digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);  // Rueda izquierda avanza
        digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH); // Invierte rueda derecha
    }
    else {
        // Si pierde la línea (todos en HIGH = Blanco), detenerse
        digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
        digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
    }
}`;
/**
 * Transpila código básico de Arduino (C++) a JavaScript asíncrono
 */
function traducirArduinoAJS(codigoArduino) {
    let jsCode = codigoArduino.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return jsCode
        // 1. Elimina las librerías (#include <...>)
        .replace(/#include\s*[<"].*?[>"]/g, '')
        // 2. Elimina/ignora Serial.begin(baudios);
        .replace(/\bSerial\s*\.\s*begin\s*\([^)]*\)\s*;/g, '')
        // 3. Convierte Serial.print(ln) a console.log
        .replace(/\bSerial\s*\.\s*println?\b/g, 'console.log')
        // 4. Transforma funciones: elimina tipos de retorno y tipos de argumentos
        .replace(/\b(void|int|float|double|long|bool|unsigned\s+long|String|char)\s+(\w+)\s*\(([^)]*)\)/g, (match, tipo, nombre, args) => {
            let argsLimpios = args.replace(/\b(?:const\s+)?(?:unsigned\s+long|int|float|double|long|bool|String|char)\s+[\*\&]*\s*(\w+)/g, '$1');
            if (nombre === 'setup') return `function setup(${argsLimpios})`;
            if (nombre === 'loop') return `async function loop(${argsLimpios})`;
            return `function ${nombre}(${argsLimpios})`;
        })
        // 5. Constantes: C++ "const int" -> JS "const"
        .replace(/\bconst\s+(?:unsigned\s+long|int|float|double|long|bool|String|char)\b/g, 'const')
        // 6. Variables: C++ "int", "float" -> JS "let"
        .replace(/\b(?:unsigned\s+long|int|float|double|long|bool|String|char)\b/g, 'let')
        // 7. Gestión de Tiempo: "delay(X)" -> "await delay(X)"
        .replace(/\bdelay\s*\(/g, 'await delay(')
        // 8. Prevención de cuelgues: obliga delay(10) al final del loop
        .replace(/(async\s+function\s+loop\s*\([^)]*\)\s*\{)([\s\S]*?)(\s*\})(?=\s*$|\s*function\b)/g,
            '$1$2\n    await delay(10);\n$3');
}

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
    _motorPWMValues = {}; // Reset fully

    // Detectar el tipo de código (opcional, solo mantendremos 'onoff')
    currentCodeType = 'onoff';

    try {
        // C++ to JS Parser overrides (Transpilación de Arduino a JS asíncrono)
        let jsCode = traducirArduinoAJS(code);

        // Create a function scope for the user's code, injecting the Arduino API
        // The user code should define setup() and loop()
        const userScript = new Function(
            ...Object.keys(arduinoAPI), // Argument names for the API objects/functions
            jsCode + `\nreturn { setup: typeof setup !== 'undefined' ? setup : undefined, loop: typeof loop !== 'undefined' ? loop : undefined, constrain: typeof constrain !== 'undefined' ? constrain : undefined };`
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

export function getCurrentCodeType() {
    return currentCodeType;
}

// Cleanup unused event listener related to code template dropdown
document.addEventListener('DOMContentLoaded', () => {
    // Dropdown codeTemplate has been removed from index.html
});