// js/robotEditor.js
import { getDOMElements } from './ui.js';
import { DEFAULT_ROBOT_GEOMETRY, PIXELS_PER_METER } from './config.js';
import { Robot } from './robot.js'; // To use Robot's drawing logic for preview

let previewCanvas, previewCtx;
let previewRobot; // A Robot instance for previewing
let currentGeometry = { ...DEFAULT_ROBOT_GEOMETRY }; // Local copy of geometry
let mainAppInterface; // To communicate geometry changes

export function initRobotEditor(appInterface) {
    mainAppInterface = appInterface;
    const elems = getDOMElements();
    previewCanvas = elems.robotPreviewCanvas;
    if (!previewCanvas) {
        console.error("Robot Preview Canvas not found!");
        return;
    }
    previewCtx = previewCanvas.getContext('2d');

    // Initialize preview robot with default geometry
    // Scale geometry for preview drawing if needed, or draw 1:1 in meters and scale canvas view
    // For simplicity, we'll draw the robot as if its dimensions are in pixels for the small preview.
    // Or, use a fixed scale for the preview canvas.
    previewRobot = new Robot(previewCanvas.width / 2 / PIXELS_PER_METER, previewCanvas.height / 2 / PIXELS_PER_METER, -Math.PI / 2); // Centered, facing up
    previewRobot.updateGeometry(DEFAULT_ROBOT_GEOMETRY);


    // Load default geometry into input fields
    setFormValues(DEFAULT_ROBOT_GEOMETRY);

    // Event listeners
    elems.applyRobotGeometryButton.addEventListener('click', () => {
        currentGeometry = getFormValues();
        previewRobot.updateGeometry(currentGeometry);
        renderRobotPreview();
        mainAppInterface.updateRobotGeometry(currentGeometry); // Notify main app
        alert("Geometría del robot actualizada y aplicada a la simulación (requiere reinicio de sim).");
    });

    elems.resetRobotGeometryButton.addEventListener('click', () => {
        currentGeometry = { ...DEFAULT_ROBOT_GEOMETRY };
        setFormValues(currentGeometry);
        previewRobot.updateGeometry(currentGeometry);
        renderRobotPreview();
        mainAppInterface.updateRobotGeometry(currentGeometry);
        alert("Geometría del robot restaurada a valores por defecto.");
    });

    // Update preview dynamically as user types (optional, can be intensive)
    const inputs = [elems.robotWidthInput, elems.robotLengthInput, elems.sensorOffsetInput, elems.sensorSpreadInput, elems.sensorDiameterInput];
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            currentGeometry = getFormValues();
            previewRobot.updateGeometry(currentGeometry); // Update preview robot's geometry
            renderRobotPreview(); // Re-render the preview
        });
    });
    
    // Initial render
    mainAppInterface.loadRobotAssets((bodyImg, wheelImg) => {
        previewRobot.setImages(bodyImg, wheelImg);
        renderRobotPreview();
    });
}

