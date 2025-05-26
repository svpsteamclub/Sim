// Esquemas de código
const codeTemplates = {
    custom: `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)

const MOTOR_LEFT_PWM = 6;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 5;   // analogWrite para velocidad del motor derecho

const SPEED = 200;      // Velocidad de los motores

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. Custom Code.");
}

async function loop() {
    // Escribe aquí el código de lectura de sensores y lógica de control
    
    // Funciones mínimas para el accionamiento de motores (ambos adelante)
    analogWrite(MOTOR_LEFT_PWM, SPEED);
    analogWrite(MOTOR_RIGHT_PWM, SPEED);          
    await delay(10);
}`,

    onoff: `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)

const MOTOR_LEFT_PWM = 6;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 5;   // analogWrite para velocidad del motor derecho

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
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = en línea, 1 = fuera de línea
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
    
    await delay(10);
}`,

    'continuous-turn': `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)

const MOTOR_LEFT_PWM = 6;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 5;   // analogWrite para velocidad del motor derecho

const TURN_SPEED = 200;      // Velocidad de giro
const FORWARD_SPEED = 150;   // Velocidad hacia adelante

// Variable para recordar la última dirección de giro
let lastTurnDirection = 0;   // -1 = izquierda, 1 = derecha

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
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = en línea, 1 = fuera de línea
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);

    // Control On/Off con giro continuo
    if (sC === 0) {  // Sensor central en línea
        // Avanzar recto
        analogWrite(MOTOR_LEFT_PWM, FORWARD_SPEED);
        analogWrite(MOTOR_RIGHT_PWM, FORWARD_SPEED);
        lastTurnDirection = 0;  // Resetear dirección de giro
    }
    else if (sL === 0) {  // Sensor izquierdo en línea
        // Girar a la izquierda
        analogWrite(MOTOR_LEFT_PWM, 0);
        analogWrite(MOTOR_RIGHT_PWM, TURN_SPEED);
        lastTurnDirection = -1;  // Recordar que giramos a la izquierda
    }
    else if (sR === 0) {  // Sensor derecho en línea
        // Girar a la derecha
        analogWrite(MOTOR_LEFT_PWM, TURN_SPEED);
        analogWrite(MOTOR_RIGHT_PWM, 0);
        lastTurnDirection = 1;  // Recordar que giramos a la derecha
    }
    else {  // Ningún sensor en línea
        // Continuar girando en la última dirección conocida
        if (lastTurnDirection === -1) {
            // Seguir girando a la izquierda
            analogWrite(MOTOR_LEFT_PWM, 0);
            analogWrite(MOTOR_RIGHT_PWM, TURN_SPEED);
        } else if (lastTurnDirection === 1) {
            // Seguir girando a la derecha
            analogWrite(MOTOR_LEFT_PWM, TURN_SPEED);
            analogWrite(MOTOR_RIGHT_PWM, 0);
        } else {
            // Si no hay dirección previa, girar a la derecha por defecto
            analogWrite(MOTOR_LEFT_PWM, TURN_SPEED);
            analogWrite(MOTOR_RIGHT_PWM, 0);
            lastTurnDirection = 1;
        }
    }

    Serial.print("sL:" + sL + " sC:" + sC + " sR:" + sR);
    Serial.println(" | L:" + (sL === 0 ? "ON" : "OFF") + 
                   " C:" + (sC === 0 ? "ON" : "OFF") + 
                   " R:" + (sR === 0 ? "ON" : "OFF") +
                   " | Último giro: " + (lastTurnDirection === -1 ? "IZQ" : lastTurnDirection === 1 ? "DER" : "NONE"));
    
    await delay(10);
}`,

    proportional: `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)

const MOTOR_LEFT_PWM = 6;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 5;   // analogWrite para velocidad del motor derecho

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
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = en línea, 1 = fuera de línea
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);

    // Cálculo del error (-2 a +2)
    let error = 0;
    if (sL === 0 && sC === 1 && sR === 1) error = -2;        // Muy a la derecha
    else if (sL === 0 && sC === 0 && sR === 1) error = -1;   // Medio a la derecha
    else if (sL === 1 && sC === 0 && sR === 1) error = 0;    // Centro
    else if (sL === 1 && sC === 0 && sR === 0) error = 1;    // Medio a la izquierda
    else if (sL === 1 && sC === 1 && sR === 0) error = 2;    // Muy a la izquierda

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
    
    await delay(10);
}`,

    pid: `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)

const MOTOR_LEFT_PWM = 6;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 5;   // analogWrite para velocidad del motor derecho

// Constantes PID - ¡Ajusta estos valores!
let Kp = 90.0;
let Ki = 0.75;
let Kd = 25.0;

const BASE_SPEED = 150;      // Velocidad base para ambos motores
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
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = en línea, 1 = fuera de línea
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);

    // --- Cálculo básico del error ---
    if (sL === 0 && sC === 1 && sR === 1) { error = -2; } // Muy a la derecha
    else if (sL === 0 && sC === 0 && sR === 1) { error = -1; } // Medio a la derecha
    else if (sL === 1 && sC === 0 && sR === 1) { error = 0;  } // Centro
    else if (sL === 1 && sC === 0 && sR === 0) { error = 1;  } // Medio a la izquierda
    else if (sL === 1 && sC === 1 && sR === 0) { error = 2;  } // Muy a la izquierda
    // Línea perdida (todos los sensores fuera de línea o todos en línea - podría ser una intersección)
    else if ((sL === 1 && sC === 1 && sR === 1) || (sL === 0 && sC === 0 && sR === 0)) {
        // Si se pierde la línea, continuar con el error previo para intentar recuperar
        // Una solución más robusta podría involucrar un patrón de búsqueda o detenerse.
        // error = previousError; // esta es una estrategia
        // Por ahora, asumimos que significa ir recto o confiar en el momentum del PID
        if (sL === 0 && sC === 0 && sR === 0) error = 0; // Todos en línea = recto
        // Si todos fuera, el error permanece como previousError implícitamente (si no se reinicia)
    }

    // Cálculo PID
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

    //Serial.print("sL:" + sL + " sC:" + sC + " sR:" + sR);
    //Serial.print(" | E:" + error + " P:" + (Kp*error).toFixed(1) + " I:" + (Ki*integral).toFixed(1) + " D:" + (Kd*derivative).toFixed(1));
    //Serial.println(" | L:" + leftMotorSpeed + " R:" + rightMotorSpeed);
    
    await delay(5); // Tiempo de paso de simulación, coincide con el parámetro de sim por defecto
}

function constrain(value, minVal, maxVal) {
    return Math.min(Math.max(value, minVal), maxVal);
}`
};

