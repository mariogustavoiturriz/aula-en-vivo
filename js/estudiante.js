/* Aula en Vivo — vista del estudiante (el celular)
   Copyright (C) 2026 Mario Gustavo Iturriz — Licencia GPL-3.0-o-posterior */
'use strict';

(function (AV) {
  const { h } = AV;

  function idCliente() {
    let id = AV.guardado.leer('aulaenvivo.id', null);
    if (!id) { id = AV.generarId(); AV.guardado.escribir('aulaenvivo.id', id); }
    return id;
  }

  function render(main, codigoInicial) {
    const conf = AV.red.redDesdeEnlace();
    let conexion = null, docente = null, estado = null, claveEscena = '';
    let relojLocal = null, finLocal = 0, tBusqueda = null, destruido = false;

    const cuerpo = h('div', { class: 'celu-cuerpo' });
    main.innerHTML = '';
    main.append(h('div', { class: 'celu' }, AV.encabezado(), cuerpo));
    document.title = 'Unirme · Aula en Vivo';

    // ---------- Pantalla de entrada ----------
    function pantallaEntrada(error) {
      claveEscena = 'entrada';
      cuerpo.innerHTML = '';
      const inCodigo = h('input', { type: 'text', id: 'codigo', value: codigoInicial || '', autocomplete: 'off', autocapitalize: 'characters', maxlength: 8, required: true,
        style: { textTransform: 'uppercase', letterSpacing: '.2em', fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.4rem' } });
      const inNombre = h('input', { type: 'text', id: 'nombre', value: AV.guardado.leer('aulaenvivo.nombre', ''), autocomplete: 'nickname', maxlength: 24, required: true, placeholder: 'Cómo querés aparecer' });
      const form = h('form', { class: 'papel', onsubmit: e => {
        e.preventDefault();
        const codigo = AV.limpiarCodigo(inCodigo.value);
        const nombre = inNombre.value.trim();
        if (codigo.length < 4) { inCodigo.focus(); AV.aviso('Revisá el código de la sala.'); return; }
        if (!nombre) { inNombre.focus(); AV.aviso('Escribí tu nombre.'); return; }
        AV.guardado.escribir('aulaenvivo.nombre', nombre);
        entrar(codigo, nombre);
      } },
        h('h1', null, 'Unirme a la sala'),
        error ? h('p', { role: 'alert', style: { color: 'var(--error)', fontWeight: 700 } }, error) : null,
        h('div', { class: 'campo' }, h('label', { for: 'codigo' }, 'Código de la sala'), inCodigo),
        h('div', { class: 'campo' }, h('label', { for: 'nombre' }, 'Tu nombre'), inNombre),
        h('button', { class: 'boton boton-principal boton-grande', type: 'submit', style: { width: '100%' } }, 'Entrar'),
        h('p', { class: 'ayuda', style: { marginTop: '12px' } }, 'Si no conecta, entrá escaneando el QR que muestra tu docente.'));
      cuerpo.append(form);
      (codigoInicial ? inNombre : inCodigo).focus();
    }

    function mensaje(grande, chico, extra) {
      cuerpo.innerHTML = '';
      cuerpo.append(h('div', { class: 'celu-centro', role: 'status' },
        h('p', { class: 'grande' }, grande),
        chico ? h('p', { class: 'suave' }, chico) : null,
        extra || null));
    }

    // ---------- Conexión ----------
    async function entrar(codigo, nombre) {
      claveEscena = 'buscando';
      mensaje('Buscando la sala…', 'Esto puede tardar unos segundos.');
      const hola = () => conexion.enviar({ t: 'hola', id: idCliente(), nombre }, docente);
      try {
        conexion = await AV.red.conectar({ codigo, rol: 'estudiante', red: conf.red, relay: conf.relay });
      } catch (err) { pantallaEntrada(err.message); return; }
      if (destruido) { conexion.salir(); return; }

      clearTimeout(tBusqueda);
      tBusqueda = setTimeout(() => {
        if (!docente && claveEscena === 'buscando') mensaje('Todavía no encontramos la sala', 'Revisá que el código sea ' + codigo + ' y que tu docente tenga la sala abierta. Seguimos intentando.',
          h('button', { class: 'boton', type: 'button', onclick: () => { conexion.salir(); conexion = null; pantallaEntrada(); } }, 'Cambiar el código'));
      }, 20000);

      conexion.alEntrar(peerId => {
        // en modo pasivo solo nos conectamos con el docente
        docente = peerId;
        hola();
      });
      conexion.alSalir(peerId => {
        if (peerId !== docente) return;
        docente = null;
        clearInterval(relojLocal);
        if (estado && estado.fase === 'fin') return;
        claveEscena = 'cortado';
        mensaje('Se cortó la conexión', 'Estamos intentando volver a conectarte. No cierres esta página.');
      });
      conexion.alRecibir((datos, peerId) => {
        if (peerId !== docente || !datos) return;
        if (datos.t === 'fuera') { conexion.salir(); conexion = null; claveEscena = 'fuera'; mensaje('Saliste de la sala', 'Tu docente te sacó de esta sala.'); return; }
        if (datos.t === 'estado') mostrar(datos);
      });
      conexion.alError(err => AV.aviso(err.message, 5000));
    }

    function enviar(datos) { if (conexion && docente) conexion.enviar(datos, docente); }

    // ---------- Pantallas según lo que manda el docente ----------
    function mostrar(e) {
      estado = e;
      const clave = e.fase + ':' + (e.n ?? '');
      clearInterval(relojLocal);

      if (e.fase === 'sala') {
        claveEscena = clave;
        mensaje('¡Listo, ' + e.nombre + '!', 'Ya estás en la sala. Mirá el pizarrón: arrancamos en un ratito.');
        return;
      }
      if (e.fase === 'pregunta') {
        if (e.tipo === 'nube' && clave === claveEscena) { actualizarPalabras(e); iniciarReloj(e); return; }
        claveEscena = clave;
        e.tipo === 'opcion' ? pantallaOpciones(e) : pantallaNube(e);
        iniciarReloj(e);
        return;
      }
      if (e.fase === 'resultado') { claveEscena = clave; pantallaResultado(e); return; }
      if (e.fase === 'fin') { claveEscena = clave; pantallaFin(e); }
    }

    function iniciarReloj(e) {
      const nodo = cuerpo.querySelector('.tiempo-celu');
      if (!nodo) return;
      finLocal = Date.now() + (e.restante || 0);
      const tic = () => {
        const s = Math.max(0, Math.ceil((finLocal - Date.now()) / 1000));
        nodo.textContent = s + ' s';
        if (s <= 0) clearInterval(relojLocal);
      };
      tic();
      relojLocal = setInterval(tic, 250);
    }

    function cabeceraPregunta(e) {
      return [
        h('div', { class: 'info-celu' }, h('span', null, `Pregunta ${e.n + 1} de ${e.total}`), h('span', { class: 'tiempo-celu', 'aria-label': 'Tiempo restante' }, '')),
        h('h1', { class: 'celu-preg' }, e.texto)
      ];
    }

    function pantallaOpciones(e) {
      cuerpo.innerHTML = '';
      // respondio llega como lista de posiciones elegidas (o null si todavía no respondió)
      const elegidas = Array.isArray(e.respondio) ? e.respondio : (e.respondio === null || e.respondio === undefined ? [] : [e.respondio]);
      const respondida = elegidas.length > 0;
      const marcadas = new Set();
      const grilla = h('div', { class: 'botones-resp' + (respondida ? ' bloqueados' : ''), role: 'group', 'aria-label': 'Opciones' });
      const aviso = h('p', { class: 'suave', role: 'status', style: { textAlign: 'center', margin: 0 } },
        respondida ? 'Respuesta enviada. Esperá a que se cierre la pregunta.' : (e.multiple ? 'Podés elegir más de una. Después tocá Enviar.' : ''));
      const btnEnviar = e.multiple && !respondida ? h('button', {
        class: 'boton boton-principal boton-grande', type: 'button', disabled: true, style: { width: '100%' },
        onclick: () => mandar([...marcadas].sort())
      }, 'Enviar respuesta') : null;

      function mandar(lista) {
        grilla.classList.add('bloqueados');
        grilla.querySelectorAll('button').forEach(x => { x.disabled = true; x.classList.toggle('elegida', lista.includes(Number(x.dataset.k))); });
        if (btnEnviar) btnEnviar.remove();
        enviar({ t: 'resp', n: e.n, v: e.multiple ? lista : lista[0] });
        aviso.textContent = 'Respuesta enviada. Esperá a que se cierre la pregunta.';
      }

      e.opciones.forEach(o => {
        const b = h('button', {
          class: 'boton-resp ' + AV.CLASES[o.k] + (elegidas.includes(o.k) ? ' elegida' : ''), type: 'button', disabled: respondida,
          'data-k': o.k, 'aria-pressed': e.multiple ? String(elegidas.includes(o.k)) : null,
          onclick: () => {
            if (!e.multiple) { mandar([o.k]); return; }
            marcadas.has(o.k) ? marcadas.delete(o.k) : marcadas.add(o.k);
            b.classList.toggle('elegida', marcadas.has(o.k));
            b.setAttribute('aria-pressed', String(marcadas.has(o.k)));
            btnEnviar.disabled = marcadas.size === 0;
          }
        }, h('span', { class: 'letra' }, AV.LETRAS[o.k]), h('span', null, o.txt));
        grilla.append(b);
      });
      cuerpo.append(...cabeceraPregunta(e), grilla, btnEnviar, aviso);
      if (!respondida) grilla.querySelector('button').focus({ preventScroll: true });
    }

    function pantallaNube(e) {
      cuerpo.innerHTML = '';
      const input = h('input', { type: 'text', id: 'palabra', maxlength: 30, autocomplete: 'off', placeholder: 'Una palabra o frase corta' });
      const form = h('form', { class: 'papel', onsubmit: ev => {
        ev.preventDefault();
        const v = input.value.trim();
        if (!v) return;
        enviar({ t: 'palabra', n: e.n, v });
        input.value = '';
        input.focus();
      } },
        h('label', { for: 'palabra' }, 'Tu respuesta'),
        h('div', { class: 'form-codigo' }, input, h('button', { class: 'boton boton-principal', type: 'submit' }, 'Enviar')),
        h('p', { class: 'ayuda', 'data-restan': '' }, ''));
      const enviadas = h('div', { class: 'palabras-enviadas', 'aria-live': 'polite' });
      cuerpo.append(...cabeceraPregunta(e), form, enviadas);
      actualizarPalabras(e);
      input.focus({ preventScroll: true });
    }

    function actualizarPalabras(e) {
      const lista = e.palabras || [];
      const enviadas = cuerpo.querySelector('.palabras-enviadas');
      const restan = cuerpo.querySelector('[data-restan]');
      const form = cuerpo.querySelector('form');
      if (!enviadas) return;
      enviadas.innerHTML = '';
      lista.forEach(w => enviadas.append(h('span', { class: 'chip' }, w)));
      const quedan = e.maxPalabras - lista.length;
      if (quedan <= 0) {
        form.replaceWith(h('p', { class: 'papel', style: { textAlign: 'center', fontWeight: 700 } }, '¡Listo! Mandaste tus ' + e.maxPalabras + ' palabras. Mirá la nube en el pizarrón.'));
      } else if (restan) {
        restan.textContent = lista.length ? `Podés mandar ${quedan} más.` : `Podés mandar hasta ${e.maxPalabras}.`;
      }
    }

    function pantallaResultado(e) {
      let sello, grande, chico;
      if (e.tipo === 'nube' || e.esEncuesta) {
        sello = h('div', { class: 'sello neutro', 'aria-hidden': 'true' }, '✓');
        grande = e.respondio ? '¡Gracias!' : 'Esta no la contestaste';
        chico = 'Mirá los resultados en el pizarrón.';
      } else if (!e.respondio) {
        sello = h('div', { class: 'sello mal', 'aria-hidden': 'true' }, '–');
        grande = 'Se terminó el tiempo';
        chico = (e.variasCorrectas ? 'Las correctas eran: ' : 'La correcta era: ') + e.textoCorrecta;
      } else if (e.correcta === true) {
        sello = h('div', { class: 'sello bien', 'aria-hidden': 'true' }, '✓');
        grande = '¡Correcto!';
        chico = null;
      } else if (e.correcta === 'parcial') {
        sello = h('div', { class: 'sello neutro', 'aria-hidden': 'true' }, '≈');
        grande = 'Casi';
        chico = `Acertaste ${e.aciertos} de ${e.totalCorrectas}. Las correctas eran: ` + e.textoCorrecta;
      } else {
        sello = h('div', { class: 'sello mal', 'aria-hidden': 'true' }, '✗');
        grande = 'Esta vez no';
        chico = (e.variasCorrectas ? 'Las correctas eran: ' : 'La correcta era: ') + e.textoCorrecta;
      }
      cuerpo.innerHTML = '';
      cuerpo.append(h('div', { class: 'celu-centro', role: 'status' },
        sello,
        h('p', { class: 'grande' }, grande),
        e.ganados > 0 ? h('p', { class: 'puntos-celu' }, '+' + e.ganados) : null,
        chico ? h('p', null, chico) : null,
        (e.tipo === 'opcion' && !e.esEncuesta) ? h('p', { class: 'suave' }, `Vas ${e.puesto}° de ${e.de}, con ${e.puntos} puntos.`) : null));
    }

    function pantallaFin(e) {
      const conPuntos = e.puntos > 0;
      cuerpo.innerHTML = '';
      cuerpo.append(h('div', { class: 'celu-centro', role: 'status' },
        h('p', { class: 'grande' }, '¡Terminamos!'),
        conPuntos ? h('p', { class: 'puntos-celu' }, `${e.puesto}° de ${e.de}`) : null,
        conPuntos ? h('p', null, `Sumaste ${e.puntos} puntos.`) : h('p', null, 'Gracias por participar, ' + e.nombre + '.'),
        h('a', { class: 'boton', href: '#/' }, 'Salir')));
      if (conexion) setTimeout(() => { if (conexion) { conexion.salir(); conexion = null; } }, 1500);
    }

    pantallaEntrada();

    return () => {
      destruido = true;
      clearInterval(relojLocal);
      clearTimeout(tBusqueda);
      if (conexion) conexion.salir();
    };
  }

  AV.estudiante = { render };
})(window.AV);
