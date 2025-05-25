// js/track.js
import { PIXELS_PER_METER } from './config.js';

export class Track {
    constructor() {
        this.image = new Image();
        this.imageData = null;
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

        this.width_px = 0;  // Width of the track image in pixels
        this.height_px = 0; // Height of the track image in pixels
        this.lineThreshold = 100; // Default, updated by sim params. Pixels darker than this are "line".

        this.isCustom = false; // True if loaded from track editor or file
        this.fileName = "";    // Name of the track file if loaded

        this.watermarkImage = null; // Optional watermark image
    }

    setWatermark(img) {
        this.watermarkImage = img;
    }

    // Load track from an image source (URL or File object)
    load(source, desiredCanvasWidth_px, desiredCanvasHeight_px, lineThreshold, callback, isCustomFile = false, fileName = "") {
        this.isCustom = isCustomFile;
        this.fileName = fileName;
        this.lineThreshold = lineThreshold;

        const img = new Image();
        img.crossOrigin = "Anonymous"; // Important for getImageData if source is URL
        
        img.onload = () => {
            this.width_px = img.width;
            this.height_px = img.height;

            // Prepare offscreen canvas with the track image for efficient pixel reading
            this.offscreenCanvas.width = this.width_px;
            this.offscreenCanvas.height = this.height_px;
            this.offscreenCtx.drawImage(img, 0, 0, this.width_px, this.height_px);
            
            try {
                this.imageData = this.offscreenCtx.getImageData(0, 0, this.width_px, this.height_px);
                if (callback) callback(true, this.width_px, this.height_px);
            } catch (error) {
                this.imageData = null;
                if (callback) callback(false, 0, 0);
            }
        };
        
        img.onerror = (error) => {
            this.imageData = null;
            if (callback) callback(false, 0, 0);
        };

        if (typeof source === 'string') {
            img.src = source;
        } else if (source instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.readAsDataURL(source);
        } else if (source instanceof HTMLCanvasElement) { // For tracks from editor
            this.setFromCanvas(source, lineThreshold)
                .then(success => {
                    if (callback) callback(success, this.width_px, this.height_px);
                })
                .catch(err => {
                    if (callback) callback(false, 0, 0);
                });
        } else {
            if (callback) callback(false, 0, 0);
        }
    }
    
    // Used by track editor to set the track from a generated canvas
    setFromCanvas(sourceCanvas, lineThreshold) {
        return new Promise((resolve, reject) => {
            this.lineThreshold = lineThreshold;
            this.isCustom = true;
            this.fileName = "PistaDelEditor.png"; // Default name for editor tracks

            this.width_px = sourceCanvas.width;
            this.height_px = sourceCanvas.height;

            this.offscreenCanvas.width = this.width_px;
            this.offscreenCanvas.height = this.height_px;
            this.offscreenCtx.drawImage(sourceCanvas, 0, 0, this.width_px, this.height_px);
            
            try {
                this.imageData = this.offscreenCtx.getImageData(0, 0, this.width_px, this.height_px);
                this.image.src = sourceCanvas.toDataURL(); // Keep an Image object too for consistency
                resolve(true);
            } catch (e) {
                this.imageData = null;
                reject(e);
            }
        });
    }

    // Check if a pixel at world coordinates (in pixels of the track image) is on the line
    isPixelOnLine(x_track_px, y_track_px) {
        if (!this.imageData || x_track_px < 0 || x_track_px >= this.width_px || y_track_px < 0 || y_track_px >= this.height_px) {
            return false; // Out of bounds or no image data implies "not on line" (e.g., on white background)
        }
        // Round coordinates to nearest pixel
        const x = Math.round(x_track_px);
        const y = Math.round(y_track_px);

        const R_INDEX = (y * this.width_px + x) * 4; // Each pixel has 4 values (R, G, B, A)
        const r = this.imageData.data[R_INDEX];
        const g = this.imageData.data[R_INDEX + 1];
        const b = this.imageData.data[R_INDEX + 2];
        // const a = this.imageData.data[R_INDEX + 3]; // Alpha, useful if track has transparency

        // A_INDEX should be R_INDEX + 3. If alpha is low, consider it background.
        const alpha = this.imageData.data[R_INDEX + 3];
        if (alpha < 128) return false; // Largely transparent pixels are not line

        // Calculate brightness (average of R, G, B). Lower brightness = darker color.
        const brightness = (r + g + b) / 3;
        return brightness < this.lineThreshold; // If brightness is below threshold, it's on the line
    }

    // Draw the track onto a given display context (e.g., the main simulation canvas)
    draw(displayCtx, displayCanvasWidth, displayCanvasHeight) {
        if (!this.imageData) {
            displayCtx.fillStyle = 'lightgray'; // Fallback if no track
            displayCtx.fillRect(0, 0, displayCanvasWidth, displayCanvasHeight);
            displayCtx.fillStyle = 'black';
            displayCtx.textAlign = 'center';
            displayCtx.fillText("No hay pista cargada", displayCanvasWidth / 2, displayCanvasHeight / 2);
            return;
        }
        
        // Clear the display canvas
        displayCtx.fillStyle = 'white'; // Default background for areas outside the track image
        displayCtx.fillRect(0, 0, displayCanvasWidth, displayCanvasHeight);
        
        // Draw the track from the offscreen canvas (which holds the original track image)
        // This will scale the track image to fit the display canvas if they are different sizes.
        // For 1px=1mm, displayCanvasWidth/Height should match track.width_px/height_px.
        displayCtx.drawImage(this.offscreenCanvas, 0, 0, displayCanvasWidth, displayCanvasHeight);

        // Draw watermark if available
        if (this.watermarkImage && this.watermarkImage.complete && this.watermarkImage.naturalWidth > 0) {
            const maxSize = Math.min(displayCanvasWidth, displayCanvasHeight) * 0.3; // Watermark size relative to canvas
            const aspectRatio = this.watermarkImage.naturalWidth / this.watermarkImage.naturalHeight;
            let watermarkWidth, watermarkHeight;
            
            if (aspectRatio > 1) { // Wider than tall
                watermarkWidth = maxSize;
                watermarkHeight = maxSize / aspectRatio;
            } else { // Taller than wide or square
                watermarkHeight = maxSize;
                watermarkWidth = maxSize * aspectRatio;
            }
            
            const x = (displayCanvasWidth - watermarkWidth) / 2;
            const y = (displayCanvasHeight - watermarkHeight) / 2;
            
            displayCtx.save();
            displayCtx.globalAlpha = 0.10; // Watermark opacity
            displayCtx.drawImage(this.watermarkImage, x, y, watermarkWidth, watermarkHeight);
            displayCtx.restore();
        }
    }

    clear() {
        this.image = new Image();
        this.imageData = null;
        this.width_px = 0;
        this.height_px = 0;
        this.isCustom = false;
        this.fileName = "";
        if (this.offscreenCtx) {
            this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        }
    }
}