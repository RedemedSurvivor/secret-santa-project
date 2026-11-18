(() => {
  const contexts = new WeakMap();
  const tau = Math.PI * 2;
  const defaultPalette = { dark: '#360811', bright: '#a81d3d', gold: '#e0a656' };

  function parseColor(value, fallback) {
    const hex = /^#([a-f\d]{6})$/i.exec(value || '')?.[1] || fallback.slice(1);
    return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
  }

  function mix(from, to, weight) {
    return 'rgb(' + from.map((channel, i) =>
      Math.round(channel + (to[i] - channel) * weight)).join(',') + ')';
  }

  function makeGrain(context) {
    const tile = context.canvas.ownerDocument.createElement('canvas');
    tile.width = tile.height = 96;
    const brush = tile.getContext('2d');
    const pixels = brush.createImageData(tile.width, tile.height);
    let seed = 8425;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      const tone = seed >>> 31 ? 255 : 0;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = tone;
      pixels.data[i + 3] = (seed >>> 20) % 17;
    }
    brush.putImageData(pixels, 0, 0);
    return context.createPattern(tile, 'repeat');
  }

  function stateFor(canvas) {
    let state = contexts.get(canvas);
    if (!state) {
      const context = canvas.getContext('2d');
      if (!context) return null;
      state = { context, grain: makeGrain(context), key: '' };
      contexts.set(canvas, state);
    }
    return state;
  }

  function preparePalette(state, palette) {
    const key = [palette.dark, palette.bright, palette.gold].join();
    if (state.key === key) return;
    const dark = parseColor(palette.dark, defaultPalette.dark);
    const bright = parseColor(palette.bright, defaultPalette.bright);
    state.base = mix(dark, bright, 0.22);
    state.gold = mix(parseColor(palette.gold, defaultPalette.gold), dark, 0.15);
    state.shades = Array.from({ length: 48 }, (_, index) =>
      mix(dark, bright, index / 47));
    state.key = key;
  }

  // The rails hold the top edge in place. Lower pleats lag and follow through
  // during travel, with the greatest movement at the free leading edge.
  function profile(step, panelWidth, width, height, motion, phase, mirror) {
    const fold = Math.sin(step * tau * 8.25 + 0.26 * mirror);
    const drift = Math.sin(phase + 1.15 * mirror + step * tau * 1.55);
    const spread = Math.min(16, width * 0.036) * motion * step;
    return [
      panelWidth * step,
      panelWidth * step + 2.6 * fold * (1 - step) + spread * (0.5 + drift),
      panelWidth * step + 4.0 * fold * (1 - step) + spread * (0.2 + drift * 0.74),
      panelWidth * step + 5.0 * fold * (1 - step) + spread * (-0.45 + drift * 0.44),
      height
    ];
  }

  function traceEdge(context, edge, reverse = false) {
    const [top, high, low, bottom, height] = edge;
    if (reverse) context.bezierCurveTo(low, height * 0.73, high, height * 0.27, top, 0);
    else context.bezierCurveTo(high, height * 0.27, low, height * 0.73, bottom, height);
  }

  function panel(state, width, height, closure, phase, mirror) {
    const { context } = state;
    const motion = Math.sin(Math.PI * closure);
    const panelWidth = (width / 2 + 1) * closure;
    const hem = profile(1, panelWidth, width, height, motion, phase, mirror);
    const strips = width < 480 ? 74 : 104;
    context.save();
    if (mirror < 0) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(hem[0], 0);
    traceEdge(context, hem);
    context.lineTo(0, height);
    context.closePath();
    context.clip();
    context.fillStyle = state.base;
    context.fillRect(0, 0, width, height);

    let left = profile(0, panelWidth, width, height, motion, phase, mirror);
    for (let i = 0; i < strips; i++) {
      const fraction = (i + 0.5) / strips;
      const right = profile((i + 1) / strips, panelWidth, width, height, motion, phase, mirror);
      const frequency = fraction * tau * 8.25 + 0.26 * mirror;
      const ripple = 0.16 * motion * Math.sin(phase + fraction * tau * 2);
      const diffuse = (0.5 + 0.5 * Math.sin(frequency + ripple)) ** 1.7;
      const broadHighlight = 0.12 * Math.sin(fraction * Math.PI);
      const shade = Math.round(47 * Math.min(1, 0.10 + diffuse * 0.72 + broadHighlight));
      context.fillStyle = state.shades[shade];
      context.beginPath();
      context.moveTo(left[0] - 0.4, 0);
      context.lineTo(right[0], 0);
      traceEdge(context, right);
      context.lineTo(left[3] - 0.4, height);
      traceEdge(context, left, true);
      context.closePath();
      context.fill();
      left = right;
    }

    const light = context.createLinearGradient(0, 0, 0, height);
    light.addColorStop(0, '#12050cf0');
    light.addColorStop(0.17, '#10040b12');
    light.addColorStop(0.35, '#ffd2ad21');
    light.addColorStop(0.61, '#42101b11');
    light.addColorStop(1, '#13040ccc');
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);

    if (state.grain) {
      context.fillStyle = state.grain;
      context.fillRect(0, 0, width, height);
    }
    context.beginPath();
    context.moveTo(hem[0], 0);
    traceEdge(context, hem);
    context.lineWidth = 3.4;
    context.strokeStyle = state.gold;
    context.stroke();
    context.restore();
  }

  window.paintVelvetCurtains = function paintVelvetCurtains(canvas, closure, time = 0, palette = defaultPalette) {
    const state = stateFor(canvas);
    if (!state) return false;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return false;
    const resolution = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.round(width * resolution);
    const pixelHeight = Math.round(height * resolution);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const { context } = state;
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    context.clearRect(0, 0, width, height);
    const amount = Math.max(0, Math.min(1, closure || 0));
    if (!amount) return true;
    preparePalette(state, { ...defaultPalette, ...palette });
    const phase = time * 0.009;
    panel(state, width, height, amount, phase, 1);
    panel(state, width, height, amount, phase, -1);
    return true;
  };
})();
