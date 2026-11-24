/*
 * Silk curtains for the reveal.
 *
 * Two red silk panels hang from a brass rod by rings. Each panel is a small cloth simulation
 * (position based dynamics): the rings slide along the rod, the free cloth below lags, swings and
 * settles, and the clips gather the silk into pleats. WebGL draws the cloth with an anisotropic
 * silk sheen that runs along the threads.
 *
 * The words printed on the silk are real HTML (HTML-in-Canvas: <canvas content="drawable"> plus
 * texElementSubImage2D) where the browser has it, and the same words drawn as an image everywhere
 * else, so every phone gets the same look.
 *
 *   const silk = SilkCurtain.create(canvas, printElement, { palette, lowPower });
 *   silk.show(); await silk.to(1, 650); ...; await silk.to(0, 1000); silk.hide();
 *
 * create() returns null when WebGL is unavailable; the caller keeps its old curtains then.
 */
(() => {
'use strict';

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smooth = t => t * t * (3 - 2 * t);
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Deterministic smooth value noise, -1..1, for the wind. */
function hash(x, y, z){
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 873357470);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z){
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const a = smooth(x - i), b = smooth(y - j), c = smooth(z - k);
  const layer = kz => {
    const p = hash(i, j, kz), q = hash(i + 1, j, kz), r = hash(i, j + 1, kz), t = hash(i + 1, j + 1, kz);
    return p + (q - p) * a + (r - p + (p - q - r + t) * a) * b;
  };
  return (layer(k) * (1 - c) + layer(k + 1) * c) * 2 - 1;
}

function hexToRgb(value, fallback){
  const m = /^#?([a-f\d]{6})$/i.exec(String(value || '').trim());
  const hex = m ? m[1] : fallback;
  return [0, 2, 4].map(o => parseInt(hex.slice(o, o + 2), 16) / 255);
}

/* ------------------------------------------------------------------ cloth */

const CLIP_EVERY = 4;          // points between two clips (a clip pins one point to a ring)
const DT = 1 / 120;
const STIFF = { across: 1, down: 1, shear: .5, bendAcross: .06, bendDown: .35 };

function buildPanel(side, W, H, lowPower){
  const clips = clamp(Math.round((W / 2) / (lowPower ? 44 : 36)), 5, lowPower ? 9 : 13);
  const nx = (clips - 1) * CLIP_EVERY + 1;
  const ny = clamp(Math.round(H / (lowPower ? 38 : 32)), 20, 30);   // rows follow the height
  const rodY = clamp(H * .028, 16, 30);
  const top = rodY + 14;
  const length = H - top + 40;                      // hem hangs below the screen
  const fullness = 1.32;                            // more silk than the span: that is what makes pleats
  const restX = (W / 2 + 10) * fullness / (nx - 1);
  const restY = length / (ny - 1);
  const n = nx * ny;
  const pos = new Float32Array(n * 3), prev = new Float32Array(n * 3);
  const inv = new Float32Array(n).fill(1);
  const links = [];
  const id = (i, j) => j * nx + i;
  const link = (a, b, k) => {
    const dx = 0, dy = 0;
    links.push(a, b, k, 0);
    return dx + dy;
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
    if (i + 1 < nx) link(id(i, j), id(i + 1, j), STIFF.across);
    if (j + 1 < ny) link(id(i, j), id(i, j + 1), STIFF.down);
    if (i + 1 < nx && j + 1 < ny){
      link(id(i, j), id(i + 1, j + 1), STIFF.shear);
      link(id(i + 1, j), id(i, j + 1), STIFF.shear);
    }
    if (i + 2 < nx) link(id(i, j), id(i + 2, j), STIFF.bendAcross);
    if (j + 2 < ny) link(id(i, j), id(i, j + 2), STIFF.bendDown);
  }
  const L = new Float32Array(links);
  // rest length of every link, from the flat sheet
  for (let l = 0; l < L.length; l += 4){
    const a = L[l], b = L[l + 1];
    const ai = a % nx, aj = (a / nx) | 0, bi = b % nx, bj = (b / nx) | 0;
    L[l + 3] = Math.hypot((bi - ai) * restX, (bj - aj) * restY);
  }
  for (let i = 0; i < nx; i += CLIP_EVERY) inv[id(i, 0)] = 0;
  const passes = lowPower ? 4 : (W > 900 ? 6 : 5);              // wide panels need a stiffer solve
  return { side, nx, ny, n, clips, passes, pos, prev, inv, links: L, restX, restY, rodY, top, W, H,
    clipX: new Float32Array(clips), normals: new Float32Array(n * 3), ao: new Float32Array(n) };
}

/* Where the clips are along the rod for a closure c (0 = open and gathered at the side, 1 = closed). */
function placeClips(p, c){
  const { W, side, clips } = p;
  const outer = side < 0 ? -10 : W + 10;
  const openInner = side < 0 ? W * .14 : W * .86;
  const closedInner = side < 0 ? W / 2 + 3 : W / 2 - 3;    // the panels meet with a slight overlap
  const inner = openInner + (closedInner - openInner) * c;
  for (let k = 0; k < clips; k++) p.clipX[k] = outer + (inner - outer) * (k / (clips - 1));
}

function pinTop(p){
  const { pos, prev, nx } = p;
  for (let k = 0; k < p.clips; k++){
    const i = k * CLIP_EVERY, o = i * 3;
    prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
    pos[o] = p.clipX[k]; pos[o + 1] = p.top; pos[o + 2] = 0;
  }
  return nx;
}

/* Lay the sheet out hanging straight under its clips, with gentle pleats, and let it settle. */
function rest(p, c){
  placeClips(p, c);
  const { nx, ny, pos, prev } = p;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
    const k = i / CLIP_EVERY, k0 = Math.floor(k), k1 = Math.min(k0 + 1, p.clips - 1);
    const x = p.clipX[k0] + (p.clipX[k1] - p.clipX[k0]) * (k - k0);
    const span = Math.floor(i / CLIP_EVERY);
    const bow = Math.sin((i % CLIP_EVERY) / CLIP_EVERY * Math.PI) * (span % 2 ? -8 : 12);
    const o = (j * nx + i) * 3;
    pos[o] = prev[o] = x; pos[o + 1] = prev[o + 1] = p.top + j * p.restY; pos[o + 2] = prev[o + 2] = bow;
  }
  for (let s = 0; s < 90; s++) step(p, 0, 0);
}

