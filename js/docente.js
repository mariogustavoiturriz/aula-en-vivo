/* Aula en Vivo — vista del docente (lo que se proyecta)
   Copyright (C) 2026 Mario Gustavo Iturriz — Licencia GPL-3.0-o-posterior

   El navegador del docente es "el que manda": guarda los puntajes, lleva el tiempo
   y le avisa a cada celular qué tiene que mostrar. Nada se guarda en servidores. */
'use strict';

(function (AV) {
  const { h } = AV;
  const MAX_PALABRAS = 3;

  function render(main, id) {
    const cuest = AV.almacen.obtener(id);
    if (!cuest) { location.hash = '#/'; return; }
    const prob = AV.almacen.problemas(cuest);
    if (prob.length) { AV.aviso(prob[0], 4500); location.hash = '#/editar/' + id; return; }

    const conf = AV.almacen.leerRed();
    const codigo = AV.generarCodigo();
    const enlace = AV.red.enlaceSala(codigo, conf);
    const preguntas = cuest.preguntas;

    // ---------- Estado del juego ----------
    const jugadores = new Map();      // idCliente -> {id, nombre, puntos, peerId, conectado, resp: []}
    const peerAJugador = new Map();   // peerId -> idCliente
    const expulsados = new Set();
    let conexion = null;
    let fase = 'sala';
    let n = -1;
    let inicio = 0, duracion = 0, cerrada = false;
    let respActuales = new Map();     // idCliente -> {v, t, puntos, correcta}
    let nube = new Map();             // palabra normalizada -> {texto, cant}
    let reloj = null;
    let destruido = false;

    // Referencias a la escena actual, para actualizar sin redibujar todo
    let ref = {};

    const escena = h('div', { class: 'escena' });
    const estadoRed = h('span', { class: 'estado-red', role: 'status' }, 'Abriendo la sala…');
    main.innerHTML = '';
    main.append(h('div', { class: 'proyector' },
      AV.encabezado(h('div', { class: 'fila' },
        estadoRed,
        h('button', { class: 'boton boton-texto', type: 'button', onclick: AV.pantallaCompleta }, 'Pantalla completa'))),
      escena));
    document.title = 'Sala ' + codigo + ' · Aula en Vivo';

    // ---------- Utilidades del juego ----------
    const preg = () => preguntas[n];
    const conectados = () => [...jugadores.values()].filter(j => j.conectado);
    const ranking = () => [...jugadores.values()].sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
    const restanteMs = () => Math.max(0, inicio + duracion - Date.now());

    function puestoDe(j) {
      const r = ranking();
      // empates comparten puesto
      let puesto = 1;
      for (let i = 0; i < r.length; i++) {
        if (i > 0 && r[i].puntos < r[i - 1].puntos) puesto = i + 1;
        if (r[i] === j) return puesto;
      }
      return r.length;
    }

    function nombreUnico(nombre, idCliente) {
      const base = nombre.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Sin nombre';
      let final = base, k = 2;
      const usados = new Set([...jugadores.values()].filter(j => j.id !== idCliente).map(j => j.nombre.toLowerCase()));
      while (usados.has(final.toLowerCase())) final = base + ' ' + (k++);
      return final;
    }

    // ---------- Lo que ve cada celular ----------
    function estadoPara(j) {
      const base = { t: 'estado', fase, titulo: cuest.titulo, total: preguntas.length, nombre: j.nombre, puntos: j.puntos };
      if (fase === 'pregunta') {
        const p = preg();
        const r = respActuales.get(j.id);
        return {
          ...base, n, tipo: p.tipo, texto: p.texto,
          opciones: p.tipo === 'opcion' ? p.opciones.map((o, k) => ({ k, txt: o })).filter(o => o.txt.trim()) : null,
          restante: cerrada ? 0 : restanteMs(), duracion,
          multiple: !!p.multiple,
          respondio: p.tipo === 'opcion' ? (r ? r.v : null) : null,
          palabras: p.tipo === 'nube' ? (j.resp[n] || []) : null,
          maxPalabras: MAX_PALABRAS
        };
      }
      if (fase === 'resultado' || fase === 'posiciones') {
        const p = preg();
        const r = respActuales.get(j.id);
        const cor = AV.almacen.correctasDe(p);
        return {
          ...base, fase: 'resultado', n, tipo: p.tipo, esEncuesta: p.tipo === 'opcion' && !cor,
          respondio: !!r || (p.tipo === 'nube' && (j.resp[n] || []).length > 0),
          correcta: r ? r.correcta : null, ganados: r ? r.puntos : 0,
          aciertos: r ? r.aciertos : 0, totalCorrectas: cor ? cor.length : 0,
          textoCorrecta: cor ? cor.map(k => AV.LETRAS[k] + '. ' + p.opciones[k]).join(' / ') : null,
          variasCorrectas: !!(cor && cor.length > 1),
          puesto: puestoDe(j), de: jugadores.size
        };
      }
      if (fase === 'fin') return { ...base, puesto: puestoDe(j), de: jugadores.size };
      return base; // sala
    }

    function enviarA(j) {
      if (conexion && j.conectado && j.peerId) conexion.enviar(estadoPara(j), j.peerId);
    }
    function enviarATodos() { jugadores.forEach(enviarA); }

    // ---------- Mensajes de los celulares ----------
    function recibir(datos, peerId) {
      if (!datos || typeof datos !== 'object') return;
      if (datos.t === 'hola') {
        const idCliente = String(datos.id || '').slice(0, 40);
        if (!idCliente) return;
        if (expulsados.has(idCliente)) { conexion.enviar({ t: 'fuera' }, peerId); return; }
        let j = jugadores.get(idCliente);
        if (!j) {
          j = { id: idCliente, nombre: nombreUnico(String(datos.nombre || ''), idCliente), puntos: 0, resp: [] };
          jugadores.set(idCliente, j);
        }
        j.peerId = peerId; j.conectado = true;
        peerAJugador.set(peerId, idCliente);
        enviarA(j);
        actualizarParticipantes();
        return;
      }
      const j = jugadores.get(peerAJugador.get(peerId));
      if (!j || fase !== 'pregunta' || cerrada || datos.n !== n) return;
      const p = preg();

      if (datos.t === 'resp' && p.tipo === 'opcion') {
        if (respActuales.has(j.id)) return; // una sola respuesta
        // siempre trabajamos con una lista de posiciones elegidas (una sola si no es múltiple)
        const crudo = Array.isArray(datos.v) ? datos.v : [datos.v];
        const sel = [...new Set(crudo.map(Number))]
          .filter(k => Number.isInteger(k) && k >= 0 && k < p.opciones.length && p.opciones[k].trim()).sort();
        if (!sel.length || (!p.multiple && sel.length > 1)) return;
        const cor = AV.almacen.correctasDe(p);
        let correcta = null, puntos = 0, aciertos = 0;
        if (cor) {
          // puntaje parcial: (aciertos − opciones mal elegidas) / cantidad de correctas, nunca negativo
          aciertos = sel.filter(k => cor.includes(k)).length;
          const errores = sel.length - aciertos;
          const parte = Math.max(0, (aciertos - errores) / cor.length);
          correcta = parte === 1 ? true : (parte > 0 ? 'parcial' : false);
          puntos = parte > 0 ? Math.round((500 + 500 * restanteMs() / duracion) * parte) : 0;
        }
        respActuales.set(j.id, { v: sel, t: Date.now() - inicio, puntos, correcta, aciertos });
        j.resp[n] = sel;
        j.puntos += puntos;
        enviarA(j);
        actualizarConteo();
        // si ya respondieron todos los conectados, cerramos solos
        const nActual = n;
        if (conectados().every(x => respActuales.has(x.id))) setTimeout(() => { if (n === nActual && !cerrada) cerrarPregunta(); }, 700);
      }

      if (datos.t === 'palabra' && p.tipo === 'nube') {
        const lista = j.resp[n] || (j.resp[n] = []);
        if (lista.length >= MAX_PALABRAS) return;
        const texto = String(datos.v || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        const clave = AV.normalizarPalabra(texto);
        if (!clave || lista.some(w => AV.normalizarPalabra(w) === clave)) return;
        lista.push(texto);
        const e = nube.get(clave);
        if (e) e.cant++; else nube.set(clave, { texto: texto.toLowerCase(), cant: 1 });
        respActuales.set(j.id, { v: lista.slice(), t: Date.now() - inicio, puntos: 0, correcta: null });
        enviarA(j);
        actualizarConteo();
        dibujarNube();
      }
    }

    function salioPar(peerId) {
      const j = jugadores.get(peerAJugador.get(peerId));
      peerAJugador.delete(peerId);
      if (j && j.peerId === peerId) { j.conectado = false; actualizarParticipantes(); actualizarConteo(); }
    }

    // ---------- Escenas ----------
    function escenaSala() {
      fase = 'sala';
      escena.innerHTML = '';
      const codigoGrande = h('div', { class: 'codigo-grande', 'aria-label': 'Código de la sala: ' + codigo.split('').join(' ') },
        codigo.split('').map(c => h('span', { 'aria-hidden': 'true' }, c)));
      ref.chips = h('div', { class: 'participantes', 'aria-live': 'polite' });
      ref.cuenta = h('span', { class: 'contador-resp' }, '0 personas');
      ref.empezar = h('button', { class: 'boton boton-principal boton-grande', type: 'button', disabled: true, onclick: () => siguiente() }, 'Empezar');
      const qr = enlace
        ? h('div', { class: 'qr', html: AV.qrSVG(enlace), role: 'img', 'aria-label': 'Código QR para entrar a la sala' })
        : h('div', { class: 'papel', style: { maxWidth: '420px' } },
          h('h3', null, 'Sin QR en esta compu'),
          h('p', { class: 'suave', style: { margin: 0 } }, 'Abriste Aula en Vivo como archivo, y los celulares no pueden entrar a esa dirección. Los estudiantes entran desde la página publicada (por ejemplo, en GitHub Pages) y escriben el código. Para tener QR, cargá esa dirección en el inicio, en «Conexión de los celulares».'));

      escena.append(
        h('div', { class: 'sala' },
          h('div', { class: 'sala-instrucciones' },
            h('h1', null, cuest.titulo),
            !enlace
              ? h('p', null, 'Entrá a Aula en Vivo desde el celu, tocá «Unirme a una sala» y escribí este código:')
              : conf.red === 'nostr'
              ? h('ol', null,
                h('li', null, 'Escaneá el QR con la cámara del celu, o'),
                h('li', null, 'entrá a ', h('span', { class: 'sala-url' }, enlace.split(/[?#]/)[0].replace(/^https?:\/\//, '').replace(/index\.html$/, '')), ' y escribí el código:'))
              : h('p', null, 'Escaneá el QR con la cámara del celu. El código de la sala es:'),
            codigoGrande),
          qr),
        h('div', { class: 'fila-entre' }, ref.cuenta, h('span', { class: 'suave chico' }, 'Tocá un nombre para sacarlo de la sala.')),
        ref.chips,
        h('div', { class: 'controles-proy' },
          enlace ? h('button', { class: 'boton', type: 'button', onclick: () => {
            if (!navigator.clipboard) { AV.aviso(enlace, 6000); return; }
            navigator.clipboard.writeText(enlace).then(() => AV.aviso('Enlace copiado')).catch(() => AV.aviso(enlace, 6000));
          } }, 'Copiar enlace') : null,
          ref.empezar));
      actualizarParticipantes();
    }

    function actualizarParticipantes() {
      if (fase !== 'sala' || !ref.chips) { return; }
      ref.chips.innerHTML = '';
      const lista = [...jugadores.values()];
      lista.forEach(j => ref.chips.append(h('button', {
        class: 'chip' + (j.conectado ? '' : ' desconectado'), type: 'button', title: 'Sacar de la sala',
        onclick: () => {
          if (!confirm(`¿Sacar a «${j.nombre}» de la sala?`)) return;
          expulsados.add(j.id); jugadores.delete(j.id);
          if (j.peerId) { conexion.enviar({ t: 'fuera' }, j.peerId); peerAJugador.delete(j.peerId); }
          actualizarParticipantes();
        }
      }, j.nombre)));
      const c = conectados().length;
      ref.cuenta.textContent = c === 1 ? '1 persona conectada' : `${c} personas conectadas`;
      ref.empezar.disabled = jugadores.size === 0;
    }

    function escenaPregunta() {
      fase = 'pregunta';
      const p = preg();
      cerrada = false;
      respActuales = new Map();
      nube = new Map();
      duracion = p.tiempo * 1000;
      inicio = Date.now();
      escena.innerHTML = '';

      ref.regla = h('div', { class: 'regla', role: 'timer', 'aria-label': 'Tiempo restante' },
        h('div', { class: 'regla-avance' }), h('span', { class: 'regla-num' }, p.tiempo));
      ref.conteo = h('span', { class: 'contador-resp', 'aria-live': 'polite' }, '');
      const esEnc = !AV.almacen.correctasDe(p);
      const tipoTxt = p.tipo === 'nube' ? 'Nube de palabras'
        : (esEnc ? 'Encuesta' : 'Opción múltiple') + (p.multiple ? ', se pueden elegir varias' : '');

      escena.append(
        h('div', { class: 'preg-meta' }, h('span', null, `Pregunta ${n + 1} de ${preguntas.length}`), h('span', null, tipoTxt)),
        ref.regla,
        h('h1', { class: 'preg-texto' }, p.texto));

      if (p.tipo === 'opcion') {
        ref.opciones = h('div', { class: 'opciones-proy' });
        p.opciones.forEach((o, k) => {
          if (!o.trim()) return;
          ref.opciones.append(h('div', { class: 'opcion-proy ' + AV.CLASES[k], 'data-k': k },
            h('span', { class: 'relleno' }), h('span', { class: 'letra' }, AV.LETRAS[k]), h('span', { class: 'txt' }, o), h('span', { class: 'cant' }, '')));
        });
        escena.append(ref.opciones);
      } else {
        ref.nube = h('div', { class: 'nube', 'aria-live': 'polite' });
        escena.append(ref.nube);
        dibujarNube();
      }
      ref.cerrar = h('button', { class: 'boton boton-grande', type: 'button', onclick: cerrarPregunta }, 'Cerrar pregunta');
      escena.append(h('div', { class: 'fila-entre' }, ref.conteo, h('div', { class: 'controles-proy' }, ref.cerrar)));

      actualizarConteo();
      enviarATodos();
      clearInterval(reloj);
      reloj = setInterval(tic, 200);
      tic();
    }

    function tic() {
      if (fase !== 'pregunta' || !ref.regla) return;
      const r = restanteMs();
      const seg = Math.ceil(r / 1000);
      ref.regla.querySelector('.regla-avance').style.width = (100 * r / duracion) + '%';
      ref.regla.querySelector('.regla-num').textContent = seg;
      ref.regla.classList.toggle('poco', seg <= 5);
      if (r <= 0 && !cerrada) cerrarPregunta();
    }

    function actualizarConteo() {
      if (fase !== 'pregunta' || !ref.conteo) return;
      const total = conectados().length;
      const resp = respActuales.size;
      ref.conteo.textContent = `${resp} de ${total} ${preg().tipo === 'nube' ? 'participaron' : 'respondieron'}`;
    }

    function dibujarNube() {
      if (!ref.nube) return;
      const lista = [...nube.values()].sort((a, b) => b.cant - a.cant).slice(0, 60);
      ref.nube.innerHTML = '';
      if (!lista.length) { ref.nube.append(h('p', { class: 'nube-vacia' }, 'Las palabras van a ir apareciendo acá.')); return; }
      const max = lista[0].cant;
      // las más repetidas al centro: alternamos izquierda y derecha
      const orden = [];
      lista.forEach((w, i) => (i % 2 ? orden.push(w) : orden.unshift(w)));
      orden.forEach(w => {
        const tam = 1.1 + 3.4 * Math.sqrt(w.cant / max);
        const color = 'w' + (Math.abs([...w.texto].reduce((a, c) => a + c.charCodeAt(0), 0)) % 5);
        ref.nube.append(h('span', { class: color, style: { fontSize: tam + 'rem' }, title: w.cant + (w.cant === 1 ? ' vez' : ' veces') }, w.texto));
      });
    }

    function cerrarPregunta() {
      if (fase !== 'pregunta' || cerrada) return;
      cerrada = true;
      clearInterval(reloj);
      escenaResultado();
    }

    function escenaResultado() {
      fase = 'resultado';
      const p = preg();
      const ultima = n === preguntas.length - 1;
      ref.regla && ref.regla.remove();
      ref.cerrar && ref.cerrar.remove();
      ref.conteo.textContent = `${respActuales.size} ${respActuales.size === 1 ? 'respuesta' : 'respuestas'}`;

      if (p.tipo === 'opcion') {
        const cor = AV.almacen.correctasDe(p);
        const cuenta = p.opciones.map(() => 0);
        respActuales.forEach(r => r.v.forEach(k => cuenta[k]++));
        // porcentaje sobre quienes respondieron (en las de varias opciones puede sumar más de 100 %)
        const total = Math.max(1, respActuales.size);
        escena.classList.add('resultado');
        escena.classList.toggle('encuesta-res', !cor);
        ref.opciones.querySelectorAll('.opcion-proy').forEach(el => {
          const k = Number(el.dataset.k);
          el.querySelector('.cant').textContent = !cor ? Math.round(100 * cuenta[k] / total) + '%' : cuenta[k];
          requestAnimationFrame(() => { el.querySelector('.relleno').style.width = (100 * cuenta[k] / total) + '%'; });
          if (cor && cor.includes(k)) el.classList.add('es-correcta');
        });
      }

      const controles = escena.querySelector('.controles-proy');
      controles.innerHTML = '';
      const hayPuntos = preguntas.some(q => AV.almacen.correctasDe(q));
      if (AV.almacen.correctasDe(p) && !ultima) {
        controles.append(h('button', { class: 'boton boton-grande', type: 'button', onclick: escenaPosiciones }, 'Ver posiciones'));
      }
      controles.append(h('button', { class: 'boton boton-principal boton-grande', type: 'button', 'data-avanzar': '', onclick: siguiente },
        ultima ? (hayPuntos ? 'Ver el podio' : 'Terminar') : 'Siguiente pregunta'));
      controles.querySelector('[data-avanzar]').focus();
      enviarATodos();
    }

    function escenaPosiciones() {
      fase = 'posiciones';
      escena.className = 'escena';
      escena.innerHTML = '';
      const top = ranking().slice(0, 5);
      escena.append(
        h('div', { class: 'preg-meta' }, h('span', null, `Después de la pregunta ${n + 1} de ${preguntas.length}`)),
        h('h1', null, 'Posiciones'),
        h('ol', { class: 'posiciones' }, top.map(j => h('li', null,
          h('span', { class: 'puesto' }, puestoDe(j)), h('span', null, j.nombre), h('span', { class: 'pts' }, j.puntos)))),
        h('div', { class: 'controles-proy' },
          h('button', { class: 'boton boton-principal boton-grande', type: 'button', 'data-avanzar': '', onclick: siguiente }, 'Siguiente pregunta')));
      escena.querySelector('[data-avanzar]').focus();
    }

    function escenaFin() {
      fase = 'fin';
      escena.className = 'escena';
      escena.innerHTML = '';
      const r = ranking();
      const hayPuntos = preguntas.some(q => AV.almacen.correctasDe(q));
      escena.append(h('h1', null, hayPuntos ? '¡Terminamos!' : '¡Gracias por participar!'));
      if (hayPuntos && r.length) {
        const col = (j, i) => j ? h('div', { class: 'podio-col p' + (i + 1) },
          h('div', { class: 'podio-nombre' }, j.nombre), h('div', { class: 'podio-pts' }, j.puntos + ' puntos'),
          h('div', { class: 'podio-escalon' }, i + 1)) : h('div');
        escena.append(h('div', { class: 'podio' }, col(r[1], 1), col(r[0], 0), col(r[2], 2)));
      } else {
        escena.append(h('p', { class: 'suave', style: { fontSize: '1.4rem' } }, `Participaron ${jugadores.size} ${jugadores.size === 1 ? 'persona' : 'personas'}.`));
      }
      escena.append(h('div', { class: 'controles-proy' },
        h('a', { class: 'boton', href: '#/' }, 'Volver a mis cuestionarios'),
        h('button', { class: 'boton boton-principal boton-grande', type: 'button', onclick: descargarCSV }, 'Descargar resultados')));
      enviarATodos();
    }

    function siguiente() {
      if (fase === 'pregunta') return;
      if (n + 1 >= preguntas.length) { escenaFin(); return; }
      n++;
      escena.className = 'escena';
      escenaPregunta();
    }

    function descargarCSV() {
      const celda = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const enc = ['Puesto', 'Nombre', 'Puntos'];
      preguntas.forEach((p, i) => enc.push(`P${i + 1}: ${p.texto}`));
      const filas = [enc.map(celda).join(';')];
      ranking().forEach(j => {
        const fila = [puestoDe(j), j.nombre, j.puntos];
        preguntas.forEach((p, i) => {
          const r = j.resp[i];
          if (r === undefined) fila.push('');
          else if (p.tipo === 'nube') fila.push(r.join(', '));
          else {
            const cor = AV.almacen.correctasDe(p);
            const letras = r.map(k => AV.LETRAS[k]).join('+');
            if (!cor) { fila.push(letras); return; }
            const bien = r.length === cor.length && r.every(k => cor.includes(k));
            const parcial = !bien && r.some(k => cor.includes(k));
            fila.push(letras + (bien ? ' (bien)' : parcial ? ' (parcial)' : ' (mal)'));
          }
        });
        filas.push(fila.map(celda).join(';'));
      });
      const fecha = new Date().toISOString().slice(0, 10);
      AV.descargar(`resultados-${AV.nombreArchivo(cuest.titulo)}-${fecha}.csv`, '﻿' + filas.join('\r\n'), 'text/csv');
    }

    // ---------- Teclado: flecha derecha o espacio avanza ----------
    function teclado(e) {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || (e.key === ' ' && e.target === document.body)) {
        const btn = escena.querySelector('[data-avanzar]') || (fase === 'sala' && !ref.empezar.disabled ? ref.empezar : null);
        if (btn) { e.preventDefault(); btn.click(); }
        else if (fase === 'pregunta' && e.key === 'ArrowRight') { e.preventDefault(); cerrarPregunta(); }
      }
    }
    document.addEventListener('keydown', teclado);

    function antesDeSalir(e) {
      if (jugadores.size && fase !== 'fin') { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', antesDeSalir);

    // ---------- Arranque ----------
    escenaSala();
    AV.red.conectar({ codigo, rol: 'docente', red: conf.red, relay: conf.relay }).then(c => {
      if (destruido) { c.salir(); return; }
      conexion = c;
      c.alRecibir(recibir);
      c.alSalir(salioPar);
      c.alError(err => { estadoRed.textContent = 'Problema de conexión'; estadoRed.className = 'estado-red error'; AV.aviso(err.message, 5000); });
      const nombreRed = AV.almacen.REDES[conf.red].nombre.replace(' (recomendada)', '');
      estadoRed.textContent = 'Conectando con la red ' + nombreRed + '…';
      // Revisamos que de verdad haya relays conectados antes de decir que la sala está abierta
      const desde = Date.now();
      const revisar = () => {
        if (destruido) return;
        const n = c.relaysConectados();
        if (n > 0 || n === -1) {
          estadoRed.textContent = 'Sala abierta · ' + nombreRed;
          estadoRed.className = 'estado-red lista';
          estadoRed.title = n > 0 ? `${n} ${n === 1 ? 'relay conectado' : 'relays conectados'}` : '';
        } else if (Date.now() - desde > 12000) {
          estadoRed.textContent = 'Sin conexión con la red ' + nombreRed;
          estadoRed.className = 'estado-red error';
          estadoRed.title = 'Revisá internet o elegí otra red en el inicio, en «Conexión de los celulares».';
        }
      };
      revisar();
      ref.relojRed = setInterval(revisar, 2000);
    }).catch(err => {
      estadoRed.textContent = 'No se pudo abrir la sala';
      estadoRed.className = 'estado-red error';
      AV.aviso(err.message, 6000);
    });

    // limpieza al salir de esta pantalla
    return () => {
      destruido = true;
      clearInterval(reloj);
      clearInterval(ref.relojRed);
      document.removeEventListener('keydown', teclado);
      window.removeEventListener('beforeunload', antesDeSalir);
      if (conexion) conexion.salir();
    };
  }

  AV.docente = { render };
})(window.AV);
