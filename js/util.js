/* Aula en Vivo — utilidades compartidas
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior */
'use strict';

window.AV = window.AV || {};

(function (AV) {
  const LETRAS = ['A', 'B', 'C', 'D'];
  const CLASES = ['op-a', 'op-b', 'op-c', 'op-d'];

  /** Crea un elemento: h('div', {class:'x', onclick: fn}, 'texto', otroNodo) */
  function h(tag, attrs, ...hijos) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const hijo of hijos.flat()) {
      if (hijo === undefined || hijo === null || hijo === false) continue;
      el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
    }
    return el;
  }

  function aviso(texto, ms = 2600) {
    const caja = document.getElementById('aviso');
    if (!caja) return;
    caja.innerHTML = '';
    const t = h('div', { class: 'toast' }, texto);
    caja.append(t);
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => t.remove(), ms);
  }

  // Sin 0/O, 1/I/L ni 5/S para que se dicte y se lea bien en el pizarrón
  const ALFABETO = '234679ACDEFGHJKMNPQRTUVWXYZ';
  function generarCodigo(largo = 5) {
    const r = new Uint32Array(largo);
    crypto.getRandomValues(r);
    return Array.from(r, n => ALFABETO[n % ALFABETO.length]).join('');
  }
  function limpiarCodigo(txt) {
    return String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function generarId() {
    const r = new Uint32Array(4);
    crypto.getRandomValues(r);
    return Array.from(r, n => n.toString(36)).join('');
  }

  /** Normaliza una palabra para agrupar en la nube: sin tildes, minúsculas, sin signos */
  function normalizarPalabra(txt) {
    return String(txt || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9ñ\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Dibuja un QR como SVG (librería qrcode-generator, local) */
  function qrSVG(texto) {
    const qr = window.qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  }

  function descargar(nombreArchivo, contenido, tipo = 'application/json') {
    const blob = new Blob([contenido], { type: tipo + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nombreArchivo });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function nombreArchivo(txt) {
    return normalizarPalabra(txt).replace(/\s+/g, '-').replace(/[^a-z0-9ñ-]/g, '').slice(0, 50) || 'cuestionario';
  }

  /** localStorage con red de seguridad (modo incógnito, almacenamiento bloqueado) */
  const guardado = {
    leer(clave, porDefecto) {
      try { const v = localStorage.getItem(clave); return v === null ? porDefecto : JSON.parse(v); }
      catch (e) { return porDefecto; }
    },
    escribir(clave, valor) {
      try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
      catch (e) { return false; }
    }
  };

  const VERSION = '1.3';

  function encabezado(extra) {
    return h('header', { class: 'encabezado' },
      h('a', { class: 'marca', href: '#/' },
        h('span', { class: 'marca-icono', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
        'Aula en Vivo'),
      extra || h('nav', { class: 'fila' },
        h('a', { class: 'boton boton-texto', href: '#/acerca', 'aria-current': location.hash === '#/acerca' ? 'page' : null }, 'Acerca de')));
  }

  /** Símbolo de copyleft: la © dada vuelta */
  function copyleft(tam) {
    return h('span', { class: 'copyleft', 'aria-label': 'Copyleft', style: tam ? { fontSize: tam } : null }, '©');
  }

  function pantallaCompleta() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  Object.assign(AV, {
    VERSION, copyleft, LETRAS, CLASES, h, aviso, generarCodigo, limpiarCodigo, generarId,
    normalizarPalabra, qrSVG, descargar, nombreArchivo, guardado, encabezado, pantallaCompleta
  });
})(window.AV);