function getFormValues() {
    const elems = getDOMElements();
    return {
        width_m: parseFloat(elems.robotWidthInput.value) || DEFAULT_ROBOT_GEOMETRY.width_m,
        length_m: parseFloat(elems.robotLengthInput.value) || DEFAULT_ROBOT_GEOMETRY.length_m,
        sensorOffset_m: parseFloat(elems.sensorOffsetInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorOffset_m,
        sensorSpread_m: parseFloat(elems.sensorSpreadInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorSpread_m,
        sensorDiameter_m: parseFloat(elems.sensorDiameterInput.value) || DEFAULT_ROBOT_GEOMETRY.sensorDiameter_m,
    };
}

function setFormValues(geometry) {
    const elems = getDOMElements();
    elems.robotWidthInput.value = geometry.width_m.toFixed(3);
    elems.robotLengthInput.value = geometry.length_m.toFixed(3);
    elems.sensorOffsetInput.value = geometry.sensorOffset_m.toFixed(3);
    elems.sensorSpreadInput.value = geometry.sensorSpread_m.toFixed(3);
    elems.sensorDiameterInput.value = geometry.sensorDiameter_m.toFixed(3);
}

function renderRobotPreview() {
    if (!previewCtx || !previewRobot) return;

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.save();

    // Center the robot in the preview canvas.
    // The robot's draw method uses PIXELS_PER_METER, so we need to scale.
    // Let's make the preview canvas represent a fixed area, e.g., 0.3m x 0.3m.
    const previewArea_m = 0.3; 
    const scale = Math.min(previewCanvas.width, previewCanvas.height) / previewArea_m; // pixels per meter for preview

    // Temporarily override PIXELS_PER_METER for this drawing context for Robot.draw()
    // This is a bit hacky. A better Robot.draw() would take scale as a parameter.
    // For now, we adjust the robot's own position to be in the center of its "world" (the preview canvas)
    // and rely on its internal PIXELS_PER_METER for drawing its parts relative to its center.
    
    // To draw the robot, we can scale the context.
    previewCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2); // Move origin to canvas center
    previewCtx.scale(scale, scale); // Scale everything drawn from now on

    // The robot's internal x_m, y_m should be 0 for centered drawing after translation
    const tempX = previewRobot.x_m;
    const tempY = previewRobot.y_m;
    const tempAngle = previewRobot.angle_rad;

    previewRobot.x_m = 0;
    previewRobot.y_m = 0;
    previewRobot.angle_rad = -Math.PI / 2; // Face "up" in the preview

    // The Robot.draw method uses its own PIXELS_PER_METER for drawing.
    // We need to ensure its internal PIXELS_PER_METER is effectively 1 for the pre-scaled context,
    // or that its draw method is scale-aware.
    // The easiest way: Robot.draw() uses PIXELS_PER_METER. Our context is already scaled.
    // So, when Robot.draw calls `this.x_m * PIXELS_PER_METER`, if x_m is 0, it's fine.
    // But for `this.length_m * PIXELS_PER_METER`, this will be scaled again.
    // This needs careful thought.

    // Let's assume Robot.draw() is not changed. It uses global PIXELS_PER_METER.
    // We want to show the robot as if it's in a world where PIXELS_PER_METER applies.
    // So, we don't scale the context by `scale`. Instead, we draw the robot at its actual size
    // (using its m values * PIXELS_PER_METER) and just ensure it's centered.
    previewCtx.restore(); // Clean slate
    previewCtx.save();
    
    // Draw robot centered. Robot's internal draw uses PIXELS_PER_METER.
    // The preview canvas is small (e.g. 300x300px).
    // We need to draw the robot as if these 300px represent its actual size in mm.
    // So, if robot is 0.1m (100mm) wide, it should take 100px on canvas.
    // This means PIXELS_PER_METER is implicitly used by Robot.draw().

    // Center the robot for drawing.
    // Robot's (0,0) is its axle center. Preview Robot is already at world center.
    // Adjust previewRobot position for drawing to be center of preview canvas
    previewRobot.x_m = (previewCanvas.width / 2) / PIXELS_PER_METER;
    previewRobot.y_m = (previewCanvas.height / 2) / PIXELS_PER_METER;
    previewRobot.angle_rad = -Math.PI/2; // Pointing upwards

    previewRobot.draw(previewCtx, previewRobot.sensors); // Pass current sensor state for visual consistency

    // Restore robot's original position if it was changed for drawing
    previewRobot.x_m = tempX;
    previewRobot.y_m = tempY;
    previewRobot.angle_rad = tempAngle;

    // Draw axes or scale reference
    previewCtx.strokeStyle = "#aaa";
    previewCtx.lineWidth = 0.5;
    previewCtx.beginPath();
    previewCtx.moveTo(previewCanvas.width / 2, 0); previewCtx.lineTo(previewCanvas.width / 2, previewCanvas.height);
    previewCtx.moveTo(0, previewCanvas.height / 2); previewCtx.lineTo(previewCanvas.width, previewCanvas.height / 2);
    previewCtx.stroke();

    // Scale legend (e.g., 5cm line)
    const legendLength_m = 0.05; // 5 cm
    const legendLength_px = legendLength_m * PIXELS_PER_METER;
    previewCtx.fillStyle = "black";
    previewCtx.fillRect(10, previewCanvas.height - 20, legendLength_px, 2);
    previewCtx.font = "10px Arial";
    previewCtx.fillText(`${legendLength_m*100} cm`, 10, previewCanvas.height - 25);

    previewCtx.restore();
}

export function getCurrentRobotGeometry() {
    return { ...currentGeometry };
}