# Aula en Vivo

Cuestionarios con puntaje, encuestas y nubes de palabras en vivo para el aula, al estilo de Kahoot o Mentimeter, pero como software libre: sin cuentas, sin publicidad y sin que las respuestas de los estudiantes queden guardadas en servidores ajenos.

Forma parte de la misma familia que *Realidad aumentada para el aula*: una página web estática que se publica en GitHub Pages, se puede descargar y no necesita instalar nada.

## Qué se puede hacer

Las funciones salen de mirar en detalle cómo trabajan Kahoot y Mentimeter, y quedarse con lo que sirve en el aula.

**Tres formas de jugar**
- **En vivo** (como Kahoot y Menti): todos responden la misma pregunta a la vez y el docente las pasa desde el proyector.
- **Escape room**: cada pregunta es un candado. Hasta que no la responden bien no ven la siguiente. Avanzan a su ritmo, solos o por equipo, con tiempo total opcional. En el proyector se ve quién va abriendo cada candado.
- **Set de actividades**: un menú con todas las actividades, que hacen en el orden que quieran. Cada una se responde una vez.

**Para evaluar** (suman puntos)
- **Opción múltiple** de 2 a 4 opciones, con una o varias correctas (puntaje parcial).
- **Verdadero o falso**.
- **Respuesta escrita**: no importan mayúsculas, tildes ni espacios, y 3,5 vale igual que 3.5. Se pueden cargar varias respuestas válidas.
- **Ordenar**: de 2 a 6 elementos que aparecen mezclados y se acomodan con flechas.
- **Adivinar el número**: un deslizador con margen aceptado. Cuanto más cerca, más puntos (80 % precisión y 20 % rapidez, igual que el slider de Kahoot).

**Para opinar** (no suman puntos)
- **Encuesta** de una o varias opciones, con porcentajes.
- **Escala** (como en Menti): un deslizador con textos en los extremos; muestra cuántos eligieron cada valor y el promedio.
- **Ranking** (como en Menti): cada uno ordena según lo que piensa y se ve el puesto promedio.
- **Nube de palabras** en vivo, que agrupa mayúsculas y tildes.

**Puntaje y juego**
- Fórmula de Kahoot: la respuesta correcta vale 1000 si es inmediata y baja hasta 500 al final del tiempo. Cada pregunta puede valer normal, doble o sin puntos.
- **Rachas**: desde la segunda correcta seguida suman 100, 200… hasta 500 extra, con el 🔥 en el celu y en las posiciones.
- **Avatares**: cada estudiante arma su criatura por partes (color, forma, ojos, boca y accesorio) o la sortea. Aparece en la sala, en las posiciones, en el podio y en el avance de los modos a su ritmo. También hay un botón para inventar un apodo (fauna del sur: Pingüino Sabio, Carpincho Veloz…).
- **Reacciones** (como en Menti): desde el celu se mandan 👏 ❤️ 😂 😮 🤔 🔥 que suben por el proyector con el avatar de quien las manda.
- Posiciones entre preguntas, podio final y **descarga de resultados en CSV** (abre directo en Excel o en Hojas de cálculo).
- El docente puede **sacar de la sala** a quien entre con un nombre inapropiado. Si un celu se corta, vuelve a entrar con sus puntos.
- Exportar e importar cuestionarios como `.json`. Plantillas de escape room y set de actividades para arrancar.

## Cómo se usa

1. Entrá a la página desde la compu que va al proyector.
2. Armá un cuestionario (o probá con el de ejemplo, *Repaso: función lineal*) y tocá **Presentar**.
3. En el pizarrón aparecen un QR y un código de 5 letras. Los estudiantes escanean el QR con la cámara del celu, escriben su nombre y entran.
4. Tocá **Empezar**. Con la flecha derecha del teclado (o el control de diapositivas) también se avanza.

Los cuestionarios quedan guardados en el navegador de esa compu. Para pasarlos a otra o tener una copia, usá **Exportar**.

## Cómo funciona la conexión

Kahoot y Menti necesitan un servidor central donde se juntan todas las respuestas. Acá no:

