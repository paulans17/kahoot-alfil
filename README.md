# Gran Hotel Alfil · Kahoot en tiempo real

Kahoot hecho desde cero para el **Curso de Protocolo XXII** de **Alfil Juvenil**, con la temática de la edición (*Gran Hotel Budapest × surrealismo de Dalí*). Las preguntas salen en el proyector y unos **130 alumnos** responden a la vez desde el móvil.

## Cómo funciona

- **Proyector** (`host.html`): crea la partida, enseña el QR y el PIN, lanza las preguntas y muestra resultados, clasificación y podio.
- **Alumnos** (`index.html`): entran con el QR o el PIN, ponen su nombre y responden.
- **Puntos**: si aciertas te llevas entre 500 y 1000 según lo rápido que contestes. Si fallas, 0.
- Cada pregunta se cierra sola cuando se acaba el tiempo o cuando ya ha respondido todo el mundo.
- **Aguanta recargas**: si se recarga el proyector, "Retomar partida" vuelve a la misma; si un alumno recarga el móvil, vuelve a entrar solo.

## Cómo está hecho

| Parte | Tecnología |
|---|---|
| Front | HTML, CSS y JavaScript (módulos ES), sin frameworks |
| Tiempo real | Firebase Cloud Firestore |
| Hosting | GitHub Pages |

- **Reglas de Firestore** (`firestore.rules`) para que cada jugador solo pueda responder una vez por pregunta y no pueda cambiar la respuesta.
- **Prueba de carga** (`tools/simular.mjs`): mete N alumnos falsos que responden solos, para comprobar antes del curso que aguanta 120 a la vez sin pasarse del plan gratuito de Firebase.

```bash
node tools/simular.mjs <PIN> 120   # Node 18+, sin dependencias
```

## Montarlo

1. Crea un proyecto en Firebase con Firestore y pega `firestore.rules` en las reglas.
2. Pon tu `firebaseConfig` en `js/config.js`.
3. Edita las preguntas en `js/questions.js` (`correcta` = índice de la respuesta buena, empezando en 0; `tiempo` en segundos).
4. Publícalo en GitHub Pages y abre `host.html` en el ordenador del proyector.
