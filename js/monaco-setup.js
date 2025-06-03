// Esquemas de código
const codeTemplates = {
    custom: `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)
const FAR_LEFT_SENSOR_PIN = 5; // Digital (Conectado al sensor más a la izquierda, si existe)
const FAR_RIGHT_SENSOR_PIN = 6; // Digital (Conectado al sensor más a la derecha, si existe)

const MOTOR_LEFT_PWM = 9;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 10;  // analogWrite para velocidad del motor derecho

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(FAR_LEFT_SENSOR_PIN, INPUT);
    pinMode(FAR_RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. On/Off Control.");
}

async function loop() {
    analogWrite(MOTOR_RIGHT_PWM, 70);
    analogWrite(MOTOR_LEFT_PWM, 70);
    await delay(10);
}

function constrain(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
`,
    onoff: `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)
const FAR_LEFT_SENSOR_PIN = 5; // Digital (Conectado al sensor más a la izquierda, si existe)
const FAR_RIGHT_SENSOR_PIN = 6; // Digital (Conectado al sensor más a la derecha, si existe)

const MOTOR_LEFT_PWM = 9;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 10;  // analogWrite para velocidad del motor derecho

const TURN_SPEED = 140;      // Velocidad de giro
const FORWARD_SPEED = 70;   // Velocidad hacia adelante

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(FAR_LEFT_SENSOR_PIN, INPUT);
    pinMode(FAR_RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. On/Off Control.");
}

async function loop() {
    let sL = digitalRead(LEFT_SENSOR_PIN);   // 0 = en línea, 1 = fuera de línea
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);
    // Control On/Off simple
    if (sC === 0) {
        analogWrite(MOTOR_RIGHT_PWM, FORWARD_SPEED);
        analogWrite(MOTOR_LEFT_PWM, FORWARD_SPEED);
    }
    else if (sL === 0) {
        analogWrite(MOTOR_RIGHT_PWM, -TURN_SPEED);
        analogWrite(MOTOR_LEFT_PWM, TURN_SPEED);
    }
    else if (sR === 0) {
        analogWrite(MOTOR_RIGHT_PWM, TURN_SPEED);
        analogWrite(MOTOR_LEFT_PWM, -TURN_SPEED);
    }
    else {
        analogWrite(MOTOR_RIGHT_PWM, FORWARD_SPEED);
        analogWrite(MOTOR_LEFT_PWM, FORWARD_SPEED);
    }
    Serial.print("sL:" + sL + " sC:" + sC + " sR:" + sR);
    Serial.println(" | L:" + (sL === 0 ? "ON" : "OFF") + 
                   " C:" + (sC === 0 ? "ON" : "OFF") + 
                   " R:" + (sR === 0 ? "ON" : "OFF"));
    await delay(10);
}

function constrain(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
`,
    'continuous-turn': `// Definición de pines (como se usa en el simulador)
const LEFT_SENSOR_PIN = 2;   // Digital (Conectado al sensor izquierdo del robot)
const CENTER_SENSOR_PIN = 3; // Digital (Conectado al sensor central del robot)
const RIGHT_SENSOR_PIN = 4;  // Digital (Conectado al sensor derecho del robot)
const FAR_LEFT_SENSOR_PIN = 5; // Digital (Conectado al sensor más a la izquierda, si existe)
const FAR_RIGHT_SENSOR_PIN = 6; // Digital (Conectado al sensor más a la derecha, si existe)

const MOTOR_LEFT_PWM = 9;    // analogWrite para velocidad del motor izquierdo
const MOTOR_RIGHT_PWM = 10;  // analogWrite para velocidad del motor derecho

const TURN_SPEED = 200;      // Velocidad de giro
const FORWARD_SPEED = 150;   // Velocidad hacia adelante
let lastTurnDirection = 0;   // -1 = izquierda, 1 = derecha

function setup() {
    Serial.begin(9600);
    pinMode(LEFT_SENSOR_PIN, INPUT);
    pinMode(CENTER_SENSOR_PIN, INPUT);
    pinMode(RIGHT_SENSOR_PIN, INPUT);
    pinMode(FAR_LEFT_SENSOR_PIN, INPUT);
    pinMode(FAR_RIGHT_SENSOR_PIN, INPUT);
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    Serial.println("Robot Setup Complete. Continuous Turn Control.");
}

async function loop() {
    let sL = digitalRead(LEFT_SENSOR_PIN);
    let sC = digitalRead(CENTER_SENSOR_PIN);
    let sR = digitalRead(RIGHT_SENSOR_PIN);
    if (sC === 0) {
        analogWrite(MOTOR_RIGHT_PWM, FORWARD_SPEED);
        analogWrite(MOTOR_LEFT_PWM, FORWARD_SPEED);
        lastTurnDirection = 0;
    }
    else if (sL === 0) {
        analogWrite(MOTOR_RIGHT_PWM, 0);
        analogWrite(MOTOR_LEFT_PWM, TURN_SPEED);
        lastTurnDirection = -1;
    }
    else if (sR === 0) {
        analogWrite(MOTOR_RIGHT_PWM, TURN_SPEED);
        analogWrite(MOTOR_LEFT_PWM, 0);
        lastTurnDirection = 1;
    }
    else {
        if (lastTurnDirection === -1) {
            analogWrite(MOTOR_RIGHT_PWM, 0);
            analogWrite(MOTOR_LEFT_PWM, TURN_SPEED);
        } else if (lastTurnDirection === 1) {
            analogWrite(MOTOR_RIGHT_PWM, TURN_SPEED);
            analogWrite(MOTOR_LEFT_PWM, 0);
        } else {
            analogWrite(MOTOR_RIGHT_PWM, TURN_SPEED);
            analogWrite(MOTOR_LEFT_PWM, 0);
            lastTurnDirection = 1;
        }
    }
    Serial.print("sL:" + sL + " sC:" + sC + " sR:" + sR);
    Serial.println(" | L:" + (sL === 0 ? "ON" : "OFF") + 
                   " C:" + (sC === 0 ? "ON" : "OFF") + 
                   " R:" + (sR === 0 ? "ON" : "OFF") +
                   " | Último giro: " + (lastTurnDirection === -1 ? "IZQ" : lastTurnDirection === 1 ? "DER" : "NONE"));
    await delay(10);
}

function constrain(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
`
};

