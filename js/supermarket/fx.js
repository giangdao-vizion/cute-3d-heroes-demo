export function createFx() {
  return { floats: [], sparks: [], rings: [] };
}

export function addFloat(fx, x, y, text, color = '#1f8f6c') {
  fx.floats.push({ x, y, text, color, life: 0.9, vy: -28 });
}

export function addSpark(fx, x, y, color = '#ffd166') {
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
    const sp = 40 + Math.random() * 50;
    fx.sparks.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.25,
      color,
      r: 2 + Math.random() * 2,
    });
  }
}

export function addRing(fx, x, y, color = 'rgba(31,143,108,.45)') {
  fx.rings.push({ x, y, r: 4, life: 0.45, color });
}

export function updateFx(fx, dt) {
  for (const f of fx.floats) {
    f.life -= dt;
    f.y += f.vy * dt;
  }
  fx.floats = fx.floats.filter(f => f.life > 0);

  for (const s of fx.sparks) {
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.92;
    s.vy *= 0.92;
  }
  fx.sparks = fx.sparks.filter(s => s.life > 0);

  for (const r of fx.rings) {
    r.life -= dt;
    r.r += 55 * dt;
  }
  fx.rings = fx.rings.filter(r => r.life > 0);
}

export function drawFx(ctx, fx) {
  for (const r of fx.rings) {
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = Math.max(0, r.life * 1.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const s of fx.sparks) {
    ctx.globalAlpha = Math.max(0, s.life * 2);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const f of fx.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = f.color;
    ctx.font = '800 14px "Baloo 2", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}
