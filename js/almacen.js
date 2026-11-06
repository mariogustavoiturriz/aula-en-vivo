/* Aula en Vivo — cuestionarios guardados en este navegador
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior */
'use strict';

(function (AV) {
  const CLAVE = 'aulaenvivo.cuestionarios';
  const CLAVE_RED = 'aulaenvivo.red';
  const TIEMPOS = [10, 20, 30, 45, 60, 90, 120];
  const MODOS = ['vivo', 'escape', 'set'];
  const TIEMPOS_TOTALES = [0, 5, 10, 15, 20, 30, 45, 60]; // minutos para el escape room (0 = sin límite)

  function nuevaPregunta(tipo) {
    const base = { id: AV.generarId(), tipo, texto: '', tiempo: tipo === 'nube' ? 60 : 20 };
    if (tipo === 'opcion') return { ...base, opciones: ['', '', '', ''], correcta: 0 };
    if (tipo === 'encuesta') return { ...base, tipo: 'opcion', opciones: ['', '', '', ''], correcta: null, tiempo: 30 };
    if (tipo === 'texto') return { ...base, respuestas: [''], tiempo: 30 };
    if (tipo === 'vf') return { ...base, tipo: 'opcion', opciones: ['Verdadero', 'Falso'], correcta: 0 };
    if (tipo === 'orden') return { ...base, items: ['', '', '', ''], tiempo: 30 };
    if (tipo === 'ranking') return { ...base, tipo: 'orden', items: ['', '', '', ''], sinCorrecta: true, tiempo: 45 };
    if (tipo === 'numero') return { ...base, min: 0, max: 100, paso: 1, respuesta: 50, margen: 5, tiempo: 30 };
    if (tipo === 'escala') return { ...base, tipo: 'numero', min: 1, max: 5, paso: 1, respuesta: null, margen: 0, etiquetaMin: 'Nada', etiquetaMax: 'Mucho', tiempo: 30 };
    return base; // nube
  }

  function ejemplo() {
    const ahora = Date.now();
    return {
      id: 'ejemplo-funcion-lineal',
      titulo: 'Repaso: función lineal',
      creado: ahora, modificado: ahora, version: 1,
      preguntas: [
        { id: 'e1', tipo: 'opcion', texto: '¿Cuál es la pendiente de y = 3x − 2?', opciones: ['3', '−2', '2/3', '−3'], correcta: 0, tiempo: 20 },
        { id: 'e2', tipo: 'opcion', texto: 'Si f(x) = 2x + 1, ¿cuánto vale f(4)?', opciones: ['7', '9', '8', '6'], correcta: 1, tiempo: 20 },
        { id: 'e2b', tipo: 'opcion', texto: '¿Cuáles de estas son funciones lineales?', opciones: ['y = 2x + 1', 'y = x²', 'y = −x', 'y = 3/x'], multiple: true, correctas: [0, 2], tiempo: 30 },
        { id: 'e3', tipo: 'opcion', texto: 'Dos rectas son paralelas cuando tienen…', opciones: ['La misma pendiente', 'La misma ordenada al origen', 'Pendientes opuestas', 'Un punto en común'], correcta: 0, tiempo: 30 },
        { id: 'e4', tipo: 'opcion', texto: '¿Qué tan seguro o segura te sentís con este tema?', opciones: ['Muy seguro/a', 'Bastante', 'Más o menos', 'Necesito repasar'], correcta: null, tiempo: 30 },
        { id: 'e5', tipo: 'nube', texto: 'Escribí una palabra que asocies con «función»', tiempo: 60 }
      ]
    };
  }

  function todos() {
    let lista = AV.guardado.leer(CLAVE, null);
    if (!Array.isArray(lista)) {
      lista = [ejemplo()];
      AV.guardado.escribir(CLAVE, lista);
    }
    return lista;
  }
  function guardarTodos(lista) { return AV.guardado.escribir(CLAVE, lista); }

  function obtener(id) { return todos().find(c => c.id === id) || null; }

  function guardar(cuest) {
    const lista = todos();
    cuest.modificado = Date.now();
    const i = lista.findIndex(c => c.id === cuest.id);
    if (i >= 0) lista[i] = cuest; else lista.unshift(cuest);
    if (!guardarTodos(lista)) AV.aviso('No se pudo guardar en este navegador. Exportá el archivo para no perderlo.', 5000);
  }

  function crear() {
    const ahora = Date.now();
    const c = { id: AV.generarId(), titulo: 'Cuestionario sin título', modo: 'vivo', creado: ahora, modificado: ahora, version: 1, preguntas: [nuevaPregunta('opcion')] };
    guardar(c);
    return c;
  }

  function duplicar(id) {
    const orig = obtener(id);
    if (!orig) return null;
    const copia = JSON.parse(JSON.stringify(orig));
    copia.id = AV.generarId();
    copia.titulo = orig.titulo + ' (copia)';
    copia.creado = Date.now();
    copia.preguntas.forEach(p => { p.id = AV.generarId(); });
    guardar(copia);
    return copia;
  }

  function borrar(id) { guardarTodos(todos().filter(c => c.id !== id)); }

  /** Revisa y limpia un cuestionario importado o recibido. Devuelve {cuest, errores} */
  function validar(datos) {
    const errores = [];
    if (!datos || typeof datos !== 'object') return { cuest: null, errores: ['El archivo no tiene un cuestionario válido.'] };
    const cuest = {
      id: typeof datos.id === 'string' ? datos.id.slice(0, 60) : AV.generarId(),
      titulo: String(datos.titulo || 'Cuestionario importado').slice(0, 120),
      creado: Number(datos.creado) || Date.now(),
      modificado: Date.now(),
      version: 1,
      modo: MODOS.includes(datos.modo) ? datos.modo : 'vivo',
      tiempoTotal: TIEMPOS_TOTALES.includes(Number(datos.tiempoTotal)) ? Number(datos.tiempoTotal) : 0,
      preguntas: []
    };
    const lista = Array.isArray(datos.preguntas) ? datos.preguntas : [];
    lista.slice(0, 100).forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      const tipo = ['nube', 'texto', 'orden', 'numero'].includes(p.tipo) ? p.tipo : 'opcion';
      const preg = {
        id: typeof p.id === 'string' ? p.id.slice(0, 40) : AV.generarId(),
        tipo,
        texto: String(p.texto || '').slice(0, 300),
        tiempo: TIEMPOS.includes(Number(p.tiempo)) ? Number(p.tiempo) : (tipo === 'nube' ? 60 : 20)
      };
      if ([0, 1000, 2000].includes(Number(p.puntos)) && Number(p.puntos) !== 1000) preg.puntos = Number(p.puntos);
      if (tipo === 'orden') {
        preg.items = (Array.isArray(p.items) ? p.items : []).slice(0, 6).map(t => String(t ?? '').slice(0, 80));
        while (preg.items.length < 2) preg.items.push('');
        if (p.sinCorrecta) preg.sinCorrecta = true;
      }
      if (tipo === 'numero') {
        const num = (v, d) => Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d;
        preg.min = num(p.min, 0); preg.max = num(p.max, 100);
        if (preg.max <= preg.min) preg.max = preg.min + 1;
        preg.paso = num(p.paso, 1) > 0 ? num(p.paso, 1) : 1;
        preg.respuesta = p.respuesta === null || p.respuesta === undefined ? null : Math.min(preg.max, Math.max(preg.min, num(p.respuesta, preg.min)));
        preg.margen = Math.max(0, num(p.margen, 0));
        if (p.etiquetaMin) preg.etiquetaMin = String(p.etiquetaMin).slice(0, 30);
        if (p.etiquetaMax) preg.etiquetaMax = String(p.etiquetaMax).slice(0, 30);
      }
      if (tipo === 'texto') {
        preg.respuestas = (Array.isArray(p.respuestas) ? p.respuestas : [p.respuesta]).slice(0, 10).map(r => String(r ?? '').slice(0, 60));
        if (!preg.respuestas.length) preg.respuestas = [''];
      }
      if (tipo === 'opcion') {
        const ops = (Array.isArray(p.opciones) ? p.opciones : []).slice(0, 4).map(o => String(o ?? '').slice(0, 120));
        while (ops.length < 2) ops.push('');
        preg.opciones = ops;
        if (p.multiple === true) {
          // varias respuestas: correctas es una lista de posiciones, o null si es encuesta
          preg.multiple = true;
          preg.correctas = (p.correctas === null || (p.correctas === undefined && p.correcta === null)) ? null
            : [...new Set((Array.isArray(p.correctas) ? p.correctas : [p.correcta]).filter(k => Number.isInteger(k) && k >= 0 && k < ops.length))].sort();
        } else {
          preg.correcta = (p.correcta === null || p.correcta === undefined) ? null
            : (Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < ops.length ? p.correcta : 0);
        }
      }
      cuest.preguntas.push(preg);
    });
    if (!cuest.preguntas.length) errores.push('El cuestionario no tiene preguntas.');
    return { cuest, errores };
  }

  /** Problemas que impiden presentar: preguntas u opciones vacías */
  function problemas(cuest) {
    const lista = [];
    if (!cuest.preguntas.length) lista.push('Agregá al menos una pregunta.');
    cuest.preguntas.forEach((p, i) => {
      const n = i + 1;
      if (!p.texto.trim()) lista.push(`La pregunta ${n} no tiene texto.`);
      if (p.tipo === 'opcion') {
        const llenas = p.opciones.filter(o => o.trim()).length;
        if (llenas < 2) lista.push(`La pregunta ${n} necesita al menos dos opciones.`);
        const cor = correctasDe(p);
        if (cor && !cor.length) lista.push(`En la pregunta ${n}, marcá al menos una respuesta correcta.`);
        if (cor && cor.some(k => !String(p.opciones[k] || '').trim())) lista.push(`En la pregunta ${n}, hay una opción marcada como correcta que está vacía.`);
      }
      if (p.tipo === 'texto' && !p.respuestas.some(r => normalizarRespuesta(r))) lista.push(`En la pregunta ${n}, escribí la respuesta correcta.`);
      if (p.tipo === 'orden' && p.items.filter(t => t.trim()).length < 2) lista.push(`La pregunta ${n} necesita al menos dos elementos para ordenar.`);
      if (p.tipo === 'orden' && p.items.some(t => !t.trim()) && p.items.filter(t => t.trim()).length >= 2) {
        p.items = p.items.filter(t => t.trim()); // los vacíos del final no cuentan
      }
      if (p.tipo === 'numero' && (p.max - p.min) / p.paso > 1000) lista.push(`En la pregunta ${n}, el deslizador tiene demasiados pasos: agrandá el paso.`);
    });
    return lista;
  }

  function exportar(cuest) {
    const limpio = { formato: 'aula-en-vivo', version: 1, ...cuest };
    AV.descargar(AV.nombreArchivo(cuest.titulo) + '.json', JSON.stringify(limpio, null, 2));
  }

  /** Lee y revisa un archivo .json, sin guardarlo */
  function leerArchivo(archivo) {
    return archivo.text().then(txt => {
      let datos;
      try { datos = JSON.parse(txt); } catch (e) { throw new Error('El archivo no es un JSON válido.'); }
      const { cuest, errores } = validar(datos);
      if (!cuest || errores.length) throw new Error(errores[0] || 'No se pudo leer el cuestionario.');
      return cuest;
    });
  }

  function importarArchivo(archivo) {
    return leerArchivo(archivo).then(cuest => {
      if (obtener(cuest.id)) cuest.id = AV.generarId();
      guardar(cuest);
      return cuest;
    });
  }

  // ----- Configuración de la red -----
  const REDES = {
    nostr: { nombre: 'Nostr (recomendada)', detalle: 'Red pública y descentralizada, con cientos de relays. No hay que configurar nada.' },
    mqtt: { nombre: 'MQTT', detalle: 'Brokers públicos de internet de las cosas. Sirve de alternativa si Nostr no conecta en tu red.' },
    relay: { nombre: 'Relay propio', detalle: 'Un servidor chico de la institución o del Ministerio. Ver la carpeta relay/ del proyecto.' }
  };
  function leerRed() {
    const c = AV.guardado.leer(CLAVE_RED, {});
    return {
      red: REDES[c.red] ? c.red : 'nostr',
      relay: typeof c.relay === 'string' ? c.relay : '',
      publica: typeof c.publica === 'string' ? c.publica : ''
    };
  }
  function guardarRed(conf) { AV.guardado.escribir(CLAVE_RED, conf); }

  /** Posiciones de las respuestas correctas, o null si la pregunta es una encuesta */
  function correctasDe(p) {
    if (p.tipo !== 'opcion') return null;
    if (p.multiple) return Array.isArray(p.correctas) ? p.correctas : null;
    return p.correcta === null || p.correcta === undefined ? null : [p.correcta];
  }

  /** Pasa una pregunta de una respuesta a varias, o al revés, conservando lo marcado */
  function cambiarMultiple(p, multiple) {
    if (multiple && !p.multiple) {
      p.correctas = p.correcta === null ? null : [p.correcta];
      delete p.correcta;
      p.multiple = true;
    } else if (!multiple && p.multiple) {
      p.correcta = p.correctas === null ? null : (p.correctas[0] ?? 0);
      delete p.correctas;
      delete p.multiple;
    }
  }

  /** Normaliza una respuesta escrita: sin tildes ni mayúsculas, sin espacios, y con coma decimal igual a punto */
  function normalizarRespuesta(txt) {
    return String(txt ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/[^a-z0-9ñ./-]/g, '');
  }
  /** ¿La respuesta escrita coincide con alguna de las aceptadas? */
  function respuestaCorrecta(p, txt) {
    const r = normalizarRespuesta(txt);
    return !!r && p.respuestas.some(ok => normalizarRespuesta(ok) === r);
  }
  /** ¿La pregunta tiene respuesta correcta (suma puntos)? */
  function calificable(p) {
    if (p.puntos === 0) return false;
    if (p.tipo === 'texto') return true;
    if (p.tipo === 'orden') return !p.sinCorrecta;
    if (p.tipo === 'numero') return p.respuesta !== null && p.respuesta !== undefined;
    return !!correctasDe(p);
  }
  /** ¿Tiene respuesta correcta aunque no sume puntos? (para mostrarla) */
  function tieneCorrecta(p) {
    if (p.tipo === 'texto') return true;
    if (p.tipo === 'orden') return !p.sinCorrecta;
    if (p.tipo === 'numero') return p.respuesta !== null && p.respuesta !== undefined;
    if (p.tipo === 'nube') return false;
    return !!correctasDe(p);
  }

  // ----- Plantillas -----
  function plantillaEscape() {
    return {
      titulo: 'Escape del aula de Matemática', modo: 'escape', tiempoTotal: 15,
      preguntas: [
        { tipo: 'opcion', texto: 'Candado 1. En la pizarra quedó escrita una ecuación: si 3x + 5 = 20, ¿cuánto vale x?', opciones: ['3', '5', '15', '25/3'], correcta: 1 },
        { tipo: 'texto', texto: 'Candado 2. El código tiene tres cifras. La 1.ª es el resultado de 2³ − 5, la 2.ª es la raíz cuadrada de 49 y la 3.ª es 15 dividido 3. ¿Cuál es el código?', respuestas: ['375'] },
        { tipo: 'opcion', texto: 'Candado 3. El armario se abre marcando todos los números primos. ¿Cuáles son?', opciones: ['2', '9', '13', '21'], multiple: true, correctas: [0, 2] },
        { tipo: 'texto', texto: 'Candado 4. ¿Cuántos grados suman los ángulos interiores de un cuadrilátero?', respuestas: ['360'] },
        { tipo: 'opcion', texto: 'Última puerta. ¿Cuál es la pendiente de la recta que pasa por (0, 1) y (2, 5)?', opciones: ['2', '4', '1/2', '3'], correcta: 0 }
      ]
    };
  }
  function plantillaSet() {
    return {
      titulo: 'Repaso de geometría', modo: 'set', tiempoTotal: 0,
      preguntas: [
        { tipo: 'opcion', texto: '¿Cuánto suman los ángulos interiores de un triángulo?', opciones: ['90°', '180°', '270°', '360°'], correcta: 1 },
        { tipo: 'opcion', texto: '¿Cuáles de estas figuras tienen cuatro lados?', opciones: ['Cuadrado', 'Triángulo', 'Rombo', 'Pentágono'], multiple: true, correctas: [0, 2] },
        { tipo: 'texto', texto: 'Un rectángulo mide 5 cm por 3 cm. ¿Cuál es su área, en cm²?', respuestas: ['15'] },
        { tipo: 'texto', texto: '¿Cuántas diagonales tiene un pentágono?', respuestas: ['5', 'cinco'] },
        { tipo: 'opcion', texto: 'Si un ángulo mide 35°, ¿cuánto mide su complemento?', opciones: ['55°', '145°', '65°', '45°'], correcta: 0 },
        { tipo: 'nube', texto: 'Escribí una palabra que te haga pensar en la geometría' }
      ]
    };
  }
  /** Crea y guarda un cuestionario nuevo a partir de una plantilla ('escape' o 'set') */
  function crearDesdePlantilla(cual) {
    const { cuest } = validar(cual === 'escape' ? plantillaEscape() : plantillaSet());
    cuest.id = AV.generarId();
    cuest.preguntas.forEach(p => { p.id = AV.generarId(); });
    guardar(cuest);
    return cuest;
  }

  AV.almacen = { TIEMPOS, REDES, MODOS, TIEMPOS_TOTALES, normalizarRespuesta, respuestaCorrecta, calificable, tieneCorrecta, crearDesdePlantilla, correctasDe, cambiarMultiple, leerArchivo, nuevaPregunta, todos, obtener, guardar, crear, duplicar, borrar, validar, problemas, exportar, importarArchivo, leerRed, guardarRed };
})(window.AV);
