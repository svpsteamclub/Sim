// js/simulation.js (Simulation Engine)
import { Robot } from './robot.js';
// PIDController is not used here if PID is in user code.
// import { PIDController } from './pidController.js';
import { Track } from './track.js';
import { PIXELS_PER_METER, DEFAULT_ROBOT_GEOMETRY } from './config.js';
import { LapTimer } from './lapTimer.js';

export class Simulation {
    constructor(robotImages, watermarkImage, initialGeometry = DEFAULT_ROBOT_GEOMETRY) {
        this.robot = new Robot(0, 0, 0, initialGeometry); // Initial position set by loadTrack
        if (robotImages) this.robot.setImages(robotImages.wheel);
        
        this.track = new Track();
        if (watermarkImage) this.track.setWatermark(watermarkImage);
        
        this.lapTimer = new LapTimer(this.robot.wheelbase_m, this.robot.length_m);

        this.params = {
            timeStep: 0.02, // Corresponds to user code delay(20) for ~50 FPS
            maxRobotSpeedMPS: 0.5, // Max physical speed robot can achieve at 255 PWM
            motorEfficiency: 0.85, // Factor reducing max speed
            motorResponseFactor: 0.1, // How quickly motors reach target speed (0-1, higher is faster)
            sensorNoiseProb: 0.0, // Probability (0-1) of a sensor flipping its reading
            movementPerturbFactor: 0.0, // Random perturbation to movement (0-1)
            motorDeadbandPWM: 10, // PWM values below this (absolute) are treated as 0
            lineThreshold: 100, // For track's isPixelOnLine
        };
        this.totalSimTime_s = 0;
        this.isOutOfTrack = false;
    }

    // Update simulation parameters (from UI)
    updateParameters(newParams) {
        if (newParams.robotGeometry) {
            this.robot.updateGeometry(newParams.robotGeometry);
            // LapTimer might need update if robot dimensions change significantly for start line
            this.lapTimer.robotWidth_m = this.robot.wheelbase_m;
            this.lapTimer.robotLength_m = this.robot.length_m;
        }
        this.params.timeStep = newParams.timeStep ?? this.params.timeStep;
        this.params.maxRobotSpeedMPS = newParams.maxRobotSpeedMPS ?? this.params.maxRobotSpeedMPS;
        this.params.motorEfficiency = newParams.motorEfficiency ?? this.params.motorEfficiency;
        this.params.motorResponseFactor = newParams.motorResponseFactor ?? this.params.motorResponseFactor;
        this.params.sensorNoiseProb = newParams.sensorNoiseProb ?? this.params.sensorNoiseProb;
        this.params.movementPerturbFactor = newParams.movementPerturbFactor ?? this.params.movementPerturbFactor;
        this.params.motorDeadbandPWM = newParams.motorDeadbandPWM ?? this.params.motorDeadbandPWM;
        this.params.lineThreshold = newParams.lineThreshold ?? this.params.lineThreshold;
        
        this.track.lineThreshold = this.params.lineThreshold; // Update track's threshold
    }

    // Load a track (from file or editor canvas)
    loadTrack(source, startX_m, startY_m, startAngle_rad, callback) {
        // The track's width/height in pixels will be set by the loaded image.
        // The simulation canvas should ideally match these dimensions for 1:1 pixel mapping.
        this.track.load(source, null, null, this.params.lineThreshold, (success, trackWidthPx, trackHeightPx) => {
            if (success) {
                // If the source is a canvas with start position data, use that
                if (source instanceof HTMLCanvasElement && source.dataset.startX) {
                    startX_m = parseFloat(source.dataset.startX);
                    startY_m = parseFloat(source.dataset.startY);
                    startAngle_rad = parseFloat(source.dataset.startAngle);
                }
                this.resetSimulationState(startX_m, startY_m, startAngle_rad);
                // Initialize lap timer with the new start pose relative to the loaded track
                this.lapTimer.initialize({ x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }, this.totalSimTime_s);
                
                // Notify track editor if the track was loaded from a source other than the editor
                if (source instanceof HTMLCanvasElement && !source.dataset.fromEditor) {
                    // Create a copy of the canvas to send to the editor
                    const trackCanvas = document.createElement('canvas');
                    trackCanvas.width = trackWidthPx;
                    trackCanvas.height = trackHeightPx;
                    const ctx = trackCanvas.getContext('2d');
                    ctx.drawImage(source, 0, 0);
                    trackCanvas.dataset.fromEditor = 'true';
                    
                    // Notify the track editor through the main app interface
                    if (window.mainAppInterface) {
                        window.mainAppInterface.loadTrackToEditor(trackCanvas);
                    }
                }
            }
            if (callback) callback(success, trackWidthPx, trackHeightPx);
        }, source instanceof HTMLCanvasElement, source instanceof File ? source.name : "track_url");
    }
    
