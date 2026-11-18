(() => {
  const circle = Math.PI * 2;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const smooth = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const roadPhase = (p) => smooth((p - .13) / .17) * (1 - smooth((p - .64) / .16));
  function drawCar(ctx, advance, angle, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const x = -115 + 260 * advance;
    ctx.translate(x, 32);
    ctx.scale(.86, .86);
    for (let i = 0; i < 19; i++) {
      const age = (advance * 2.4 + i / 19) % 1;
      ctx.globalAlpha = opacity * (1 - age) * .24;
      ctx.beginPath();
      ctx.ellipse(-40 - age * 82, 13 - age * (12 + i % 8), 5 + 21 * age, 3 + 12 * age, -.12, 0, circle);
      ctx.fillStyle = i % 3 ? '#ecd5c1' : '#a37f88';
      ctx.fill();
    }
    ctx.globalAlpha = opacity;
    const paint = ctx.createLinearGradient(0, -45, 0, 15);
    paint.addColorStop(0, '#fa7455');
    paint.addColorStop(.53, '#d7393f');
    paint.addColorStop(1, '#740d28');
    ctx.beginPath();
    ctx.moveTo(-78, 3);
    ctx.quadraticCurveTo(-82, -15, -52, -20);
    ctx.bezierCurveTo(-21, -21, -24, -44, 4, -43);
    ctx.bezierCurveTo(27, -46, 36, -27, 53, -20);
    ctx.bezierCurveTo(81, -16, 92, -9, 91, 4);
    ctx.lineTo(79, 13);
    ctx.lineTo(-72, 13);
    ctx.closePath();
    ctx.fillStyle = paint;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#f6b294';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-28, -23);
    ctx.quadraticCurveTo(1, -58, 32, -27);
    ctx.lineTo(40, -21);
    ctx.closePath();
    ctx.fillStyle = '#342b3b';
    ctx.fill();
    ctx.strokeStyle = '#ad8b93';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-35, -6);
    ctx.quadraticCurveTo(10, 6, 70, -8);
    ctx.moveTo(77, -10);
    ctx.lineTo(88, -5);
    ctx.strokeStyle = '#ffc19b';
    ctx.stroke();
    for (const tire of [-44, 51]) {
      ctx.save();
      ctx.translate(tire, 10);
      ctx.rotate(angle);
      ctx.scale(.22, .22);
      machineFace(ctx);
      ctx.restore();
    }
    ctx.restore();
  }
  function disc(ctx, radius, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, circle);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }
  function paintedFace(ctx, colors) {
    disc(ctx, 87, '#381f32', '#c79865', 2);
    for (let i = 0; i < 8; i++) {
      const a = i * circle / 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 78, a, a + circle / 8);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#432332';
      ctx.stroke();
      ctx.save();
      ctx.rotate(a + circle / 16);
      ctx.translate(58, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = i % 2 ? '#432332' : '#fff4d8';
      ctx.font = '19px Georgia';
      ctx.fillText(i % 2 ? '✦' : '?', 0, 0);
      ctx.restore();
    }
    disc(ctx, 22, '#eac592', '#7a3e37', 2);
    ctx.fillStyle = '#432332';
    ctx.font = 'italic 16px Georgia';
    ctx.fillText('Spin', 0, 0);
  }
  function machineFace(ctx) {
    disc(ctx, 87, '#221b27', '#d0a77c', 2);
    disc(ctx, 74, '#38313b', '#ac917f', 2);
    for (let i = 0; i < 24; i++) {
      ctx.save();
      ctx.rotate(i * circle / 24);
      ctx.strokeStyle = '#6e5963';
      ctx.beginPath();
      ctx.moveTo(77, -2);
      ctx.lineTo(84, 3);
      ctx.stroke();
      ctx.restore();
    }
    const spokes = 6;
    for (let i = 0; i < spokes; i++) {
      ctx.save();
      ctx.rotate(i * circle / spokes);
      ctx.beginPath();
      {
        ctx.moveTo(12, -7);
        ctx.quadraticCurveTo(45, -14, 64, -6);
        ctx.lineTo(62, 5);
        ctx.quadraticCurveTo(39, 14, 12, 7);
        ctx.fillStyle = '#d6bec0';
      }
      ctx.fill();
      ctx.restore();
    }
    disc(ctx, 15, '#e6c6a2', '#523243', 2);
  }
  window.wheelJourney = function wheelJourney(canvas, progress = 0, angle = 0, colors = ['#78394e', '#f5ddaf', '#926687', '#e9b297']) {
    const ctx = canvas.getContext('2d');
    const road = roadPhase(progress);
    const travel = road;
    const wide = smooth((progress - .27) / .12) * (1 - smooth((progress - .59) / .14));
    const zoom = Math.min(canvas.width, canvas.height) / 205;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    if (road > 0) {
      ctx.globalAlpha = road * .65;
      ctx.strokeStyle = '#d7a775';
      ctx.setLineDash([17, 10]);
      ctx.lineDashOffset = -angle * 10;
      for (const y of [72, 82, 92]) {
        ctx.beginPath();
        ctx.moveTo(-110, y);
        ctx.quadraticCurveTo(0, y + 10, 110, y - 8);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (wide > 0) drawCar(ctx, clamp((progress - .29) / .37), angle, wide);
    ctx.globalAlpha = 1 - wide;
    ctx.rotate(-.16 * travel);
    ctx.scale(1 - .20 * travel, 1 - .12 * travel);
    for (let i = 9; i > 0; i--) {
      ctx.save();
      ctx.translate(i * (0.6 + travel * .9), i * .64);
      disc(ctx, 87, i % 2 ? '#523143' : '#60404a');
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    paintedFace(ctx, colors);
    if (road > 0) {
      ctx.globalAlpha = road * (1 - wide);
      machineFace(ctx);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, 86, Math.PI * 1.08, Math.PI * 1.75);
    ctx.strokeStyle = '#ffe6b699';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
})();
