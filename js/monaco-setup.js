// Default code for the editor
const defaultCode = `// Pin Definitions (as used in the simulator)
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
}`;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' } });

let editor = null;

require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monacoContainer'), {
        value: defaultCode,
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
});

// Handle window resize
window.addEventListener('resize', function() {
    if (editor) {
        editor.layout();
    }
});