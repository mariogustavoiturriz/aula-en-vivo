/* Aula en Vivo — vista del docente (lo que se proyecta)
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior

   El navegador del docente es "el que manda": guarda los puntajes, lleva el tiempo
   y le avisa a cada celular qué tiene que mostrar. Nada se guarda en servidores. */
'use strict';

(function (AV) {
  const { h } = AV;
  /** append que ignora los bloques opcionales vacíos (null, undefined, false) */
  const poner = (padre, ...xs) => padre.append(...xs.flat().filter(x => x !== null && x !== undefined && x !== false));
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
    const modo = cuest.modo || 'vivo';             // 'vivo', 'escape' o 'set'
    const aSuRitmo = modo !== 'vivo';
    const tiempoTotalMs = modo === 'escape' ? (cuest.tiempoTotal || 0) * 60000 : 0;
    let inicioRitmo = 0;

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
    const restanteMs = () => Math.max(0, inicio + duracion - Date.now());
    const restanteTotalMs = () => tiempoTotalMs ? Math.max(0, inicioRitmo + tiempoTotalMs - Date.now()) : null;

    // En el escape room gana quien abrió más candados y, a igualdad, quien llegó antes. En los demás, los puntos.
    function progDe(j) {
      if (!j.prog) j.prog = preguntas.map(() => ({ hecho: false, ok: null, intentos: 0, puntos: 0, valor: null }));
      return j.prog;
    }
    const abiertos = j => progDe(j).filter(x => x.hecho).length;
    function comparar(a, b) {
      if (modo === 'escape') {
        const d = abiertos(b) - abiertos(a);
        if (d) return d;
        return (a.fin ?? a.ultimoAvance ?? Infinity) - (b.fin ?? b.ultimoAvance ?? Infinity);
      }
      return b.puntos - a.puntos;
    }
    const ranking = () => [...jugadores.values()].sort((a, b) => comparar(a, b) || a.nombre.localeCompare(b.nombre));

    function puestoDe(j) {
      const r = ranking();
      // empates comparten puesto
      let puesto = 1;
      for (let i = 0; i < r.length; i++) {
        if (i > 0 && comparar(r[i - 1], r[i]) !== 0) puesto = i + 1;
        if (r[i] === j) return puesto;
      }
      return r.length;
    }
    function mmss(ms) { const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
    function textoCorrectaDe(p) {
      if (p.tipo === 'texto') return p.respuestas.filter(Boolean)[0] || '';
      if (p.tipo === 'orden') return p.sinCorrecta ? null : p.items.map((t, k) => `${k + 1}. ${t}`).join('  ');
      if (p.tipo === 'numero') return p.respuesta === null ? null : String(p.respuesta).replace('.', ',') + (p.margen ? ` (±${String(p.margen).replace('.', ',')})` : '');
      const cor = AV.almacen.correctasDe(p);
      return cor ? cor.map(k => AV.LETRAS[k] + '. ' + p.opciones[k]).join(' / ') : null;
    }
    function opcionesVisibles(p) { return p.tipo === 'opcion' ? p.opciones.map((o, k) => ({ k, txt: o })).filter(o => o.txt.trim()) : null; }

    /** Evalúa una respuesta. Devuelve {valor, correcta, parte, aciertos} o null si no es válida */
    // mezcla fija por pregunta para los elementos a ordenar (todos ven el mismo orden inicial)
    const mezclas = new Map();
    function mezclaDe(i) {
      if (!mezclas.has(i)) {
        const idx = preguntas[i].items.map((_, k) => k);
        do { for (let k = idx.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); [idx[k], idx[r]] = [idx[r], idx[k]]; } }
        while (idx.length > 1 && idx.every((x, k) => x === k));
        mezclas.set(i, idx);
      }
      return mezclas.get(i);
    }
    function itemsVisibles(i) { const p = preguntas[i]; return p.tipo === 'orden' ? mezclaDe(i).map(k => ({ k, txt: p.items[k] })) : null; }
    function datosNumero(p) { return p.tipo === 'numero' ? { min: p.min, max: p.max, paso: p.paso, etiquetaMin: p.etiquetaMin || '', etiquetaMax: p.etiquetaMax || '' } : null; }

    function evaluar(p, v) {
      if (p.tipo === 'orden') {
        const n = p.items.length;
        const sel = Array.isArray(v) ? v.map(Number) : [];
        if (sel.length !== n || new Set(sel).size !== n || sel.some(k => !Number.isInteger(k) || k < 0 || k >= n)) return null;
        if (p.sinCorrecta) return { valor: sel, correcta: null, parte: null, aciertos: 0 };
        const bien = sel.filter((k, pos) => k === pos).length;
        const parte = bien === n ? 1 : bien / n / 2;  // todo bien: 100 %. Si no, la mitad de lo que acertó
        return { valor: sel, correcta: bien === n ? true : (bien > 0 ? 'parcial' : false), parte, aciertos: bien };
      }
      if (p.tipo === 'numero') {
        const x = Number(v);
        if (!Number.isFinite(x) || x < p.min || x > p.max) return null;
        if (p.respuesta === null) return { valor: x, correcta: null, parte: null, aciertos: 0 };
        const d = Math.abs(x - p.respuesta);
        const dentro = p.margen > 0 ? d <= p.margen + 1e-9 : d < 1e-9;
        const precision = !dentro ? 0 : (p.margen > 0 ? 1 - 0.5 * d / p.margen : 1);
        return { valor: x, correcta: dentro ? (d < 1e-9 ? true : 'cerca') : false, parte: precision, aciertos: dentro ? 1 : 0, precision };
      }
      if (p.tipo === 'texto') {
        const txt = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!txt) return null;
        const ok = AV.almacen.respuestaCorrecta(p, txt);
        return { valor: txt, correcta: ok, parte: ok ? 1 : 0, aciertos: ok ? 1 : 0 };
      }
      if (p.tipo !== 'opcion') return null;
      // siempre trabajamos con una lista de posiciones elegidas (una sola si no es múltiple)
      const crudo = Array.isArray(v) ? v : [v];
      const sel = [...new Set(crudo.map(Number))]
        .filter(k => Number.isInteger(k) && k >= 0 && k < p.opciones.length && p.opciones[k].trim()).sort();
      if (!sel.length || (!p.multiple && sel.length > 1)) return null;
      const cor = AV.almacen.correctasDe(p);
      if (!cor) return { valor: sel, correcta: null, parte: null, aciertos: 0 };
      // puntaje parcial: (aciertos − opciones mal elegidas) / cantidad de correctas, nunca negativo
      const aciertos = sel.filter(k => cor.includes(k)).length;
      const parte = Math.max(0, (aciertos - (sel.length - aciertos)) / cor.length);
      return { valor: sel, correcta: parte === 1 ? true : (parte > 0 ? 'parcial' : false), parte, aciertos };
    }

    function nombreUnico(nombre, idCliente) {
      const base = nombre.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Sin nombre';
      let final = base, k = 2;
      const usados = new Set([...jugadores.values()].filter(j => j.id !== idCliente).map(j => j.nombre.toLowerCase()));
      while (usados.has(final.toLowerCase())) final = base + ' ' + (k++);
      return final;
    }

    // ---------- Lo que ve cada celular ----------
    function estadoPara(j, ultimo) {
      const base = { t: 'estado', fase, modo, titulo: cuest.titulo, total: preguntas.length, nombre: j.nombre, avatar: j.avatar, puntos: j.puntos };
      if (fase === 'ritmo') {
        const prog = progDe(j);
        return {
          ...base,
          preguntas: preguntas.map((p, i) => ({ n: i, tipo: p.tipo, texto: p.texto, opciones: opcionesVisibles(p), items: itemsVisibles(i), num: datosNumero(p), multiple: !!p.multiple, maxPalabras: 1 })),
          // en el set, después de responder se ve cuál era la correcta; en el escape room, no
          prog: prog.map((x, i) => ({ hecho: x.hecho, ok: x.ok, intentos: x.intentos, puntos: x.puntos,
            correcta: modo === 'set' && x.hecho && AV.almacen.calificable(preguntas[i]) ? textoCorrectaDe(preguntas[i]) : null })),
          restante: restanteTotalMs(), terminado: j.fin !== undefined, ultimo: ultimo || null
        };
      }
      if (fase === 'fin' && aSuRitmo) {
        return { ...base, puesto: puestoDe(j), de: jugadores.size, abiertos: abiertos(j), tiempo: j.fin !== undefined ? mmss(j.fin) : null };
      }
      if (fase === 'pregunta') {
        const p = preg();
        const r = respActuales.get(j.id);
        return {
          ...base, n, tipo: p.tipo, texto: p.texto,
          opciones: opcionesVisibles(p), items: itemsVisibles(n), num: datosNumero(p),
          restante: cerrada ? 0 : restanteMs(), duracion,
          multiple: !!p.multiple,
          respondio: p.tipo !== 'nube' ? (r ? r.v : null) : null,
          palabras: p.tipo === 'nube' ? (j.resp[n] || []) : null,
          maxPalabras: MAX_PALABRAS
        };
      }
      if (fase === 'resultado' || fase === 'posiciones') {
        const p = preg();
        const r = respActuales.get(j.id);
        const cor = AV.almacen.correctasDe(p);
        return {
          ...base, fase: 'resultado', n, tipo: p.tipo, esEncuesta: !AV.almacen.tieneCorrecta(p) && p.tipo !== 'nube',
          racha: j.racha || 0, bonus: r ? (r.bonus || 0) : 0,
          respondio: !!r || (p.tipo === 'nube' && (j.resp[n] || []).length > 0),
          correcta: r ? r.correcta : null, ganados: r ? r.puntos : 0,
          aciertos: r ? r.aciertos : 0, totalCorrectas: cor ? cor.length : 0,
          textoCorrecta: textoCorrectaDe(p),
          variasCorrectas: !!(cor && cor.length > 1),
          puesto: puestoDe(j), de: jugadores.size
        };
      }
      if (fase === 'fin') return { ...base, puesto: puestoDe(j), de: jugadores.size };
      return base; // sala
    }

    function enviarA(j, ultimo) {
      if (conexion && j.conectado && j.peerId) conexion.enviar(estadoPara(j, ultimo), j.peerId);
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
          j = { id: idCliente, nombre: nombreUnico(String(datos.nombre || ''), idCliente), puntos: 0, racha: 0, resp: [] };
          jugadores.set(idCliente, j);
        }
        j.avatar = AV.avatar.limpiar(datos.avatar);
        j.peerId = peerId; j.conectado = true;
        peerAJugador.set(peerId, idCliente);
        enviarA(j);
        actualizarParticipantes();
        dibujarProgreso();
        return;
      }
      const j = jugadores.get(peerAJugador.get(peerId));
      if (j && datos.t === 'reac') { reaccion(j, datos.v); return; }
      if (j && fase === 'ritmo') { recibirRitmo(j, datos); return; }
      if (!j || fase !== 'pregunta' || cerrada || datos.n !== n) return;
      const p = preg();

      if (datos.t === 'resp' && ['opcion', 'texto', 'orden', 'numero'].includes(p.tipo)) {
        if (respActuales.has(j.id)) return; // una sola respuesta
        const ev = evaluar(p, datos.v);
        if (!ev) return;
        let puntos = 0, bonus = 0;
        if (AV.almacen.calificable(p) && ev.parte > 0) {
          // fórmula de Kahoot: arranca en el total y baja hasta la mitad a medida que pasa el tiempo.
          // En adivinar el número: 80 % precisión y 20 % rapidez
          const base = p.puntos ?? 1000;
          const rapidez = restanteMs() / duracion;
          puntos = p.tipo === 'numero' ? Math.round(base * (0.8 * ev.parte + 0.2 * rapidez)) : Math.round(base * (1 - (1 - rapidez) / 2) * ev.parte);
        }
        if (AV.almacen.calificable(p)) {
          // racha: respuestas correctas seguidas. Desde la segunda suma 100, 200… hasta 500 extra
          if (ev.correcta === true || ev.correcta === 'cerca') { j.racha = (j.racha || 0) + 1; bonus = Math.min(j.racha - 1, 5) * 100; }
          else j.racha = 0;
          puntos += bonus;
        }
        respActuales.set(j.id, { v: ev.valor, t: Date.now() - inicio, puntos, bonus, correcta: ev.correcta, aciertos: ev.aciertos });
        j.resp[n] = ev.valor;
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

    // ---------- Modos a su ritmo: escape room y set de actividades ----------
    function recibirRitmo(j, datos) {
      const k = Number(datos.n);
      if (!Number.isInteger(k) || k < 0 || k >= preguntas.length) return;
      const prog = progDe(j), it = prog[k], p = preguntas[k];
      if (it.hecho) return;
      // en el escape room solo vale el candado que le toca
      if (modo === 'escape' && k !== prog.findIndex(x => !x.hecho)) return;
      let ev = null;
      if (p.tipo === 'nube') {
        if (datos.t !== 'palabra') return;
        const texto = String(datos.v || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        if (!AV.normalizarPalabra(texto)) return;
        it.valor = [texto]; it.hecho = true; it.intentos = 1;
      } else {
        if (datos.t !== 'resp') return;
        ev = evaluar(p, datos.v);
        if (!ev) return;
        it.intentos++; it.valor = ev.valor;
        if (!AV.almacen.calificable(p)) { it.hecho = true; it.ok = null; }
        else if (modo === 'set') {
          it.hecho = true; it.ok = ev.correcta;
          it.puntos = ev.parte > 0 ? Math.round((p.puntos ?? 1000) * ev.parte) : 0;
          j.puntos += it.puntos;
        } else if (ev.correcta === true || ev.correcta === 'cerca') { it.hecho = true; it.ok = true; }
        else it.ok = false;
      }
      j.resp[k] = it.valor;
      if (it.hecho) j.ultimoAvance = Date.now() - inicioRitmo;
      if (prog.every(x => x.hecho)) j.fin = Date.now() - inicioRitmo;
      enviarA(j, { n: k, correcta: ev ? ev.correcta : null, hecho: it.hecho, intentos: it.intentos });
      dibujarProgreso();
    }

    function escenaRitmo() {
      fase = 'ritmo';
      inicioRitmo = Date.now();
      escena.className = 'escena';
      escena.innerHTML = '';
      const nombreModo = modo === 'escape' ? 'Escape room' : 'Set de actividades';
      const cuantos = modo === 'escape' ? `${preguntas.length} candados` : `${preguntas.length} actividades`;
      ref.relojTotal = tiempoTotalMs ? h('span', { class: 'reloj-total', role: 'timer', 'aria-label': 'Tiempo restante' }, mmss(tiempoTotalMs)) : null;
      ref.regla = tiempoTotalMs ? h('div', { class: 'regla' }, h('div', { class: 'regla-avance' })) : null;
      ref.progreso = h('div', { class: 'progreso', role: 'table', 'aria-label': 'Avance de cada participante' });
      ref.conteo = h('span', { class: 'contador-resp', 'aria-live': 'polite' }, '');
      poner(escena, 
        h('div', { class: 'preg-meta' }, h('span', null, `${nombreModo} · ${cuantos} · cada uno a su ritmo`), ref.relojTotal),
        ref.regla || '',
        h('h1', { class: 'preg-texto', style: { fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' } }, cuest.titulo),
        ref.progreso,
        h('div', { class: 'fila-entre' }, ref.conteo,
          h('div', { class: 'controles-proy' },
            h('button', { class: 'boton boton-principal boton-grande', type: 'button', onclick: () => {
              if (confirm('¿Terminar para todos y mostrar los resultados?')) terminarRitmo();
            } }, 'Terminar'))));
      dibujarProgreso();
      enviarATodos();
      clearInterval(reloj);
      reloj = setInterval(ticRitmo, 500);
    }

    function ticRitmo() {
      if (fase !== 'ritmo' || !tiempoTotalMs) return;
      const r = restanteTotalMs();
      ref.relojTotal.textContent = mmss(r);
      ref.relojTotal.classList.toggle('poco', r <= 60000);
      ref.regla.querySelector('.regla-avance').style.width = (100 * r / tiempoTotalMs) + '%';
      ref.regla.classList.toggle('poco', r <= 60000);
      if (r <= 0) terminarRitmo();
    }

    function dibujarProgreso() {
      if (fase !== 'ritmo' || !ref.progreso) return;
      const lista = ranking();
      ref.progreso.innerHTML = '';
      ref.progreso.style.setProperty('--columnas', preguntas.length);
      if (!lista.length) { ref.progreso.append(h('p', { class: 'suave' }, 'Todavía no entró nadie.')); }
      lista.forEach(j => {
        const prog = progDe(j);
        const actual = prog.findIndex(x => !x.hecho);
        const celdas = prog.map((x, i) => {
          let cls = 'celda', txt = '·', titulo = 'Sin hacer';
          if (modo === 'escape') {
            if (x.hecho) { cls += ' abierto'; txt = '🔓'; titulo = 'Abierto'; }
            else if (i === actual) { cls += ' actual'; txt = '🔒'; titulo = x.intentos ? `Intentando (${x.intentos} ${x.intentos === 1 ? 'intento' : 'intentos'})` : 'Le toca este'; }
            else { cls += ' cerrado'; txt = '🔒'; titulo = 'Cerrado'; }
          } else if (x.hecho) {
            if (x.ok === true) { cls += ' bien'; txt = '✓'; titulo = 'Bien'; }
            else if (x.ok === 'parcial') { cls += ' parcial'; txt = '≈'; titulo = 'En parte'; }
            else if (x.ok === false) { cls += ' mal'; txt = '✗'; titulo = 'Mal'; }
            else { cls += ' hecho'; txt = '•'; titulo = 'Respondida'; }
          }
          return h('span', { class: cls, role: 'cell', title: `${modo === 'escape' ? 'Candado' : 'Actividad'} ${i + 1}: ${titulo}` }, txt);
        });
        const resumen = modo === 'escape'
          ? (j.fin !== undefined ? `Salió en ${mmss(j.fin)}` : `${abiertos(j)} de ${preguntas.length}`)
          : `${j.puntos} pts`;
        ref.progreso.append(h('div', { class: 'fila-prog' + (j.conectado ? '' : ' desconectado') + (j.fin !== undefined ? ' terminado' : ''), role: 'row' },
          h('span', { class: 'puesto', role: 'cell' }, puestoDe(j)),
          h('span', { class: 'nombre', role: 'cell' }, AV.avatar.nodo(j.avatar, 30), j.nombre),
          h('span', { class: 'celdas' }, celdas),
          h('span', { class: 'resumen', role: 'cell' }, resumen)));
      });
      const terminaron = lista.filter(j => j.fin !== undefined).length;
      ref.conteo.textContent = `${terminaron} de ${lista.length} ${modo === 'escape' ? 'escaparon' : 'terminaron'}`;
    }

    function terminarRitmo() {
      if (fase !== 'ritmo') return;
      clearInterval(reloj);
      escenaFin();
    }

    function salioPar(peerId) {
      const j = jugadores.get(peerAJugador.get(peerId));
      peerAJugador.delete(peerId);
      if (j && j.peerId === peerId) { j.conectado = false; actualizarParticipantes(); actualizarConteo(); dibujarProgreso(); }
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

      poner(escena, 
        h('div', { class: 'sala' },
          h('div', { class: 'sala-instrucciones' },
            h('h1', null, cuest.titulo),
            aSuRitmo ? h('p', { class: 'suave', style: { margin: '-.3em 0 .6em' } }, (modo === 'escape' ? 'Escape room' : 'Set de actividades') + ': cada uno avanza a su ritmo. Si juegan en grupo, que entre un solo celu por grupo con el nombre del equipo.') : null,
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
      }, AV.avatar.nodo(j.avatar, 34), j.nombre)));
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
      const tipoTxt = p.tipo === 'nube' ? 'Nube de palabras' : p.tipo === 'texto' ? 'Respuesta escrita'
        : p.tipo === 'orden' ? (p.sinCorrecta ? 'Ranking' : 'Ordenar')
        : p.tipo === 'numero' ? (p.respuesta === null ? 'Escala' : 'Adivinar el número')
        : (esEnc ? 'Encuesta' : 'Opción múltiple') + (p.multiple ? ', se pueden elegir varias' : '');
      const pts = AV.almacen.calificable(p) ? (p.puntos === 2000 ? ' · puntos dobles' : '') : (AV.almacen.tieneCorrecta(p) ? ' · sin puntos' : '');

      poner(escena, 
        h('div', { class: 'preg-meta' }, h('span', null, `Pregunta ${n + 1} de ${preguntas.length}`), h('span', null, tipoTxt + pts)),
        ref.regla,
        h('h1', { class: 'preg-texto' }, p.texto));

      if (p.tipo === 'opcion') {
        ref.opciones = h('div', { class: 'opciones-proy' });
        p.opciones.forEach((o, k) => {
          if (!o.trim()) return;
          ref.opciones.append(h('div', { class: 'opcion-proy ' + AV.CLASES[k], 'data-k': k },
            h('span', { class: 'relleno' }), h('span', { class: 'letra' }, AV.LETRAS[k]), h('span', { class: 'txt' }, o), h('span', { class: 'cant' }, '')));
        });
        poner(escena, ref.opciones);
      } else if (p.tipo === 'texto') {
        ref.textoRes = h('div', { class: 'opciones-proy texto-res' }, h('p', { class: 'nube-vacia' }, 'Las respuestas aparecen cuando se cierra la pregunta.'));
        poner(escena, ref.textoRes);
      } else if (p.tipo === 'orden') {
        ref.textoRes = h('div', { class: 'opciones-proy texto-res' },
          itemsVisibles(n).map(it => h('div', { class: 'opcion-proy op-texto' }, h('span', { class: 'txt' }, it.txt))));
        poner(escena, ref.textoRes);
      } else if (p.tipo === 'numero') {
        ref.textoRes = h('div', { class: 'escala-proy' },
          h('div', { class: 'escala-ext' }, h('span', null, fmt(p.min), p.etiquetaMin ? h('small', null, p.etiquetaMin) : null), h('span', null, fmt(p.max), p.etiquetaMax ? h('small', null, p.etiquetaMax) : null)),
          h('div', { class: 'escala-barra' }));
        poner(escena, ref.textoRes);
      } else {
        ref.nube = h('div', { class: 'nube', 'aria-live': 'polite' });
        poner(escena, ref.nube);
        dibujarNube();
      }
      ref.cerrar = h('button', { class: 'boton boton-grande', type: 'button', onclick: cerrarPregunta }, 'Cerrar pregunta');
      poner(escena, h('div', { class: 'fila-entre' }, ref.conteo, h('div', { class: 'controles-proy' }, ref.cerrar)));

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
      if (AV.almacen.calificable(preg())) jugadores.forEach(j => { if (!respActuales.has(j.id)) j.racha = 0; });
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

      if (p.tipo === 'orden') resultadoOrden(p);
      if (p.tipo === 'numero') resultadoNumero(p);

      if (p.tipo === 'texto') {
        // las respuestas más repetidas, agrupadas sin importar mayúsculas ni tildes
        const grupos = new Map();
        respActuales.forEach(r => {
          const clave = AV.almacen.normalizarRespuesta(r.v);
          const g = grupos.get(clave) || { texto: r.v, cant: 0, ok: r.correcta === true };
          g.cant++; grupos.set(clave, g);
        });
        const lista = [...grupos.values()].sort((a, b) => b.ok - a.ok || b.cant - a.cant).slice(0, 6);
        const total = Math.max(1, respActuales.size);
        ref.textoRes.innerHTML = '';
        escena.classList.add('resultado');
        if (!lista.length) ref.textoRes.append(h('p', { class: 'nube-vacia' }, 'Nadie respondió. La respuesta era: ' + textoCorrectaDe(p)));
        lista.forEach(g => {
          const el = h('div', { class: 'opcion-proy op-texto' + (g.ok ? ' es-correcta' : '') },
            h('span', { class: 'relleno' }), h('span', { class: 'txt' }, g.texto), h('span', { class: 'cant' }, g.cant));
          ref.textoRes.append(el);
          requestAnimationFrame(() => { el.querySelector('.relleno').style.width = (100 * g.cant / total) + '%'; });
        });
        if (lista.length && !lista.some(g => g.ok)) ref.textoRes.append(h('p', { class: 'suave', style: { fontSize: '1.3rem' } }, 'La respuesta era: ' + textoCorrectaDe(p)));
      }

      const controles = escena.querySelector('.controles-proy');
      controles.innerHTML = '';
      const hayPuntos = preguntas.some(q => AV.almacen.calificable(q));
      if (AV.almacen.calificable(p) && !ultima) {
        controles.append(h('button', { class: 'boton boton-grande', type: 'button', onclick: escenaPosiciones }, 'Ver posiciones'));
      }
      controles.append(h('button', { class: 'boton boton-principal boton-grande', type: 'button', 'data-avanzar': '', onclick: siguiente },
        ultima ? (hayPuntos ? 'Ver el podio' : 'Terminar') : 'Siguiente pregunta'));
      controles.querySelector('[data-avanzar]').focus();
      enviarATodos();
    }

    function fmt(x) { return String(Math.round(x * 1000) / 1000).replace('.', ','); }

    function resultadoOrden(p) {
      const total = Math.max(1, respActuales.size);
      ref.textoRes.innerHTML = '';
      escena.classList.add('resultado');
      if (p.sinCorrecta) {
        // ranking: puesto promedio de cada elemento (1 = el primero)
        const suma = p.items.map(() => 0);
        respActuales.forEach(r => r.v.forEach((k, pos) => { suma[k] += pos + 1; }));
        const prom = p.items.map((t, k) => ({ t, k, m: respActuales.size ? suma[k] / respActuales.size : 0 }))
          .sort((a, b) => a.m - b.m);
        prom.forEach((x, i) => {
          const el = h('div', { class: 'opcion-proy op-texto' }, h('span', { class: 'relleno' }), h('span', { class: 'letra' }, i + 1), h('span', { class: 'txt' }, x.t),
            h('span', { class: 'cant', title: 'Puesto promedio' }, respActuales.size ? 'prom. ' + fmt(Math.round(x.m * 10) / 10) : ''));
          ref.textoRes.append(el);
          const ancho = respActuales.size ? 100 * (p.items.length + 1 - x.m) / p.items.length : 0;
          requestAnimationFrame(() => { el.querySelector('.relleno').style.width = ancho + '%'; });
        });
        return;
      }
      // ordenar: el orden correcto y cuántos acertaron cada posición
      const bienPos = p.items.map(() => 0);
      let todoBien = 0;
      respActuales.forEach(r => { r.v.forEach((k, pos) => { if (k === pos) bienPos[pos]++; }); if (r.correcta === true) todoBien++; });
      p.items.forEach((t, k) => {
        const el = h('div', { class: 'opcion-proy op-texto es-correcta' }, h('span', { class: 'relleno' }), h('span', { class: 'letra' }, k + 1), h('span', { class: 'txt' }, t),
          h('span', { class: 'cant', title: 'Lo ubicaron bien' }, bienPos[k]));
        ref.textoRes.append(el);
        requestAnimationFrame(() => { el.querySelector('.relleno').style.width = (100 * bienPos[k] / total) + '%'; });
      });
      ref.textoRes.append(h('p', { class: 'suave', style: { fontSize: '1.3rem', margin: 0 } }, `${todoBien} de ${respActuales.size} lo ordenaron completo.`));
    }

    function resultadoNumero(p) {
      // distribución en hasta 11 columnas, con la respuesta correcta o el promedio marcado
      const vals = [...respActuales.values()].map(r => r.v);
      // intervalos redondos: un múltiplo del paso, para que haya como mucho 11 columnas
      const pasos = Math.round((p.max - p.min) / p.paso);
      const ancho = Math.max(1, Math.ceil((pasos + 1) / 11)) * p.paso;
      const cols = Math.floor((p.max - p.min) / ancho) + 1;
      const cuenta = new Array(cols).fill(0);
      vals.forEach(v => { cuenta[Math.min(cols - 1, Math.floor((v - p.min + 1e-9) / ancho))]++; });
      const max = Math.max(1, ...cuenta);
      const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const desde = i => p.min + i * ancho;
      const hasta = i => Math.min(p.max, desde(i) + ancho - p.paso);
      const etiqueta = i => ancho === p.paso ? fmt(desde(i)) : `${fmt(desde(i))}–${fmt(hasta(i))}`;
      const dentro = i => p.respuesta !== null && hasta(i) >= p.respuesta - p.margen - 1e-9 && desde(i) <= p.respuesta + p.margen + 1e-9;
      escena.classList.add('resultado');
      ref.textoRes.innerHTML = '';
      ref.textoRes.append(
        h('div', { class: 'histograma', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } },
          cuenta.map((c, i) => h('div', { class: 'hist-col' + (dentro(i) ? ' es-correcta' : '') },
            h('span', { class: 'hist-cant' }, c || ''),
            h('span', { class: 'hist-barra', style: { height: (100 * c / max) + '%' } }),
            h('span', { class: 'hist-etq' }, etiqueta(i))))),
        h('p', { class: 'resumen-num' },
          p.respuesta !== null ? h('strong', null, 'Respuesta: ' + textoCorrectaDe(p)) : null,
          prom !== null ? h('span', null, 'Promedio de la clase: ' + fmt(Math.round(prom * 10) / 10)) : h('span', null, 'Nadie respondió.')));
    }

    // ---------- Reacciones (como en Mentimeter): emojis que suben por el proyector ----------
    const REACCIONES = ['👏', '❤️', '😂', '😮', '🤔', '🔥'];
    const capaReac = h('div', { class: 'capa-reacciones', 'aria-hidden': 'true' });
    document.body.append(capaReac);
    function reaccion(j, v) {
      if (!REACCIONES.includes(v)) return;
      const ahora = Date.now();
      if (j.ultimaReac && ahora - j.ultimaReac < 800) return; // una por segundo, más o menos
      j.ultimaReac = ahora;
      if (capaReac.childElementCount > 40) return;
      const el = h('span', { class: 'reac', style: { left: (5 + Math.random() * 90) + '%' } }, v, AV.avatar.nodo(j.avatar, 26));
      capaReac.append(el);
      setTimeout(() => el.remove(), 3200);
    }

    function escenaPosiciones() {
      fase = 'posiciones';
      escena.className = 'escena';
      escena.innerHTML = '';
      const top = ranking().slice(0, 5);
      poner(escena, 
        h('div', { class: 'preg-meta' }, h('span', null, `Después de la pregunta ${n + 1} de ${preguntas.length}`)),
        h('h1', null, 'Posiciones'),
        h('ol', { class: 'posiciones' }, top.map(j => h('li', null,
          h('span', { class: 'puesto' }, puestoDe(j)),
          h('span', { class: 'quien' }, AV.avatar.nodo(j.avatar, 44), j.nombre, (j.racha || 0) >= 2 ? h('span', { class: 'racha', title: 'Respuestas correctas seguidas' }, '🔥 ' + j.racha) : null),
          h('span', { class: 'pts' }, j.puntos)))),
        h('div', { class: 'controles-proy' },
          h('button', { class: 'boton boton-principal boton-grande', type: 'button', 'data-avanzar': '', onclick: siguiente }, 'Siguiente pregunta')));
      escena.querySelector('[data-avanzar]').focus();
    }

    function escenaFin() {
      fase = 'fin';
      escena.className = 'escena';
      escena.innerHTML = '';
      const r = ranking();
      const hayPuntos = modo === 'escape' || preguntas.some(q => AV.almacen.calificable(q));
      poner(escena, h('h1', null, modo === 'escape' ? '¡Se terminó el escape room!' : hayPuntos ? '¡Terminamos!' : '¡Gracias por participar!'));
      const detalle = j => modo === 'escape'
        ? (j.fin !== undefined ? `Salió en ${mmss(j.fin)}` : `${abiertos(j)} de ${preguntas.length} candados`)
        : j.puntos + ' puntos';
      if (hayPuntos && r.length) {
        const col = (j, i) => j ? h('div', { class: 'podio-col p' + (i + 1) },
          AV.avatar.nodo(j.avatar, i === 0 ? 120 : 92, 'podio-avatar'),
          h('div', { class: 'podio-nombre' }, j.nombre), h('div', { class: 'podio-pts' }, detalle(j)),
          h('div', { class: 'podio-escalon' }, i + 1)) : h('div');
        poner(escena, h('div', { class: 'podio' }, col(r[1], 1), col(r[0], 0), col(r[2], 2)));
      } else {
        poner(escena, h('p', { class: 'suave', style: { fontSize: '1.4rem' } }, `Participaron ${jugadores.size} ${jugadores.size === 1 ? 'persona' : 'personas'}.`));
      }
      poner(escena, h('div', { class: 'controles-proy' },
        h('a', { class: 'boton', href: '#/' }, 'Volver a mis cuestionarios'),
        h('button', { class: 'boton boton-principal boton-grande', type: 'button', onclick: descargarCSV }, 'Descargar resultados')));
      enviarATodos();
    }

    function siguiente() {
      if (fase === 'pregunta' || fase === 'ritmo') return;
      if (fase === 'sala' && aSuRitmo) { escenaRitmo(); return; }
      if (n + 1 >= preguntas.length) { escenaFin(); return; }
      n++;
      escena.className = 'escena';
      escenaPregunta();
    }

    function descargarCSV() {
      const celda = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const enc = ['Puesto', 'Nombre', modo === 'escape' ? 'Candados abiertos' : 'Puntos'];
      if (modo === 'escape') enc.push('Tiempo');
      preguntas.forEach((p, i) => enc.push(`P${i + 1}: ${p.texto}`));
      const filas = [enc.map(celda).join(';')];
      ranking().forEach(j => {
        const fila = [puestoDe(j), j.nombre, modo === 'escape' ? abiertos(j) : j.puntos];
        if (modo === 'escape') fila.push(j.fin !== undefined ? mmss(j.fin) : 'no salió');
        preguntas.forEach((p, i) => {
          const r = j.resp[i];
          const intentos = modo === 'escape' && j.prog && j.prog[i].intentos > 1 ? ` (${j.prog[i].intentos} intentos)` : '';
          if (r === undefined || r === null) fila.push('');
          else if (p.tipo === 'nube') fila.push(r.join(', '));
          else if (p.tipo === 'texto') fila.push(r + (AV.almacen.respuestaCorrecta(p, r) ? ' (bien)' : ' (mal)') + intentos);
          else if (p.tipo === 'orden') {
            const orden = r.map(k => p.items[k]).join(' > ');
            fila.push(p.sinCorrecta ? orden : orden + (r.every((k, pos) => k === pos) ? ' (bien)' : ' (mal)') + intentos);
          }
          else if (p.tipo === 'numero') {
            const ev = evaluar(p, r);
            fila.push(fmt(r) + (p.respuesta === null ? '' : ev && ev.aciertos ? ' (bien)' : ' (mal)') + intentos);
          }
          else {
            const cor = AV.almacen.correctasDe(p);
            const letras = r.map(k => AV.LETRAS[k]).join('+');
            if (!cor) { fila.push(letras); return; }
            const bien = r.length === cor.length && r.every(k => cor.includes(k));
            const parcial = !bien && r.some(k => cor.includes(k));
            fila.push(letras + (bien ? ' (bien)' : parcial ? ' (parcial)' : ' (mal)') + intentos);
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
      capaReac.remove();
      clearInterval(ref.relojRed);
      document.removeEventListener('keydown', teclado);
      window.removeEventListener('beforeunload', antesDeSalir);
      if (conexion) conexion.salir();
    };
  }

  AV.docente = { render };
})(window.AV);
