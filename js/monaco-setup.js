// Esquemas de código
const codeTemplates = {
    simpleOnOff: `void setup() {
    // Configurar pines de los sensores (A2, A4, A3)
    pinMode(A2, INPUT);   // Sensor Izquierdo
    pinMode(A4, INPUT);   // Sensor Centro
    pinMode(A3, INPUT);   // Sensor Derecho

    // Configurar pines del driver L298N
    pinMode(11, OUTPUT);  // Motor Izq IN1
    pinMode(9, OUTPUT);   // Motor Izq IN2
    pinMode(3, OUTPUT);   // Motor Izq ENA (PWM)
    
    pinMode(10, OUTPUT);  // Motor Der IN3
    pinMode(6, OUTPUT);   // Motor Der IN4
    pinMode(5, OUTPUT);   // Motor Der ENB (PWM)
}

void loop() {
    // Leer los sensores (HIGH = Vio línea negra)
    int izq = digitalRead(A2);
    int cen = digitalRead(A4);
    int der = digitalRead(A3);
    
    // Fijar la velocidad general (0 a 255)
    analogWrite(3, 120); 
    analogWrite(5, 120);

    // Lógica Simple
    if (cen == HIGH) {
        // Avanzar: ambos motores adelante
        digitalWrite(11, HIGH); digitalWrite(9, LOW);
        digitalWrite(10, HIGH); digitalWrite(6, LOW);
    } 
    else if (izq == HIGH) {
        // Girar Izquierda: frena llanta izquierda, avanza derecha
        digitalWrite(11, LOW);  digitalWrite(9, LOW);
        digitalWrite(10, HIGH); digitalWrite(6, LOW);
    } 
    else if (der == HIGH) {
        // Girar Derecha: avanza izquierda, frena derecha
        digitalWrite(11, HIGH); digitalWrite(9, LOW);
        digitalWrite(10, LOW);  digitalWrite(6, LOW);
    } 
}`
};

// Textos explicativos para cada plantilla
const codeExplanations = {
    simpleOnOff: `🌟 <b>Código Seguidor de Línea (L298N)</b>\n\nEste código utiliza los 6 pines necesarios para controlar un puente H L298N. Los pines <b>ENA (3)</b> y <b>ENB (5)</b> definen la <i>velocidad</i> (PWM), mientras que los pines <b>IN1/IN2</b> e <b>IN3/IN4</b> definen la <i>dirección</i>.\n\nEs fácil de entender y perfecto para tus primeras pruebas.\n\n<b>¿Qué puedes probar?</b>\n- Cambia el valor <b>120</b> en <code>analogWrite</code> para hacer que el robot corra más rápido o más lento.\n- Prueba diferentes pistas y mira cómo reacciona en las curvas.`
};

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' } });

let editor = null;

require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monacoContainer'), {
        value: codeTemplates.simpleOnOff, // Start with the single default template
        language: 'javascript', // We keep javascript for syntax highlighting, codeEditor.js parses it anyway
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

    window.monacoEditor = editor;
});

// --- Descargar y cargar código desde archivo ---
document.getElementById('downloadCodeButton').addEventListener('click', function () {
    let code = '';
    if (window.editor && typeof window.editor.getValue === 'function') {
        code = window.editor.getValue();
    } else if (typeof editor !== 'undefined' && typeof editor.getValue === 'function') {
        code = editor.getValue();
    }
    if (!code) return;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigo_robot.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
});

document.getElementById('uploadCodeInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        // Cambia el dropdown a 'custom' antes de cargar el código
        const templateSelect = document.getElementById('codeTemplate');
        if (templateSelect) templateSelect.value = 'custom';
        // Si hay un evento de cambio, disparemoslo para que el editor se actualice si es necesario
        if (templateSelect) {
            const event = new Event('change', { bubbles: true });
            templateSelect.dispatchEvent(event);
        }
        // Espera un pequeño tiempo para asegurar que el editor esté en modo custom
        setTimeout(function () {
            if (window.editor && typeof window.editor.setValue === 'function') {
                window.editor.setValue(evt.target.result);
            } else if (typeof editor !== 'undefined' && typeof editor.setValue === 'function') {
                editor.setValue(evt.target.result);
            }
        }, 100);
    };
    reader.readAsText(file);
});

// Handle window resize
window.addEventListener('resize', function () {
    if (editor) {
        editor.layout();
    }
});