// js/lapTimer.js
export class LapTimer {
    constructor(robotWidth_m, robotLength_m) {
        this.robotWidth_m = robotWidth_m;
        this.robotLength_m = robotLength_m;
        this.startLine = { x1: 0, y1: 0, x2: 0, y2: 0 };
        this.isActive = false;
        this.lapCount = 0;
        this.currentLapStartTime_s = 0;
        this.lastLapTime_ms = null;
        this.bestLapTime_ms = null;
        this.onPositiveSide = false; // Which side of the line the robot is on
    }

    initialize(startPose, currentTime_s, customStartLine = null) {
        if (!this.robotWidth_m || !this.robotLength_m || isNaN(this.robotWidth_m) || isNaN(this.robotLength_m)) {
            console.error('[LapTimer] ERROR: robotWidth_m or robotLength_m is invalid:', this.robotWidth_m, this.robotLength_m);
        }
        console.log("[LapTimer] Initializing with start pose:", startPose);

        if (customStartLine) {
            // Use provided custom start line
            this.startLine = {
                x1: customStartLine.x1,
                y1: customStartLine.y1,
                x2: customStartLine.x2,
                y2: customStartLine.y2
            };
        } else {
            // Define start/finish line based on start pose and robot dimensions
            // Line is perpendicular to robot's starting angle, centered on robot's rear axle
            const halfWidth = this.robotWidth_m * 2; // Make line wider than robot
            const backOffset = -this.robotLength_m / 2; // Line at the back of the robot

            const cosA = Math.cos(startPose.angle_rad);
            const sinA = Math.sin(startPose.angle_rad);

            const lineCenterX = startPose.x_m + backOffset * cosA;
            const lineCenterY = startPose.y_m + backOffset * sinA;

            const perpendicularAngle = startPose.angle_rad + Math.PI / 2;
            const dx = halfWidth * Math.cos(perpendicularAngle);
            const dy = halfWidth * Math.sin(perpendicularAngle);

            this.startLine = {
                x1: lineCenterX - dx, y1: lineCenterY - dy,
                x2: lineCenterX + dx, y2: lineCenterY + dy
            };
        }

        this.currentLapStartTime_s = performance.now() / 1000.0; // Use real time instead of simulation time
        this.lapCount = 0;
        this.lastLapTime_ms = null;
        this.bestLapTime_ms = null;
        this.isActive = true;
        
        // Determine initial side
        this.onPositiveSide = this._isRobotOnPositiveSide(startPose.x_m, startPose.y_m);
        console.log("[LapTimer] Start line created:", {
            startLine: this.startLine,
            isActive: this.isActive,
            robotWidth: this.robotWidth_m,
            robotLength: this.robotLength_m,
            initialSide: this.onPositiveSide
        });
    }

    reset() {
        this.isActive = false;
        this.lapCount = 0;
        this.currentLapStartTime_s = 0;
        this.lastLapTime_ms = null;
        this.bestLapTime_ms = null;
    }

    // Line side check: (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1)
    _getSide(x, y) {
        return (y - this.startLine.y1) * (this.startLine.x2 - this.startLine.x1) -
               (x - this.startLine.x1) * (this.startLine.y2 - this.startLine.y1);
    }

    _isRobotOnPositiveSide(robotX_m, robotY_m) {
        return this._getSide(robotX_m, robotY_m) > 0;
    }

    update(currentTime_s, robotPose) {
        if (!this.isActive) return { newLapCompleted: false, completedLapTime: null };

        const currentSideIsPositive = this._isRobotOnPositiveSide(robotPose.x_m, robotPose.y_m);

        let newLapCompleted = false;
        let completedLapTime = null;

        // Check for crossing the start/finish line
        if (currentSideIsPositive !== this.onPositiveSide) {
            // Robot crossed the line. Check if it's a valid lap (e.g., moving forward)
            // Simple check: only count if lap time is more than a few seconds to avoid bouncing
            const currentRealTime_s = performance.now() / 1000.0;
            const lapDuration_s = currentRealTime_s - this.currentLapStartTime_s;
            if (lapDuration_s > 2.0) { // Minimum lap time to be considered valid (e.g., 2 seconds)
                this.lapCount++;
                completedLapTime = lapDuration_s * 1000; // to ms
                this.lastLapTime_ms = completedLapTime;

                if (this.bestLapTime_ms === null || completedLapTime < this.bestLapTime_ms) {
                    this.bestLapTime_ms = completedLapTime;
                }
                this.currentLapStartTime_s = currentRealTime_s;
                newLapCompleted = true;
                // console.log(`Lap ${this.lapCount} completed: ${formatTime(completedLapTime)}`);
            }
             this.onPositiveSide = currentSideIsPositive; // Update side
        }
        return { newLapCompleted, completedLapTime };
    }
    
    getDisplayData() {
        const currentTime_s = this.isActive ? (performance.now() / 1000.0) : this.currentLapStartTime_s; // Approximation if not running
        const currentLapDuration_s = this.isActive ? (currentTime_s - this.currentLapStartTime_s) : 0;
        return {
            lapCount: this.lapCount,
            lastLapTime_ms: this.lastLapTime_ms,
            bestLapTime_ms: this.bestLapTime_ms,
            currentLapTime_ms: this.lapCount > 0 || this.isActive ? currentLapDuration_s * 1000 : null,
            isTiming: this.isActive
        };
    }
}