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
        currentCodeType: document.getElementById('currentCodeType'),
        codeExplanation: document.querySelector('.code-explanation'),
        editorHelp: document.querySelector('.editor-help'),
        serialMonitorOutput: document.getElementById('serialMonitorOutput'),
        clearSerialButton: document.getElementById('clearSerialButton'),

        // Robot Editor Tab
        robotPreviewCanvas: document.getElementById('robotPreviewCanvas'),
        robotWidthInput: document.getElementById('robotWidth'),
        sensorOffsetInput: document.getElementById('sensorOffset'),
        sensorSpreadInput: document.getElementById('sensorSpread'),
        sensorDiameterInput: document.getElementById('sensorDiameter'),
        sensorCountSelect: document.getElementById('sensorCount'),
        applyRobotGeometryButton: document.getElementById('applyRobotGeometryButton'),
        resetRobotGeometryButton: document.getElementById('resetRobotGeometryButton'),
        robotPartsPalette: document.getElementById('robotPartsPalette'),
        saveRobotButton: document.getElementById('saveRobotButton'),
        loadRobotInput: document.getElementById('loadRobotInput'),
        robotSelectionDropdown: document.getElementById('robotSelectionDropdown'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        zoomResetBtn: document.getElementById('zoomResetBtn'),

        // Pin Connections UI
        sensorConnectionsContainer: document.getElementById('sensorConnectionsContainer'),
        pinSensorFarLeftInput: document.getElementById('pinSensorFarLeft'),
        pinSensorLeftInput: document.getElementById('pinSensorLeft'),
        pinSensorCenterInput: document.getElementById('pinSensorCenter'),
        pinSensorRightInput: document.getElementById('pinSensorRight'),
        pinSensorFarRightInput: document.getElementById('pinSensorFarRight'),
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

export function setupTabs() {
    const { tabButtons, tabContents } = getDOMElements();
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
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

    // --- 1. Guía del Código (code-explanation) ---
    let guideHtml = `<h3>Guía del Código</h3><div style='font-family:inherit; white-space:pre-wrap;'>`;
    if (driverType === 'l298n') {
        guideHtml += `🌟 <b>Código Seguidor de Línea (L298N)</b>

Este código utiliza los 6 pines para controlar un puente H L298N. Los pines <b>ENA (${motorPins.leftEn})</b> y <b>ENB (${motorPins.rightEn})</b> definen la <i>velocidad</i> (PWM), mientras que los pines <b>IN1 (${motorPins.leftIn1}) / IN2 (${motorPins.leftIn2})</b> e <b>IN3 (${motorPins.rightIn3}) / IN4 (${motorPins.rightIn4})</b> definen la <i>dirección</i>.`;
    } else if (driverType === 'mx1616') {
        guideHtml += `🌟 <b>Código Seguidor de Línea (MX1616)</b>

Este driver utiliza 4 pines PWM para controlar dos motores. Los pines <b>IN1 (${motorPins.leftIn1}) / IN2 (${motorPins.leftIn2})</b> controlan el motor izquierdo, y los pines <b>IN3 (${motorPins.rightIn3}) / IN4 (${motorPins.rightIn4})</b> el motor derecho. La velocidad se calcula como la diferencia entre ambos pines.`;
    } else {
        guideHtml += `🌟 <b>Código Seguidor de Línea (ESCs)</b>

Configuración simplificada usando 1 pin PWM por motor. El pin <b>IZQ (${motorPins.leftPWM})</b> controla el motor izquierdo y el pin <b>DER (${motorPins.rightPWM})</b> el motor derecho.`;
    }

    guideHtml += `

<b>¿Qué puedes probar?</b>
- Cambia el valor de velocidad en <code>analogWrite</code> para ajustar el ritmo del robot.
- Prueba diferentes pistas y observa cómo reacciona en las curvas.
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
        <h2>Editor de Código</h2>
        <h3>¿Cómo usar este editor?</h3>
        <p>Escribe tu código estilo Arduino y haz click en 'Aplicar Código'. Si te equivocas, puedes reiniciar la página.</p>

        <h3>¿Cómo referenciar componentes?</h3>
        <p>Los <b>pines de los sensores</b> (usando <code>digitalRead(pin)</code>):</p>
        <ul>${sensorsText}</ul>

        <p>Los <b>pines de los motores</b> (usando <code>analogWrite(pin, valor)</code>):</p>
        <ul>${motorsText}</ul>

        <h3>Funciones Soportadas (Translator Arduino C++):</h3>
        <ul>
            <li><code>setup()</code> y <code>loop()</code>: Funciones principales obligatorias.</li>
            <li><code>pinMode(pin, mode)</code>: Configura como <code>INPUT</code> o <code>OUTPUT</code>.</li>
            <li><code>digitalRead(pin)</code>: Retorna <b>1 (HIGH)</b> en línea negra, <b>0 (LOW)</b> fuera.</li>
            <li><code>digitalWrite(pin, val)</code>: Para encender/apagar motores o LEDs.</li>
            <li><code>analogWrite(pin, val)</code>: Control de velocidad PWM (0-255).</li>
            <li><code>delay(ms)</code>: Pausa la ejecución (con <code>await</code> interno automático).</li>
            <li><code>Serial.print()</code> / <code>println()</code>: Depuración en el Monitor Serial.</li>
            <li><code>constrain(val, min, max)</code>: Limita un valor a un rango.</li>
        </ul>
        <p style="color: #d9534f; font-weight: bold; background: #fdf2f2; padding: 0.5em; border-radius: 4px;">
            ⚠️ NOTA: analogRead(pin) NO está soportado en esta versión del simulador. Usa digitalRead() para sensores IR.
        </p>

        <h3>Lógica de Control:</h3>
        <p>Usa <code>if</code>, <code>else if</code>, <code>while</code>, <code>for</code>. Operadores: <code>==</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&amp;&amp;</code>, <code>||</code>. Ejemplo:</p>
        <pre style="background:#eee; padding:0.5em; border-radius:4px;">if (digitalRead(${sensorPinExample}) == HIGH) {
  // Gira a la izquierda
}</pre>
        <p>Declara variables con tipos de C++ (<code>int</code>, <code>float</code>, <code>unsigned long</code>).</p>
    `;
}