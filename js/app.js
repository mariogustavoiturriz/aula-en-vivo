/* Aula en Vivo — inicio y navegación
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior */
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

        pie())
    );
    dibujarLista();
  }

  /* Dirección para recibir sugerencias. Si la dejás vacía, la página igual ofrece
     el enlace al repositorio cuando el sitio está publicado en GitHub Pages. */
  const CORREO_SUGERENCIAS = '';

  function pie() {
    return h('footer', { class: 'pie' },
      'Aula en Vivo · ', AV.copyleft(), ' ',
      h('a', { href: '#/acerca' }, 'Gustavo Iturriz · software libre'));
  }

  function acerca(main) {
    document.title = 'Acerca de · Aula en Vivo';
    const vias = h('div', { class: 'fila' });
    if (CORREO_SUGERENCIAS) {
      vias.append(h('a', { class: 'boton boton-principal', href: 'mailto:' + CORREO_SUGERENCIAS + '?subject=' + encodeURIComponent('Aula en Vivo') }, 'Escribirme'));
    }
    // Si está publicado en GitHub Pages, deducimos solos la dirección del repositorio
    const host = location.hostname;
    if (/\.github\.io$/i.test(host)) {
      const usuario = host.replace(/\.github\.io$/i, '');
      const primera = location.pathname.split('/').filter(Boolean)[0];
      const repo = (primera && !/\.html?$/i.test(primera)) ? primera : host;
      vias.append(h('a', { class: 'boton', href: `https://github.com/${usuario}/${repo}/issues/new`, target: '_blank', rel: 'noopener' }, 'Contar un problema o proponer algo'));
    }
    if (!vias.children.length) {
      vias.append(h('span', { class: 'suave chico' }, 'Para habilitar el contacto, poné una dirección de correo al principio de la función acerca, en js/app.js.'));
    }

    main.innerHTML = '';
    main.append(
      AV.encabezado(),
      h('div', { class: 'hoja hoja-angosta pila', style: { width: 'min(720px, 100% - 32px)' } },
        h('section', { class: 'portada', style: { paddingBottom: 0 } },
          h('h1', null, 'Acerca de'),
          h('p', null, 'Un sistema libre para hacer cuestionarios, encuestas y nubes de palabras en vivo en el aula, sin instalar nada, sin cuentas y sin depender de ningún servicio pago.')),

        h('section', { class: 'papel' },
          h('dl', { class: 'ficha' },
            h('dt', null, 'Autoría'), h('dd', null, h('strong', null, 'Gustavo Iturriz')),
            h('dt', null, 'Lugar'), h('dd', null, 'Ushuaia, Tierra del Fuego, Argentina'),
            h('dt', null, 'Versión'), h('dd', null, AV.VERSION),
            h('dt', null, 'Año'), h('dd', null, '2026'))),

        h('h2', null, 'Copyleft'),
        h('section', { class: 'papel' },
          h('p', null, h('span', { class: 'copyleft copyleft-grande', 'aria-label': 'Copyleft' }, '©')),
          h('p', null, 'Este sistema es ', h('strong', null, 'software libre'), '. Se puede usar, copiar, estudiar, modificar y repartir, con fines educativos o de cualquier otro tipo, sin pedir permiso y sin pagar nada.'),
          h('p', null, 'Lo único que se pide a cambio es que lo que se derive de acá siga siendo libre: que se comparta con la misma libertad y que se mantenga la mención de autoría. A eso se le dice copyleft.'),
          h('p', { class: 'chico suave', style: { margin: 0 } }, 'Licencia ', h('strong', null, 'GNU GPL versión 3'), '. El texto completo está en ',
            h('a', { href: 'https://www.gnu.org/licenses/gpl-3.0.html', target: '_blank', rel: 'noopener' }, 'gnu.org/licenses/gpl-3.0'), '.')),

        h('h2', null, 'Hecho con software libre'),
        h('section', { class: 'papel' },
          h('p', null, 'La conexión entre los celulares y la compu, y los códigos QR, no los escribí yo: son bibliotecas libres de otra gente, que viajan adentro de este sistema y no se descargan de ningún lado.'),
          h('ul', { class: 'creditos' },
            h('li', null, h('strong', null, 'Trystero'), ' 0.26: conexión directa entre navegadores (WebRTC) usando Nostr, MQTT o un relay propio para encontrarse. Dan Motzenbecker, licencia MIT. Lleva un cambio chiquito mío para que quien llega tarde encuentre la sala enseguida.'),
            h('li', null, h('strong', null, 'qrcode-generator'), ' 2.0: generación de códigos QR. Kazuhiko Arase, licencia MIT.'),
            h('li', null, h('strong', null, 'Atkinson Hyperlegible'), ' y ', h('strong', null, 'Bricolage Grotesque'), ': tipografías. Braille Institute y Mathieu Triay, licencia SIL Open Font 1.1.')),
          h('p', { class: 'chico suave', style: { margin: 0 } }, 'Las licencias de esas bibliotecas se respetan tal como están: son libres y permiten este uso.')),

        h('h2', null, 'Sugerencias y mejoras'),
        h('section', { class: 'papel' },
          h('p', null, 'Si encontrás algo que no anda, se te ocurre un tipo de pregunta nuevo o querés usarlo en tu escuela y necesitás una mano, escribime. Esto se mejora con lo que va apareciendo en las aulas.'),
          vias),

        h('h2', null, 'Para qué lo hice'),
        h('section', { class: 'papel' },
          h('p', null, 'Las herramientas que se usan para esto en el aula son pagas o tienen versiones gratis recortadas, hay que abrir cuenta, y las respuestas de los estudiantes quedan guardadas en el servidor de una empresa.'),
          h('p', { style: { margin: 0 } }, 'Acá cada celular se conecta directo con la compu del docente, los cuestionarios son archivos que te guardás vos y no queda nada en servidores ajenos. El programa se copia y se publica donde quieras. Si algún día dejo de ocuparme de esto, les sigue funcionando igual a los docentes y estudiantes que lo usan.')),
        pie())
    );
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
    else if (ruta === 'acerca') acerca(main);
    else if (ruta === 'sala') limpiar = AV.estudiante.render(main, AV.limpiarCodigo(param || ''));
    else inicio(main);
  }

  window.addEventListener('hashchange', enrutar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enrutar);
  else enrutar();
})(window.AV);
