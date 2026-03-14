// js/ui.js

export function getDOMElements() {
    return {
        // Tabs
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),

        // Simulation Tab
        simulationDisplayCanvas: document.getElementById('simulationDisplayCanvas'),
        startSimButton: document.getElementById('startSimButton'),
        stopSimButton: document.getElementById('stopSimButton'),
        resetSimButton: document.getElementById('resetSimButton'),
        timeStepInput: document.getElementById('timeStep'),
        maxRobotSpeedInput: document.getElementById('maxRobotSpeed'),
        motorEfficiencyInput: document.getElementById('motorEfficiency'),
        motorImbalanceInput: document.getElementById('motorImbalance'),
        motorResponseInput: document.getElementById('motorResponse'),
        sensorNoiseInput: document.getElementById('sensorNoise'),
        movementPerturbInput: document.getElementById('movementPerturb'),
        motorDeadbandInput: document.getElementById('motorDeadband'),
        lineThresholdInput: document.getElementById('lineThreshold'),
        robotMassInput: document.getElementById('robotMass'),
        comOffsetInput: document.getElementById('comOffset'),
        tireGripInput: document.getElementById('tireGrip'),
        applySimParamsButton: document.getElementById('applySimParamsButton'),
        telemetryOutput: document.getElementById('telemetryOutput'),
        lapTimerOutput: document.getElementById('lapTimerOutput'),

        // Code Editor Tab
        codeEditorArea: document.getElementById('codeEditorArea'),
        applyCodeButton: document.getElementById('applyCodeButton'),
        loadExampleCodeButton: document.getElementById('loadExampleCodeButton'),
        currentCodeType: document.getElementById('currentCodeType'),
        codeExplanation: document.querySelector('.code-explanation'),
        editorHelp: document.querySelector('.editor-help'),
        serialMonitorOutput: document.getElementById('serialMonitorOutput'),
        clearSerialButton: document.getElementById('clearSerialButton'),
        serialMonitorOutputCodeEditor: document.getElementById('serialMonitorOutputCodeEditor'),
        clearSerialButtonCodeEditor: document.getElementById('clearSerialButtonCodeEditor'),

        // Robot Editor Tab
        robotPreviewCanvas: document.getElementById('robotPreviewCanvas'),
        robotWidthInput: document.getElementById('robotWidth'),
        sensorOffsetInput: document.getElementById('sensorOffset'),
        sensorSpreadInput: document.getElementById('sensorSpread'),
        sensorDiameterInput: document.getElementById('sensorDiameter'),
        sensorCountSelect: document.getElementById('sensorCount'),
        addCustomSensorBtn: document.getElementById('addCustomSensorBtn'),
        customSensorsList: document.getElementById('customSensorsList'),
        applyRobotGeometryButton: document.getElementById('applyRobotGeometryButton'),
        resetRobotGeometryButton: document.getElementById('resetRobotGeometryButton'),
        robotPartsPalette: document.getElementById('robotPartsPalette'),
        saveRobotButton: document.getElementById('saveRobotButton'),
        loadRobotInput: document.getElementById('loadRobotInput'),
        loadExampleRobotButton: document.getElementById('loadExampleRobotButton'),
        robotSelectionDropdown: document.getElementById('robotSelectionDropdown'),
        editorPanBtn: document.getElementById('editorPanBtn'),
        zoomInBtn: document.getElementById('editorZoomInBtn'),
        zoomOutBtn: document.getElementById('editorZoomOutBtn'),
        zoomResetBtn: document.getElementById('editorZoomResetBtn'),
        zoomExtentsBtn: document.getElementById('editorZoomExtentsBtn'),

        // Pin Connections UI
        sensorConnectionsContainer: document.getElementById('sensorConnectionsContainer'),
        pinSensorFarLeftInput: document.getElementById('pinSensorFarLeft'),
        pinSensorFullFarLeftInput: document.getElementById('pinSensorFullFarLeft'),
        pinSensorLeftInput: document.getElementById('pinSensorLeft'),
        pinSensorCenterInput: document.getElementById('pinSensorCenter'),
        pinSensorRightInput: document.getElementById('pinSensorRight'),
        pinSensorFarRightInput: document.getElementById('pinSensorFarRight'),
        pinSensorFullFarRightInput: document.getElementById('pinSensorFullFarRight'),
        motorDriverTypeSelect: document.getElementById('motorDriverType'),
        motorConnectionsContainer: document.getElementById('motorConnectionsContainer'),

        // Custom Parts UI
        addCustomWheelsBtn: document.getElementById('addCustomWheelsBtn'),
        addCustomBodyBtn: document.getElementById('addCustomBodyBtn'),
        customPartDialog: document.getElementById('customPartDialog'),
        customPartForm: document.getElementById('customPartForm'),
        customPartTitle: document.getElementById('customPartTitle'),
        customPartType: document.getElementById('customPartType'),
        customPartLengthInput: document.getElementById('customPartLength'),
        customPartWidthInput: document.getElementById('customPartWidth'),
        customPartOffsetInput: document.getElementById('customPartOffset'),
        customPartColorInput: document.getElementById('customPartColor'),
        cancelCustomPartBtn: document.getElementById('cancelCustomPart'),
        confirmCustomPartBtn: document.getElementById('confirmCustomPart'),
        customPartWidthContainer: document.getElementById('customPartWidthContainer'),
        customPartOffsetContainer: document.getElementById('customPartOffsetContainer'),

        // Track Editor Tab
        trackEditorCanvas: document.getElementById('trackEditorCanvas'),
        trackGridSizeSelect: document.getElementById('trackGridSize'),
        generateRandomTrackButton: document.getElementById('generateRandomTrack'),
        trackEditorTrackNameInput: document.getElementById('trackEditorTrackName'),
        saveTrackDesignButton: document.getElementById('saveTrackDesignButton'),
        loadTrackDesignInput: document.getElementById('loadTrackDesignInput'),
        exportTrackToSimulatorButton: document.getElementById('exportTrackToSimulator'),
        trackPartsPalette: document.getElementById('trackPartsPalette'),
        trackEditorControls: document.querySelector('.track-editor-controls'),
        trackModeDropdown: document.getElementById('trackModeDropdown')
    };
}

