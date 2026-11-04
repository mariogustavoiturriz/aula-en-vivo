/* Aula en Vivo — conexión entre el docente y los celulares
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior

   Cómo funciona:
   - Cada celular se conecta DIRECTO al navegador del docente (WebRTC, cifrado de punta a punta).
   - Para que se encuentren usamos Trystero, que aprovecha redes públicas (Nostr o MQTT)
     o un relay propio solo para el "apretón de manos". Las respuestas no pasan por ahí.
   - Los celulares entran en modo "pasivo": se conectan con el docente pero no entre ellos,
     así un curso de 30 no arma 435 conexiones cruzadas. */
'use strict';

(function (AV) {
  const APP_ID = 'aula-en-vivo.v1';
  const ARCHIVOS = { nostr: 'lib/red-nostr.js', mqtt: 'lib/red-mqtt.js', relay: 'lib/red-relay.js' };
  const CLAVES = { nostr: 'nostr', mqtt: 'mqtt', relay: 'ws' };
  const cargando = {};

  function cargarLibreria(red) {
    const clave = CLAVES[red];
    if (window.RedAula && window.RedAula[clave]) return Promise.resolve(window.RedAula[clave]);
    if (cargando[red]) return cargando[red];
    cargando[red] = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = ARCHIVOS[red];
      s.onload = () => (window.RedAula && window.RedAula[clave]) ? ok(window.RedAula[clave]) : mal(new Error('La librería de conexión no se cargó bien.'));
      s.onerror = () => { delete cargando[red]; mal(new Error('No se encontró ' + ARCHIVOS[red] + '. ¿Está la carpeta lib/ completa?')); };
      document.head.append(s);
    });
    return cargando[red];
  }

  /**
   * conectar({codigo, rol, red, relay}) → Promise<conexion>
   * rol: 'docente' (activo, recibe a todos) o 'estudiante' (pasivo, solo habla con el docente)
   */
  async function conectar({ codigo, rol, red = 'nostr', relay = '' }) {
    if (!('RTCPeerConnection' in window)) throw new Error('Este navegador no permite conexiones en vivo (WebRTC). Probá con Chrome, Firefox o Safari actualizados.');
    if (red === 'relay' && !/^wss?:\/\//i.test(relay)) throw new Error('Falta la dirección del relay propio (tiene que empezar con wss:// o ws://).');

    const lib = await cargarLibreria(red);
    const oyentes = { recibir: [], entrar: [], salir: [], error: [] };
    const emitir = (tipo, ...args) => oyentes[tipo].forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } });

    const config = {
      appId: APP_ID,
      password: 'aula-en-vivo:' + codigo,
      passive: rol === 'estudiante'
    };
    // El docente se anuncia cada 5 segundos (Trystero trae 60 por defecto) para que
    // quien llega tarde o se reconecta encuentre la sala enseguida. Los celulares no se anuncian.
    if (rol === 'docente') config.announceIntervalMs = 5000;
    if (red === 'relay') config.relayConfig = { urls: [relay] };

    const sala = lib.joinRoom(config, 'sala-' + codigo, {
      onJoinError: (det) => emitir('error', new Error(det && det.error ? det.error : 'No se pudo entrar a la sala.'))
    });

    const canal = sala.makeAction('av');
    canal.onMessage = (datos, ctx) => emitir('recibir', datos, ctx.peerId);
    sala.onPeerJoin = (id) => emitir('entrar', id);
    sala.onPeerLeave = (id) => emitir('salir', id);

    // para diagnóstico desde la consola del navegador: AV.red.actual.pares()
    return AV.red.actual = {
      miId: lib.selfId,
      enviar(datos, destino) {
        return canal.send(datos, destino ? { target: destino } : undefined).catch(e => console.warn('No se pudo enviar', e));
      },
      alRecibir(fn) { oyentes.recibir.push(fn); },
      alEntrar(fn) { oyentes.entrar.push(fn); },
      alSalir(fn) { oyentes.salir.push(fn); },
      alError(fn) { oyentes.error.push(fn); },
      pares() { return Object.keys(sala.getPeers()); },
      /** Cuántos relays de la red (Nostr, MQTT o propio) están conectados ahora */
      relaysConectados() {
        try {
          const socks = lib.getRelaySockets ? lib.getRelaySockets() : {};
          return Object.values(socks).filter(s => s && (s.readyState === 1 || s.connected === true)).length;
        } catch (e) { return -1; }
      },
      salir() { try { return sala.leave(); } catch (e) { /* nada */ } }
    };
  }

  /** Arma el enlace que va en el QR, con la misma red que eligió el docente */
  function enlaceSala(codigo, conf) {
    // Si la página se abrió como archivo (doble clic), los celulares no pueden usar esa dirección:
    // usamos la dirección pública configurada (por ejemplo, la de GitHub Pages)
    let base = location.href.split('#')[0].split('?')[0];
    if (location.protocol === 'file:') base = conf.publica ? conf.publica.replace(/[?#].*$/, '') : '';
    if (!base) return '';
    const params = new URLSearchParams();
    if (conf.red && conf.red !== 'nostr') params.set('red', conf.red);
    if (conf.red === 'relay' && conf.relay) params.set('relay', conf.relay);
    const q = params.toString();
    return base + (q ? '?' + q : '') + '#/sala/' + codigo;
  }

  /** Lee la red desde la dirección (lo que trae el QR) */
  function redDesdeEnlace() {
    const p = new URLSearchParams(location.search);
    const red = ['nostr', 'mqtt', 'relay'].includes(p.get('red')) ? p.get('red') : 'nostr';
    return { red, relay: p.get('relay') || '' };
  }

  AV.red = { conectar, enlaceSala, redDesdeEnlace };
})(window.AV);