function step(p, time, wind, h = DT){
  const { pos, prev, inv, n, nx, links, W, H } = p;
  const g = 2600 * h * h;
  const windT = time * .55;
  for (let s = 0; s < n; s++){
    if (!inv[s]) continue;
    const o = s * 3;
    const x = pos[o], y = pos[o + 1], z = pos[o + 2];
    const i = s % nx;
    const span = Math.floor(i / CLIP_EVERY);
    // keep the pleats going the same way all the way down: alternate spans bow out and in
    const pleat = (i % CLIP_EVERY ? (span % 2 ? -1 : 1.4) : 0) * 90;
    const depth = (y - p.top) / H;
    const gust = wind * depth * (noise3(x * .006, y * .004, windT) * 1.0 + noise3(x * .02, y * .015, windT * 2.3) * .35);
    // a weighted hem: each column is drawn back under its own ring, so the cloth swings but cannot trail far behind
    const kc = i / CLIP_EVERY, k0 = Math.floor(kc), k1 = Math.min(k0 + 1, p.clips - 1);
    const underRing = p.clipX[k0] + (p.clipX[k1] - p.clipX[k0]) * (kc - k0);
    const ax = gust * .35 * 600 + (underRing - x) * 22 * clamp(W / 1200, .3, 1);
    const az = pleat + gust * 1400 - z * 2.2;        // a soft pull back towards the plane of the rod
    const vx = (x - prev[o]) * .978, vy = (y - prev[o + 1]) * .98, vz = (z - prev[o + 2]) * .96;
    prev[o] = x; prev[o + 1] = y; prev[o + 2] = z;
    pos[o] = x + vx + ax * h * h;
    pos[o + 1] = y + vy + g;
    pos[o + 2] = z + vz + az * h * h;
  }
  for (let pass = 0; pass < p.passes; pass++){
    for (let l = 0; l < links.length; l += 4){
      const a = links[l], b = links[l + 1], k = links[l + 2], r = links[l + 3];
      const wa = inv[a], wb = inv[b], w = wa + wb;
      if (!w) continue;
      const ao = a * 3, bo = b * 3;
      const dx = pos[bo] - pos[ao], dy = pos[bo + 1] - pos[ao + 1], dz = pos[bo + 2] - pos[ao + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      // bending links only resist being squashed a little, so pleats can fold
      const err = (d - r) / d;
      const f = (k < .4 && err < 0 ? k * .5 : k) * err / w;
      pos[ao] += dx * f * wa; pos[ao + 1] += dy * f * wa; pos[ao + 2] += dz * f * wa;
      pos[bo] -= dx * f * wb; pos[bo + 1] -= dy * f * wb; pos[bo + 2] -= dz * f * wb;
    }
    const middle = W / 2, reach = 5;                  // the panels meet at the middle and never pass through each other
    for (let s = 0; s < n; s++){
      const o = s * 3;
      if (pos[o + 2] < -26) pos[o + 2] = -26;         // the wall behind the curtain
      else if (pos[o + 2] > 70) pos[o + 2] = 70;
      if (p.side < 0 ? pos[o] > middle + reach : pos[o] < middle - reach) pos[o] = middle + p.side * -reach;
    }
  }

}

function shade(p){
  const { pos, nx, ny, normals, ao } = p;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
    const s = j * nx + i, o = s * 3;
    const l = (j * nx + Math.max(i - 1, 0)) * 3, r = (j * nx + Math.min(i + 1, nx - 1)) * 3;
    const u = (Math.max(j - 1, 0) * nx + i) * 3, d = (Math.min(j + 1, ny - 1) * nx + i) * 3;
    const ax = pos[r] - pos[l], ay = pos[r + 1] - pos[l + 1], az = pos[r + 2] - pos[l + 2];
    const bx = pos[d] - pos[u], by = pos[d + 1] - pos[u + 1], bz = pos[d + 2] - pos[u + 2];
    let nxv = ay * bz - az * by, nyv = az * bx - ax * bz, nzv = ax * by - ay * bx;
    const len = Math.hypot(nxv, nyv, nzv) || 1;
    if (p.side > 0){ nxv = -nxv; nyv = -nyv; nzv = -nzv; }   // the right panel is laid out mirrored
    normals[o] = nxv / len; normals[o + 1] = nyv / len; normals[o + 2] = nzv / len;
    // folds that sink behind their neighbours get darker
    const around = (pos[l + 2] + pos[r + 2] + pos[u + 2] + pos[d + 2]) / 4;
    ao[s] = clamp(.72 + (pos[o + 2] - around) * .05 + pos[o + 2] * .006, .25, 1.12);
  }
}