const tabScrollPositions = new Map();

export function setupTabs() {
    const { tabButtons, tabContents } = getDOMElements();
    
    // Identificar la pestaña activa inicialmente
    let currentActiveTab = null;
    tabButtons.forEach(btn => {
        if (btn.classList.contains('active')) {
            currentActiveTab = btn.dataset.tab;
        }
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            if (currentActiveTab === targetTab) return;

            // Guardar el scroll de la pestaña actual antes de cambiar
            if (currentActiveTab) {
                tabScrollPositions.set(currentActiveTab, window.scrollY);
            }

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });

            currentActiveTab = targetTab;

            // Restaurar el scroll de la nueva pestaña
            // requestAnimationFrame ayuda a asegurar que el DOM se haya actualizado y el navegador pueda hacer scroll
            requestAnimationFrame(() => {
                window.scrollTo({
                    top: tabScrollPositions.get(targetTab) || 0,
                    behavior: 'instant'
                });
            });
        });
    });
}

export function updateTelemetry(data) {
    const elems = getDOMElements();
    if (!elems.telemetryOutput) return;

    let output = "Telemetría del Robot:\n";
    if (data.error !== undefined) output += `Error PID: ${data.error.toFixed(2)}\n`;
    if (data.pidTerms) {
        output += `  P: ${data.pidTerms.P?.toFixed(2) ?? 'N/A'}\n`;
        output += `  I: ${data.pidTerms.I?.toFixed(2) ?? 'N/A'}\n`;
        output += `  D: ${data.pidTerms.D?.toFixed(2) ?? 'N/A'}\n`;
    }
    if (data.motorPWMs) {
        output += `PWM Izquierdo: ${data.motorPWMs.leftPWM} (${data.motorPWMs.leftDirForward ? 'Fwd' : 'Rev'})\n`;
        output += `PWM Derecho: ${data.motorPWMs.rightPWM} (${data.motorPWMs.rightDirForward ? 'Fwd' : 'Rev'})\n`;
    }
    if (data.sensorStates) {
        output += `Sensor Izquierdo: ${data.sensorStates.left ? 'OFF' : 'ON'} Linea\n`;
        output += `Sensor Centro: ${data.sensorStates.center ? 'OFF' : 'ON'} Linea\n`;
        output += `Sensor Derecho: ${data.sensorStates.right ? 'OFF' : 'ON'} Linea\n`;
    }
    if (data.simTime !== undefined) output += `Tiempo Sim: ${data.simTime.toFixed(2)}s\n`;
    if (data.outOfBounds) output += `Estado: ¡Robot fuera de pista!\n`;

    elems.telemetryOutput.textContent = output;
}

