// js/robot.js
import { PIXELS_PER_METER, WHEEL_LENGTH_M, WHEEL_WIDTH_M, DEFAULT_ROBOT_GEOMETRY } from './config.js';
import { clamp } from './utils.js';

export class Robot {
    constructor(initialX_m = 0.1, initialY_m = 0.1, initialAngle_rad = 0, geometry = DEFAULT_ROBOT_GEOMETRY) {
        this.x_m = initialX_m;
        this.y_m = initialY_m;
        this.angle_rad = initialAngle_rad; // Angle in radians, 0 is along positive X-axis

        // Default to 3 sensors if not specified
        const sensorCount = geometry && geometry.sensorCount ? geometry.sensorCount : 3;
        this.sensorCount = sensorCount;
        this.sensors = {};
        this._initSensorState();
        // Motor speeds as PWM values (0-255), set by user's analogWrite
        this.motorPWMSpeeds = {
            left: 0,
            right: 0
        };

        this.updateGeometry(geometry, false); // false to skip trail reset if called from constructor

        this.currentApplied_vL_mps = 0; // Actual speed of left wheel
        this.currentApplied_vR_mps = 0; // Actual speed of right wheel

        this.centerTrail = [];
        this.leftWheelTrail = [];
        this.rightWheelTrail = [];
        this.maxTrailLength = 300; // Shorter trail for performance

        this.wheelImage = null;
        this.decorativeParts = []; // Array to store decorative parts
    }

    _initSensorState() {
        // Always use keys: left, center, right, farLeft, farRight (for up to 5 sensors)
        // For 2 sensors: left, right
        // For 3 sensors: left, center, right
        // For 4 sensors: farLeft, left, right, farRight
        // For 5 sensors: farLeft, left, center, right, farRight
        this.sensors = {};
        if (this.sensorCount === 2) {
            this.sensors.left = 1;
            this.sensors.right = 1;
        } else if (this.sensorCount === 3) {
            this.sensors.left = 1;
            this.sensors.center = 1;
            this.sensors.right = 1;
        } else if (this.sensorCount === 4) {
            this.sensors.farLeft = 1;
            this.sensors.left = 1;
            this.sensors.right = 1;
            this.sensors.farRight = 1;
        } else if (this.sensorCount === 5) {
            this.sensors.farLeft = 1;
            this.sensors.left = 1;
            this.sensors.center = 1;
            this.sensors.right = 1;
            this.sensors.farRight = 1;
        }
    }

    setImages(wheelImg) {
        this.wheelImage = wheelImg;
    }

    setDecorativeParts(parts) {
        this.decorativeParts = parts;
    }
    
    updateGeometry(geometry, resetTrails = true) {
        if (!geometry) return;

        this.wheelbase_m = geometry.width_m;
        this.length_m = geometry.length_m || 0.15; // Use provided length or default to 0.15m
        this.sensorForwardProtrusion_m = geometry.sensorOffset_m;
        this.sensorSideSpread_m = geometry.sensorSpread_m;
        this.sensorDiameter_m = geometry.sensorDiameter_m;
        this.sensorCount = geometry.sensorCount || 3;
        this._initSensorState();
        
        if (resetTrails) this.resetTrails();
    }

    resetState(x_m, y_m, angle_rad, geometry = null) {
        this.x_m = x_m;
        this.y_m = y_m;
        this.angle_rad = angle_rad;
        if (geometry) this.updateGeometry(geometry);

        this.currentApplied_vL_mps = 0;
        this.currentApplied_vR_mps = 0;
        this.motorPWMSpeeds = { left: 0, right: 0 };
        this._initSensorState();
        this.resetTrails();
    }

    resetTrails() {
        this.centerTrail = [];
        this.leftWheelTrail = [];
        this.rightWheelTrail = [];
    }

