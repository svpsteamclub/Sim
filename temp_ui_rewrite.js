const fs = require('fs');
const file = 'js/ui.js';
let js = fs.readFileSync(file, 'utf8');
const startStr = 'elems.editorHelp.innerHTML = `';
const endStr = '\n    `;\n}';
const start = js.indexOf(startStr);
const end = js.indexOf(endStr, start) + endStr.length;

const newStr = startStr + `
        <div class="space-y-6 text-slate-700 bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-4 font-sans">
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
                <div class="bg-slate-900 rounded-lg p-5 overflow-x-auto shadow-inner">
                    <pre class="text-emerald-400 font-mono text-sm leading-relaxed m-0"><code><span class="text-pink-400">if</span> (digitalRead(\${sensorPinExample}) == <span class="text-blue-400">HIGH</span>) {
    <span class="text-slate-500">// El sensor detecta la línea, gira a un lado</span>
}</code></pre>
                </div>
            </div>

            <div class="border-t border-slate-100 pt-6">
                <h3 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">🔌 ¿Cómo referenciar componentes?</h3>
                
                <div class="grid md:grid-cols-2 gap-6 mb-6">
                    <div class="bg-blue-50/50 p-5 rounded-lg border border-blue-100 shadow-sm">
                        <p class="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">📻 Pines de los sensores:</p>
                        <p class="text-sm text-slate-600 mb-4 h-10">Léelos usando <code>digitalRead(pin)</code>, incluso si en el Robot Editor los conectaste a puertos analógicos (A0, A1).</p>
                        <ul class="list-disc pl-5 space-y-2 text-sm marker:text-blue-500 font-mono bg-white p-3 rounded border border-blue-50">\${sensorsText}</ul>
                    </div>

                    <div class="bg-orange-50/50 p-5 rounded-lg border border-orange-100 shadow-sm">
                        <p class="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">⚙️ Pines de los motores:</p>
                        <p class="text-sm text-slate-600 mb-4 h-10">Controlalos siempre con <code>analogWrite()</code> y <code>digitalWrite()</code> según el tipo driver que selecciones.</p>
                        <ul class="list-disc pl-5 space-y-2 text-sm marker:text-orange-500 font-mono bg-white p-3 rounded border border-orange-50">\${motorsText}</ul>
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
                        <span class="text-slate-600 text-xs">Envía señal PWM (0-255) para vel de motor.</span>
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
                        <code class="text-blue-700 font-bold block mb-1">abs(x) / min(x,y) / max()</code>
                        <span class="text-slate-600 text-xs">Matemática directa (Valor absoluto y Límites).</span>
                    </div>
                </div>
            </div>
        </div>` + endStr;

js = js.substring(0, start) + newStr + js.substring(end);
fs.writeFileSync(file, js, 'utf8');
console.log('Done');
