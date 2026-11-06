/* Aula en Vivo — avatares y apodos al azar
   Copyleft 🄯 2026 Gustavo Iturriz — Licencia GNU GPL v3 o posterior

   Cada avatar es una criatura armada por partes (color, forma, ojos, boca y accesorio).
   Se guarda como un texto corto, por ejemplo "3-1-0-2-4", que viaja en el mensaje de entrada
   y se dibuja como SVG en el celular y en el proyector. No usa imágenes externas. */
'use strict';

(function (AV) {
  const COLORES = ['#D33A2C', '#2867D6', '#F0B323', '#1F8A5B', '#8A4FD1', '#E46FA5', '#1AA6B7', '#F07C23', '#6B7A8F', '#7DBA3C'];
  const NOMBRES = {
    color: ['Rojo', 'Azul', 'Amarillo', 'Verde', 'Violeta', 'Rosa', 'Celeste', 'Naranja', 'Gris', 'Lima'],
    forma: ['Redondo', 'Gota', 'Cuadrado', 'Fantasma', 'Estrella'],
    ojos: ['Redondos', 'Felices', 'Sorprendidos', 'Guiño', 'Un ojo', 'Anteojos'],
    boca: ['Sonrisa', 'Abierta', 'Dientes', 'Lengua', 'Seria'],
    extra: ['Nada', 'Cuernitos', 'Antenas', 'Gorro', 'Corona', 'Moño', 'Gorro de lana']
  };
  const PARTES = Object.keys(NOMBRES);
  const TOPES = PARTES.map(p => NOMBRES[p].length);

  function aleatorio() {
    return TOPES.map(t => Math.floor(Math.random() * t)).join('-');
  }
  /** Devuelve un código válido: si llega algo raro, lo arregla */
  function limpiar(cod) {
    const v = String(cod || '').split('-').map(Number);
    if (v.length !== TOPES.length || v.some((x, i) => !Number.isInteger(x) || x < 0 || x >= TOPES[i])) return '0-0-0-0-0';
    return v.join('-');
  }
  function partes(cod) { return limpiar(cod).split('-').map(Number); }
  function cambiar(cod, parte, delta) {
    const v = partes(cod), i = PARTES.indexOf(parte);
    v[i] = (v[i] + delta + TOPES[i]) % TOPES[i];
    return v.join('-');
  }

  // --- dibujo (viewBox 100×100) ---
  function cuerpo(forma, color) {
    const borde = `fill="${color}" stroke="#18263F" stroke-width="3" stroke-linejoin="round"`;
    switch (forma) {
      case 1: return `<path d="M50 14 C68 34 82 48 82 64 A32 30 0 0 1 18 64 C18 48 32 34 50 14Z" ${borde}/>`;
      case 2: return `<rect x="18" y="24" width="64" height="66" rx="16" ${borde}/>`;
      case 3: return `<path d="M20 52 A30 30 0 0 1 80 52 V90 L70 82 L60 90 L50 82 L40 90 L30 82 L20 90Z" ${borde}/>`;
      case 4: return `<path d="M50 16 L58 34 L80 30 L70 50 L84 66 L64 70 L60 90 L50 78 L40 90 L36 70 L16 66 L30 50 L20 30 L42 34Z" ${borde}/>`;
      default: return `<ellipse cx="50" cy="58" rx="33" ry="32" ${borde}/>`;
    }
  }
  function ojos(tipo) {
    const ojo = (x) => `<circle cx="${x}" cy="52" r="8" fill="#fff" stroke="#18263F" stroke-width="2.5"/><circle cx="${x + 1.5}" cy="53" r="3.6" fill="#18263F"/>`;
    switch (tipo) {
      case 1: return `<path d="M33 54 Q39 46 45 54 M55 54 Q61 46 67 54" fill="none" stroke="#18263F" stroke-width="3.5" stroke-linecap="round"/>`;
      case 2: return `<circle cx="39" cy="51" r="10" fill="#fff" stroke="#18263F" stroke-width="2.5"/><circle cx="39" cy="51" r="3" fill="#18263F"/><circle cx="61" cy="51" r="10" fill="#fff" stroke="#18263F" stroke-width="2.5"/><circle cx="61" cy="51" r="3" fill="#18263F"/>`;
      case 3: return ojo(37) + `<path d="M55 53 Q61 47 67 53" fill="none" stroke="#18263F" stroke-width="3.5" stroke-linecap="round"/>`;
      case 4: return `<circle cx="50" cy="50" r="13" fill="#fff" stroke="#18263F" stroke-width="2.5"/><circle cx="52" cy="51" r="5.5" fill="#18263F"/><circle cx="54" cy="48" r="1.8" fill="#fff"/>`;
      case 5: return ojo(37) + ojo(61) + `<g fill="none" stroke="#18263F" stroke-width="3"><circle cx="38" cy="52" r="11"/><circle cx="62" cy="52" r="11"/><path d="M49 51 H51"/></g>`;
      default: return ojo(37) + ojo(61);
    }
  }
  function boca(tipo) {
    const t = 'stroke="#18263F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
    switch (tipo) {
      case 1: return `<ellipse cx="50" cy="73" rx="7" ry="6" fill="#5A1A1A" ${t}/>`;
      case 2: return `<path d="M38 69 Q50 82 62 69 Z" fill="#fff" ${t}/><path d="M44 71 V75 M50 72 V77 M56 71 V75" ${t} stroke-width="1.6"/>`;
      case 3: return `<path d="M38 69 Q50 80 62 69" fill="none" ${t}/><path d="M48 75 Q53 85 58 74" fill="#E46F7A" ${t} stroke-width="2"/>`;
      case 4: return `<path d="M41 73 H59" fill="none" ${t}/>`;
      default: return `<path d="M38 69 Q50 80 62 69" fill="none" ${t}/>`;
    }
  }
  function extra(tipo, color) {
    const t = 'stroke="#18263F" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
    switch (tipo) {
      case 1: return `<path d="M30 34 L24 12 L40 28Z M70 34 L76 12 L60 28Z" fill="#FFF3D6" ${t}/>`;
      case 2: return `<path d="M40 30 Q36 18 30 10 M60 30 Q64 18 70 10" fill="none" ${t}/><circle cx="30" cy="10" r="5" fill="#F0B323" ${t}/><circle cx="70" cy="10" r="5" fill="#F0B323" ${t}/>`;
      case 3: return `<path d="M24 34 Q50 4 76 34 Z" fill="#2867D6" ${t}/><path d="M70 30 L90 34" ${t}/>`;
      case 4: return `<path d="M30 30 L32 12 L41 22 L50 8 L59 22 L68 12 L70 30Z" fill="#F0B323" ${t}/>`;
      case 5: return `<path d="M50 30 L36 20 L36 40Z M50 30 L64 20 L64 40Z" fill="#E46FA5" ${t}/><circle cx="50" cy="30" r="4" fill="#E46FA5" ${t}/>`;
      case 6: return `<path d="M22 36 Q50 8 78 36 Z" fill="#D33A2C" ${t}/><path d="M22 36 H78" ${t} stroke-width="6" stroke="#fff"/><circle cx="50" cy="12" r="6" fill="#fff" ${t}/>`;
      default: return '';
    }
  }

  /** SVG del avatar como texto */
  function svg(cod) {
    const [c, f, o, b, x] = partes(cod);
    const color = COLORES[c];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">`
      + cuerpo(f, color)
      + `<ellipse cx="34" cy="64" rx="5" ry="3" fill="#fff" opacity=".35"/><ellipse cx="66" cy="64" rx="5" ry="3" fill="#fff" opacity=".35"/>`
      + ojos(o) + boca(b) + extra(x, color) + `</svg>`;
  }
  /** Nodo listo para insertar, con su tamaño */
  function nodo(cod, tam = 40, clase = '') {
    const s = document.createElement('span');
    s.className = 'avatar ' + clase;
    s.style.width = s.style.height = tam + 'px';
    s.innerHTML = svg(cod);
    return s;
  }
  function descripcion(cod) {
    const v = partes(cod);
    return `${NOMBRES.forma[v[1]]} ${NOMBRES.color[v[0]].toLowerCase()}`;
  }

  // --- apodos al azar, con fauna y paisaje del sur ---
  const BICHOS = ['Pingüino', 'Carpincho', 'Zorro', 'Cóndor', 'Castor', 'Huemul', 'Guanaco', 'Lobo marino', 'Puma', 'Tero', 'Hornero', 'Ñandú', 'Yaguareté', 'Mara', 'Delfín', 'Albatros', 'Pudú', 'Chingolo'];
  const ADJETIVOS = ['Veloz', 'Sabio', 'Curioso', 'Valiente', 'Tranqui', 'Astuto', 'Fueguino', 'Patagónico', 'Genial', 'Atento', 'Matero', 'Despierto', 'Austral', 'Brillante', 'Sereno'];
  function apodo() {
    const r = a => a[Math.floor(Math.random() * a.length)];
    return r(BICHOS) + ' ' + r(ADJETIVOS);
  }

  AV.avatar = { PARTES, NOMBRES, aleatorio, limpiar, cambiar, partes, svg, nodo, descripcion, apodo };
})(window.AV);
