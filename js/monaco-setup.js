// Code templates
const codeTemplates = {
    onoff: `// Pin Definitions (as used in the simulator)
const LEFT_SENSOR_PIN = 2;   // Digital (Connected to Robot's Left Sensor)
const CENTER_SENSOR_PIN = 3; // Digital (Connected to Robot's Center Sensor)
const RIGHT_SENSOR_PIN = 4;  // Digital (Connected to Robot's Right Sensor)

const MOTOR_LEFT_PWM = 6;    // analogWrite for Left Motor Speed
const MOTOR_RIGHT_PWM = 5;   // analogWrite for Right Motor Speed

const TURN_SPEED = 200;      // Velocidad de giro
const FORWARD_SPEED = 150;   // Velocidad hacia adelante

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. On/Off Control.");
}

async function loop() {
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = on line, 1 = off line
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);

    // Control On/Off simple
    if (sC === 0) {  // Sensor central en línea
        // Avanzar recto
        analogWrite(MOTOR_LEFT_PWM, FORWARD_SPEED);
        analogWrite(MOTOR_RIGHT_PWM, FORWARD_SPEED);
    }
    else if (sL === 0) {  // Sensor izquierdo en línea
        // Girar a la izquierda
        analogWrite(MOTOR_LEFT_PWM, 0);
        analogWrite(MOTOR_RIGHT_PWM, TURN_SPEED);
    }
    else if (sR === 0) {  // Sensor derecho en línea
        // Girar a la derecha
        analogWrite(MOTOR_LEFT_PWM, TURN_SPEED);
        analogWrite(MOTOR_RIGHT_PWM, 0);
    }
    else {  // Ningún sensor en línea
        // Avanzar lento buscando la línea
        analogWrite(MOTOR_LEFT_PWM, FORWARD_SPEED/2);
        analogWrite(MOTOR_RIGHT_PWM, FORWARD_SPEED/2);
    }

    Serial.print("sL:" + sL + " sC:" + sC + " sR:" + sR);
    Serial.println(" | L:" + (sL === 0 ? "ON" : "OFF") + 
                   " C:" + (sC === 0 ? "ON" : "OFF") + 
                   " R:" + (sR === 0 ? "ON" : "OFF"));
    
    await delay(20);
}`,

    proportional: `// Pin Definitions (as used in the simulator)
const LEFT_SENSOR_PIN = 2;   // Digital (Connected to Robot's Left Sensor)
const CENTER_SENSOR_PIN = 3; // Digital (Connected to Robot's Center Sensor)
const RIGHT_SENSOR_PIN = 4;  // Digital (Connected to Robot's Right Sensor)

const MOTOR_LEFT_PWM = 6;    // analogWrite for Left Motor Speed
const MOTOR_RIGHT_PWM = 5;   // analogWrite for Right Motor Speed

// Control Proporcional
const Kp = 100.0;           // Constante proporcional
const BASE_SPEED = 150;     // Velocidad base
const MAX_SPEED = 255;      // Velocidad máxima
const MIN_SPEED = 0;        // Velocidad mínima

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. Proportional Control.");
}

function constrain(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

async function loop() {
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = on line, 1 = off line
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);

    // Cálculo del error (-2 a +2)
    let error = 0;
    if (sL === 0 && sC === 1 && sR === 1) error = -2;        // Far Right
    else if (sL === 0 && sC === 0 && sR === 1) error = -1;   // Mid Right
    else if (sL === 1 && sC === 0 && sR === 1) error = 0;    // Center
    else if (sL === 1 && sC === 0 && sR === 0) error = 1;    // Mid Left
    else if (sL === 1 && sC === 1 && sR === 0) error = 2;    // Far Left

    // Cálculo proporcional
    let correction = Kp * error;

    // Aplicar corrección a los motores
    let leftSpeed = BASE_SPEED + correction;
    let rightSpeed = BASE_SPEED - correction;

    // Limitar velocidades
    leftSpeed = constrain(leftSpeed, MIN_SPEED, MAX_SPEED);
    rightSpeed = constrain(rightSpeed, MIN_SPEED, MAX_SPEED);

    // Aplicar a los motores
    analogWrite(MOTOR_LEFT_PWM, leftSpeed);
    analogWrite(MOTOR_RIGHT_PWM, rightSpeed);

    Serial.print("sL:" + sL + " sC:" + sC + " sR:" + sR);
    Serial.print(" | Error:" + error);
    Serial.println(" | L:" + leftSpeed.toFixed(0) + " R:" + rightSpeed.toFixed(0));
    
    await delay(20);
}`,

    pid: `// Pin Definitions (as used in the simulator)
const LEFT_SENSOR_PIN = 2;   // Digital (Connected to Robot's Left Sensor)
const CENTER_SENSOR_PIN = 3; // Digital (Connected to Robot's Center Sensor)
const RIGHT_SENSOR_PIN = 4;  // Digital (Connected to Robot's Right Sensor)

const MOTOR_LEFT_PWM = 6;    // analogWrite for Left Motor Speed
const MOTOR_RIGHT_PWM = 5;   // analogWrite for Right Motor Speed

// PID Constants - Tune these!
let Kp = 50.0;
let Ki = 0.1;
let Kd = 25.0;

const BASE_SPEED = 150;      // Base speed for both motors
const MAX_MOTOR_SPEED = 255;
const MIN_MOTOR_SPEED = 0;

let error = 0;
let previousError = 0;
let integral = 0;
let derivative = 0;
const INTEGRAL_MIN = -200;
const INTEGRAL_MAX = 200;

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. PID Line Follower.");
}

async function loop() {
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = on line, 1 = off line
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);

    // --- Basic Error Calculation ---
    if (sL === 0 && sC === 1 && sR === 1) { error = -2; } // Far Right
    else if (sL === 0 && sC === 0 && sR === 1) { error = -1; } // Mid Right
    else if (sL === 1 && sC === 0 && sR === 1) { error = 0;  } // Center
    else if (sL === 1 && sC === 0 && sR === 0) { error = 1;  } // Mid Left
    else if (sL === 1 && sC === 1 && sR === 0) { error = 2;  } // Far Left
    // Lost line (all sensors off line or all on line - could be intersection)
    else if ((sL === 1 && sC === 1 && sR === 1) || (sL === 0 && sC === 0 && sR === 0)) {
        // If line lost, continue with previous error to try to recover
        // A more robust solution might involve a search pattern or stopping.
        // error = previousError; // this is one strategy
        // For now, let's assume it means to go straight or rely on PID momentum
        if (sL === 0 && sC === 0 && sR === 0) error = 0; // All on line = straight
        // If all off, error remains previousError implicitly (if not reset)
    }

    // PID Calculation
    integral = integral + error;
    integral = constrain(integral, INTEGRAL_MIN, INTEGRAL_MAX);
    derivative = error - previousError;
    let pidOutput = (Kp * error) + (Ki * integral) + (Kd * derivative);
    previousError = error;

    let leftMotorSpeed = BASE_SPEED + pidOutput;
    let rightMotorSpeed = BASE_SPEED - pidOutput;

    leftMotorSpeed = constrain(leftMotorSpeed, MIN_MOTOR_SPEED, MAX_MOTOR_SPEED);
    rightMotorSpeed = constrain(rightMotorSpeed, MIN_MOTOR_SPEED, MAX_MOTOR_SPEED);

    analogWrite(MOTOR_LEFT_PWM, leftMotorSpeed);
    analogWrite(MOTOR_RIGHT_PWM, rightMotorSpeed);

    Serial.print("sL:" + sL + " sC:" + sC + " sR:" + sR);
    Serial.print(" | E:" + error + " P:" + (Kp*error).toFixed(1) + " I:" + (Ki*integral).toFixed(1) + " D:" + (Kd*derivative).toFixed(1));
    Serial.println(" | L:" + leftMotorSpeed + " R:" + rightMotorSpeed);
    
    await delay(20); // Simulation step time, matches sim param by default
}

function constrain(value, minVal, maxVal) {
    return Math.min(Math.max(value, minVal), maxVal);
}`
};