export function updateLapTimerDisplay(lapData) {
    const elems = getDOMElements();
    if (!elems.lapTimerOutput || !lapData) return;

    const formatTime = (time_ms) => {
        if (time_ms === null || time_ms === Infinity || isNaN(time_ms)) return '--:--:---';
        let ms = Math.floor(time_ms % 1000);
        let secs = Math.floor((time_ms / 1000) % 60);
        let mins = Math.floor(time_ms / (1000 * 60));
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;
    };

    let output = `Vueltas: ${lapData.lapCount}\n`;
    output += `Mejor: ${formatTime(lapData.bestLapTime_ms)}\n`;
    output += `Última: ${formatTime(lapData.lastLapTime_ms)}\n`;
    output += `Actual: ${formatTime(lapData.currentLapTime_ms)}\n\n`;

    // Add lap history
    if (lapData.lapHistory && lapData.lapHistory.length > 0) {
        output += "Últimas 10 vueltas:\n";
        lapData.lapHistory.forEach((lapTime, index) => {
            output += `${index + 1}. ${formatTime(lapTime)}\n`;
        });
    }

    elems.lapTimerOutput.textContent = output;
}

export function updateCodeTypeDisplay(codeType) {
    const elems = getDOMElements();
    if (!elems.currentCodeType) return;

    let displayText = '';
    switch (codeType) {
        case 'onoff':
            displayText = 'Control On/Off';
            break;
        case 'continuous-turn':
            displayText = 'Control Giro Continuo';
            break;
        case 'proportional':
            displayText = 'Control Proporcional';
            break;
        case 'pid':
            displayText = 'Control PID';
            break;
        default:
            displayText = 'Código Personalizado';
    }
    elems.currentCodeType.textContent = displayText;
}

/**
 * Actualiza los textos de ayuda del robot dinámicamente según la configuración
 */
