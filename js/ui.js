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
        motorResponseInput: document.getElementById('motorResponse'),
        sensorNoiseInput: document.getElementById('sensorNoise'),
        movementPerturbInput: document.getElementById('movementPerturb'),
        motorDeadbandInput: document.getElementById('motorDeadband'),
        lineThresholdInput: document.getElementById('lineThreshold'),
        applySimParamsButton: document.getElementById('applySimParamsButton'),
        telemetryOutput: document.getElementById('telemetryOutput'),
        lapTimerOutput: document.getElementById('lapTimerOutput'),

        // Code Editor Tab
        codeEditorArea: document.getElementById('codeEditorArea'),
        serialMonitorOutput: document.getElementById('serialMonitorOutput'),
        clearSerialButton: document.getElementById('clearSerialButton'),

        // Robot Editor Tab
        robotPreviewCanvas: document.getElementById('robotPreviewCanvas'),
        robotWidthInput: document.getElementById('robotWidth'),
        sensorOffsetInput: document.getElementById('sensorOffset'),
        sensorSpreadInput: document.getElementById('sensorSpread'),
        sensorDiameterInput: document.getElementById('sensorDiameter'),
        applyRobotGeometryButton: document.getElementById('applyRobotGeometryButton'),
        resetRobotGeometryButton: document.getElementById('resetRobotGeometryButton'),
        robotPartsPalette: document.getElementById('robotPartsPalette'),

        // Track Editor Tab
        trackEditorCanvas: document.getElementById('trackEditorCanvas'),
        trackGridSizeSelect: document.getElementById('trackGridSize'),
        generateRandomTrackButton: document.getElementById('generateRandomTrack'),
        toggleEraseModeButton: document.getElementById('toggleEraseModeButton'),
        trackEditorTrackNameInput: document.getElementById('trackEditorTrackName'),
        saveTrackDesignButton: document.getElementById('saveTrackDesignButton'),
        loadTrackDesignInput: document.getElementById('loadTrackDesignInput'),
        exportTrackToSimulatorButton: document.getElementById('exportTrackToSimulator'),
        trackPartsPalette: document.getElementById('trackPartsPalette'),
        trackEditorControls: document.querySelector('.track-editor-controls')
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
        output += `PWM Izquierdo: ${data.motorPWMs.leftPWM} (${data.motorPWMs.leftDirForward ? 'Fwd':'Rev'})\n`;
        output += `PWM Derecho: ${data.motorPWMs.rightPWM} (${data.motorPWMs.rightDirForward ? 'Fwd':'Rev'})\n`;
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
    
    elems.lapTimerOutput.textContent = 
        `Vueltas: ${lapData.lapCount}\n` +
        `Mejor: ${formatTime(lapData.bestLapTime_ms)}\n` +
        `Última: ${formatTime(lapData.lastLapTime_ms)}\n` +
        `Actual: ${formatTime(lapData.currentLapTime_ms)}`;
}