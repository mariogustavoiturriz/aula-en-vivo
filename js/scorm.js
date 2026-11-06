/* Aula en Vivo — exportar un cuestionario como paquete SCORM 1.2
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior

   Arma, en el navegador y sin servidor, un .zip con:
   - imsmanifest.xml (SCORM 1.2)
   - index.html: un reproductor autónomo que se resuelve a su ritmo, de a una pregunta,
     y le informa a la plataforma (Moodle, campus INFD, etc.) la nota y el estado. */
'use strict';

(function (AV) {
  // ---------- ZIP sin compresión (método "store"), suficiente para un paquete chico ----------
  const TABLA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(archivos) {
    const enc = new TextEncoder();
    const partes = [], central = [];
    let offset = 0;
    const ahora = new Date();
    const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
    for (const { nombre, contenido } of archivos) {
      const datos = typeof contenido === 'string' ? enc.encode(contenido) : contenido;
      const nom = enc.encode(nombre);
      const crc = crc32(datos);
      const loc = new DataView(new ArrayBuffer(30));
      loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
      loc.setUint16(10, hora, true); loc.setUint16(12, fecha, true); loc.setUint32(14, crc, true);
      loc.setUint32(18, datos.length, true); loc.setUint32(22, datos.length, true); loc.setUint16(26, nom.length, true); loc.setUint16(28, 0, true);
      partes.push(new Uint8Array(loc.buffer), nom, datos);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
      cen.setUint16(12, hora, true); cen.setUint16(14, fecha, true); cen.setUint32(16, crc, true);
      cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true); cen.setUint16(28, nom.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), nom);
      offset += 30 + nom.length + datos.length;
    }
    const tamCentral = central.reduce((a, b) => a + b.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
    return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' });
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function manifiesto(cuest, id) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${esc(cuest.titulo)}</title>
      <item identifier="item1" identifierref="res1" isvisible="true">
        <title>${esc(cuest.titulo)}</title>
        <adlcp:masteryscore>${cuest.__aprobar}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`;
  }

  // ---------- Reproductor autónomo (va dentro del paquete) ----------
  // Se escribe como función para que el editor lo revise y después se convierte en texto.
  function reproductor(DATOS) {
    var LETRAS = ['A', 'B', 'C', 'D'];
    var COLORES = ['#D33A2C', '#2867D6', '#F0B323', '#1F8A5B'];
    var preg = DATOS.preguntas, n = 0, puntos = 0, maximo = 0, resultados = [];
    var cuerpo = document.getElementById('app');

    // --- SCORM 1.2: busca la API en las ventanas de arriba ---
    var API = null;
    (function buscar() {
      var w = window, i = 0;
      // si la plataforma está en otro dominio, el navegador no deja mirar: lo tomamos como "sin plataforma"
      try { while (w && i < 10) { if (w.API) { API = w.API; return; } if (w.parent === w) break; w = w.parent; i++; } } catch (e) { /* sin acceso */ }
      try { if (window.opener && window.opener.API) API = window.opener.API; } catch (e) { /* sin acceso */ }
    })();
    function scorm(f, a, b) { try { return API ? API[f](a === undefined ? '' : a, b) : ''; } catch (e) { return ''; } }
    scorm('LMSInitialize');
    var previo = scorm('LMSGetValue', 'cmi.core.lesson_status');
    if (previo === 'not attempted' || previo === '') scorm('LMSSetValue', 'cmi.core.lesson_status', 'incomplete');
    var inicio = Date.now(), terminado = false;
    function duracion() {
      var t = Math.round((Date.now() - inicio) / 1000), hh = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = t % 60;
      return (hh < 10 ? '000' : '00') + hh + ':' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
    }
    function cerrar() { if (!API) return; scorm('LMSSetValue', 'cmi.core.session_time', duracion()); scorm('LMSCommit'); scorm('LMSFinish'); API = null; }
    window.addEventListener('beforeunload', cerrar); window.addEventListener('pagehide', cerrar);

    function el(tag, attrs, hijos) {
      var e = document.createElement(tag);
      for (var k in attrs || {}) { if (k === 'onclick' || k === 'oninput') e[k] = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
      (hijos || []).forEach(function (h) { if (h) e.appendChild(typeof h === 'string' ? document.createTextNode(h) : h); });
      return e;
    }
    function norm(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2').replace(/[^a-z0-9ñ./-]/g, ''); }
    function fmt(x) { return String(Math.round(x * 1000) / 1000).replace('.', ','); }
    function califica(p) {
      if (p.puntos === 0) return false;
      if (p.tipo === 'texto') return true;
      if (p.tipo === 'orden') return !p.sinCorrecta;
      if (p.tipo === 'numero') return p.respuesta !== null && p.respuesta !== undefined;
      if (p.tipo === 'opcion') return p.multiple ? Array.isArray(p.correctas) : p.correcta !== null && p.correcta !== undefined;
      return false;
    }
    function correctas(p) { return p.multiple ? p.correctas : [p.correcta]; }
    function textoCorrecta(p) {
      if (p.tipo === 'texto') return p.respuestas.filter(Boolean)[0];
      if (p.tipo === 'orden') return p.items.map(function (t, k) { return (k + 1) + '. ' + t; }).join('  ');
      if (p.tipo === 'numero') return fmt(p.respuesta) + (p.margen ? ' (±' + fmt(p.margen) + ')' : '');
      return correctas(p).map(function (k) { return LETRAS[k] + '. ' + p.opciones[k]; }).join(' / ');
    }
    // devuelve la fracción lograda (0 a 1)
    function evaluar(p, v) {
      if (p.tipo === 'texto') return p.respuestas.some(function (r) { return norm(r) && norm(r) === norm(v); }) ? 1 : 0;
      if (p.tipo === 'orden') { var bien = v.filter(function (k, i) { return k === i; }).length; return bien === v.length ? 1 : bien / v.length / 2; }
      if (p.tipo === 'numero') { var d = Math.abs(v - p.respuesta); if (p.margen > 0) return d <= p.margen + 1e-9 ? 1 - 0.5 * d / p.margen : 0; return d < 1e-9 ? 1 : 0; }
      var cor = correctas(p), ac = v.filter(function (k) { return cor.indexOf(k) >= 0; }).length;
      return Math.max(0, (ac - (v.length - ac)) / cor.length);
    }
    function registrar(i, p, v, parte) {
      // interacciones de SCORM 1.2: la plataforma guarda qué respondió en cada pregunta
      var tipo = p.tipo === 'opcion' ? 'choice' : p.tipo === 'orden' ? 'sequencing' : p.tipo === 'numero' ? 'numeric' : 'fill-in';
      var resp = Array.isArray(v) ? v.map(function (k) { return p.tipo === 'opcion' ? String.fromCharCode(97 + k) : String(k + 1); }).join(',') : String(v).slice(0, 255);
      var pre = 'cmi.interactions.' + i + '.';
      scorm('LMSSetValue', pre + 'id', 'p' + (i + 1));
      scorm('LMSSetValue', pre + 'type', tipo);
      scorm('LMSSetValue', pre + 'student_response', resp);
      if (califica(p)) scorm('LMSSetValue', pre + 'result', parte === 1 ? 'correct' : 'wrong');
      else scorm('LMSSetValue', pre + 'result', 'neutral');
      scorm('LMSCommit');
    }

    function pantalla() {
      cuerpo.innerHTML = '';
      if (n >= preg.length) return fin();
      var p = preg[n];
      cuerpo.appendChild(el('div', { class: 'meta' }, ['Pregunta ' + (n + 1) + ' de ' + preg.length]));
      cuerpo.appendChild(el('div', { class: 'barra' }, [el('span', { style: 'width:' + (100 * n / preg.length) + '%' })]));
      cuerpo.appendChild(el('h1', { text: p.texto }));
      var zona = el('div', { class: 'zona' });
      cuerpo.appendChild(zona);
      var enviar = el('button', { class: 'principal', text: 'Responder' });
      enviar.disabled = true;
      var valor = null;
      if (p.tipo === 'opcion') {
        var marcadas = [];
        p.opciones.forEach(function (o, k) {
          if (!String(o).trim()) return;
          var b = el('button', { class: 'opcion', style: 'background:' + COLORES[k] + (k === 2 ? ';color:#2A2000' : ''), 'aria-pressed': 'false' }, [el('b', { text: LETRAS[k] }), o]);
          b.onclick = function () {
            if (p.multiple) { var i = marcadas.indexOf(k); if (i >= 0) marcadas.splice(i, 1); else marcadas.push(k); }
            else marcadas = [k];
            Array.prototype.forEach.call(zona.children, function (c, j) { c.classList.toggle('elegida', marcadas.indexOf(Number(c.dataset.k)) >= 0); c.setAttribute('aria-pressed', String(marcadas.indexOf(Number(c.dataset.k)) >= 0)); });
            valor = marcadas.slice().sort(); enviar.disabled = !valor.length;
          };
          b.dataset.k = k; zona.appendChild(b);
        });
        if (p.multiple) cuerpo.appendChild(el('p', { class: 'ayuda', text: 'Podés elegir más de una.' }));
      } else if (p.tipo === 'orden') {
        var orden = p.items.map(function (_, k) { return k; });
        do { for (var k = orden.length - 1; k > 0; k--) { var r = Math.floor(Math.random() * (k + 1)); var t = orden[k]; orden[k] = orden[r]; orden[r] = t; } }
        while (orden.length > 1 && orden.every(function (x, k) { return x === k; }));
        var pintar = function () {
          zona.innerHTML = '';
          orden.forEach(function (k, i) {
            var arriba = el('button', { class: 'chico', 'aria-label': 'Subir', text: '▲' }), abajo = el('button', { class: 'chico', 'aria-label': 'Bajar', text: '▼' });
            arriba.disabled = i === 0; abajo.disabled = i === orden.length - 1;
            arriba.onclick = function () { var t = orden[i - 1]; orden[i - 1] = orden[i]; orden[i] = t; pintar(); };
            abajo.onclick = function () { var t = orden[i + 1]; orden[i + 1] = orden[i]; orden[i] = t; pintar(); };
            zona.appendChild(el('div', { class: 'item' }, [el('b', { text: String(i + 1) }), el('span', { text: p.items[k] }), arriba, abajo]));
          });
          valor = orden.slice();
        };
        pintar(); enviar.disabled = false;
      } else if (p.tipo === 'numero') {
        var medio = p.min + Math.round((p.max - p.min) / 2 / p.paso) * p.paso;
        var salida = el('div', { class: 'valor', text: fmt(medio) });
        var desl = el('input', { type: 'range', min: p.min, max: p.max, step: p.paso, value: medio, 'aria-label': 'Tu respuesta' });
        desl.oninput = function () { salida.textContent = fmt(Number(desl.value)); valor = Number(desl.value); };
        valor = medio; enviar.disabled = false;
        zona.appendChild(salida); zona.appendChild(desl);
        zona.appendChild(el('div', { class: 'ext' }, [el('span', { text: fmt(p.min) + (p.etiquetaMin ? ' · ' + p.etiquetaMin : '') }), el('span', { text: (p.etiquetaMax ? p.etiquetaMax + ' · ' : '') + fmt(p.max) })]));
      } else {
        var inp = el('input', { type: 'text', maxlength: '60', 'aria-label': 'Tu respuesta', placeholder: 'Tu respuesta', autocomplete: 'off' });
        inp.oninput = function () { valor = inp.value.trim(); enviar.disabled = !valor; };
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !enviar.disabled) enviar.click(); });
        zona.appendChild(inp); setTimeout(function () { inp.focus(); }, 50);
      }
      enviar.onclick = function () {
        enviar.disabled = true;
        Array.prototype.forEach.call(zona.querySelectorAll('button, input'), function (b) { b.disabled = true; });
        var cal = califica(p), base = p.puntos || 1000, parte = cal ? evaluar(p, valor) : null;
        if (cal) { maximo += base; puntos += Math.round(base * parte); }
        resultados.push({ p: p, parte: parte });
        registrar(n, p, valor, parte);
        var fb;
        if (!cal) fb = el('p', { class: 'fb neutro', text: '¡Gracias! Tu respuesta quedó registrada.' });
        else if (parte === 1) fb = el('p', { class: 'fb bien', text: '¡Correcto!' });
        else if (parte > 0) fb = el('p', { class: 'fb neutro', text: 'Casi. La respuesta era: ' + textoCorrecta(p) });
        else fb = el('p', { class: 'fb mal', text: 'Esta vez no. La respuesta era: ' + textoCorrecta(p) });
        cuerpo.appendChild(fb);
        var seguir = el('button', { class: 'principal', text: n + 1 < preg.length ? 'Siguiente' : 'Ver mi resultado' });
        seguir.onclick = function () { n++; pantalla(); };
        cuerpo.appendChild(seguir); seguir.focus();
      };
      cuerpo.appendChild(enviar);
    }

    function fin() {
      var nota = maximo ? Math.round(100 * puntos / maximo) : 100;
      if (!terminado) {
        terminado = true;
        scorm('LMSSetValue', 'cmi.core.score.min', '0');
        scorm('LMSSetValue', 'cmi.core.score.max', '100');
        scorm('LMSSetValue', 'cmi.core.score.raw', String(nota));
        scorm('LMSSetValue', 'cmi.core.lesson_status', !maximo ? 'completed' : nota >= DATOS.aprobar ? 'passed' : 'failed');
        scorm('LMSSetValue', 'cmi.core.exit', '');
        scorm('LMSSetValue', 'cmi.core.session_time', duracion());
        scorm('LMSCommit');
      }
      cuerpo.innerHTML = '';
      cuerpo.appendChild(el('h1', { text: '¡Terminaste!' }));
      if (maximo) {
        cuerpo.appendChild(el('div', { class: 'nota', text: nota + ' / 100' }));
        cuerpo.appendChild(el('p', { text: nota >= DATOS.aprobar ? 'Aprobaste. ¡Muy bien!' : 'Para aprobar hacía falta ' + DATOS.aprobar + '. Podés repasar y volver a intentarlo.' }));
      } else cuerpo.appendChild(el('p', { text: 'Gracias por participar. Tus respuestas quedaron registradas.' }));
      var lista = el('ol', { class: 'repaso' });
      resultados.forEach(function (r) { lista.appendChild(el('li', {}, [r.p.texto + ' ', el('b', { text: r.parte === null ? '•' : r.parte === 1 ? '✓' : r.parte > 0 ? '≈' : '✗' })])); });
      cuerpo.appendChild(lista);
      if (!API) cuerpo.appendChild(el('p', { class: 'ayuda', text: 'Abriste el paquete fuera de un aula virtual, así que la nota no se guarda en ningún lado.' }));
      cerrar();
    }

    pantalla();
  }

  const ESTILOS = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#FAFBF7;color:#18263F;line-height:1.45}
#app{max-width:680px;margin:0 auto;padding:20px 16px 48px}h1{font-size:1.5rem;line-height:1.2;margin:.4em 0 .8em}
.meta{font-weight:700;color:#56637B;font-size:.95rem}.barra{height:8px;background:#E2E9EF;border-radius:4px;margin-top:6px;overflow:hidden}.barra span{display:block;height:100%;background:#2867D6}
.zona{display:grid;gap:10px;margin-bottom:14px}button{font:inherit;cursor:pointer}button[disabled]{cursor:default}
.opcion{display:flex;gap:12px;align-items:center;text-align:left;border:0;border-radius:12px;padding:14px;color:#fff;font-weight:700;font-size:1.05rem;min-height:60px}
.opcion b{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,.25);flex:none}.opcion.elegida{outline:5px solid #18263F;outline-offset:2px}.opcion[disabled]:not(.elegida){opacity:.45}
.principal{width:100%;min-height:52px;border:2px solid #18263F;border-radius:8px;background:#18263F;color:#fff;font-weight:700;font-size:1.1rem;margin-top:8px}.principal[disabled]{opacity:.4}
.item{display:grid;grid-template-columns:32px 1fr auto auto;gap:8px;align-items:center;padding:8px 10px;border:2px solid #18263F;border-radius:10px;background:#fff;font-weight:700}
.item b{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#18263F;color:#fff}.chico{width:40px;height:40px;border:2px solid #18263F;border-radius:6px;background:#fff}
.valor{font-size:2.6rem;font-weight:800;text-align:center}input[type=range]{width:100%;height:36px}.ext{display:flex;justify-content:space-between;font-weight:700;color:#56637B}
input[type=text]{width:100%;padding:12px;font:inherit;font-size:1.2rem;border:2px solid #C9D3DD;border-radius:8px}
.fb{padding:12px;border-radius:10px;font-weight:700;text-align:center}.bien{background:#DDF1E5;color:#145C3C}.mal{background:#FCE1DD;color:#8E2416}.neutro{background:#E3ECFA;color:#1B4A9A}
.nota{font-size:3rem;font-weight:800}.ayuda{color:#56637B;font-size:.92rem}.repaso li{margin-bottom:6px}
:focus-visible{outline:3px solid #2867D6;outline-offset:3px}`;

  function paginaReproductor(cuest, aprobar) {
    const datos = { titulo: cuest.titulo, aprobar, preguntas: cuest.preguntas.map(p => {
      const q = { ...p }; delete q.id; delete q.tiempo;
      if (q.tipo === 'orden') q.items = q.items.filter(t => t.trim());
      return q;
    }) };
    // el JSON va dentro de un <script>: escapamos "<" para que un texto no pueda cerrar la etiqueta
    const json = JSON.stringify(datos).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cuest.titulo)}</title>
<style>${ESTILOS}</style>
</head>
<body>
<main id="app" aria-live="polite"></main>
<!-- Hecho con Aula en Vivo · Copyleft 2026 Gustavo Iturriz · Licencia GNU GPL v3 o posterior -->
<script>
'use strict';
(${reproductor.toString()})(${json});
</script>
</body>
</html>
`;
  }

  function exportar(cuest) {
    const prob = AV.almacen.problemas(cuest);
    if (prob.length) { AV.aviso(prob[0], 4500); return; }
    const resp = prompt('Nota mínima para aprobar, de 0 a 100.\n(Las preguntas de opinión no cuentan para la nota.)', '60');
    if (resp === null) return;
    const aprobar = Math.min(100, Math.max(0, Math.round(Number(String(resp).replace(',', '.'))) || 0));
    const id = 'aula-en-vivo-' + AV.nombreArchivo(cuest.titulo) + '-' + Date.now().toString(36);
    const blob = zip([
      { nombre: 'imsmanifest.xml', contenido: manifiesto({ ...cuest, __aprobar: aprobar }, id) },
      { nombre: 'index.html', contenido: paginaReproductor(cuest, aprobar) }
    ]);
    const url = URL.createObjectURL(blob);
    const a = AV.h('a', { href: url, download: 'scorm-' + AV.nombreArchivo(cuest.titulo) + '.zip' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    AV.aviso('Paquete SCORM descargado. Subilo al aula virtual como paquete SCORM.', 4500);
  }

  AV.scorm = { exportar, zip, paginaReproductor };
})(window.AV);
