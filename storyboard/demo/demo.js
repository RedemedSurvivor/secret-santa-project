const get = (selector) => document.querySelector(selector);
const panels = [...document.querySelectorAll('.panel')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = get('canvas');
const ctx = canvas.getContext('2d');
const colors = ['#ff7443', '#fff4dc', '#c29db9', '#311733'];
const card = get('.card');
const pin = get('.pin');
const spin = get('#spin');
let frame = 0;
let audio;
let musicTimer;
let musicStep = 0;
const theme = get('#theme');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  theme.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
}
applyTheme(localStorage.getItem('njithi-theme') || (systemDark.matches ? 'dark' : 'light'));
theme.onclick = () => {
  const mode = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(mode);
  localStorage.setItem('njithi-theme', mode);
};
get('#open').onclick = () => { sound(420); show('entry'); };

function music() {
  const notes = [220, 329.63, 440, 392, 196, 293.66, 392, 329.63];
  sound(notes[musicStep++ % notes.length], 1.4, 0.012, 'sine');
}

function drumroll() {
  show('suspense');
  const duration = 1180;
  const start = performance.now();
  let beat = 0;
  function roll(now) {
    const elapsed = now - start;
    if (elapsed >= duration) { reveal(); return; }
    const nextBeat = Math.floor(7 * (elapsed / duration) + 15 * (elapsed / duration) ** 2);
    if (nextBeat > beat) {
      sound(100 + nextBeat * 2, 0.065, 0.063, 'triangle', 39);
      beat = nextBeat;
    }
    frame = requestAnimationFrame(roll);
  }
  frame = requestAnimationFrame(roll);
}

function show(id) {
  for (const panel of panels) panel.hidden = panel.id !== id;
  get('#' + id + ' h1').focus();
}

function sound(frequency, length = 0.045, volume = 0.045, wave = 'sine', endFrequency = frequency) {
  if (!audio || audio.state !== 'running' || get('#sound').ariaPressed !== 'true') return;
  const voice = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime;
  voice.type = wave;
  voice.frequency.setValueAtTime(frequency, start);
  voice.frequency.exponentialRampToValueAtTime(endFrequency, start + length);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + length);
  voice.connect(gain).connect(audio.destination);
  voice.start(start);
  voice.stop(start + length);
}

get('#sound').onclick = async (event) => {
  const toggle = event.currentTarget;
  if (toggle.ariaPressed === 'true') {
    toggle.ariaPressed = 'false';
    toggle.textContent = 'Sound off';
    clearInterval(musicTimer);
    return;
  }
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audio ??= new Audio();
  await audio.resume();
  toggle.ariaPressed = 'true';
  toggle.textContent = 'Sound on';
  sound(520);
  music();
  musicTimer = setInterval(music, 650);
};

function draw(angle = 0) {
  const radius = canvas.width / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(angle);
  for (let i = 0; i < 16; i++) {
    const edge = i * Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 6, edge, edge + Math.PI / 8);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
  }
  ctx.restore();
  for (const [size, color, outline] of [[radius - 6, '#311733', true], [radius / 5, '#311733', false]]) {
    ctx.beginPath();
    ctx.arc(radius, radius, size, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx[outline ? 'strokeStyle' : 'fillStyle'] = color;
    ctx[outline ? 'stroke' : 'fill']();
  }
  ctx.fillStyle = colors[1];
  ctx.font = '28px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', radius, radius + 1);
}

function reveal() {
  cancelAnimationFrame(frame);
  pin.style.transform = '';
  spin.disabled = false;
  card.classList.remove('arrive');
  show('result');
  void card.offsetWidth;
  card.classList.add('arrive');
  sound(880, 0.24, 0.07);
  navigator.vibrate?.(25);
}

function spinWheel() {
  if (reduced.matches) { reveal(); return; }
  spin.disabled = true;
  navigator.vibrate?.(14);
  const start = performance.now();
  const turn = Math.PI * 2;
  let lastTick = 0;
  function update(now) {
    const progress = Math.min((now - start) / 3400, 1);
    const acceleration = 0.18;
    const glide = Math.max(0, (progress - acceleration) / (1 - acceleration));
    const angle = progress < acceleration
      ? turn * 1.2 * (progress / acceleration) ** 2
      : turn * (1.2 + 5.8 * (1 - (1 - glide) ** 3));
    draw(angle);
    const tick = Math.floor(angle / (turn / 16));
    if (tick !== lastTick) {
      sound(210 + 230 * (1 - progress), 0.024);
      lastTick = tick;
    }
    pin.style.transform = 'rotate(' + (-16 * Math.abs(Math.sin(angle * 8))) + 'deg)';
    if (progress < 1) frame = requestAnimationFrame(update);
    else drumroll();
  }
  frame = requestAnimationFrame(update);
}

get('form').onsubmit = (event) => {
  event.preventDefault();
  const value = get('#code').value.toLowerCase().trim().replace(/\s+/g, ' ');
  const valid = value === 'mango lantern 47';
  get('#error').hidden = valid;
  if (valid) {
    sound(550);
    show('stage');
    draw();
  }
};
get('#code').addEventListener('input', () => { get('#error').hidden = true; sound(350, 0.023, 0.025); });
spin.onclick = spinWheel;
get('#skip').onclick = reveal;
get('#close').onclick = () => { get('form').reset(); show('entry'); };

const surface = get('.perspective');
function tilt(event) {
  if (reduced.matches) return;
  const bounds = surface.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
  card.style.setProperty('--rx', ((0.5 - y) * 18) + 'deg');
  card.style.setProperty('--ry', ((x - 0.5) * 18) + 'deg');
  card.style.setProperty('--sheen', (x * 72 + y * 28) + '%');
  card.style.setProperty('--shine', '0.85');
}
function resetTilt() {
  for (const property of ['--rx', '--ry', '--sheen', '--shine']) card.style.removeProperty(property);
}
surface.addEventListener('pointerdown', tilt);
surface.addEventListener('pointermove', tilt);
for (const event of ['pointerleave', 'pointerup', 'pointercancel']) surface.addEventListener(event, resetTilt);
