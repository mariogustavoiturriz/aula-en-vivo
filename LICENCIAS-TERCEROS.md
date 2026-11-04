# Licencias de terceros

Aula en Vivo se distribuye bajo GPL-3.0-o-posterior (ver `LICENSE`). Incluye estas piezas de otros autores, todas con licencias libres compatibles:

| Pieza | Dónde está | Licencia | Origen |
|---|---|---|---|
| Trystero 0.26 (estrategias Nostr, MQTT y relay WebSocket) | `lib/red-nostr.js`, `lib/red-mqtt.js`, `lib/red-relay.js` | MIT | https://github.com/dmotz/trystero |
| noble-secp256k1 y otras dependencias de Trystero (incluidas en el paquete) | dentro de `lib/red-*.js` | MIT | ver los comentarios de licencia dentro de cada archivo |
| qrcode-generator 2.0.4 | `lib/qrcode.js` | MIT | https://github.com/kazuhikoarase/qrcode-generator |
| Bricolage Grotesque | `fuentes/bricolage-*` | SIL Open Font License 1.1 | https://github.com/ateliertriay/bricolage |
| Atkinson Hyperlegible (Braille Institute) | `fuentes/atkinson-*` | SIL Open Font License 1.1 | https://www.brailleinstitute.org/freefont |

Los textos completos de las licencias de las fuentes están en la carpeta `fuentes/`. Los archivos de `lib/` conservan los avisos de licencia originales.

## Cómo se armaron los archivos de `lib/`

Se empaquetaron con esbuild en formato IIFE para que funcionen con etiquetas `<script>` comunes, sin módulos ni servidor.

Trystero lleva un parche mínimo (`lib/parche-trystero.diff`): permite elegir cada cuánto se anuncia la compu del docente. Trystero trae 60 segundos fijos, y eso hacía que un estudiante que llegaba tarde o se reconectaba tuviera que esperar hasta un minuto para encontrar la sala. Con el parche, el docente se anuncia cada 5 segundos; los celulares no cambian. El parche respeta las esperas que piden los relays cuando limitan el tráfico.

```bash
npm i trystero @trystero-p2p/nostr @trystero-p2p/mqtt @trystero-p2p/ws-relay qrcode-generator esbuild
cd node_modules && patch -p1 < ../lib/parche-trystero.diff && cd ..
# ejemplo para Nostr:
echo "import {joinRoom, selfId, getRelaySockets} from '@trystero-p2p/nostr'; window.RedAula = window.RedAula || {}; window.RedAula.nostr = {joinRoom, selfId, getRelaySockets};" > nostr.js
npx esbuild nostr.js --bundle --minify --format=iife --target=es2020 --legal-comments=inline --outfile=lib/red-nostr.js
```

Para MQTT y el relay se repite cambiando el paquete (`@trystero-p2p/mqtt`, `@trystero-p2p/ws-relay`) y la clave (`mqtt`, `ws`).
