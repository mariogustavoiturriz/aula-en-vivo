/* Aula en Vivo — vista del estudiante (el celular)
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior */
'use strict';

(function (AV) {
  const { h } = AV;
  /** append que ignora los bloques opcionales vacíos (null, undefined, false) */
  const poner = (padre, ...xs) => padre.append(...xs.flat().filter(x => x !== null && x !== undefined && x !== false));

  function idCliente() {
    let id = AV.guardado.leer('aulaenvivo.id', null);
    if (!id) { id = AV.generarId(); AV.guardado.escribir('aulaenvivo.id', id); }
    return id;
  }

  function render(main, codigoInicial) {
    const conf = AV.red.redDesdeEnlace();
    let conexion = null, docente = null, estado = null, claveEscena = '';
    let vistaRitmo = 'menu';   // en el set de actividades: 'menu' o el número de actividad abierta
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
      // avatar: se arma por partes y queda guardado en este celu para la próxima
      let avatar = AV.avatar.limpiar(AV.guardado.leer('aulaenvivo.avatar', null) || AV.avatar.aleatorio());
      const vista = h('div', { class: 'avatar-vista' });
      const filas = h('div', { class: 'avatar-partes' });
      function pintarAvatar() {
        vista.innerHTML = '';
        vista.append(AV.avatar.nodo(avatar, 120));
        vista.setAttribute('aria-label', 'Tu avatar: ' + AV.avatar.descripcion(avatar));
        const v = AV.avatar.partes(avatar);
        filas.innerHTML = '';
        AV.avatar.PARTES.forEach((parte, i) => {
          const etiqueta = { color: 'Color', forma: 'Forma', ojos: 'Ojos', boca: 'Boca', extra: 'Accesorio' }[parte];
          filas.append(h('div', { class: 'avatar-fila' },
            h('button', { type: 'button', class: 'boton boton-chico', 'aria-label': etiqueta + ' anterior', onclick: () => { avatar = AV.avatar.cambiar(avatar, parte, -1); pintarAvatar(); } }, '◀'),
            h('span', null, h('small', null, etiqueta), AV.avatar.NOMBRES[parte][v[i]]),
            h('button', { type: 'button', class: 'boton boton-chico', 'aria-label': etiqueta + ' siguiente', onclick: () => { avatar = AV.avatar.cambiar(avatar, parte, 1); pintarAvatar(); } }, '▶')));
        });
      }
      pintarAvatar();
      const editorAvatar = h('fieldset', { class: 'campo avatar-editor' },
        h('legend', null, 'Tu avatar'),
        h('div', { class: 'avatar-arriba' }, vista,
          h('button', { type: 'button', class: 'boton', onclick: () => { avatar = AV.avatar.aleatorio(); pintarAvatar(); } }, '🎲 Al azar')),
        filas);
      const form = h('form', { class: 'papel', onsubmit: e => {
        e.preventDefault();
        const codigo = AV.limpiarCodigo(inCodigo.value);
        const nombre = inNombre.value.trim();
        if (codigo.length < 4) { inCodigo.focus(); AV.aviso('Revisá el código de la sala.'); return; }
        if (!nombre) { inNombre.focus(); AV.aviso('Escribí tu nombre.'); return; }
        AV.guardado.escribir('aulaenvivo.nombre', nombre);
        AV.guardado.escribir('aulaenvivo.avatar', avatar);
        entrar(codigo, nombre, avatar);
      } },
        h('h1', null, 'Unirme a la sala'),
        error ? h('p', { role: 'alert', style: { color: 'var(--error)', fontWeight: 700 } }, error) : null,
        h('div', { class: 'campo' }, h('label', { for: 'codigo' }, 'Código de la sala'), inCodigo),
        h('div', { class: 'campo' }, h('label', { for: 'nombre' }, 'Tu nombre'),
          h('div', { class: 'form-texto' }, inNombre,
            h('button', { type: 'button', class: 'boton', title: 'Inventame un apodo', 'aria-label': 'Inventame un apodo', onclick: () => { inNombre.value = AV.avatar.apodo(); } }, '🎲'))),
        editorAvatar,
        h('button', { class: 'boton boton-principal boton-grande', type: 'submit', style: { width: '100%' } }, 'Entrar'),
        h('p', { class: 'ayuda', style: { marginTop: '12px' } }, 'Si no conecta, entrá escaneando el QR que muestra tu docente.'));
      poner(cuerpo, form);
      (codigoInicial ? inNombre : inCodigo).focus();
    }

    function mensaje(grande, chico, extra) {
      cuerpo.innerHTML = '';
      poner(cuerpo, h('div', { class: 'celu-centro', role: 'status' },
        h('p', { class: 'grande' }, grande),
        chico ? h('p', { class: 'suave' }, chico) : null,
        extra || null));
    }

    // ---------- Conexión ----------
    async function entrar(codigo, nombre, avatar) {
      claveEscena = 'buscando';
      mensaje('Buscando la sala…', 'Esto puede tardar unos segundos.');
      const hola = () => conexion.enviar({ t: 'hola', id: idCliente(), nombre, avatar }, docente);
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
        mensaje('¡Listo, ' + e.nombre + '!', e.modo === 'escape'
          ? 'Ya estás en la sala. Cuando empiece el escape room, vas a ir abriendo candados a tu ritmo.'
          : e.modo === 'set' ? 'Ya estás en la sala. Cuando empiece, vas a ver todas las actividades y las hacés en el orden que quieras.'
          : 'Ya estás en la sala. Mirá el pizarrón: arrancamos en un ratito.');
        cuerpo.querySelector('.celu-centro').prepend(AV.avatar.nodo(e.avatar, 120, 'avatar-sala'));
        poner(cuerpo, barraReacciones());
        return;
      }
      if (e.fase === 'ritmo') { claveEscena = 'ritmo'; pantallaRitmo(e); return; }
      if (e.fase === 'pregunta') {
        if (e.tipo === 'nube' && clave === claveEscena) { actualizarPalabras(e); iniciarReloj(e); return; }
        claveEscena = clave;
        e.tipo === 'opcion' ? pantallaOpciones(e) : e.tipo === 'texto' ? pantallaTexto(e)
          : (e.tipo === 'orden' || e.tipo === 'numero') ? pantallaWidget(e) : pantallaNube(e);
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
      poner(cuerpo, ...cabeceraPregunta(e), grilla, btnEnviar, aviso);
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
      poner(cuerpo, ...cabeceraPregunta(e), form, enviadas);
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
      } else if (e.correcta === 'cerca') {
        sello = h('div', { class: 'sello bien', 'aria-hidden': 'true' }, '◎');
        grande = '¡Muy cerca!';
        chico = 'La respuesta era ' + e.textoCorrecta + '.';
      } else if (e.correcta === 'parcial') {
        sello = h('div', { class: 'sello neutro', 'aria-hidden': 'true' }, '≈');
        grande = 'Casi';
        chico = e.tipo === 'orden'
          ? `Ubicaste bien ${e.aciertos}. El orden era: ${e.textoCorrecta}`
          : `Acertaste ${e.aciertos} de ${e.totalCorrectas}. Las correctas eran: ` + e.textoCorrecta;
      } else {
        sello = h('div', { class: 'sello mal', 'aria-hidden': 'true' }, '✗');
        grande = 'Esta vez no';
        chico = (e.variasCorrectas ? 'Las correctas eran: ' : 'La correcta era: ') + e.textoCorrecta;
      }
      cuerpo.innerHTML = '';
      poner(cuerpo, h('div', { class: 'celu-centro', role: 'status' },
        sello,
        h('p', { class: 'grande' }, grande),
        e.ganados > 0 ? h('p', { class: 'puntos-celu' }, '+' + e.ganados) : null,
        e.racha >= 2 ? h('p', { class: 'racha-celu' }, `🔥 Racha de ${e.racha}` + (e.bonus ? ` (+${e.bonus} extra)` : '')) : null,
        chico ? h('p', null, chico) : null,
        (e.tipo !== 'nube' && !e.esEncuesta) ? h('p', { class: 'suave' }, `Vas ${e.puesto}° de ${e.de}, con ${e.puntos} puntos.`) : null),
        barraReacciones());
    }

    // ---------- Reacciones: mandan un emoji que sube por el proyector ----------
    function barraReacciones() {
      return h('div', { class: 'reacciones', role: 'group', 'aria-label': 'Reaccionar en el pizarrón' },
        ['👏', '❤️', '😂', '😮', '🤔', '🔥'].map(v => h('button', { type: 'button', class: 'reac-btn', 'aria-label': 'Reaccionar con ' + v, onclick: ev => {
          enviar({ t: 'reac', v });
          const b = ev.currentTarget; b.classList.remove('pulso'); void b.offsetWidth; b.classList.add('pulso');
        } }, v)));
    }

    // ---------- Ordenar y deslizador (en vivo y a su ritmo) ----------
    function widgetOrden(q, alEnviar) {
      let orden = q.items.map(it => it.k);
      const textos = new Map(q.items.map(it => [it.k, it.txt]));
      const lista = h('ol', { class: 'lista-orden', 'aria-label': 'Elementos para ordenar' });
      const enviarBtn = h('button', { class: 'boton boton-principal boton-grande', type: 'button', style: { width: '100%' }, onclick: () => {
        lista.querySelectorAll('button').forEach(b => { b.disabled = true; });
        enviarBtn.disabled = true; enviarBtn.textContent = 'Enviado';
        alEnviar(orden.slice());
      } }, 'Enviar orden');
      function mover(i, d, foco) {
        const j = i + d;
        if (j < 0 || j >= orden.length) return;
        [orden[i], orden[j]] = [orden[j], orden[i]];
        pintar(); lista.querySelectorAll('li')[j].querySelector(`[data-d="${foco}"]`)?.focus();
      }
      function pintar() {
        lista.innerHTML = '';
        orden.forEach((k, i) => lista.append(h('li', null,
          h('span', { class: 'pos', 'aria-hidden': 'true' }, i + 1),
          h('span', { class: 'txt' }, textos.get(k)),
          h('span', { class: 'flechas' },
            h('button', { type: 'button', class: 'boton boton-chico', 'data-d': '-1', disabled: i === 0, 'aria-label': `Subir «${textos.get(k)}»`, onclick: () => mover(i, -1, -1) }, '▲'),
            h('button', { type: 'button', class: 'boton boton-chico', 'data-d': '1', disabled: i === orden.length - 1, 'aria-label': `Bajar «${textos.get(k)}»`, onclick: () => mover(i, 1, 1) }, '▼')))));
      }
      pintar();
      return [h('p', { class: 'suave chico', style: { margin: 0 } }, 'Usá las flechas para ordenar y después tocá Enviar.'), lista, enviarBtn];
    }

    function widgetNumero(q, alEnviar) {
      const nm = q.num;
      const medio = nm.min + Math.round((nm.max - nm.min) / 2 / nm.paso) * nm.paso;
      const fmt = x => String(Math.round(x * 1000) / 1000).replace('.', ',');
      const valor = h('output', { class: 'valor-num', for: 'desl-' + q.n }, fmt(medio));
      const desl = h('input', { type: 'range', id: 'desl-' + q.n, min: nm.min, max: nm.max, step: nm.paso, value: medio, 'aria-label': 'Tu respuesta',
        oninput: e => { valor.textContent = fmt(Number(e.target.value)); } });
      const btn = h('button', { class: 'boton boton-principal boton-grande', type: 'button', style: { width: '100%' }, onclick: () => {
        desl.disabled = true; btn.disabled = true; btn.textContent = 'Enviado';
        alEnviar(Number(desl.value));
      } }, 'Enviar');
      return [h('div', { class: 'papel deslizador' }, valor, desl,
        h('div', { class: 'escala-ext' },
          h('span', null, fmt(nm.min), nm.etiquetaMin ? h('small', null, nm.etiquetaMin) : null),
          h('span', null, fmt(nm.max), nm.etiquetaMax ? h('small', null, nm.etiquetaMax) : null))), btn];
    }

    function pantallaWidget(e) {
      cuerpo.innerHTML = '';
      const respondida = e.respondio !== null && e.respondio !== undefined;
      if (respondida) {
        poner(cuerpo, ...cabeceraPregunta(e), h('p', { class: 'respuesta-feedback neutro', role: 'status' }, 'Respuesta enviada. Esperá a que se cierre la pregunta.'));
        return;
      }
      const w = e.tipo === 'orden' ? widgetOrden(e, v => enviar({ t: 'resp', n: e.n, v })) : widgetNumero(e, v => enviar({ t: 'resp', n: e.n, v }));
      poner(cuerpo, ...cabeceraPregunta(e), ...w);
    }

    function pantallaFin(e) {
      clearInterval(relojLocal);
      if (e.modo === 'escape') {
        cuerpo.innerHTML = '';
        poner(cuerpo, h('div', { class: 'celu-centro', role: 'status' },
          h('p', { class: 'grande' }, e.tiempo ? '¡Escapaste!' : 'Se terminó el tiempo'),
          h('p', { class: 'puntos-celu' }, `${e.puesto}° de ${e.de}`),
          h('p', null, e.tiempo ? `Abriste los ${e.total} candados en ${e.tiempo}.` : `Abriste ${e.abiertos} de ${e.total} candados.`),
          h('a', { class: 'boton', href: '#/' }, 'Salir')));
        if (conexion) setTimeout(() => { if (conexion) { conexion.salir(); conexion = null; } }, 1500);
        return;
      }
      const conPuntos = e.puntos > 0;
      cuerpo.innerHTML = '';
      poner(cuerpo, h('div', { class: 'celu-centro', role: 'status' },
        h('p', { class: 'grande' }, '¡Terminamos!'),
        conPuntos ? h('p', { class: 'puntos-celu' }, `${e.puesto}° de ${e.de}`) : null,
        conPuntos ? h('p', null, `Sumaste ${e.puntos} puntos.`) : h('p', null, 'Gracias por participar, ' + e.nombre + '.'),
        h('a', { class: 'boton', href: '#/' }, 'Salir')));
      if (conexion) setTimeout(() => { if (conexion) { conexion.salir(); conexion = null; } }, 1500);
    }

    // ---------- Respuesta escrita en vivo ----------
    function pantallaTexto(e) {
      cuerpo.innerHTML = '';
      if (e.respondio) {
        poner(cuerpo, ...cabeceraPregunta(e), h('p', { class: 'respuesta-feedback neutro', role: 'status' }, 'Respuesta enviada: ' + e.respondio + '. Esperá a que se cierre la pregunta.'));
        return;
      }
      poner(cuerpo, ...cabeceraPregunta(e), formRespuesta({ n: e.n, tipo: 'texto' }, v => enviar({ t: 'resp', n: e.n, v })));
      cuerpo.querySelector('input').focus({ preventScroll: true });
    }

    /** Formulario para escribir una respuesta (respuesta escrita o nube de palabras) */
    function formRespuesta(q, alEnviar) {
      const id = 'resp-' + q.n;
      const input = h('input', { type: 'text', id, maxlength: q.tipo === 'nube' ? 30 : 60, autocomplete: 'off', autocapitalize: 'off',
        inputmode: 'text', placeholder: q.tipo === 'nube' ? 'Una palabra o frase corta' : 'Tu respuesta' });
      const boton = h('button', { class: 'boton boton-principal', type: 'submit' }, 'Enviar');
      return h('form', { class: 'papel', onsubmit: ev => {
        ev.preventDefault();
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        boton.disabled = true; input.disabled = true; boton.textContent = 'Enviando…';
        alEnviar(v);
      } }, h('label', { for: id }, 'Tu respuesta'), h('div', { class: 'form-texto' }, input, boton));
    }

    /** Botones de opciones para los modos a su ritmo (una sola o varias) */
    function botonesRitmo(q, alEnviar) {
      const marcadas = new Set();
      const grilla = h('div', { class: 'botones-resp', role: 'group', 'aria-label': 'Opciones' });
      const btnEnviar = q.multiple ? h('button', { class: 'boton boton-principal boton-grande', type: 'button', disabled: true, style: { width: '100%' },
        onclick: () => { bloquear(); alEnviar([...marcadas].sort()); } }, 'Enviar respuesta') : null;
      function bloquear() { grilla.classList.add('bloqueados'); grilla.querySelectorAll('button').forEach(b => { b.disabled = true; }); if (btnEnviar) btnEnviar.disabled = true; }
      q.opciones.forEach(o => {
        const b = h('button', { class: 'boton-resp ' + AV.CLASES[o.k], type: 'button', 'aria-pressed': q.multiple ? 'false' : null, onclick: () => {
          if (!q.multiple) { b.classList.add('elegida'); bloquear(); alEnviar(o.k); return; }
          marcadas.has(o.k) ? marcadas.delete(o.k) : marcadas.add(o.k);
          b.classList.toggle('elegida', marcadas.has(o.k)); b.setAttribute('aria-pressed', String(marcadas.has(o.k)));
          btnEnviar.disabled = marcadas.size === 0;
        } }, h('span', { class: 'letra' }, AV.LETRAS[o.k]), h('span', null, o.txt));
        grilla.append(b);
      });
      return [grilla, btnEnviar, q.multiple ? h('p', { class: 'suave chico', style: { textAlign: 'center', margin: 0 } }, 'Podés elegir más de una. Después tocá Enviar.') : null];
    }

    function zonaRespuesta(q) {
      const mandar = v => enviar({ t: q.tipo === 'nube' ? 'palabra' : 'resp', n: q.n, v });
      if (q.tipo === 'opcion') return botonesRitmo(q, mandar);
      if (q.tipo === 'orden') return widgetOrden(q, mandar);
      if (q.tipo === 'numero') return widgetNumero(q, mandar);
      return [formRespuesta(q, mandar)];
    }

    // ---------- Escape room y set de actividades: cada uno a su ritmo ----------
    function cabeceraRitmo(e) {
      return h('div', { class: 'info-celu' },
        h('span', null, e.modo === 'escape' ? 'Escape room' : 'Set de actividades'),
        e.restante !== null && e.restante !== undefined ? h('span', { class: 'tiempo-celu', 'aria-label': 'Tiempo restante' }, '') : h('span', null, e.modo === 'set' ? `${e.puntos} pts` : ''));
    }
    function iniciarRelojTotal(e) {
      const nodo = cuerpo.querySelector('.tiempo-celu');
      if (!nodo || e.restante === null || e.restante === undefined) return;
      const fin = Date.now() + e.restante;
      const tic = () => {
        const t = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
        nodo.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
        if (t <= 0) clearInterval(relojLocal);
      };
      tic();
      relojLocal = setInterval(tic, 500);
    }

    function pantallaRitmo(e) {
      e.modo === 'escape' ? pantallaEscape(e) : pantallaSet(e);
      iniciarRelojTotal(e);
    }

    function pantallaEscape(e) {
      cuerpo.innerHTML = '';
      const actual = e.prog.findIndex(x => !x.hecho);
      const fila = h('div', { class: 'candados', 'aria-label': `Abriste ${e.prog.filter(x => x.hecho).length} de ${e.total} candados` },
        e.prog.map((x, i) => h('span', { class: x.hecho ? 'abierto' : (i === actual ? 'actual' : ''), 'aria-hidden': 'true' }, x.hecho ? '🔓' : '🔒')));
      poner(cuerpo, cabeceraRitmo(e), fila);
      if (e.ultimo && e.ultimo.hecho && e.ultimo.n !== undefined && actual !== -1) AV.aviso(`🔓 ¡Se abrió el candado ${e.ultimo.n + 1}!`);
      if (actual === -1) {
        poner(cuerpo, h('div', { class: 'celu-centro', role: 'status' },
          h('div', { class: 'sello bien', 'aria-hidden': 'true' }, '🔓'),
          h('p', { class: 'grande' }, '¡Escapaste!'),
          h('p', { class: 'suave' }, 'Abriste todos los candados. Mirá el pizarrón para ver cómo van los demás.')));
        return;
      }
      const q = e.preguntas[actual];
      const fb = e.ultimo && e.ultimo.n === actual && !e.ultimo.hecho
        ? h('p', { class: 'respuesta-feedback mal', role: 'alert' }, (e.ultimo.correcta === 'parcial' ? 'Casi: te falta o te sobra alguna. ' : 'Ese no es. ') + 'Probá de nuevo.')
        : null;
      poner(cuerpo, 
        h('div', { class: 'info-celu' }, h('span', null, `Candado ${actual + 1} de ${e.total}`), h('span', null, e.prog[actual].intentos ? `${e.prog[actual].intentos} ${e.prog[actual].intentos === 1 ? 'intento' : 'intentos'}` : '')),
        h('h1', { class: 'celu-preg' }, q.texto), fb, ...zonaRespuesta(q));
      enfocarPrimero();
    }

    function pantallaSet(e) {
      cuerpo.innerHTML = '';
      // si llega la respuesta de una actividad, nos quedamos en esa actividad para ver cómo nos fue
      if (e.ultimo && e.ultimo.n !== undefined) vistaRitmo = e.ultimo.n;
      if (vistaRitmo !== 'menu' && !e.preguntas[vistaRitmo]) vistaRitmo = 'menu';
      if (vistaRitmo === 'menu') return menuSet(e);
      const k = vistaRitmo, q = e.preguntas[k], x = e.prog[k];
      const pendiente = e.prog.findIndex((y, i) => !y.hecho && i !== k);
      poner(cuerpo, cabeceraRitmo(e),
        h('div', { class: 'fila-entre' },
          h('button', { class: 'boton boton-texto', type: 'button', onclick: () => { vistaRitmo = 'menu'; e.ultimo = null; pantallaSet(e); } }, '◀ Menú'),
          h('span', { class: 'suave', style: { fontWeight: 700 } }, `Actividad ${k + 1} de ${e.total}`)),
        h('h1', { class: 'celu-preg' }, q.texto));
      if (!x.hecho) { poner(cuerpo, ...zonaRespuesta(q)); enfocarPrimero(); return; }
      let clase = 'neutro', txt = '¡Listo! Tu respuesta quedó guardada.';
      if (x.ok === true) { clase = 'bien'; txt = `¡Correcto! +${x.puntos}`; }
      else if (x.ok === 'parcial') { clase = 'neutro'; txt = `Casi: sumaste ${x.puntos}. La respuesta completa era: ${x.correcta}`; }
      else if (x.ok === false) { clase = 'mal'; txt = `Esta vez no. La correcta era: ${x.correcta}`; }
      poner(cuerpo, h('p', { class: 'respuesta-feedback ' + clase, role: 'status' }, txt),
        h('div', { class: 'fila', style: { justifyContent: 'center' } },
          h('button', { class: 'boton', type: 'button', onclick: () => { vistaRitmo = 'menu'; e.ultimo = null; pantallaSet(e); } }, 'Volver al menú'),
          pendiente !== -1 ? h('button', { class: 'boton boton-principal', type: 'button', onclick: () => { vistaRitmo = pendiente; e.ultimo = null; pantallaSet(e); } }, 'Siguiente pendiente') : null));
      cuerpo.querySelector('.fila button:last-child').focus({ preventScroll: true });
    }

    function menuSet(e) {
      const hechas = e.prog.filter(x => x.hecho).length;
      const iconos = x => !x.hecho ? '›' : x.ok === true ? '✓' : x.ok === false ? '✗' : x.ok === 'parcial' ? '≈' : '•';
      const colores = x => !x.hecho ? 'var(--tinta)' : x.ok === true ? 'var(--ok)' : x.ok === false ? 'var(--error)' : 'var(--b)';
      poner(cuerpo, cabeceraRitmo(e),
        h('h1', { class: 'celu-preg' }, e.titulo),
        hechas === e.total
          ? h('p', { class: 'respuesta-feedback bien', role: 'status' }, `¡Terminaste las ${e.total} actividades! Sumaste ${e.puntos} puntos.`)
          : h('p', { class: 'suave', style: { margin: 0 } }, `Hiciste ${hechas} de ${e.total}. Elegí una actividad.`),
        h('ul', { class: 'menu-act' }, e.preguntas.map((q, i) => h('li', null,
          h('button', { type: 'button', class: e.prog[i].hecho ? 'hecha' : '', onclick: () => { vistaRitmo = i; e.ultimo = null; pantallaSet(e); } },
            h('span', { class: 'num', 'aria-hidden': 'true' }, i + 1),
            h('span', null, q.texto.length > 80 ? q.texto.slice(0, 78) + '…' : q.texto),
            h('span', { class: 'estado', style: { color: colores(e.prog[i]) }, 'aria-label': e.prog[i].hecho ? 'Hecha' : 'Sin hacer' }, iconos(e.prog[i])))))));
    }

    function enfocarPrimero() {
      const el = cuerpo.querySelector('form input, .boton-resp');
      if (el) el.focus({ preventScroll: true });
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
