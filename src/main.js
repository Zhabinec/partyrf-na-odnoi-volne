import { entrance, percent, roomScreen, situations } from './ui.js';

const app = document.querySelector('#app');
const feedback = document.querySelector('#feedback');
const roomLabel = document.querySelector('#room-label');
const soundToggle = document.querySelector('#sound-toggle');
let soundOn = true;
let audio;
let output;
let beat = 0;
let musicPhase;

const bassNotes = [45, null, null, 45, null, 52, null, 55, 57, null, null, 55, null, 52, 48, null];
const leadNotes = [null, null, 69, null, 72, null, null, 76, null, 74, null, 72, null, 69, null, null];

function unlockSound() {
  if (!soundOn || !window.AudioContext) return;
  if (!audio) {
    audio = new AudioContext();
    output = audio.createGain();
    output.connect(audio.destination);
  }
  if (audio.state === 'suspended') void audio.resume().catch(() => {});
}

function canPlay() {
  return soundOn && !document.hidden && audio?.state === 'running';
}

function tone(note, at, length, volume, type = 'triangle') {
  const voice = audio.createOscillator();
  const envelope = audio.createGain();
  voice.type = type;
  voice.frequency.value = 440 * 2 ** ((note - 69) / 12);
  envelope.gain.setValueAtTime(.001, at);
  envelope.gain.linearRampToValueAtTime(volume, at + .009);
  envelope.gain.exponentialRampToValueAtTime(.001, at + length);
  voice.connect(envelope).connect(output);
  voice.start(at);
  voice.stop(at + length);
}

function musicBeat() {
  const phase = state?.phase;
  const playing = phase === 'lobby' || phase === 'guessing';
  if (!canPlay() || !playing || (phase === 'guessing' && state.deadline - Date.now() - offset <= 8000)) {
    musicPhase = undefined;
    return;
  }
  if (musicPhase !== phase) {
    musicPhase = phase;
    beat = 0;
  }
  const index = beat % bassNotes.length;
  const transpose = Math.floor(beat / bassNotes.length) % 2 ? -5 : 0;
  const at = audio.currentTime;
  const bass = bassNotes[index];
  const lead = leadNotes[index];
  const lobby = phase === 'lobby';
  if (bass !== null) tone(bass + transpose, at, .15, lobby ? .09 : .044);
  if (lobby && lead !== null) {
    tone(lead + transpose, at, .12, .045, 'sine');
    tone(lead + transpose - 5, at + .03, .1, .023);
  }
  if (index % 4 === 0) tone(30, at, .07, lobby ? .075 : .045, 'sine');
  if (index % 4 === 2) tone(96, at, .038, lobby ? .023 : .012, 'square');
  beat++;
}

function playCue(kind) {
  if (!canPlay()) return;
  const notes = {
    accepted: [72, 76],
    turn: [69, 72, 76],
    sealed: [72, 67],
  }[kind];
  notes.forEach((note, i) => tone(note, audio.currentTime + i * .065, .12, .065));
}

function playFinale() {
  if (!canPlay()) return;
  const noise = audio.createBuffer(1, Math.round(audio.sampleRate * .07), audio.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2;
  const start = audio.currentTime;
  for (let i = 0; i < 12; i++) {
    const hit = audio.createBufferSource();
    const gain = audio.createGain();
    hit.buffer = noise;
    gain.gain.value = i === 11 ? .16 : .04 + i * .006;
    hit.connect(gain).connect(output);
    hit.start(start + i * .073);
  }
  [69, 73, 76, 81].forEach((note, i) => tone(note, start + .83 + i * .055, .28, .075));
}

soundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  soundToggle.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) unlockSound();
  if (output) output.gain.setTargetAtTime(soundOn ? 1 : 0, audio.currentTime, .015);
});
const code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
const sessionKey = 'on-wave-session';
let session;
try { session = JSON.parse(sessionStorage.getItem(sessionKey)); } catch {}
if (code && session?.code !== code) session = null;
let state;
let renderedKey;
let requestId = 0;
let lastApplied = 0;
let offset = 0;
let busy = false;
let lastTick;

function playClockTick(seconds) {
  if (!canPlay()) return;
  const at = audio.currentTime;
  const hit = audio.createOscillator();
  const gain = audio.createGain();
  hit.frequency.value = seconds <= 3 ? 920 : 590;
  gain.gain.setValueAtTime(.06, at);
  gain.gain.exponentialRampToValueAtTime(.001, at + .065);
  hit.connect(gain).connect(output);
  hit.start(at);
  hit.stop(at + .07);
}

function message(text = '') {
  feedback.textContent = text;
  feedback.hidden = !text;
}

function inviteUrl() {
  const url = new URL('./', location.href);
  url.searchParams.set('room', state.code);
  return url.href;
}

function updateClock() {
  const timer = document.querySelector('#timer');
  if (!timer) return;
  const remaining = Math.max(0, state.deadline - Date.now() - offset);
  const seconds = Math.ceil(remaining / 1000);
  const clock = timer.closest('.round-clock');
  const fraction = Math.min(1, remaining / (state.duration || remaining || 1));
  clock.style.setProperty('--remaining', (fraction * 100) + '%');
  clock.style.setProperty('--hand-angle', (-360 * (1 - fraction)) + 'deg');
  clock.classList.toggle('time-low', seconds <= 8);
  const formatted = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  if (timer.textContent !== formatted) timer.textContent = formatted;
  const tick = state.step + ':' + seconds;
  if (tick !== lastTick) {
    lastTick = tick;
    if (seconds > 0 && seconds <= 8 && !document.hidden) playClockTick(seconds);
  }
}

