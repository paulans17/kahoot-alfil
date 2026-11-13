# Gran Hotel Alfil · Kahoot del Curso de Protocolo XXII

Kahoot propio de Alfil Juvenil con la temática *Gran Hotel Budapest x Surrealismo de Dalí*.
Web estática (GitHub Pages) + Firestore para el tiempo real. Pensado para ~130 alumnos a la vez.

- **Pantalla grande (proyector):** `host.html`
- **Alumnos (móvil):** `index.html` → entran con el QR o el PIN

## Puesta en marcha (una vez)

1. **Firebase**: en la consola del proyecto → *Firestore Database* → crear base de datos (modo producción, región `eur3`).
2. **Reglas**: Firestore → *Reglas* → pegar `firestore.rules` → Publicar.
3. **Config**: pegar el `firebaseConfig` de la app web en `js/config.js`.
4. **Preguntas**: editar `js/questions.js` (`correcta` = índice de la buena, empezando en 0; `tiempo` en segundos).

## El día del curso

1. Abrir `https://paulans17.github.io/kahoot-alfil/host.html` en el ordenador del proyector → **Abrir partida**.
2. Los alumnos escanean el QR, ponen su nombre y esperan.
3. **Empezar** → cada pregunta se cierra sola cuando se acaba el tiempo o cuando han respondido todos.
4. Resultados → Clasificación → Siguiente pregunta … → Podio.

Si se recarga el ordenador del proyector, **Retomar partida** vuelve a la misma partida.
Si un alumno recarga el móvil, vuelve a entrar solo.

## Puntos

Acierto = entre 500 y 1000 puntos según lo rápido que respondas. Fallo o sin respuesta = 0.

## Coste

Plan gratuito de Firebase (Spark): con 130 alumnos y ~20 preguntas se gastan unas 15.000 lecturas y 6.000 escrituras,
por debajo del límite diario (50.000 / 20.000). Mejor no hacer muchas pruebas grandes el mismo día del curso.

## Si cambias preguntas o código

GitHub Pages cachea los archivos ~10 minutos. Después de editar, sube el número `?v=2` → `?v=3`
en `index.html`, `host.html` y en los `import` de `js/*.js`, para que todos carguen la versión nueva.

## Prueba de carga

`node tools/simular.mjs <PIN> 120` mete 120 alumnos falsos que responden solos (Node 18+, sin instalar nada).