    // Called by the simulation loop AFTER user code has run and set motorPWMSpeeds
    updateMovement(dt_s, target_vL_mps, target_vR_mps, motorResponseFactor, maxPhysicalSpeed_mps, movementPerturbationFactor) {
        // Apply motor response (inertia)
        this.currentApplied_vL_mps += (target_vL_mps - this.currentApplied_vL_mps) * motorResponseFactor;
        this.currentApplied_vR_mps += (target_vR_mps - this.currentApplied_vR_mps) * motorResponseFactor;

        this.currentApplied_vL_mps = clamp(this.currentApplied_vL_mps, -maxPhysicalSpeed_mps, maxPhysicalSpeed_mps);
        this.currentApplied_vR_mps = clamp(this.currentApplied_vR_mps, -maxPhysicalSpeed_mps, maxPhysicalSpeed_mps);

        let linear_displacement_m = (this.currentApplied_vR_mps + this.currentApplied_vL_mps) / 2.0 * dt_s;
        let d_theta_rad = 0;
        if (this.wheelbase_m > 0.001) { // Avoid division by zero if wheelbase is tiny
             // Positive d_theta_rad for counter-clockwise rotation.
             // If vR > vL, robot turns left (CCW).
            d_theta_rad = (this.currentApplied_vR_mps - this.currentApplied_vL_mps) / this.wheelbase_m * dt_s;
        }
        
        if (movementPerturbationFactor > 0) {
            const perturbR = (Math.random() * 2 - 1) * movementPerturbationFactor;
            const perturbL = (Math.random() * 2 - 1) * movementPerturbationFactor;
            linear_displacement_m *= (1 + perturbR);
            d_theta_rad *= (1 + perturbL);
        }

        this.x_m += linear_displacement_m * Math.cos(this.angle_rad);
        this.y_m += linear_displacement_m * Math.sin(this.angle_rad);
        this.angle_rad += d_theta_rad;
        this.angle_rad = Math.atan2(Math.sin(this.angle_rad), Math.cos(this.angle_rad)); // Normalize angle to [-PI, PI]

        this._updateTrails();
    }

    _updateTrails() {
        this.centerTrail.push({ x_m: this.x_m, y_m: this.y_m });
        if (this.centerTrail.length > this.maxTrailLength) this.centerTrail.shift();

        const halfWheelbase_m = this.wheelbase_m / 2;
        const sinAngle = Math.sin(this.angle_rad);
        const cosAngle = Math.cos(this.angle_rad);

        // Left wheel trail (robot's left)
        const x_lw_m = this.x_m + halfWheelbase_m * Math.sin(this.angle_rad); // sin for y offset in robot frame
        const y_lw_m = this.y_m - halfWheelbase_m * Math.cos(this.angle_rad); // -cos for x offset in robot frame
        this.leftWheelTrail.push({ x_m: x_lw_m, y_m: y_lw_m });
        if (this.leftWheelTrail.length > this.maxTrailLength) this.leftWheelTrail.shift();

        // Right wheel trail (robot's right)
        const x_rw_m = this.x_m - halfWheelbase_m * Math.sin(this.angle_rad);
        const y_rw_m = this.y_m + halfWheelbase_m * Math.cos(this.angle_rad);
        this.rightWheelTrail.push({ x_m: x_rw_m, y_m: y_rw_m });
        if (this.rightWheelTrail.length > this.maxTrailLength) this.rightWheelTrail.shift();
    }

