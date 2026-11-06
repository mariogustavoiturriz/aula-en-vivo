/* Aula en Vivo — editor de cuestionarios
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior */
'use strict';

(function (AV) {
  const { h } = AV;
  const NOMBRE_TIPO = { opcion: 'Opción múltiple', encuesta: 'Encuesta (sin respuesta correcta)', nube: 'Nube de palabras', texto: 'Respuesta escrita',
    vf: 'Verdadero o falso', orden: 'Ordenar', ranking: 'Ranking (ordenar según su opinión)', numero: 'Adivinar el número', escala: 'Escala (opinión)' };
  const MODOS = {
    vivo: { nombre: 'En vivo', ayuda: 'Todos responden a la vez. Vos pasás las preguntas desde el proyector y cada una tiene su tiempo.' },
    escape: { nombre: 'Escape room', ayuda: 'Cada pregunta es un candado: hasta que no la responden bien, no ven la siguiente. Avanzan a su ritmo, solos o en grupo, y en el proyector se ve quién va abriendo cada candado.' },
    set: { nombre: 'Set de actividades', ayuda: 'Ven todas las actividades en un menú y las hacen en el orden que quieran, a su ritmo. Cada una se responde una sola vez. En el proyector se ve el avance de cada uno.' }
  };

  function tipoVisible(p) {
    if (p.tipo === 'nube' || p.tipo === 'texto') return p.tipo;
    if (p.tipo === 'orden') return p.sinCorrecta ? 'ranking' : 'orden';
    if (p.tipo === 'numero') return p.respuesta === null ? 'escala' : 'numero';
    if (p.opciones.length === 2 && p.opciones[0] === 'Verdadero' && p.opciones[1] === 'Falso' && !p.multiple) return AV.almacen.correctasDe(p) ? 'vf' : 'encuesta';
    return AV.almacen.correctasDe(p) === null ? 'encuesta' : 'opcion';
  }

  function render(main, id) {
    const cuest = AV.almacen.obtener(id);
    if (!cuest) { location.hash = '#/'; return; }

    let tGuardar;
    const guardarPronto = () => { clearTimeout(tGuardar); tGuardar = setTimeout(() => AV.almacen.guardar(cuest), 350); };
    const guardarYa = () => { clearTimeout(tGuardar); AV.almacen.guardar(cuest); };

    const lista = h('div', { class: 'pila' });

    function dibujar(enfocar) {
      lista.innerHTML = '';
      cuest.preguntas.forEach((p, i) => lista.append(tarjetaPregunta(p, i)));
      if (enfocar) {
        const el = lista.querySelector(`[data-id="${enfocar}"] textarea`);
        if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
    }

    function mover(i, delta) {
      const j = i + delta;
      if (j < 0 || j >= cuest.preguntas.length) return;
      const [p] = cuest.preguntas.splice(i, 1);
      cuest.preguntas.splice(j, 0, p);
      guardarYa(); dibujar();
      const btn = lista.querySelector(`[data-id="${p.id}"] [data-mover="${delta}"]`);
      if (btn) btn.focus();
    }

    function tarjetaPregunta(p, i) {
      const tipo = tipoVisible(p);
      const caja = h('section', { class: 'papel preg-editor', 'data-id': p.id, 'aria-label': `Pregunta ${i + 1}` });
      caja.append(h('span', { class: 'numero', 'aria-hidden': 'true' }, i + 1));
      caja.append(h('div', { class: 'tipo' }, NOMBRE_TIPO[tipo] + (p.multiple ? ', con varias respuestas' : '')));

      const idTexto = 'txt-' + p.id;
      caja.append(h('div', { class: 'campo' },
        h('label', { for: idTexto }, 'Pregunta'),
        h('textarea', {
          id: idTexto, rows: 2, maxlength: 300, placeholder: tipo === 'nube' ? 'Ej.: Escribí una palabra que asocies con…' : (cuest.modo === 'escape' ? 'Ej.: Candado 1. Resolvé…' : 'Escribí la pregunta'),
          oninput: e => { p.texto = e.target.value; guardarPronto(); }
        }, p.texto)
      ));

      if (p.tipo === 'opcion') {
        const grupo = 'cor-' + p.id;
        const opciones = h('fieldset', { class: 'campo', style: { border: 0, padding: 0, margin: '0 0 14px' } },
          h('legend', { style: { fontWeight: 700, marginBottom: '8px' } }, 'Opciones'));
        p.opciones.forEach((op, k) => {
          const idOp = `op-${p.id}-${k}`;
          opciones.append(h('div', { class: 'opc-editor' },
            h('span', { class: 'letra ' + AV.CLASES[k], 'aria-hidden': 'true' }, AV.LETRAS[k]),
            h('input', {
              type: 'text', id: idOp, value: op, maxlength: 120, 'aria-label': 'Opción ' + AV.LETRAS[k],
              placeholder: k < 2 ? 'Opción ' + AV.LETRAS[k] : 'Opción ' + AV.LETRAS[k] + ' (opcional)',
              oninput: e => { p.opciones[k] = e.target.value; guardarPronto(); }
            }),
            tipo === 'opcion' ? h('label', { class: 'correcta-toggle' },
              p.multiple
                ? h('input', {
                  type: 'checkbox', checked: p.correctas.includes(k),
                  onchange: e => {
                    const set = new Set(p.correctas);
                    e.target.checked ? set.add(k) : set.delete(k);
                    p.correctas = [...set].sort(); guardarYa();
                  }
                })
                : h('input', {
                  type: 'radio', name: grupo, checked: p.correcta === k,
                  onchange: () => { p.correcta = k; guardarYa(); }
                }), 'Correcta') : null
          ));
        });
        if (tipo !== 'vf') opciones.append(h('label', { class: 'correcta-toggle', style: { marginTop: '10px', fontWeight: 700 } },
          h('input', {
            type: 'checkbox', checked: !!p.multiple,
            onchange: e => { AV.almacen.cambiarMultiple(p, e.target.checked); guardarYa(); dibujar(); lista.querySelector(`[data-id="${p.id}"] [data-multiple]`)?.focus(); },
            'data-multiple': ''
          }),
          tipo === 'opcion' ? 'Hay más de una respuesta correcta (se eligen varias)' : 'Se pueden elegir varias opciones'));
        caja.append(opciones);
      }

      if (p.tipo === 'orden') {
        const lista = h('div', { class: 'campo' },
          h('div', { style: { fontWeight: 700, marginBottom: '6px' } }, p.sinCorrecta ? 'Elementos para ordenar' : 'Elementos, en el orden correcto'),
          h('p', { class: 'ayuda', style: { marginTop: 0 } }, p.sinCorrecta
            ? 'Cada estudiante los ordena según lo que piensa. En el proyector se ve el puesto promedio de cada uno.'
            : 'Escribilos en el orden correcto: en el celu aparecen mezclados. De 2 a 6 elementos.'));
        p.items.forEach((it, k) => lista.append(h('div', { class: 'opc-editor', style: { gridTemplateColumns: '40px 1fr auto' } },
          h('span', { class: 'letra', 'aria-hidden': 'true' }, k + 1),
          h('input', { type: 'text', value: it, maxlength: 80, 'aria-label': 'Elemento ' + (k + 1), oninput: e => { p.items[k] = e.target.value; guardarPronto(); } }),
          p.items.length > 2 ? h('button', { type: 'button', class: 'boton boton-texto', 'aria-label': 'Quitar elemento ' + (k + 1), onclick: () => { p.items.splice(k, 1); guardarYa(); dibujar(); } }, '✕') : h('span'))));
        if (p.items.length < 6) lista.append(h('button', { type: 'button', class: 'boton boton-texto', onclick: () => { p.items.push(''); guardarYa(); dibujar(p.id); } }, '+ Agregar elemento'));
        caja.append(lista);
      }

      if (p.tipo === 'numero') {
        const num = (campo, etiqueta, extra) => {
          const idc = `${campo}-${p.id}`;
          return h('div', null, h('label', { for: idc }, etiqueta),
            h('input', { type: 'number', id: idc, value: p[campo] ?? '', step: 'any', ...extra, oninput: e => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              if (v !== null && !Number.isFinite(v)) return;
              p[campo] = v ?? (campo === 'margen' ? 0 : p[campo]); guardarPronto();
            } }));
        };
        if (p.respuesta === null) {
          caja.append(h('div', { class: 'grilla-num' },
            num('min', 'Desde'), num('max', 'Hasta'),
            h('div', null, h('label', { for: 'emin-' + p.id }, 'Texto del extremo izquierdo'),
              h('input', { type: 'text', id: 'emin-' + p.id, value: p.etiquetaMin || '', maxlength: 30, oninput: e => { p.etiquetaMin = e.target.value; guardarPronto(); } })),
            h('div', null, h('label', { for: 'emax-' + p.id }, 'Texto del extremo derecho'),
              h('input', { type: 'text', id: 'emax-' + p.id, value: p.etiquetaMax || '', maxlength: 30, oninput: e => { p.etiquetaMax = e.target.value; guardarPronto(); } }))),
            h('p', { class: 'ayuda' }, 'En el proyector se ve cuántos eligieron cada valor y el promedio.'));
        } else {
          caja.append(h('div', { class: 'grilla-num' },
            num('min', 'Desde'), num('max', 'Hasta'), num('paso', 'De a', { min: 0 }),
            num('respuesta', 'Respuesta correcta'), num('margen', 'Margen aceptado (±)', { min: 0 })),
            h('p', { class: 'ayuda' }, 'Se mueve un deslizador. Valen las respuestas dentro del margen, y cuanto más cerca, más puntos (80 % por precisión y 20 % por rapidez).'));
        }
      }

      if (p.tipo === 'texto') {
        const idResp = 'resp-' + p.id;
        caja.append(h('div', { class: 'campo' },
          h('label', { for: idResp }, 'Respuesta correcta'),
          h('input', {
            type: 'text', id: idResp, value: p.respuestas.join('; '), maxlength: 200, placeholder: 'Ej.: 375',
            oninput: e => { p.respuestas = e.target.value.split(';').map(r => r.trim()).filter(Boolean).slice(0, 10); if (!p.respuestas.length) p.respuestas = ['']; guardarPronto(); }
          }),
          h('p', { class: 'ayuda' }, 'No importan las mayúsculas, las tildes ni los espacios, y 3,5 vale igual que 3.5. Si hay varias respuestas válidas, separalas con punto y coma (por ejemplo: 5; cinco).')));
      }

      const idTiempo = 'tmp-' + p.id;
      const selTiempo = h('select', {
        id: idTiempo, style: { width: 'auto' },
        onchange: e => { p.tiempo = Number(e.target.value); guardarYa(); }
      }, AV.almacen.TIEMPOS.map(t => h('option', { value: t, selected: p.tiempo === t }, t < 60 ? `${t} segundos` : `${t / 60} min`)));

      const herr = h('div', { class: 'herr-preg' },
        h('button', { class: 'boton boton-texto', type: 'button', 'data-mover': '-1', disabled: i === 0, onclick: () => mover(i, -1) }, 'Subir'),
        h('button', { class: 'boton boton-texto', type: 'button', 'data-mover': '1', disabled: i === cuest.preguntas.length - 1, onclick: () => mover(i, 1) }, 'Bajar'),
        h('button', {
          class: 'boton boton-texto', type: 'button', onclick: () => {
            const copia = JSON.parse(JSON.stringify(p)); copia.id = AV.generarId();
            cuest.preguntas.splice(i + 1, 0, copia); guardarYa(); dibujar(copia.id);
          }
        }, 'Duplicar'),
        h('button', {
          class: 'boton boton-texto', type: 'button', style: { color: 'var(--error)' }, onclick: () => {
            if (!confirm(`¿Borrar la pregunta ${i + 1}?`)) return;
            cuest.preguntas.splice(i, 1); guardarYa(); dibujar();
          }
        }, 'Borrar')
      );

      // puntos: normal, doble o sin puntos (como en Kahoot). Solo en preguntas con respuesta correcta
      const idPts = 'pts-' + p.id;
      const selPuntos = AV.almacen.tieneCorrecta(p) ? h('div', { class: 'fila' }, h('label', { for: idPts, style: { margin: 0 } }, 'Puntos'),
        h('select', { id: idPts, style: { width: 'auto' }, onchange: e => { const v = Number(e.target.value); if (v === 1000) delete p.puntos; else p.puntos = v; guardarYa(); } },
          [[1000, 'Normal'], [2000, 'Doble'], [0, 'Sin puntos']].map(([v, t]) => h('option', { value: v, selected: (p.puntos ?? 1000) === v }, t)))) : null;
      // el tiempo por pregunta solo corre en vivo: en los modos a su ritmo no se muestra
      caja.append(h('div', { class: 'fila-entre' },
        h('div', { class: 'fila', style: { gap: '18px' } },
          cuest.modo === 'vivo' ? h('div', { class: 'fila' }, h('label', { for: idTiempo, style: { margin: 0 } }, 'Tiempo'), selTiempo) : null,
          selPuntos),
        herr));
      return caja;
    }

    function agregar(tipo) {
      const p = AV.almacen.nuevaPregunta(tipo);
      cuest.preguntas.push(p);
      guardarYa(); dibujar(p.id);
    }

    const titulo = h('input', {
      type: 'text', id: 'titulo', value: cuest.titulo, maxlength: 120,
      style: { fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.6rem' },
      oninput: e => { cuest.titulo = e.target.value || 'Cuestionario sin título'; guardarPronto(); }
    });

    function presentar() {
      guardarYa();
      const prob = AV.almacen.problemas(cuest);
      if (prob.length) { AV.aviso(prob[0], 4500); return; }
      location.hash = '#/presentar/' + cuest.id;
    }

    // Importar: suma al final las preguntas de otro cuestionario exportado (.json)
    const archivo = h('input', { type: 'file', accept: '.json,application/json', class: 'oculto-visual', id: 'importar-preg', onchange: e => {
      const f = e.target.files[0];
      if (!f) return;
      AV.almacen.leerArchivo(f).then(otro => {
        const nuevas = otro.preguntas.map(p => ({ ...p, id: AV.generarId() }));
        // si el cuestionario estaba recién creado y vacío, lo reemplazamos en vez de sumar
        const vacio = cuest.preguntas.length === 1 && !cuest.preguntas[0].texto.trim();
        if (vacio) { cuest.preguntas = nuevas; if (cuest.titulo === 'Cuestionario sin título') { cuest.titulo = otro.titulo; titulo.value = otro.titulo; } }
        else cuest.preguntas.push(...nuevas);
        guardarYa(); dibujar(nuevas[0] && nuevas[0].id);
        AV.aviso(nuevas.length === 1 ? 'Agregaste 1 pregunta' : `Agregaste ${nuevas.length} preguntas`);
      }).catch(err => AV.aviso(err.message, 4500)).finally(() => { e.target.value = ''; });
    } });

    // Cómo se juega: en vivo, escape room o set de actividades
    function cajaModo() {
      if (!cuest.modo) cuest.modo = 'vivo';
      const ayuda = h('p', { class: 'ayuda', style: { margin: '8px 0 0' } }, MODOS[cuest.modo].ayuda);
      const selTotal = h('select', { id: 'tiempo-total', style: { width: 'auto' }, onchange: e => { cuest.tiempoTotal = Number(e.target.value); guardarYa(); } },
        AV.almacen.TIEMPOS_TOTALES.map(m => h('option', { value: m, selected: (cuest.tiempoTotal || 0) === m }, m ? `${m} minutos` : 'Sin límite')));
      return h('section', { class: 'papel', 'aria-labelledby': 't-modo' },
        h('h2', { id: 't-modo', style: { fontSize: '1.2rem' } }, 'Cómo se juega'),
        h('div', { class: 'opciones-modo', role: 'radiogroup', 'aria-labelledby': 't-modo' },
          Object.entries(MODOS).map(([clave, m]) => h('label', { class: 'modo' + (cuest.modo === clave ? ' elegido' : '') },
            h('input', { type: 'radio', name: 'modo', value: clave, checked: cuest.modo === clave, onchange: () => { cuest.modo = clave; guardarYa(); redibujarTodo(); } }),
            m.nombre))),
        ayuda,
        cuest.modo === 'escape' ? h('div', { class: 'fila', style: { marginTop: '12px' } },
          h('label', { for: 'tiempo-total', style: { margin: 0 } }, 'Tiempo para escapar'), selTotal) : null);
    }
    let cajaModoActual = null;
    function redibujarTodo() {
      const nueva = cajaModo();
      cajaModoActual.replaceWith(nueva);
      cajaModoActual = nueva;
      dibujar();
      nueva.querySelector(`input[name=modo][value=${cuest.modo}]`)?.focus();
    }

    main.innerHTML = '';
    main.append(
      AV.encabezado(h('div', { class: 'fila' },
        h('label', { class: 'boton', for: 'importar-preg', style: { margin: 0 } }, 'Importar'), archivo,
        h('button', { class: 'boton', type: 'button', onclick: () => { guardarYa(); AV.almacen.exportar(cuest); } }, 'Exportar'),
        h('button', { class: 'boton', type: 'button', title: 'Paquete SCORM 1.2 para Moodle o el campus del INFD', onclick: () => { guardarYa(); AV.scorm.exportar(cuest); } }, 'SCORM'),
        h('button', { class: 'boton boton-principal', type: 'button', onclick: presentar }, 'Presentar'))),
      h('div', { class: 'hoja pila' },
        h('div', { class: 'campo' },
          h('label', { for: 'titulo' }, 'Título del cuestionario'),
          titulo,
          h('p', { class: 'ayuda' }, 'Se guarda solo en este navegador mientras escribís. Para pasarlo a otra compu, usá Exportar.')),
        (cajaModoActual = cajaModo()),
        lista,
        h('div', { class: 'agregar' },
          h('div', { class: 'grupo-agregar' }, h('span', null, 'Para evaluar'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('opcion') }, '+ Opción múltiple'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('vf') }, '+ Verdadero o falso'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('texto') }, '+ Respuesta escrita'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('orden') }, '+ Ordenar'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('numero') }, '+ Adivinar el número')),
          h('div', { class: 'grupo-agregar' }, h('span', null, 'Para opinar'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('encuesta') }, '+ Encuesta'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('escala') }, '+ Escala'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('ranking') }, '+ Ranking'),
            h('button', { class: 'boton', type: 'button', onclick: () => agregar('nube') }, '+ Nube de palabras'))),
        h('div', { class: 'fila-entre' },
          h('a', { class: 'boton boton-texto', href: '#/', onclick: guardarYa }, 'Volver a mis cuestionarios'),
          h('button', { class: 'boton boton-principal boton-grande', type: 'button', onclick: presentar }, 'Presentar a la clase'))
      )
    );
    dibujar();
    document.title = cuest.titulo + ' · Aula en Vivo';
    return () => guardarYa();
  }

  AV.editor = { render };
})(window.AV);
