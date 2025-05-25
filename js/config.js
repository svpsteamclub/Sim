// js/config.js

// Escala: 1 pixel en el canvas de simulación representa 1 milímetro en la "realidad"
export const PIXELS_PER_METER = 1000; // 1000 mm = 1 m

// Tamaño de las piezas de la pista en el editor (en píxeles de la imagen original)
export const TRACK_PART_SIZE_PX = 350; // Cada pieza PNG es 350x350 px

// Geometría por defecto del robot (en metros)
export const DEFAULT_ROBOT_GEOMETRY = {
    width_m: 0.10,    // Ancho del robot / Distancia entre centros de ruedas
    length_m: 0.15,   // Largo del robot
    sensorOffset_m: 0.05, // Distancia desde el centro del robot al centro de la línea de sensores, hacia adelante
    sensorSpread_m: 0.03, // Distancia desde el sensor central a un sensor lateral
    sensorDiameter_m: 0.005 // Diámetro de cada punto sensor
};

// Para el PID del código de usuario de ejemplo (si lo usa)
export const currentMaxValError = 2; // Error máximo para la lógica de PID ejemplo

// Partes de pista disponibles para el editor
// 'connections': N, S, E, W indican si la pieza tiene una conexión en esa dirección.
// La rotación se maneja en el editor. Estas son las conexiones para la pieza en su orientación 0 grados.
// Las imágenes deben estar en 'assets/track_parts/'
export const AVAILABLE_TRACK_PARTS = [
    { name: "C0.00-BCS", file: "C0.00-BCS.png", connections: { N: false, S: false, E: false, W: false } },
    { name: "C1.01-RCS", file: "C1.01-RCS.png", connections: { N: true, S: true, E: false, W: false } },
    { name: "C1.02-MCS", file: "C1.02-MCS.png", connections: { N: false, S: true, E: true, W: false } },
    { name: "C1.03-CCS", file: "C1.03-CCS.png", connections: { N: false, S: true, E: false, W: true } },
    { name: "C1.04-MCS", file: "C1.04-MCS.png", connections: { N: false, S: true, E: true, W: false } },
    { name: "C1.05-RCS", file: "C1.05-RCS.png", connections: { N: false, S: true, E: true, W: false } },
    { name: "C1.06-MCS", file: "C1.06-MCS.png", connections: { N: false, S: true, E: true, W: false } },
    { name: "C2.07-RCI", file: "C2.07-RCI.png", connections: { N: false, S: true, E: true, W: false } },
    { name: "C2.08-MCS", file: "C2.08-MCS.png", connections: { N: true, S: true, E: false, W: false } },
];


// Para la simulación (Robot.js)
export const WHEEL_LENGTH_M = 0.065; // 65mm en metros
export const WHEEL_WIDTH_M = 0.025; // 25mm en metros