    // Gets sensor positions in meters, relative to robot's origin (center of axle line) and orientation
    // Returns an object with keys matching this.sensors
    getSensorPositions_world_m() {
        const count = this.sensorCount || 3;
        const offset = this.sensorForwardProtrusion_m;
        const spread = this.sensorSideSpread_m;
        const cosA = Math.cos(this.angle_rad);
        const sinA = Math.sin(this.angle_rad);
        // Positions along the y axis (robot local frame)
        let positions = {};
        if (count === 2) {
            // left/right only
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.left = {
                x_m: x - ySpread * sinA,
                y_m: y + ySpread * cosA
            };
            positions.right = {
                x_m: x + ySpread * sinA,
                y_m: y - ySpread * cosA
            };
        } else if (count === 3) {
            // left, center, right
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.left = {
                x_m: x - ySpread * sinA,
                y_m: y + ySpread * cosA
            };
            positions.center = { x_m: x, y_m: y };
            positions.right = {
                x_m: x + ySpread * sinA,
                y_m: y - ySpread * cosA
            };
        } else if (count === 4) {
            // farLeft, left, right, farRight
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.farLeft = {
                x_m: x - 1.5 * ySpread * sinA,
                y_m: y + 1.5 * ySpread * cosA
            };
            positions.left = {
                x_m: x - 0.5 * ySpread * sinA,
                y_m: y + 0.5 * ySpread * cosA
            };
            positions.right = {
                x_m: x + 0.5 * ySpread * sinA,
                y_m: y - 0.5 * ySpread * cosA
            };
            positions.farRight = {
                x_m: x + 1.5 * ySpread * sinA,
                y_m: y - 1.5 * ySpread * cosA
            };
        } else if (count === 5) {
            // farLeft, left, center, right, farRight
            const ySpread = spread;
            const x = this.x_m + offset * cosA;
            const y = this.y_m + offset * sinA;
            positions.farLeft = {
                x_m: x - 2 * ySpread * sinA,
                y_m: y + 2 * ySpread * cosA
            };
            positions.left = {
                x_m: x - ySpread * sinA,
                y_m: y + ySpread * cosA
            };
            positions.center = { x_m: x, y_m: y };
            positions.right = {
                x_m: x + ySpread * sinA,
                y_m: y - ySpread * cosA
            };
            positions.farRight = {
                x_m: x + 2 * ySpread * sinA,
                y_m: y - 2 * ySpread * cosA
            };
        }
        return positions;
    }