/* ------------------------------------------------------------------ WebGL */

const CLOTH_VS = `
attribute vec3 aPos; attribute vec3 aNormal; attribute float aAo; attribute vec2 aUv; attribute float aEdge;
uniform vec2 uRes; uniform float uLift;
varying vec3 vN; varying float vAo; varying vec2 vUv; varying vec2 vScreen; varying float vEdge;
void main(){
  float s = 1400.0 / (1400.0 - aPos.z);
  vec2 c = uRes * vec2(.5, .35);
  vec2 p = c + (aPos.xy - c) * s;
  vScreen = p / uRes;
  vN = aNormal; vAo = aAo; vUv = aUv; vEdge = aEdge;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, -(aPos.z + uLift) / 400.0, 1.0);
}`;

const CLOTH_FS = `
precision mediump float;
uniform sampler2D uPrint; uniform vec3 uDark; uniform vec3 uBright; uniform vec3 uGold;
varying vec3 vN; varying float vAo; varying vec2 vUv; varying vec2 vScreen; varying float vEdge;
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.3, -0.55, 0.78));          // a spot above and left of the stage (y runs down)
  float ndl = dot(N, L);
  float diff = clamp(ndl * 0.62 + 0.42, 0.0, 1.0);
  // silk: the highlight stretches along the threads, which hang vertically
  vec3 T = normalize(vec3(0.0, 1.0, 0.0) - N * N.y);
  vec3 H = normalize(L + V);
  float th = dot(T, H);
  float sinTH = sqrt(max(1.0 - th * th, 0.0));
  float spec = pow(sinTH, 80.0) * 0.55 + pow(sinTH, 10.0) * 0.10;
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.4);
  float ao = clamp(vAo, 0.0, 1.2);
  vec3 silk = mix(uDark, uBright, diff) * (0.42 + 0.58 * ao);
  silk += vec3(1.0, 0.82, 0.78) * spec * (0.35 + 0.65 * ao);
  silk += uBright * rim * 0.22;
  float spot = 1.06 - 0.42 * length((vScreen - vec2(0.5, 0.32)) * vec2(1.1, 0.85));
  silk *= clamp(spot, 0.45, 1.1);
  // gold piping down the leading edge
  float trim = smoothstep(0.972, 0.99, vEdge);
  silk = mix(silk, uGold * (0.55 + 0.6 * diff) + vec3(1.0, 0.9, 0.7) * spec * 0.8, trim);
  // the print: premultiplied, lit like gold thread
  vec4 ink = texture2D(uPrint, vUv);
  vec3 thread = ink.rgb * (0.62 + 0.55 * diff) * (0.6 + 0.4 * ao) + uGold * spec * ink.a * 1.1;
  vec3 col = silk * (1.0 - ink.a) + thread;
  gl_FragColor = vec4(col, 1.0);
}`;