    resetSimulationState(startX_m, startY_m, startAngle_rad, newGeometry = null) {
        if (newGeometry) this.robot.updateGeometry(newGeometry);
        this.robot.resetState(startX_m, startY_m, startAngle_rad);
        this.totalSimTime_s = 0;
        this.isOutOfTrack = false;
        this.lapTimer.reset(); // Reset lap data, but don't re-initialize line until new track/start
        if (this.track.imageData) { // Re-initialize if track already loaded
             this.lapTimer.initialize({ x_m: startX_m, y_m: startY_m, angle_rad: startAngle_rad }, this.totalSimTime_s);
        }
    }

    // This is the main step function called by the simulation loop in main.js
    // It takes PWM values from the user's code.
    simulationStep(userLeftPWM, userRightPWM) {
        if (!this.track.imageData) {
            return { error: "No track loaded." }; // Early exit if no track
        }

        // 1. Update robot's internal sensor readings based on its current position and track
        this._updateRobotSensors();

        // (User code runs here, via main.js, and sets robot.motorPWMSpeeds)
        // For this method, userLeftPWM and userRightPWM are passed in.

        // 2. Calculate target motor speeds from PWMs
        let leftPWM = userLeftPWM;
        let rightPWM = userRightPWM;

        // Apply deadband (user code's constrain should handle 0-255, but good to be safe)
        leftPWM = (Math.abs(leftPWM) < this.params.motorDeadbandPWM && leftPWM !==0) ? 0 : leftPWM;
        rightPWM = (Math.abs(rightPWM) < this.params.motorDeadbandPWM && rightPWM !==0) ? 0 : rightPWM;

        const effectiveMaxSpeed = this.params.maxRobotSpeedMPS * this.params.motorEfficiency;
        let target_vL_mps = (leftPWM / 255.0) * effectiveMaxSpeed;
        let target_vR_mps = (rightPWM / 255.0) * effectiveMaxSpeed;
        
        // 3. Update robot physics (movement)
        this.robot.updateMovement(
            this.params.timeStep, 
            target_vL_mps, 
            target_vR_mps, 
            this.params.motorResponseFactor,
            effectiveMaxSpeed, // Max physical speed used for clamping inside updateMovement
            this.params.movementPerturbFactor
        );

        // 4. Update total simulation time and lap timer
        this.totalSimTime_s += this.params.timeStep;
        const lapUpdate = this.lapTimer.update(this.totalSimTime_s, { x_m: this.robot.x_m, y_m: this.robot.y_m, angle_rad: this.robot.angle_rad });

        // 5. Check if robot is out of track boundaries
        // A simple boundary check. More sophisticated would be checking if far from any line.
        const boundaryMargin_m = Math.max(this.robot.length_m, this.robot.wheelbase_m); // Generous margin
        this.isOutOfTrack = (
             this.robot.x_m < -boundaryMargin_m || 
             this.robot.x_m * PIXELS_PER_METER > this.track.width_px + boundaryMargin_m * PIXELS_PER_METER ||
             this.robot.y_m < -boundaryMargin_m ||
             this.robot.y_m * PIXELS_PER_METER > this.track.height_px + boundaryMargin_m * PIXELS_PER_METER
        );
        
        // 6. Return data for UI update
        return {
            sensorStates: { ...this.robot.sensors }, // Current sensor readings (0=online, 1=offline)
            motorPWMsFromUser: { leftPWM: userLeftPWM, rightPWM: userRightPWM }, // PWMs from user code
            actualMotorSpeeds: { left_mps: this.robot.currentApplied_vL_mps, right_mps: this.robot.currentApplied_vR_mps },
            lapData: this.lapTimer.getDisplayData(),
            newLapCompleted: lapUpdate.newLapCompleted,
            completedLapTime: lapUpdate.completedLapTime,
            simTime_s: this.totalSimTime_s,
            outOfBounds: this.isOutOfTrack
        };
    }