// Textos explicativos para cada plantilla
const codeExplanations = {
    onoff: `🌟 <b>Control On/Off</b>\n\nEste código es como un semáforo sencillo para tu robot. Si el sensor del medio ve la línea negra, el robot avanza. Si la pierde por la izquierda o la derecha, gira para buscarla.\n\nEs fácil de entender y perfecto para tus primeras pruebas. Pero, ¡ojo! En curvas muy cerradas puede que el robot se salga un poco.\n\n<b>¿Cuándo usarlo?</b>\nCuando quieres que tu robot siga la línea de forma simple y rápida.\n\n<b>¿Qué puedes probar?</b>\n- Cambia la velocidad para ver si el robot va más rápido o más lento.\n- Prueba diferentes pistas y mira cómo reacciona.`,
    proportional: `🌟 <b>Control Proporcional</b>\n\nEste código es un poco más inteligente. El robot calcula "qué tan lejos" está de la línea y corrige su camino suavemente. Así, no gira de golpe, sino que ajusta la velocidad de cada motor para seguir la línea como un experto.\n\n<b>¿Por qué es mejor?</b>\nHace que el robot se mueva más suave y no "zigzaguee" tanto.\n\n<b>¿Qué puedes probar?</b>\n- Cambia el número <b>Kp</b> para ver si el robot gira más o menos fuerte.\n- Haz pistas con curvas y observa cómo las toma.`,
    pid: `🌟 <b>Control PID</b>\n\n¡Este es el código más avanzado! El robot piensa en tres cosas: dónde está ahora (P), cuánto se ha desviado antes (I) y qué tan rápido cambia el error (D). Así puede seguir la línea incluso en curvas difíciles y no se sale casi nunca.\n\n<b>¿Por qué es genial?</b>\nPorque el robot aprende a corregirse solo, como si tuviera reflejos.\n\n<b>¿Qué puedes probar?</b>\n- Juega con los valores <b>Kp</b>, <b>Ki</b> y <b>Kd</b> para ver cómo cambia el comportamiento.\n- Haz pistas con muchas curvas y pon a prueba tu robot.\n\n¡Con este código, tu robot será un campeón de las pistas!`
};

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' } });