function applyState(next, id) {
  if (id < lastApplied) return;
  lastApplied = id;
  const changesPage = state?.step !== next.step;
  state = next;
  offset = next.now - Date.now();
  const key = JSON.stringify([state.step, state.done, state.phase, state.players, state.me]);
  if (key !== renderedKey) {
    const shouldFocus = renderedKey !== undefined && !document.activeElement?.matches('.invite-link');
    renderedKey = key;
    app.classList.add('in-room');
    app.innerHTML = roomScreen(state);
    if (changesPage) app.firstElementChild.classList.add('page-turn');
    if (changesPage && state.phase === 'finished') playFinale();
    if (changesPage && state.phase === 'sealed') playCue('sealed');
    if (changesPage && state.phase === 'guessing') playCue('turn');
    roomLabel.textContent = 'КОМНАТА ' + state.code;
    const invite = document.querySelector('#invite-link');
    if (invite) invite.value = inviteUrl();
    if (shouldFocus) {
      const heading = app.querySelector('h1');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  document.querySelector('#progress').textContent = state.progress
    ? 'ГОТОВЫ ' + state.progress.join(' / ') : '';
  updateClock();
}

async function request(path, body, token) {
  const response = await fetch('./api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  const data = await response.json();
  if (!response.ok && !data.state) throw Object.assign(new Error(data.error), { status: response.status });
  return data;
}

async function sync() {
  if (!session) return;
  const id = ++requestId;
  try {
    const data = await request('rooms/' + session.code, null, session.token);
    applyState(data.state, id);
    if (feedback.dataset.connection) {
      delete feedback.dataset.connection;
      message();
    }
  } catch (error) {
    if (error.status === 401) {
      session = null;
      state = null;
      renderedKey = undefined;
      sessionStorage.removeItem(sessionKey);
      showEntrance();
      message(error.message);
      return;
    }
    feedback.dataset.connection = 'true';
    message('Связь пропала. Пробуем подключиться…');
  }
}

function showEntrance() {
  roomLabel.textContent = 'ИГРА ДЛЯ КОМПАНИИ';
  app.classList.remove('in-room');
  app.innerHTML = entrance(code);
}

async function action(type, value) {
  const id = ++requestId;
  const step = state.step;
  const data = await request('rooms/' + session.code, { type, value, step }, session.token);
  applyState(data.state, id);
  if (!data.error && data.state.step === step) playCue('accepted');
  message(data.error);
}

async function interact(callback, control) {
  if (busy) return;
  busy = true;
  control.disabled = true;
  delete feedback.dataset.connection;
  message();
  try { await callback(); }
  catch (error) { message(error.status ? error.message : 'Не удалось связаться с комнатой. Попробуй ещё раз.'); }
  finally {
    control.disabled = false;
    busy = false;
  }
}

app.addEventListener('submit', event => {
  event.preventDefault();
  unlockSound();
  const form = event.target;
  const control = event.submitter ?? form.querySelector('button');
  const fields = new FormData(form);
  const type = form.dataset.form;
  void interact(async () => {
    if (type === 'entry') {
      const data = await request(control.value || 'join', { name: fields.get('name'), code: fields.get('code') });
      session = { code: data.state.code, token: data.token };
      sessionStorage.setItem(sessionKey, JSON.stringify(session));
      applyState(data.state, ++requestId);
      return;
    }
    const value = fields.get('value');
    await action(type, type === 'topic' ? value : Number(value));
  }, control);
});

app.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  unlockSound();
  void interact(async () => {
    if (control.dataset.action === 'copy') {
      try {
        await navigator.clipboard.writeText(inviteUrl());
        message('Ссылка скопирована.');
      } catch {
        const input = document.querySelector('#invite-link');
        input.focus();
        input.select();
        message('Скопируй выделенную ссылку.');
      }
    } else if (control.dataset.action === 'suggest') {
      const input = document.querySelector('#topic');
      const options = situations.filter(situation => situation !== input.value);
      input.value = options[Math.floor(Math.random() * options.length)];
      input.focus();
    } else await action(control.dataset.action);
  }, control);
});

app.addEventListener('input', event => {
  if (event.target.id !== 'scale') return;
  const rating = Number(event.target.value);
  const value = percent(rating);
  event.target.setAttribute('aria-valuetext', value);
  document.querySelector('#reading').value = value;
  document.querySelector('.wave-meter').style.setProperty('--waterline', (50 - rating * .42) + '%');
  document.querySelector('#host-line').textContent = rating >= 85 ? 'Точно настолько? Тут уже цунами!' :
    rating <= -85 ? 'Ого. Даже спасательный круг не поможет?' :
    Math.abs(rating) < 15 ? 'Прямо посередине? Дипломатично.' :
    rating > 0 ? 'Так-так, волна пошла!' : 'Кажется, отлив. Оставляем так?';
});

async function poll() {
  if (!busy) await sync();
  setTimeout(poll, 900);
}

if (session) app.textContent = 'Подключаемся к комнате…';
else showEntrance();
void poll();
setInterval(updateClock, 100);
setInterval(musicBeat, 145);