    _updateRobotSensors() {
        if (!this.track.imageData) {
            this.robot.sensors = { left: 1, center: 1, right: 1 }; // All off line if no track
            return;
        }

        const sensorPositions_m = this.robot.getSensorPositions_world_m();
        
        // Convert world meter positions to track image pixel positions
        const sL_pos_track_px = { x: sensorPositions_m.left.x_m * PIXELS_PER_METER, y: sensorPositions_m.left.y_m * PIXELS_PER_METER };
        const sC_pos_track_px = { x: sensorPositions_m.center.x_m * PIXELS_PER_METER, y: sensorPositions_m.center.y_m * PIXELS_PER_METER };
        const sR_pos_track_px = { x: sensorPositions_m.right.x_m * PIXELS_PER_METER, y: sensorPositions_m.right.y_m * PIXELS_PER_METER };

        let sL_onLine = this.track.isPixelOnLine(sL_pos_track_px.x, sL_pos_track_px.y);
        let sC_onLine = this.track.isPixelOnLine(sC_pos_track_px.x, sC_pos_track_px.y);
        let sR_onLine = this.track.isPixelOnLine(sR_pos_track_px.x, sR_pos_track_px.y);

        // Apply sensor noise if enabled
        if (this.params.sensorNoiseProb > 0) {
            if (Math.random() < this.params.sensorNoiseProb) sL_onLine = !sL_onLine;
            if (Math.random() < this.params.sensorNoiseProb) sC_onLine = !sC_onLine;
            if (Math.random() < this.params.sensorNoiseProb) sR_onLine = !sR_onLine;
        }
        
        // Update robot's internal sensor state (0 = on line, 1 = off line for user code)
        this.robot.sensors.left = sL_onLine ? 0 : 1;
        this.robot.sensors.center = sC_onLine ? 0 : 1;
        this.robot.sensors.right = sR_onLine ? 0 : 1;
    }

    // Draw the current state of the simulation
    draw(displayCtx, displayCanvasWidth, displayCanvasHeight) {
        if (!displayCtx) return;

        // Clear canvas handled by track.draw usually
        // displayCtx.clearRect(0, 0, displayCanvasWidth, displayCanvasHeight);
        
        if (this.track) {
            this.track.draw(displayCtx, displayCanvasWidth, displayCanvasHeight);
        }
        
        if (this.robot && this.track && this.track.imageData) { // Only draw robot if track is loaded
            // Pass current sensor states (0=online, 1=offline) for visual drawing (lime/gray)
            const displaySensorStates = {
                left: this.robot.sensors.left === 1, // true if off line for drawing
                center: this.robot.sensors.center === 1,
                right: this.robot.sensors.right === 1
            };
            this.robot.draw(displayCtx, displaySensorStates);
        }

        // Draw Lap Timer Start/Finish Line (optional for debugging)
        if (this.lapTimer.isActive && this.lapTimer.startLine.x1 !== undefined) {
            displayCtx.save();
            displayCtx.strokeStyle = "rgba(0, 255, 255, 0.7)";
            displayCtx.lineWidth = 3;
            displayCtx.beginPath();
            displayCtx.moveTo(this.lapTimer.startLine.x1 * PIXELS_PER_METER, this.lapTimer.startLine.y1 * PIXELS_PER_METER);
            displayCtx.lineTo(this.lapTimer.startLine.x2 * PIXELS_PER_METER, this.lapTimer.startLine.y2 * PIXELS_PER_METER);
            displayCtx.stroke();
            displayCtx.restore();
        }
    }

    // Utility to get current robot geometry
    getCurrentRobotGeometry() {
        return {
            width_m: this.robot.wheelbase_m,
            length_m: this.robot.length_m,
            sensorOffset_m: this.robot.sensorForwardProtrusion_m,
            sensorSpread_m: this.robot.sensorSideSpread_m,
            sensorDiameter_m: this.robot.sensorDiameter_m,
        };
    }
}