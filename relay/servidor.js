/* Aula en Vivo — relay propio (opcional)
   Solo hace falta si la institución quiere no depender de redes públicas.
   El relay únicamente ayuda a que los celulares encuentren la compu del docente:
   las respuestas viajan directo entre navegadores y no pasan por acá.

   Uso:   npm install   y después   npm start
   Puerto: variable PUERTO (por defecto 8787). Detrás de HTTPS, publicarlo como wss://

   Copyright (C) 2026 Mario Gustavo Iturriz — Licencia GPL-3.0-o-posterior */
import { createWsRelayServer } from '@trystero-p2p/ws-relay/server'

const port = Number(process.env.PUERTO || 8787)
const relay = createWsRelayServer({ port, onError: err => console.error('Error en el relay:', err.message) })
await relay.ready
console.log(`Relay de Aula en Vivo escuchando en ws://localhost:${port}`)
