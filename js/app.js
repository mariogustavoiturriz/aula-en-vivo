/* Aula en Vivo — inicio y navegación
   Copyright (C) 2026 Mario Gustavo Iturriz — Licencia GPL-3.0-o-posterior */
'use strict';

(function (AV) {
  const { h } = AV;
  let limpiar = null;

  function inicio(main) {
    document.title = 'Aula en Vivo';
    const lista = h('ul', { class: 'lista-cuest' });

    function dibujarLista() {
      const todos = AV.almacen.todos();
      lista.innerHTML = '';
      if (!todos.length) {
        lista.append(h('li', { class: 'vacio', style: { display: 'block' } }, 'Todavía no tenés cuestionarios. Armá el primero con el botón de arriba.'));
        return;
      }
      todos.forEach(c => {
        const nPreg = c.preguntas.length;
        lista.append(h('li', null,
          h('div', null,
            h('div', { class: 'nombre' }, c.titulo),
            h('div', { class: 'suave chico' }, nPreg === 1 ? '1 pregunta' : `${nPreg} preguntas`)),
          h('div', { class: 'fila' },
            h('a', { class: 'boton', href: '#/editar/' + c.id }, 'Editar'),
            h('a', { class: 'boton boton-principal', href: '#/presentar/' + c.id }, 'Presentar'),
            h('button', { class: 'boton boton-texto', type: 'button', onclick: () => { AV.almacen.duplicar(c.id); dibujarLista(); AV.aviso('Cuestionario duplicado'); } }, 'Duplicar'),
            h('button', { class: 'boton boton-texto', type: 'button', onclick: () => AV.almacen.exportar(c) }, 'Exportar'),
            h('button', { class: 'boton boton-texto', type: 'button', style: { color: 'var(--error)' }, onclick: () => {
              if (!confirm(`¿Borrar «${c.titulo}»? Si no lo exportaste, se pierde.`)) return;
              AV.almacen.borrar(c.id); dibujarLista();
            } }, 'Borrar'))));
      });
    }

    const archivo = h('input', { type: 'file', accept: '.json,application/json', class: 'oculto-visual', id: 'importar', onchange: e => {
      const f = e.target.files[0];
      if (!f) return;
      AV.almacen.importarArchivo(f).then(c => { dibujarLista(); AV.aviso('Importaste «' + c.titulo + '»'); })
        .catch(err => AV.aviso(err.message, 4500))
        .finally(() => { e.target.value = ''; });
    } });

    const inCodigo = h('input', { type: 'text', id: 'codigo-inicio', placeholder: 'CÓDIGO', autocomplete: 'off', autocapitalize: 'characters', maxlength: 8, 'aria-label': 'Código de la sala' });

    // Configuración de la red
    const conf = AV.almacen.leerRed();
    const inRelay = h('input', { type: 'url', id: 'relay', value: conf.relay, placeholder: 'wss://relay.mi-escuela.edu.ar', disabled: conf.red !== 'relay',
      oninput: e => { conf.relay = e.target.value.trim(); AV.almacen.guardarRed(conf); } });
    const opcionesRed = h('div', { class: 'opciones-red', role: 'radiogroup', 'aria-label': 'Red para conectar los celulares' },
      Object.entries(AV.almacen.REDES).map(([clave, r]) => h('label', null,
        h('input', { type: 'radio', name: 'red', value: clave, checked: conf.red === clave, onchange: () => {
          conf.red = clave; inRelay.disabled = clave !== 'relay'; AV.almacen.guardarRed(conf);
        } }),
        h('span', null, h('strong', null, r.nombre), h('br'), h('span', { class: 'suave chico' }, r.detalle)))));

    main.innerHTML = '';
    main.append(
      AV.encabezado(),
      h('div', { class: 'hoja' },
        h('section', { class: 'portada' },
          h('h1', null, 'Preguntas en vivo para el aula'),
          h('p', null, 'Cuestionarios con puntaje, encuestas y nubes de palabras. Cada celular se conecta directo a la compu del docente: sin cuentas, sin publicidad y sin que las respuestas queden guardadas en servidores ajenos.')),

        h('div', { class: 'caminos' },
          h('section', { class: 'papel camino', 'aria-labelledby': 't-unirme' },
            h('h2', { id: 't-unirme' }, 'Unirme a una sala'),
            h('p', null, 'Escribí el código que aparece en el pizarrón.'),
            h('form', { class: 'form-codigo', onsubmit: e => {
              e.preventDefault();
              const c = AV.limpiarCodigo(inCodigo.value);
              if (c.length < 4) { AV.aviso('Revisá el código de la sala.'); inCodigo.focus(); return; }
              location.hash = '#/sala/' + c;
            } }, inCodigo, h('button', { class: 'boton boton-principal', type: 'submit' }, 'Entrar'))),

          h('section', { class: 'papel camino', 'aria-labelledby': 't-armar' },
            h('h2', { id: 't-armar' }, 'Armar un cuestionario'),
            h('p', null, 'Opción múltiple con puntaje por rapidez, encuestas sin respuesta correcta y nubes de palabras.'),
            h('div', { class: 'fila' },
              h('button', { class: 'boton boton-principal', type: 'button', onclick: () => { const c = AV.almacen.crear(); location.hash = '#/editar/' + c.id; } }, 'Nuevo cuestionario'),
              h('label', { class: 'boton', for: 'importar', style: { margin: 0 } }, 'Importar archivo'), archivo))),

        h('section', { class: 'papel', style: { marginTop: '20px' }, 'aria-labelledby': 't-mis' },
          h('div', { class: 'fila-entre' },
            h('h2', { id: 't-mis', style: { margin: 0 } }, 'Mis cuestionarios'),
            h('label', { class: 'boton', for: 'importar', style: { margin: 0 } }, 'Importar un cuestionario')),
          h('p', { class: 'suave chico' }, 'Están guardados en este navegador. Exportalos para tener una copia o pasarlos a otra compu.'),
          lista),

        h('details', { class: 'avanzado papel' },
          h('summary', null, 'Conexión de los celulares'),
          h('p', { class: 'suave' }, 'Las redes públicas solo sirven para que los celulares encuentren tu compu. Después, las respuestas viajan directo y cifradas. Si en tu escuela no conecta con una, probá con otra.'),
          opcionesRed,
          h('div', { class: 'campo' }, h('label', { for: 'relay' }, 'Dirección del relay propio'), inRelay),
          h('div', { class: 'campo' },
            h('label', { for: 'publica' }, 'Dirección pública de Aula en Vivo'),
            h('input', { type: 'url', id: 'publica', value: conf.publica, placeholder: 'https://tu-usuario.github.io/aula-en-vivo/',
              oninput: e => { conf.publica = e.target.value.trim(); AV.almacen.guardarRed(conf); } }),
            h('p', { class: 'ayuda' }, 'Solo hace falta si abrís Aula en Vivo como archivo desde la compu (doble clic en index.html). Con esta dirección el QR lleva a los celulares a la página publicada.'))),

        h('footer', { class: 'suave chico', style: { marginTop: '32px' } },
          h('p', null, 'Aula en Vivo es software libre (GPL-3.0). Creado por Mario Gustavo Iturriz, 2026. Usa Trystero para las conexiones y qrcode-generator para los QR (licencias MIT).')))
    );
    dibujarLista();
  }

  function enrutar() {
    if (typeof limpiar === 'function') { try { limpiar(); } catch (e) { console.error(e); } }
    limpiar = null;
    const main = document.getElementById('principal');
    const partes = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    const [ruta, param] = partes;
    window.scrollTo(0, 0);
    if (ruta === 'editar' && param) limpiar = AV.editor.render(main, param);
    else if (ruta === 'presentar' && param) limpiar = AV.docente.render(main, param);
    else if (ruta === 'sala') limpiar = AV.estudiante.render(main, AV.limpiarCodigo(param || ''));
    else inicio(main);
  }

  window.addEventListener('hashchange', enrutar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enrutar);
  else enrutar();
})(window.AV);