- Cada celular se conecta **directo** al navegador del docente con WebRTC, y el tráfico va cifrado de punta a punta.
- Para que el celu y la compu se encuentren hace falta un "apretón de manos" inicial. Eso lo resuelve la librería libre [Trystero](https://github.com/dmotz/trystero) usando redes públicas y descentralizadas que ya existen. Por esas redes no pasan las respuestas, solo los datos para encontrarse.
- Los celulares entran en modo pasivo: se conectan con el docente pero no entre ellos. Así un curso de 30 arma 30 conexiones y no 435.
- El navegador del docente lleva los puntajes y el tiempo. Cuando se cierra la pestaña, todo eso desaparece (salvo el CSV, si lo descargaste).

En **Conexión de los celulares**, en la página de inicio, se elige la red:

| Red | Cuándo usarla |
|---|---|
| **Nostr** (por defecto) | Siempre, de entrada. Tiene cientos de relays y no depende de una sola empresa. |
| **MQTT** | Si en la red de la escuela Nostr no conecta. |
| **Relay propio** | Si la institución o el Ministerio quieren no depender de redes públicas. Ver más abajo. |

Si elegís una red distinta de Nostr, los estudiantes tienen que entrar con el QR, porque el enlace lleva la red elegida.

### Qué necesita para funcionar

- Internet en la compu del docente y en los celulares, al menos para el momento de entrar.
- Un navegador actualizado (Chrome, Firefox, Edge o Safari).
- Pensado para un curso o dos a la vez (hasta 50 o 60 celulares). No es para un auditorio de 300.

### Si los celulares no conectan

- Algunas redes wifi escolares aíslan a los dispositivos entre sí. Probá compartiendo internet desde el celu del docente (zona wifi) y conectando ahí a la compu y a los estudiantes.
- Cambiá de Nostr a MQTT en **Conexión de los celulares** y volvé a presentar.
- En redes muy cerradas puede hacer falta un servidor TURN. Trystero lo permite (`turnConfig`); queda para una versión próxima.

## Publicarlo en GitHub Pages

1. Creá un repositorio nuevo y subí todo el contenido de esta carpeta (no hace falta compilar nada).
2. En el repo: **Settings → Pages → Build and deployment → Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En un par de minutos queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

También funciona abriendo `index.html` directo desde la compu (doble clic), sin servidor. El editor anda sin internet; para jugar en vivo hace falta conexión. En ese caso los celulares no pueden entrar a la dirección del archivo: entran a la página publicada y escriben el código. Si cargás la dirección publicada en **Conexión de los celulares → Dirección pública**, el QR los lleva directo.

## Relay propio (opcional)

En la carpeta `relay/` hay un servidor de pocas líneas para quien quiera independencia total de redes públicas. Necesita Node 18 o superior:

```bash
cd relay
npm install
npm start          # escucha en ws://localhost:8787 (se cambia con la variable PUERTO)
```

Publicado detrás de HTTPS (por ejemplo en un servidor de la institución), su dirección queda como `wss://relay.mi-escuela.edu.ar`. Esa dirección se carga en **Conexión de los celulares → Relay propio**. GitHub Pages no puede correr este servidor porque solo sirve archivos estáticos.

## Formato de los cuestionarios

```json
{
  "formato": "aula-en-vivo",
  "version": 1,
  "titulo": "Repaso: función lineal",
  "preguntas": [
    { "tipo": "opcion", "texto": "¿Cuál es la pendiente de y = 3x − 2?", "opciones": ["3", "−2", "2/3", "−3"], "correcta": 0, "tiempo": 20 },
    { "tipo": "opcion", "texto": "¿Cuáles son funciones lineales?", "opciones": ["y = 2x + 1", "y = x²", "y = −x"], "multiple": true, "correctas": [0, 2], "tiempo": 30 },
    { "tipo": "opcion", "texto": "¿Qué tan seguro o segura te sentís?", "opciones": ["Mucho", "Bastante", "Poco"], "correcta": null, "tiempo": 30 },
    { "tipo": "nube", "texto": "Una palabra que asocies con «función»", "tiempo": 60 }
  ]
}
```

- `correcta` es la posición de la opción correcta empezando en 0 (A = 0, B = 1…). Con `null` la pregunta es una encuesta.
- Con `"multiple": true` se pueden elegir varias opciones, y en lugar de `correcta` va `correctas`, una lista de posiciones. Con `"correctas": null` es una encuesta de varias opciones.
- `tiempo` en segundos: 10, 20, 30, 45, 60, 90 o 120.

Hay un ejemplo completo en `ejemplos/`.

## Estructura del proyecto

```
index.html            la página
css/estilos.css       estilos (hoja cuadriculada, tinta azul y cuatro fibrones)
js/util.js            utilidades
js/almacen.js         cuestionarios guardados en el navegador, importar y exportar
js/red.js             conexión entre la compu del docente y los celulares
js/editor.js          editor de cuestionarios
js/docente.js         lo que se proyecta: sala, preguntas, resultados y podio
js/estudiante.js      lo que ve cada celular
js/app.js             inicio y navegación
lib/                  Trystero y el generador de QR, empaquetados para usar sin internet
fuentes/              tipografías libres (Bricolage Grotesque y Atkinson Hyperlegible)
relay/                relay propio opcional (Node)
ejemplos/             cuestionarios de ejemplo
```

## Licencia

Copyleft 🄯 2026 Gustavo Iturriz — Ushuaia, Tierra del Fuego, Argentina.

Software libre bajo la **GNU GPL versión 3** o posterior: se puede usar, copiar, estudiar, cambiar y repartir sin pedir permiso, siempre que lo que se reparta siga siendo libre, con la misma licencia y con la mención de autoría. Ver `LICENCIA.md` (en criollo), `LICENSE` (texto completo) y `LICENCIAS-TERCEROS.md` (bibliotecas incluidas). Dentro de la aplicación, todo esto está en **Acerca de**.