    draw(ctx, displaySensorStates = null) {
        ctx.save();
        ctx.translate(this.x_m * PIXELS_PER_METER, this.y_m * PIXELS_PER_METER);
        ctx.rotate(this.angle_rad);

        // Draw Wheels
        const wheelLengthPx = WHEEL_LENGTH_M * PIXELS_PER_METER;
        const wheelWidthPx = WHEEL_WIDTH_M * PIXELS_PER_METER;
        const wheelYOffsetPx = this.wheelbase_m / 2 * PIXELS_PER_METER;

        if (this.wheelImage && this.wheelImage.complete && this.wheelImage.naturalWidth > 0) {
            // Left wheel
            ctx.drawImage(this.wheelImage, -wheelLengthPx / 2, wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
            // Right wheel
            ctx.drawImage(this.wheelImage, -wheelLengthPx / 2, -wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
        } else {
            ctx.fillStyle = 'rgba(80, 80, 80, 0.9)';
            ctx.fillRect(-wheelLengthPx / 2, wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
            ctx.fillRect(-wheelLengthPx / 2, -wheelYOffsetPx - wheelWidthPx / 2, wheelLengthPx, wheelWidthPx);
        }
            
        // Draw direction indicator
        ctx.fillStyle = 'rgba(173, 216, 230, 0.9)';
        ctx.beginPath();
        const indicatorTipX = wheelLengthPx / 2;
        const indicatorBaseX = wheelLengthPx / 2 - Math.min(10, wheelLengthPx * 0.2);
        const indicatorBaseSpread = wheelWidthPx / 3;
        ctx.moveTo(indicatorTipX, 0);
        ctx.lineTo(indicatorBaseX, -indicatorBaseSpread / 2);
        ctx.lineTo(indicatorBaseX, indicatorBaseSpread / 2);
        ctx.closePath();
        ctx.fill();

        // Draw decorative parts
        if (this.decorativeParts && this.decorativeParts.length > 0) {
            this.decorativeParts.forEach(part => {
                if (part.img && part.img.complete && part.img.naturalWidth > 0) {
                    const x = part.x * PIXELS_PER_METER;
                    const y = part.y * PIXELS_PER_METER;
                    const sizeW = part.img.width;
                    const sizeH = part.img.height;
                    ctx.save();
                    // Always fully opaque
                    ctx.translate(x, y);
                    ctx.rotate(part.rotation || 0); // Apply the part's rotation
                    ctx.drawImage(part.img, -sizeW/2, -sizeH/2, sizeW, sizeH);
                    ctx.restore();
                }
            });
        }

        ctx.restore();

        // Draw Trails
        const drawTrail = (trail, color, lineWidth) => {
            if (trail.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.moveTo(trail[0].x_m * PIXELS_PER_METER, trail[0].y_m * PIXELS_PER_METER);
                for (let i = 1; i < trail.length; i++) {
                    ctx.lineTo(trail[i].x_m * PIXELS_PER_METER, trail[i].y_m * PIXELS_PER_METER);
                }
                ctx.stroke();
            }
        };
        drawTrail(this.centerTrail, 'rgba(0, 0, 255, 0.2)', 3);
        drawTrail(this.leftWheelTrail, 'rgba(255, 0, 0, 0.2)', 2);
        drawTrail(this.rightWheelTrail, 'rgba(0, 255, 0, 0.2)', 2);

        // Draw Sensors if states provided for display
        if (displaySensorStates) {
            this.drawSensorsForDisplay(ctx, displaySensorStates);
        }
    }

    drawSensorsForDisplay(ctx, sensorReadings) {
        const sensorPositions_m = this.getSensorPositions_world_m();
        const sensorRadiusPx = Math.max(2, (this.sensorDiameter_m / 2) * PIXELS_PER_METER);
        for (const key in sensorPositions_m) {
            const pos_m = sensorPositions_m[key];
            const isOffLine = sensorReadings[key];
            ctx.beginPath();
            ctx.arc(pos_m.x_m * PIXELS_PER_METER, pos_m.y_m * PIXELS_PER_METER, sensorRadiusPx, 0, 2 * Math.PI);
            ctx.fillStyle = isOffLine ? 'gray' : 'lime';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Mostrar número de pin dentro del círculo
            ctx.save();
            ctx.fillStyle = 'black';
            ctx.font = `${Math.max(10, sensorRadiusPx)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let pinNumber = '';
            if (this.sensorCount === 2) {
                if (key === 'left') pinNumber = '2';
                else if (key === 'right') pinNumber = '3';
            } else if (this.sensorCount === 3) {
                if (key === 'left') pinNumber = '2';
                else if (key === 'center') pinNumber = '3';
                else if (key === 'right') pinNumber = '4';
            } else if (this.sensorCount === 4) {
                if (key === 'farLeft') pinNumber = '2';
                else if (key === 'left') pinNumber = '3';
                else if (key === 'right') pinNumber = '4';
                else if (key === 'farRight') pinNumber = '5';
            } else if (this.sensorCount === 5) {
                if (key === 'farLeft') pinNumber = '2';
                else if (key === 'left') pinNumber = '3';
                else if (key === 'center') pinNumber = '4';
                else if (key === 'right') pinNumber = '5';
                else if (key === 'farRight') pinNumber = '6';
            }
            ctx.fillText(pinNumber, pos_m.x_m * PIXELS_PER_METER, pos_m.y_m * PIXELS_PER_METER);
            ctx.restore();
        }
        // Mostrar pines de motores cerca de las ruedas (ajustar para que estén a la izquierda y derecha del robot, y con orientación del chasis)
        ctx.save();
        ctx.fillStyle = 'blue';
        ctx.font = `${Math.max(10, sensorRadiusPx)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Motor izquierdo (pin 10)
        ctx.save();
        ctx.translate(-this.wheelbase_m / 2 * PIXELS_PER_METER - 18, 0);
        ctx.rotate(0); // Ya está en el sistema del robot, así que 0
        ctx.fillText('10', 0, 0);
        ctx.restore();
        // Motor derecho (pin 9)
        ctx.save();
        ctx.translate(this.wheelbase_m / 2 * PIXELS_PER_METER + 18, 0);
        ctx.rotate(0); // Ya está en el sistema del robot, así que 0
        ctx.fillText('9', 0, 0);
        ctx.restore();
        ctx.restore();
    }
}