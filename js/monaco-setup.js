// Esquemas de código
const codeTemplates = {
    simpleOnOff: `function setup() {
    pinMode(4, INPUT);   // Sensor Izquierdo
    pinMode(3, INPUT);   // Sensor Centro
    pinMode(2, INPUT);   // Sensor Derecho
    pinMode(10, OUTPUT); // Motor Izquierdo
    pinMode(9, OUTPUT);  // Motor Derecho
}

async function loop() {
    let izq = digitalRead(4);
    let cen = digitalRead(3);
    let der = digitalRead(2);
    
    if (cen === 0) {
        analogWrite(10, 100);  // Avanzar
        analogWrite(9, 100);
    } 
    else if (izq === 0) {
        analogWrite(10, -100); // Girar Izquierda
        analogWrite(9, 100);
    } 
    else if (der === 0) {
        analogWrite(10, 100);  // Girar Derecha
        analogWrite(9, -100);
    } 
    // Al quitar el "else", el robot no tiene instrucción de detenerse.
    // Automáticamente recordará y mantendrá la última acción que ejecutó.

    await delay(10); // Pausa obligatoria del simulador
}`
};

// Textos explicativos para cada plantilla
const codeExplanations = {
    simpleOnOff: `🌟 <b>Código on/off simple</b>\n\nEste código es como un semáforo sencillo para tu robot. Si el sensor del centro (Pin 3) ve la línea negra, el robot avanza. Si la pierde por la izquierda o la derecha, frena esa rueda para hacer que el robot gire y busque la línea.\n\nEs fácil de entender y perfecto para tus primeras pruebas. En este caso:\n- <b>Pin 10</b> controla el Motor Izquierdo\n- <b>Pin 9</b> controla el Motor Derecho\n\n<b>¿Qué puedes probar?</b>\n- Cambia el valor <b>100</b> en <code>analogWrite</code> para hacer que el robot corra más rápido o más lento.\n- Prueba diferentes pistas y mira cómo reacciona en las curvas.`
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

    // Remove template selector logic as there is only one default template now
    // Inicializar explicación al cargar
    const codeExplanationElem = document.querySelector('.code-explanation');
    if (codeExplanationElem && codeExplanations.simpleOnOff) {
        codeExplanationElem.innerHTML = `<h3>Guía del Código</h3><pre style='font-family:inherit;background:none;border:none;padding:0;margin:0;white-space:pre-wrap;'>${codeExplanations.simpleOnOff}</pre>`;
    }
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