// Textos explicativos para cada plantilla
const codeExplanations = {
    custom: `🌟 <b>Código Personalizado</b>\n\nEste es un template base para que puedas escribir tu propio código de control. Incluye todas las definiciones necesarias de pines y una estructura básica para que puedas empezar a programar.\n\n<b>¿Qué incluye?</b>\n- Definición de todos los pines necesarios\n- Configuración básica en setup()\n- Estructura del loop() con lectura de sensores\n- Control básico de motores\n\n<b>¿Qué puedes hacer?</b>\n- Escribe tu propia lógica de control\n- Experimenta con diferentes estrategias\n- Aprende cómo funciona cada parte del código\n\n¡Es tu oportunidad de ser creativo y hacer que el robot se comporte como tú quieras!`,

    onoff: `🌟 <b>Control On/Off</b>\n\nEste código es como un semáforo sencillo para tu robot. Si el sensor del medio ve la línea negra, el robot avanza. Si la pierde por la izquierda o la derecha, gira para buscarla.\n\nEs fácil de entender y perfecto para tus primeras pruebas. Pero, ¡ojo! En curvas muy cerradas puede que el robot se salga un poco.\n\n<b>¿Cuándo usarlo?</b>\nCuando quieres que tu robot siga la línea de forma simple y rápida.\n\n<b>¿Qué puedes probar?</b>\n- Cambia la velocidad para ver si el robot va más rápido o más lento.\n- Prueba diferentes pistas y mira cómo reacciona.`,

    'continuous-turn': `🌟 <b>Control On/Off con Giro Continuo</b>\n\nEste código es similar al control On/Off simple, pero con una mejora importante: cuando el robot pierde la línea, en lugar de avanzar lentamente, continúa girando en la última dirección que estaba usando.\n\n<b>¿Por qué es útil?</b>\n- Ayuda a recuperar la línea más rápido cuando el robot se desvía\n- Es más efectivo en curvas cerradas\n- Evita que el robot se salga de la pista cuando pierde la línea\n\n<b>¿Qué puedes probar?</b>\n- Compara su comportamiento con el control On/Off simple\n- Prueba diferentes velocidades de giro\n- Observa cómo se comporta en curvas cerradas`,

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