let editor = null;

require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monacoContainer'), {
        value: codeTemplates.pid, // Start with PID template
        language: 'javascript',
        theme: 'vs',
        minimap: {
            enabled: false
        },
        automaticLayout: true,
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        roundedSelection: false,
        readOnly: false,
        cursorStyle: 'line',
        selectOnLineNumbers: true,
        contextmenu: true,
        quickSuggestions: true,
        wordWrap: 'on'
    });

    // Make the editor instance available globally
    window.monacoEditor = editor;

    // Handle template selection changes
    const templateSelector = document.getElementById('codeTemplate');
    const codeExplanationElem = document.querySelector('.code-explanation');
    if (templateSelector) {
        templateSelector.addEventListener('change', (e) => {
            const selectedTemplate = e.target.value;
            if (codeTemplates[selectedTemplate]) {
                editor.setValue(codeTemplates[selectedTemplate]);
            }
            if (codeExplanationElem && codeExplanations[selectedTemplate]) {
                codeExplanationElem.innerHTML = `<h3>Guía del Código</h3><pre style='font-family:inherit;background:none;border:none;padding:0;margin:0;'>${codeExplanations[selectedTemplate]}</pre>`;
            }
        });
        // Inicializar explicación al cargar
        if (codeExplanationElem && codeExplanations[templateSelector.value]) {
            codeExplanationElem.innerHTML = `<h3>Guía del Código</h3><pre style='font-family:inherit;background:none;border:none;padding:0;margin:0;'>${codeExplanations[templateSelector.value]}</pre>`;
        }
    }
});

// Handle window resize
window.addEventListener('resize', function() {
    if (editor) {
        editor.layout();
    }
});