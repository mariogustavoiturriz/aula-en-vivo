/* Aula en Vivo — editor de cuestionarios
   Copyright (C) 2026 Mario Gustavo Iturriz — Licencia GPL-3.0-o-posterior */
'use strict';

(function (AV) {
  const { h } = AV;
  const NOMBRE_TIPO = { opcion: 'Opción múltiple', encuesta: 'Encuesta (sin respuesta correcta)', nube: 'Nube de palabras' };

  function tipoVisible(p) { return p.tipo === 'nube' ? 'nube' : (AV.almacen.correctasDe(p) === null ? 'encuesta' : 'opcion'); }

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
          id: idTexto, rows: 2, maxlength: 300, placeholder: tipo === 'nube' ? 'Ej.: Escribí una palabra que asocies con…' : 'Escribí la pregunta',
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
        opciones.append(h('label', { class: 'correcta-toggle', style: { marginTop: '10px', fontWeight: 700 } },
          h('input', {
            type: 'checkbox', checked: !!p.multiple,
            onchange: e => { AV.almacen.cambiarMultiple(p, e.target.checked); guardarYa(); dibujar(); lista.querySelector(`[data-id="${p.id}"] [data-multiple]`)?.focus(); },
            'data-multiple': ''
          }),
          tipo === 'opcion' ? 'Hay más de una respuesta correcta (se eligen varias)' : 'Se pueden elegir varias opciones'));
        caja.append(opciones);
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

      caja.append(h('div', { class: 'fila-entre' },
        h('div', { class: 'fila' }, h('label', { for: idTiempo, style: { margin: 0 } }, 'Tiempo'), selTiempo),
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

    main.innerHTML = '';
    main.append(
      AV.encabezado(h('div', { class: 'fila' },
        h('label', { class: 'boton', for: 'importar-preg', style: { margin: 0 } }, 'Importar'), archivo,
        h('button', { class: 'boton', type: 'button', onclick: () => { guardarYa(); AV.almacen.exportar(cuest); } }, 'Exportar'),
        h('button', { class: 'boton boton-principal', type: 'button', onclick: presentar }, 'Presentar'))),
      h('div', { class: 'hoja pila' },
        h('div', { class: 'campo' },
          h('label', { for: 'titulo' }, 'Título del cuestionario'),
          titulo,
          h('p', { class: 'ayuda' }, 'Se guarda solo en este navegador mientras escribís. Para pasarlo a otra compu, usá Exportar.')),
        lista,
        h('div', { class: 'agregar' },
          h('button', { class: 'boton', type: 'button', onclick: () => agregar('opcion') }, '+ Opción múltiple'),
          h('button', { class: 'boton', type: 'button', onclick: () => agregar('encuesta') }, '+ Encuesta'),
          h('button', { class: 'boton', type: 'button', onclick: () => agregar('nube') }, '+ Nube de palabras')),
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