export function updateDynamicCodeHelp(geometry) {
    const elems = getDOMElements();
    if (!elems.codeExplanation || !elems.editorHelp) return;

    const c = geometry.connections;
    const driverType = c.driverType;
    const motorPins = c.motorPins;
    const sensorPins = c.sensorPins;
    const count = geometry.sensorCount;

    // Helper to format pin
    const fmtPin = (p) => (p && p.trim() !== '') ? p : null;

    // Build quick reference list
    let pinsHtml = `<div style="background: rgba(255,255,255,0.5); padding: 8px; border-radius: 4px; border: 1px solid #ddd; margin-bottom: 12px; font-size: 0.9em;">
<b>📌 Referencia Rápida de Pines (En Uso):</b><br>
<ul style="margin: 5px 0 0 20px; padding: 0;">`;

    // Sensors
    if (count >= 5 && fmtPin(sensorPins.farLeft)) pinsHtml += `<li><b>${sensorPins.farLeft}</b>: Sensor Izquierdo (Externo)</li>`;
    if (count >= 2 && fmtPin(sensorPins.left)) pinsHtml += `<li><b>${sensorPins.left}</b>: Sensor Izquierdo</li>`;
    if ((count == 1 || count == 3 || count == 5) && fmtPin(sensorPins.center)) pinsHtml += `<li><b>${sensorPins.center}</b>: Sensor Central</li>`;
    if (count >= 2 && fmtPin(sensorPins.right)) pinsHtml += `<li><b>${sensorPins.right}</b>: Sensor Derecho</li>`;
    if (count >= 5 && fmtPin(sensorPins.farRight)) pinsHtml += `<li><b>${sensorPins.farRight}</b>: Sensor Derecho (Externo)</li>`;

    // Custom Sensors
    if (geometry.customSensors && geometry.customSensors.length > 0) {
        geometry.customSensors.forEach((s, idx) => {
            const pinId = `custom_${idx}`;
            if (fmtPin(sensorPins[pinId])) {
                pinsHtml += `<li><b>${sensorPins[pinId]}</b>: Sensor Custom ${idx + 1}</li>`;
            }
        });
    }

    // Motors
    if (driverType === 'l298n') {
        if (fmtPin(motorPins.leftEn)) pinsHtml += `<li><b>${motorPins.leftEn}</b>: Motor Izq. ENA (PWM)</li>`;
        if (fmtPin(motorPins.leftIn1)) pinsHtml += `<li><b>${motorPins.leftIn1}</b>: Motor Izq. IN1 (Dir)</li>`;
        if (fmtPin(motorPins.leftIn2)) pinsHtml += `<li><b>${motorPins.leftIn2}</b>: Motor Izq. IN2 (Dir)</li>`;
        if (fmtPin(motorPins.rightIn3)) pinsHtml += `<li><b>${motorPins.rightIn3}</b>: Motor Der. IN3 (Dir)</li>`;
        if (fmtPin(motorPins.rightIn4)) pinsHtml += `<li><b>${motorPins.rightIn4}</b>: Motor Der. IN4 (Dir)</li>`;
        if (fmtPin(motorPins.rightEn)) pinsHtml += `<li><b>${motorPins.rightEn}</b>: Motor Der. ENB (PWM)</li>`;
    } else if (driverType === 'mx1616') {
        if (fmtPin(motorPins.leftIn1)) pinsHtml += `<li><b>${motorPins.leftIn1}</b>: Motor Izq. IN1 (PWM)</li>`;
        if (fmtPin(motorPins.leftIn2)) pinsHtml += `<li><b>${motorPins.leftIn2}</b>: Motor Izq. IN2 (PWM)</li>`;
        if (fmtPin(motorPins.rightIn3)) pinsHtml += `<li><b>${motorPins.rightIn3}</b>: Motor Der. IN3 (PWM)</li>`;
        if (fmtPin(motorPins.rightIn4)) pinsHtml += `<li><b>${motorPins.rightIn4}</b>: Motor Der. IN4 (PWM)</li>`;
    } else { // esc
        if (fmtPin(motorPins.leftPWM)) pinsHtml += `<li><b>${motorPins.leftPWM}</b>: Motor Izq. (ESC PWM)</li>`;
        if (fmtPin(motorPins.rightPWM)) pinsHtml += `<li><b>${motorPins.rightPWM}</b>: Motor Der. (ESC PWM)</li>`;
    }

    // Check if empty
    if (pinsHtml.endsWith('<ul style="margin: 5px 0 0 20px; padding: 0;">')) {
        pinsHtml += `<li><i>Ningún pin seleccionado.</i></li>`;
    }
    pinsHtml += `</ul></div>`;

    // --- 1. Guía del Código (code-explanation) ---
    let guideHtml = `<h3>Guía de Configuración</h3><div style='font-family:inherit; white-space:pre-wrap;'>`;
    guideHtml += pinsHtml;

    // Instrucciones del Driver
    if (driverType === 'l298n') {
        guideHtml += `🎮 <b>Para usar el driver L298N:</b>
Debes configurar los pines <b>ENA (${motorPins.leftEn})</b> y <b>ENB (${motorPins.rightEn})</b> como <code>OUTPUT</code> para controlar la <i>velocidad</i> (PWM). Para la <i>dirección</i>, usa los pines <b>IN1 (${motorPins.leftIn1})/IN2 (${motorPins.leftIn2})</b> para el motor izquierdo e <b>IN3 (${motorPins.rightIn3})/IN4 (${motorPins.rightIn4})</b> para el derecho.`;
    } else if (driverType === 'mx1616') {
        guideHtml += `🎮 <b>Para usar el driver MX1616:</b>
Debes usar 4 pines PWM (p.ej. <code>analogWrite</code>). Controla el motor izquierdo con <b>IN1 (${motorPins.leftIn1})</b> e <b>IN2 (${motorPins.leftIn2})</b>, y el motor derecho con <b>IN3 (${motorPins.rightIn3})</b> e <b>IN4 (${motorPins.rightIn4})</b>.`;
    } else {
        guideHtml += `🎮 <b>Para usar ESCs:</b>
Debes conectar el pin <b>IZQ (${motorPins.leftPWM})</b> al motor izquierdo y el pin <b>DER (${motorPins.rightPWM})</b> al motor derecho, ambos configurados como <code>OUTPUT</code> para señales PWM.`;
    }

    guideHtml += `\n\n`;

    // Instrucciones de los Sensores
    if (count == 1) {
        guideHtml += `📡 <b>Para usar 1 sensor:</b>
Debes leer el pin <b>${sensorPins.center}</b> (Centro). Recuerda que <code>HIGH</code> significa que ha detectado la línea negra.`;
    } else if (count == 2) {
        guideHtml += `📡 <b>Para usar 2 sensores:</b>
Debes leer los pines <b>${sensorPins.left}</b> (Izq.) y <b>${sensorPins.right}</b> (Der.). Si el izquierdo detecta <code>HIGH</code>, el robot debe girar a la izquierda.`;
    } else if (count == 3) {
        guideHtml += `📡 <b>Para usar 3 sensores:</b>
Debes leer los pines <b>${sensorPins.left}</b>, <b>${sensorPins.center}</b> y <b>${sensorPins.right}</b>. El sensor central te indica si el robot está centrado en la línea.`;
    } else if (count == 4) {
        guideHtml += `📡 <b>Para usar 4 sensores:</b>
Debes leer desde <b>${sensorPins.farLeft}</b> hasta <b>${sensorPins.farRight}</b>. Los sensores externos son ideales para detectar curvas cerradas.`;
    } else if (count == 5) {
        guideHtml += `📡 <b>Para usar 5 sensores:</b>
Debes leer los 5 pines configurados (desde <b>${sensorPins.farLeft}</b> hasta <b>${sensorPins.farRight}</b>) para un control de precisión máxima sobre la línea.`;
    }

    guideHtml += `\n\n<b>¿Qué puedes probar?</b>
- Cambia la velocidad en <code>analogWrite</code> para ajustar el ritmo.
- Observa cómo reacciona el robot en las curvas según la lectura de los sensores.
</div>`;
    elems.codeExplanation.innerHTML = guideHtml;

    // --- 2. Editor de Código (editor-help) ---
    let sensorsText = "";
    if (count == 1) {
        sensorsText = `<li><b>Robot de 1 Sensor:</b> <code>${sensorPins.center}</code> (Centro)</li>`;
    } else if (count == 2) {
        sensorsText = `<li><b>Robot de 2 Sensores:</b> <code>${sensorPins.left}</code> (Izquierdo) y <code>${sensorPins.right}</code> (Derecho)</li>`;
    } else if (count == 3) {
        sensorsText = `<li><b>Robot de 3 Sensores:</b> <code>${sensorPins.left}</code> (Izq.), <code>${sensorPins.center}</code> (Centro), <code>${sensorPins.right}</code> (Der.)</li>`;
    } else if (count == 4) {
        sensorsText = `<li><b>Robot de 4 Sensores:</b> <code>${sensorPins.farLeft}</code> (Ext. Izq.), <code>${sensorPins.left}</code> (Izq.), <code>${sensorPins.right}</code> (Der.), <code>${sensorPins.farRight}</code> (Ext. Der.)</li>`;
    } else if (count == 5) {
        sensorsText = `<li><b>Robot de 5 Sensores:</b> <code>${sensorPins.farLeft}</code>, <code>${sensorPins.left}</code>, <code>${sensorPins.center}</code>, <code>${sensorPins.right}</code>, <code>${sensorPins.farRight}</code></li>`;
    }

    let motorsText = "";
    if (driverType === 'l298n') {
        motorsText = `<li><b>Motor Izquierdo:</b> <code>${motorPins.leftEn}</code> (PWM), <code>${motorPins.leftIn1}</code>/<code>${motorPins.leftIn2}</code> (DIR)</li>
                      <li><b>Motor Derecho:</b> <code>${motorPins.rightEn}</code> (PWM), <code>${motorPins.rightIn3}</code>/<code>${motorPins.rightIn4}</code> (DIR)</li>`;
    } else if (driverType === 'mx1616') {
        motorsText = `<li><b>Motor Izquierdo:</b> <code>${motorPins.leftIn1}</code> y <code>${motorPins.leftIn2}</code> (PWM)</li>
                      <li><b>Motor Derecho:</b> <code>${motorPins.rightIn3}</code> y <code>${motorPins.rightIn4}</code> (PWM)</li>`;
    } else {
        motorsText = `<li><b>Motor Izquierdo:</b> <code>${motorPins.leftPWM}</code> (PWM)</li>
                      <li><b>Motor Derecho:</b> <code>${motorPins.rightPWM}</code> (PWM)</li>`;
    }

    const sensorPinExample = sensorPins.left || sensorPins.center || '2';

    elems.editorHelp.innerHTML = `
        <div class="space-y-6 text-slate-700 bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-4 font-sans max-w-5xl mx-auto">
            <div class="border-b border-slate-100 pb-4">
                <h2 class="text-2xl font-black text-slate-900 mb-4 flex items-center gap-2"><span class="text-blue-600">👨‍💻</span> Editor de Código</h2>
                <div class="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-5 mb-4">
                    <h3 class="font-bold text-blue-900 text-lg mb-2 flex items-center gap-2">💡 ¿Cómo usar este editor?</h3>
                    <p class="text-blue-800 leading-relaxed text-sm">
                        Escribe tu código en lenguaje C++ (estilo Arduino) y haz click en <b class="bg-blue-100 px-2 py-1 rounded text-blue-900 mx-1 shadow-sm">'Aplicar Código'</b> para compilarlo antes de iniciar la simulación. El <b>Monitor Serial</b> de arriba te avisará si hay errores de sintaxis al tratar de compilar. Si necesitas volver al estado inicial del código, simplemente recarga la página.
                    </p>
                </div>
            </div>

            <div>
                <h3 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">🏗️ Estructura Básica de Arduino</h3>
                <p class="mb-4 text-sm">Todo código válido debe seguir la estructura clásica de un programa de Arduino:</p>
                <ul class="space-y-3 list-none p-0 text-sm">
                    <li class="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                        <b class="text-slate-900 text-base block mb-2">1. Sección Global:</b> 
                        <p class="mb-2">Aquí defines tus variables al inicio del programa. Por ejemplo: <code class="bg-slate-200 px-1 py-0.5 rounded text-pink-600">int velocidad = 150;</code></p>
                        <div class="mt-3 bg-red-50 text-red-700 px-3 py-2 rounded text-sm font-medium border-l-4 border-red-500 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <span class="text-lg">⚠️</span> 
                            <span><b>NOTA:</b> El simulador NO soporta el uso de librerías externas (ej: <code class="bg-red-100 px-1 py-0.5 rounded text-red-800">#include &lt;Servo.h&gt;</code>).</span>
                        </div>
                    </li>
                    <li class="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm leading-relaxed">
                        <b class="text-slate-900 text-base block mb-1 font-mono"><span class="text-blue-600">void</span> setup() { ... }</b> 
                        Se ejecuta <b>una sola vez</b> al iniciar. Úsalo para configurar tus pines usando <code>pinMode()</code> y para iniciar la comunicación serial con <code>Serial.begin(9600)</code>.
                    </li>
                    <li class="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm leading-relaxed">
                        <b class="text-slate-900 text-base block mb-1 font-mono"><span class="text-blue-600">void</span> loop() { ... }</b> 
                        Se ejecuta <b>repetidamente en un ciclo infinito</b>. Aquí debes colocar la lógica principal de tu robot (lectura de sensores y activación de motores).
                    </li>
                    <li class="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm leading-relaxed">
                        <b class="text-slate-900 text-base block mb-1">Funciones Propias:</b> 
                        Puedes crear muchas funciones adicionales libremente debajo del <code>loop()</code> para organizar mejor tu código (por ejemplo: <code>void avanzar()</code> o <code>int leerSensor()</code>).
                    </li>
                </ul>
            </div>

            <div class="border-t border-slate-100 pt-6">
                <h3 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">🧠 Lógica de Control y Variables</h3>
                <p class="mb-4 text-sm">Están soportadas las estructuras nativas de control como <code>if</code>, <code>else if</code>, <code>else</code>, <code>while</code>, y <code>for</code>. Puedes declarar variables tal y como lo harías en un entorno C++ (<code>int</code>, <code>float</code>, <code>unsigned long</code>, <code>bool</code>).</p>
                <div class="bg-slate-900 rounded-lg p-5 overflow-x-auto shadow-inner mb-2 cursor-text">
                    <pre class="text-emerald-400 font-mono text-sm leading-relaxed m-0"><code><span class="text-pink-400">if</span> (digitalRead(${sensorPinExample}) == <span class="text-blue-400">HIGH</span>) {
    <span class="text-slate-500">// El sensor detecta la línea, gira a un lado</span>
}</code></pre>
                </div>
            </div>

            <div class="border-t border-slate-100 pt-6">
                <h3 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">🔌 ¿Cómo referenciar componentes?</h3>
                
                <div class="grid md:grid-cols-2 gap-6 mb-6">
                    <div class="bg-blue-50/50 p-5 rounded-lg border border-blue-100 shadow-sm">
                        <p class="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">📻 Pines de los sensores:</p>
                        <p class="text-sm text-slate-600 mb-4 h-10">Léelos usando <code>digitalRead(pin)</code>, incluso si en el Robot Editor los conectaste a puertos analógicos (A0..).</p>
                        <ul class="list-disc pl-5 space-y-2 text-sm marker:text-blue-500 font-mono bg-white p-3 rounded border border-blue-50">${sensorsText}</ul>
                    </div>

                    <div class="bg-orange-50/50 p-5 rounded-lg border border-orange-100 shadow-sm">
                        <p class="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">⚙️ Pines de los motores:</p>
                        <p class="text-sm text-slate-600 mb-4 h-10">Controlalos siempre con <code>analogWrite()</code> y <code>digitalWrite()</code> según tu driver.</p>
                        <ul class="list-disc pl-5 space-y-2 text-sm marker:text-orange-500 font-mono bg-white p-3 rounded border border-orange-50">${motorsText}</ul>
                    </div>
                </div>

                <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex flex-col md:flex-row gap-4 items-center">
                    <div class="text-3xl">🚫</div>
                    <div>
                        <p class="text-red-900 font-bold mb-1">IMPORTANTE: 'analogRead(pin)' NO está soportado.</p>
                        <p class="text-red-800 text-sm leading-relaxed">Todos los sensores de las pistas virtuales son infrarrojos de tipo digital binario (sólo leen blanco o negro). <b>Usa <code>digitalRead()</code> obligatoriamente.</b></p>
                    </div>
                </div>
            </div>

            <div class="border-t border-slate-100 pt-6">
                <h3 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">📚 Diccionario de Funciones Soportadas</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">pinMode(pin, mode)</code>
                        <span class="text-slate-600 text-xs">Configura un pin como INPUT u OUTPUT.</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">digitalRead(pin)</code>
                        <span class="text-slate-600 text-xs">Retorna 1 (HIGH/Negro) o 0 (LOW/Blanco).</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">digitalWrite(pin, val)</code>
                        <span class="text-slate-600 text-xs">Envía HIGH o LOW (para dirección IN1, IN2).</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">analogWrite(pin, val)</code>
                        <span class="text-slate-600 text-xs">Envía PWM (0-255) para vel de motor.</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">millis() / delay(ms)</code>
                        <span class="text-slate-600 text-xs">Abre tiempos, pausas e integradores matemáticos.</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">Serial.print(val)</code>
                        <span class="text-slate-600 text-xs">Envía variables/texto al Monitor.</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">map(...)</code>
                        <span class="text-slate-600 text-xs">Mapea valores de un rango hacia otro (útil en PID).</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">constrain(val, min, max)</code>
                        <span class="text-slate-600 text-xs">Fuerza a val a mantenerse en el rango de min a max.</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                        <code class="text-blue-700 font-bold block mb-1">abs(x) / min(x) / max()</code>
                        <span class="text-slate-600 text-xs">Matemática directa (Valor absoluto y Límites).</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