const HW_VS = `
attribute vec2 aPos; attribute vec2 aLocal; attribute float aKind;
uniform vec2 uRes;
varying vec2 vLocal; varying float vKind;
void main(){
  vLocal = aLocal; vKind = aKind;
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

/* kind 0: the rod, 1: a ring, 2: a finial ball, 3: the soft shadow under the rod, 4: the dark band behind the rod */
const HW_FS = `
precision mediump float;
varying vec2 vLocal; varying float vKind;
vec3 brass(float t){ return mix(vec3(0.36, 0.22, 0.07), vec3(0.95, 0.76, 0.42), t); }
void main(){
  vec4 c = vec4(0.0);
  if (vKind < 0.5){
    float y = vLocal.y;
    float t = 0.5 + 0.5 * cos(y * 1.5);
    float hi = exp(-pow((y + 0.38) * 5.0, 2.0));
    vec3 col = brass(t * 0.9) + vec3(1.0, 0.9, 0.7) * hi * 0.6;
    float a = smoothstep(1.0, 0.82, abs(y));
    c = vec4(col * a, a);
  } else if (vKind < 1.5){
    float r = length(vLocal);
    float a = smoothstep(1.0, 0.9, r) * smoothstep(0.58, 0.68, r);
    float lit = 0.55 + 0.45 * dot(normalize(vLocal + 1e-4), normalize(vec2(-0.5, -0.8)));
    vec3 col = brass(lit) + vec3(1.0) * pow(max(lit, 0.0), 12.0) * 0.4;
    c = vec4(col * a, a);
  } else if (vKind < 2.5){
    float r = length(vLocal);
    float a = smoothstep(1.0, 0.9, r);
    float z = sqrt(max(1.0 - r * r, 0.0));
    float lit = clamp(dot(vec3(vLocal, z), normalize(vec3(-0.4, -0.6, 0.7))), 0.0, 1.0);
    vec3 col = brass(lit) + vec3(1.0, 0.92, 0.75) * pow(lit, 24.0) * 0.8;
    c = vec4(col * a, a);
  } else if (vKind < 3.5){
    float a = (1.0 - smoothstep(0.0, 1.0, abs(vLocal.y))) * 0.35;
    c = vec4(0.0, 0.0, 0.0, a);
  } else {
    float t = vLocal.y * 0.5 + 0.5;
    c = vec4(mix(vec3(0.05, 0.01, 0.03), vec3(0.16, 0.03, 0.06), t), 1.0);
  }
  gl_FragColor = c;
}`;

function compile(gl, vs, fs){
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]){
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const loc = name => gl.getAttribLocation(prog, name);
  const uni = name => gl.getUniformLocation(prog, name);
  return { prog, loc, uni };
}

/* ------------------------------------------------------------------ the print */

/* The same words as the HTML print, drawn into an image for browsers without HTML-in-Canvas. */
function rasterPrint(el, w, h, dpr){
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  const cs = getComputedStyle(el);
  const gold = cs.color || '#f2c978';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = gold;
  // Without HTML-in-Canvas the words inside the canvas are not laid out, so place them from
  // data-y (fraction of the height) and their computed font, centred across the stage.
  for (const part of el.querySelectorAll('[data-print]')){
    const ps = getComputedStyle(part);
    const size = parseFloat(ps.fontSize) || 32;
    x.font = `${ps.fontStyle} ${ps.fontWeight} ${size}px ${ps.fontFamily}`;
    if ('letterSpacing' in x) x.letterSpacing = ps.letterSpacing === 'normal' ? '0px' : ps.letterSpacing;
    x.fillStyle = ps.color || gold;
    x.globalAlpha = parseFloat(ps.opacity) || 1;
    const text = ps.textTransform === 'uppercase' ? part.textContent.trim().toUpperCase() : part.textContent.trim();
    x.fillText(text, w * (parseFloat(part.dataset.x) || .5), h * (parseFloat(part.dataset.y) || .5));
  }
  return c;
}

/* ------------------------------------------------------------------ controller */

function create(canvas, printEl, options = {}){
  const lowPower = !!options.lowPower;
  const attrs = { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, preserveDrawingBuffer: false };
  const gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
  if (!gl) return null;

  let cloth, hardware;
  try {
    cloth = compile(gl, CLOTH_VS, CLOTH_FS);
    hardware = compile(gl, HW_VS, HW_FS);
  } catch (error){
    console.warn('silk curtain disabled:', error);
    return null;
  }
  const htmlApi = !!(printEl && 'requestPaint' in canvas && typeof gl.texElementSubImage2D === 'function');

  const state = {
    W: 0, H: 0, dpr: 1, panels: [], buffers: [], index: null, indexCount: 0, hw: gl.createBuffer(),
    printTex: gl.createTexture(), printReady: false, printMode: htmlApi ? 'html' : 'image',
    closure: 0, from: 0, target: 0, t0: 0, dur: 1, resolve: null, running: false, raf: 0, last: 0, time: 0, lost: false,
    palette: null
  };

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); state.lost = true; stopLoop(); });

  function paletteNow(){
    const p = typeof options.palette === 'function' ? options.palette() : (options.palette || {});
    return { dark: hexToRgb(p.dark, '3a0008'), bright: hexToRgb(p.bright, 'b8001f'), gold: hexToRgb(p.gold, 'e0a656') };
  }

  function emptyPrint(){
    gl.bindTexture(gl.TEXTURE_2D, state.printTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  emptyPrint();

  function uploadImagePrint(){
    if (!printEl) return;
    const img = rasterPrint(printEl, state.W, state.H, state.dpr);
    gl.bindTexture(gl.TEXTURE_2D, state.printTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    state.printReady = true;
    state.printMode = 'image';
    canvas.dataset.print = 'image';
  }

  /* HTML-in-Canvas: the browser hands us a picture of the live element on its 'paint' event. */
  function uploadHtmlPrint(){
    const w = Math.round(state.W * state.dpr), h = Math.round(state.H * state.dpr);
    gl.bindTexture(gl.TEXTURE_2D, state.printTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      while (gl.getError()) { /* clear */ }
      try { gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, printEl, { width: w, height: h }); }
      catch (error){ if (error instanceof TypeError) gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, printEl); else throw error; }
      if (gl.getError()) throw new Error('upload failed');
      state.printReady = true;
      state.printMode = 'html';
      canvas.dataset.print = 'html';
    } catch (error){
      if (!state.htmlFailed) console.info('silk: HTML print unavailable, drawing it instead:', error && error.message);
      state.htmlFailed = true;
      uploadImagePrint();
    }
  }
  if (htmlApi){
    canvas.addEventListener('paint', () => { if (state.W) uploadHtmlPrint(); });
  }

  function layout(){
    const W = Math.round(window.innerWidth), H = Math.round(window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.5);   // soft cloth needs no more
    if (W === state.W && H === state.H && dpr === state.dpr && state.panels.length) return;
    state.W = W; state.H = H; state.dpr = dpr;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    state.panels = [buildPanel(-1, W, H, lowPower), buildPanel(1, W, H, lowPower)];
    const { nx, ny } = state.panels[0];
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++){
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    state.index = state.index || gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    state.indexCount = idx.length;
    state.buffers = state.panels.map(p => ({ buf: gl.createBuffer(), data: new Float32Array(p.n * 10) }));
    state.printReady = false;
    emptyPrint();
    if (printEl){
      printEl.style.width = W + 'px';
      printEl.style.height = H + 'px';
    }
    if (htmlApi) canvas.requestPaint();
    else uploadImagePrint();
    // if the browser never sends a picture of the HTML, draw the words ourselves
    setTimeout(() => { if (!state.printReady && !state.lost) uploadImagePrint(); }, 400);
  }

  function writeMesh(p, out){
    const { nx, ny, pos, normals, ao, side } = p;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
      const s = j * nx + i, o = s * 10, q = s * 3;
      out[o] = pos[q]; out[o + 1] = pos[q + 1]; out[o + 2] = pos[q + 2];
      out[o + 3] = normals[q]; out[o + 4] = normals[q + 1]; out[o + 5] = normals[q + 2];
      out[o + 6] = ao[s];
      const along = i / (nx - 1);                                 // 0 at the outer edge, 1 at the leading edge
      out[o + 7] = side < 0 ? along * .508 : 1 - along * .508;   // the print reads across both panels
      out[o + 8] = (p.top + j * p.restY) / p.H;
      out[o + 9] = along;
    }
  }

  function drawCloth(){
    const { W, H } = state;
    gl.useProgram(cloth.prog);
    gl.uniform2f(cloth.uni('uRes'), W, H);
    gl.uniform3fv(cloth.uni('uDark'), state.palette.dark);
    gl.uniform3fv(cloth.uni('uBright'), state.palette.bright);
    gl.uniform3fv(cloth.uni('uGold'), state.palette.gold);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.printTex);
    gl.uniform1i(cloth.uni('uPrint'), 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.index);
    const attrs = [['aPos', 3, 0], ['aNormal', 3, 3], ['aAo', 1, 6], ['aUv', 2, 7], ['aEdge', 1, 9]];
    state.panels.forEach((p, k) => {
      const b = state.buffers[k];
      shade(p);
      writeMesh(p, b.data);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
      gl.bufferData(gl.ARRAY_BUFFER, b.data, gl.DYNAMIC_DRAW);
      for (const [name, size, off] of attrs){
        const l = cloth.loc(name);
        if (l < 0) continue;
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, size, gl.FLOAT, false, 40, off * 4);
      }
      gl.uniform1f(cloth.uni('uLift'), p.side < 0 ? 3 : 0);       // the left panel overlaps the right
      gl.drawElements(gl.TRIANGLES, state.indexCount, gl.UNSIGNED_SHORT, 0);
    });
    for (const [name] of attrs){ const l = cloth.loc(name); if (l >= 0) gl.disableVertexAttribArray(l); }
  }

  function drawHardware(){
    const { W } = state;
    const p0 = state.panels[0];
    const rodY = p0.rodY, rodR = clamp(state.H * .006, 4, 7), ringR = rodR + 5;
    const v = [];
    const quad = (x0, y0, x1, y1, kind, lx0 = -1, ly0 = -1, lx1 = 1, ly1 = 1) => {
      v.push(x0, y0, lx0, ly0, kind, x1, y0, lx1, ly0, kind, x0, y1, lx0, ly1, kind,
        x1, y0, lx1, ly0, kind, x1, y1, lx1, ly1, kind, x0, y1, lx0, ly1, kind);
    };
    quad(-10, -2, W + 10, p0.top + 3, 4);                                            // dark band behind the rod
    quad(-10, rodY + rodR - 2, W + 10, rodY + rodR + 14, 3, -1, -1, 1, 1);          // shadow under the rod
    quad(-10, rodY - rodR, W + 10, rodY + rodR, 0);                                // the rod
    for (const p of state.panels) for (let k = 0; k < p.clips; k++){
      const x = p.clipX[k];
      quad(x - ringR, rodY - ringR, x + ringR, rodY + ringR, 1);
      quad(x - 1.6, rodY + ringR - 2, x + 1.6, p.top + 2, 0, -1, -.4, 1, .4);      // the clip hanging from the ring
    }
    const ball = rodR * 2.1;
    quad(-ball * .6, rodY - ball, ball * 1.4, rodY + ball, 2);
    quad(W - ball * 1.4, rodY - ball, W + ball * .6, rodY + ball, 2);
    const data = new Float32Array(v);
    gl.useProgram(hardware.prog);
    gl.uniform2f(hardware.uni('uRes'), W, state.H);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.hw);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const attrs = [['aPos', 2, 0], ['aLocal', 2, 2], ['aKind', 1, 4]];
    for (const [name, size, off] of attrs){
      const l = hardware.loc(name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 20, off * 4);
    }
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 5);
    for (const [name] of attrs) gl.disableVertexAttribArray(hardware.loc(name));
  }

  function render(){
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    drawCloth();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawHardware();
  }

  function frame(now){
    if (!state.running) return;
    const dt = Math.min(.05, (now - (state.last || now)) / 1000);
    state.last = now;
    state.time += dt;
    // where the rings are
    const k = clamp((now - state.t0) / state.dur, 0, 1);
    const prevClosure = state.closure;
    state.closure = state.from + (state.target - state.from) * easeInOut(k);
    const speed = Math.abs(state.closure - prevClosure) / Math.max(dt, 1e-3);
    const wind = (.22 + Math.min(speed, 3) * .7) * Math.min(1, 700 / state.W);
    for (const p of state.panels) placeClips(p, state.closure);
    // At most 3 steps a frame, each up to 1/60 s: on a slow phone the steps get longer, so the cloth
    // still keeps pace with the rings instead of trailing behind them.
    const steps = Math.max(1, Math.min(3, Math.round(dt / DT)));
    const h = Math.min(dt / steps, 1 / 60);
    for (let s = 0; s < steps; s++){
      for (const p of state.panels){
        pinTop(p);
        step(p, state.time, wind, h);
      }
    }
    render();
    if (k >= 1 && state.resolve){ const r = state.resolve; state.resolve = null; r(); }
    state.raf = requestAnimationFrame(frame);
  }

  function startLoop(){
    if (state.running) return;
    state.running = true;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  }
  function stopLoop(){
    state.running = false;
    cancelAnimationFrame(state.raf);
    if (state.resolve){ const r = state.resolve; state.resolve = null; r(); }
  }

  return {
    get printMode(){ return state.printMode; },
    get ok(){ return !state.lost; },
    /* Open (gathered at the sides) and hanging still, ready to close. */
    show(closure = 0){
      if (state.lost) return false;
      layout();
      state.palette = paletteNow();
      state.closure = state.from = state.target = closure;
      for (const p of state.panels) rest(p, closure);
      render();
      startLoop();
      return true;
    },
    /* Slide the rings to a closure (0 open, 1 closed) over ms; resolves when they arrive. */
    to(target, ms){
      if (state.lost) return Promise.resolve();
      if (state.resolve){ const r = state.resolve; state.resolve = null; r(); }
      state.from = state.closure;
      state.target = target;
      state.t0 = performance.now();
      state.dur = Math.max(1, ms);
      startLoop();
      return new Promise(resolve => { state.resolve = resolve; });
    },
    hide(){ stopLoop(); }
  };
}

window.SilkCurtain = { create };
})();
