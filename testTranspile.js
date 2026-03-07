import fs from 'fs';
import { loadUserCode } from './js/codeEditor.js';

const DEMO_CODE = `// --- Configuración de Pines ---
const int S_IZQ = A1;
const int S_CEN = A2; // Sensor central añadido
const int S_DER = A3;

// Motor Izquierdo
const int ENA = 10; 
const int IN1 = 3;
const int IN2 = 5;

// Motor Derecho
const int ENB = 11; 
const int IN3 = 6;
const int IN4 = 9;

// --- Variables de Control ---
int vel = 160;            
int ultima_dir = 0;       // 0: Centro, 1: Izq, 2: Der
bool turnoDerecha = true; 

void setup() {
  Serial.begin(9600);
  Serial.println("--- Robot 3-Sensores (6-Pines) Iniciado ---");

  pinMode(S_IZQ, INPUT);
  pinMode(S_CEN, INPUT);
  pinMode(S_DER, INPUT);
  
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
}

void loop() {
  int sIzq = digitalRead(S_IZQ);
  int sCen = digitalRead(S_CEN);
  int sDer = digitalRead(S_DER);

  // 1. DETECCIÓN DE INTERSECCIÓN (Los 3 sensores o extremos detectan línea)
  if (sIzq == HIGH && sDer == HIGH) {
    if (turnoDerecha) {
      Serial.println("INTERSECCION: Giro programado DERECHA");
      girar_der_fuerte();
      delay(350); 
      while(digitalRead(S_CEN) == LOW); // Gira hasta que el centro encuentre la línea
      turnoDerecha = false;
    } else {
      Serial.println("INTERSECCION: Giro programado IZQUIERDA");
      girar_izq_fuerte();
      delay(350);
      while(digitalRead(S_CEN) == LOW); 
      turnoDerecha = true;
    }
  }

  // 2. SEGUIMIENTO DE LÍNEA
  else if (sCen == HIGH) {
    Serial.println("Estado: CENTRADO");
    avanzar();
    ultima_dir = 0;
  }
  else if (sIzq == HIGH) {
    Serial.println("Estado: CORRIGIENDO IZQUIERDA");
    girar_izq_suave();
    ultima_dir = 1;
  }
  else if (sDer == HIGH) {
    Serial.println("Estado: CORRIGIENDO DERECHA");
    girar_der_suave();
    ultima_dir = 2;
  }

  // 3. MEMORIA DE GIRO (Si todos están en blanco / 0)
  else {
    if (ultima_dir == 1) {
      Serial.println("MEMORIA: Buscando a la IZQUIERDA");
      girar_izq_fuerte();
    } else if (ultima_dir == 2) {
      Serial.println("MEMORIA: Buscando a la DERECHA");
      girar_der_fuerte();
    } else {
      avanzar_lento(); // Si se pierde recto, busca al frente
    }
  }
}

// --- Funciones de Movimiento ---

void avanzar() {
  analogWrite(ENA, vel); digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  analogWrite(ENB, vel); digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}

void avanzar_lento() {
  analogWrite(ENA, 100); digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  analogWrite(ENB, 100); digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}

void girar_izq_suave() {
  analogWrite(ENA, 80);  digitalWrite(IN1, LOW);  digitalWrite(IN2, LOW);
  analogWrite(ENB, vel); digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}

void girar_der_suave() {
  analogWrite(ENA, vel); digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  analogWrite(ENB, 80);  digitalWrite(IN3, LOW);  digitalWrite(IN4, LOW);
}

void girar_izq_fuerte() {
  analogWrite(ENA, vel); digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH); 
  analogWrite(ENB, vel); digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);  
}

void girar_der_fuerte() {
  analogWrite(ENA, vel); digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);  
  analogWrite(ENB, vel); digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH); 
}`;

let ok = loadUserCode(DEMO_CODE);
console.log("Transpiled success: ", ok);
