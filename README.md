# Aula en Vivo

Cuestionarios con puntaje, encuestas y nubes de palabras en vivo para el aula, al estilo de Kahoot o Mentimeter, pero como software libre: sin cuentas, sin publicidad y sin que las respuestas de los estudiantes queden guardadas en servidores ajenos.

Forma parte de la misma familia que *Realidad aumentada para el aula*: una página web estática que se publica en GitHub Pages, se puede descargar y no necesita instalar nada.

## Qué se puede hacer

- **Opción múltiple** de 2 a 4 opciones, con tiempo y puntaje por rapidez (entre 500 y 1000 puntos por respuesta correcta).
- **Varias respuestas correctas**: el estudiante marca todas las que le parecen y toca Enviar. El puntaje es parcial: se cuentan los aciertos, se descuentan las opciones mal elegidas y se divide por la cantidad de correctas (nunca da negativo). Si marca todo, no suma.
- **Encuestas** sin respuesta correcta, de una o de varias opciones: muestran porcentajes y no suman puntos.
- **Nubes de palabras**: cada estudiante manda hasta 3 palabras y la nube crece en vivo en el proyector. Agrupa mayúsculas y tildes (*Gráfico* y *grafico* cuentan como la misma).
- Posiciones entre preguntas, podio final y **descarga de resultados en CSV** (abre directo en Excel o en Hojas de cálculo).
- El docente puede **sacar de la sala** a alguien que entró con un nombre inapropiado.
- Si un celular se desconecta o se recarga la página, vuelve a entrar y **conserva sus puntos**.
- Exportar e importar cuestionarios como archivo `.json`, para compartirlos entre colegas. Desde el inicio se importa un cuestionario completo; desde el editor se suman las preguntas de un archivo al cuestionario que estás armando.

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
