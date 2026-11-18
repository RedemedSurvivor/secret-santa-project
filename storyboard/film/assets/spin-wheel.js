(() => {
  const circle = Math.PI * 2;
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
  window.paintSpinWheel = function paintSpinWheel(canvas, angle = 0, colors = ['#78394e', '#f5ddaf', '#926687', '#e9b297']) {
    const ctx = canvas.getContext('2d');
    const zoom = Math.min(canvas.width, canvas.height) / 205;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    for (let i = 9; i > 0; i--) {
      ctx.save();
      ctx.translate(i * .6, i * .64);
      disc(ctx, 87, i % 2 ? '#523143' : '#60404a');
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    paintedFace(ctx, colors);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, 86, Math.PI * 1.08, Math.PI * 1.75);
    ctx.strokeStyle = '#ffe6b699';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
})();