// Textos explicativos para cada plantilla
const codeExplanations = {
    custom: `🌟 <b>Código Personalizado</b>\n\nEste es un template base para que puedas escribir tu propio código de control. Incluye todas las definiciones necesarias de pines y una estructura básica para que puedas empezar a programar.\n\n<b>¿Qué incluye?</b>\n- Definición de todos los pines necesarios\n- Configuración básica en setup()\n- Estructura del loop() con lectura de sensores\n- Control básico de motores\n\n<b>¿Qué puedes hacer?</b>\n- Escribe tu propia lógica de control\n- Experimenta con diferentes estrategias\n- Aprende cómo funciona cada parte del código\n\n¡Es tu oportunidad de ser creativo y hacer que el robot se comporte como tú quieras!`,

    onoff: `🌟 <b>Control On/Off</b>\n\nEste código es como un semáforo sencillo para tu robot. Si el sensor del medio ve la línea negra, el robot avanza. Si la pierde por la izquierda o la derecha, gira para buscarla.\n\nEs fácil de entender y perfecto para tus primeras pruebas. Pero, ¡ojo! En curvas muy cerradas puede que el robot se salga un poco.\n\n<b>¿Cuándo usarlo?</b>\nCuando quieres que tu robot siga la línea de forma simple y rápida.\n\n<b>¿Qué puedes probar?</b>\n- Cambia la velocidad para ver si el robot va más rápido o más lento.\n- Prueba diferentes pistas y mira cómo reacciona.`,

    'continuous-turn': `🌟 <b>Control On/Off con Giro Continuo</b>\n\nEste código es similar al control On/Off simple, pero con una mejora importante: cuando el robot pierde la línea, en lugar de avanzar lentamente, continúa girando en la última dirección que estaba usando.\n\n<b>¿Por qué es útil?</b>\n- Ayuda a recuperar la línea más rápido cuando el robot se desvía\n- Es más efectivo en curvas cerradas\n- Evita que el robot se salga de la pista cuando pierde la línea\n\n<b>¿Qué puedes probar?</b>\n- Compara su comportamiento con el control On/Off simple\n- Prueba diferentes velocidades de giro\n- Observa cómo se comporta en curvas cerradas`
};

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' } });

let editor = null;

require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monacoContainer'), {
        value: codeTemplates.onoff, // Start with PID template
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