import { entrance, percent, roomScreen, situations } from './ui.js';

const app = document.querySelector('#app');
const feedback = document.querySelector('#feedback');
const roomLabel = document.querySelector('#room-label');
const leaveRoom = document.querySelector('#leave-room');
const soundToggle = document.querySelector('#sound-toggle');
let soundOn = true;
let audio;
let output;
let musicClip;
let music;
let musicGain;
let musicVolume;
const clips = new Map();
const effects = {
  splash: ['water-splash', .48, 1.3],
  bubble: ['water-bubble', .56, .5],
  drum: ['drum-roll', .48, 2.3],
  applause: ['applause', .48, 2.4],
  tick: ['clock-tick', .35, .5],
};

function loadClip(file) {
  return fetch('./assets/' + file + '.mp3')
    .then(response => {
      if (!response.ok) throw new Error('Sound unavailable');
      return response.arrayBuffer();
    })
    .then(buffer => audio.decodeAudioData(buffer))
    .catch(() => null);
}

function updateMusic(retryLoad = false) {
  if (!state || state.me !== state.host) {
    music?.stop();
    music = null;
    musicVolume = undefined;
    return;
  }
  if (!soundOn || !audio) return;
  if (musicClip === undefined || (retryLoad && musicClip === false)) {
    musicClip = null;
    void loadClip('surf-shimmy').then(buffer => {
      musicClip = buffer ?? false;
      updateMusic();
    });
  }
  if (!musicClip) return;
  if (!music) {
    musicGain = audio.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(output);
    music = audio.createBufferSource();
    music.buffer = musicClip;
    music.loop = true;
    music.connect(musicGain);
    const gain = musicGain;
    music.onended = () => gain.disconnect();
    music.start();
  }
  const silent = document.hidden || ['intro', 'sealed', 'recap-why', 'winner', 'moment', 'finished'].includes(state.phase);
  const volume = silent ? 0 : state.phase === 'lobby' ? .42 : .24;
  if (volume === musicVolume) return;
  musicVolume = volume;
  musicGain.gain.setTargetAtTime(volume, audio.currentTime, .09);
}

function unlockSound() {
  if (!soundOn || !window.AudioContext) return;
  if (!audio) {
    audio = new AudioContext();
    output = audio.createGain();
    output.connect(audio.destination);
    for (const [file] of Object.values(effects)) {
      clips.set(file, loadClip(file));
    }
  }
  if (audio.state !== 'running') void audio.resume().catch(() => {});
  updateMusic(true);
}

async function playEffect(kind) {
  if (!soundOn || document.hidden || audio?.state !== 'running') return;
  const step = state?.step;
  const [file, volume, limit] = effects[kind];
  const buffer = await clips.get(file);
  if (!buffer || !soundOn || document.hidden || state?.step !== step) return;
  const voice = audio.createBufferSource();
  const gain = audio.createGain();
  const duration = Math.min(limit, buffer.duration);
  const start = audio.currentTime;
  voice.buffer = buffer;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.setValueAtTime(volume, start + Math.max(0, duration - .12));
  gain.gain.linearRampToValueAtTime(0, start + duration);
  voice.connect(gain).connect(output);
  voice.start(start, 0, duration);
}

soundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  soundToggle.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) unlockSound();
  if (output) output.gain.setTargetAtTime(soundOn ? 1 : 0, audio.currentTime, .015);
});
document.addEventListener('visibilitychange', () => updateMusic());
let code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
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
    if (seconds > 0 && seconds <= 8 && !document.hidden) void playEffect('tick');
  }
}

function applyState(next, id) {
  if (id < lastApplied) return;
  lastApplied = id;
  const changesPage = state?.step !== next.step;
  state = next;
  updateMusic();
  offset = next.now - Date.now();
  const key = JSON.stringify([state.step, state.done, state.phase, state.players, state.me, state.host]);
  if (key !== renderedKey) {
    const shouldFocus = renderedKey !== undefined && !document.activeElement?.matches('.invite-link');
    renderedKey = key;
    app.classList.add('in-room');
    app.innerHTML = roomScreen(state);
    if (changesPage) app.firstElementChild.classList.add('page-turn');
    if (changesPage && state.phase === 'intro') void playEffect(state.nextPhase === 'winner' ? 'drum' : 'splash');
    if (changesPage && state.phase === 'recap') void playEffect('splash');
    if (changesPage && ['sealed', 'recap-why'].includes(state.phase)) void playEffect('bubble');
    if (changesPage && state.phase === 'winner' && state.winners.length) {
      const finalStep = state.step;
      setTimeout(() => {
        if (state?.step === finalStep && state.phase === 'winner') void playEffect('applause');
      }, 120);
    }
    roomLabel.textContent = 'КОМНАТА ' + state.code;
    leaveRoom.hidden = false;
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
    if (id < lastApplied) return;
    applyState(data.state, id);
    if (feedback.dataset.connection) {
      delete feedback.dataset.connection;
      message();
    }
  } catch (error) {
    if (id < lastApplied) return;
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
  updateMusic();
  roomLabel.textContent = 'ИГРА ДЛЯ КОМПАНИИ';
  leaveRoom.hidden = true;
  app.classList.remove('in-room');
  app.innerHTML = entrance(code, app.hasAttribute('data-test-bots'));
}

leaveRoom.addEventListener('click', () => {
  if (!session) return;
  const previous = session;
  lastApplied = ++requestId;
  session = null;
  state = null;
  renderedKey = undefined;
  code = '';
  sessionStorage.removeItem(sessionKey);
  history.replaceState(null, '', new URL('./', location.href));
  delete feedback.dataset.connection;
  message();
  showEntrance();
  app.querySelector('#name')?.focus();
  void request('rooms/' + previous.code, { type: 'leave' }, previous.token).catch(() => {});
});

async function action(type, value) {
  const id = ++requestId;
  const step = state.step;
  const data = await request('rooms/' + session.code, { type, value, step }, session.token);
  if (id < lastApplied) return;
  applyState(data.state, id);
  if (!data.error && data.state.step === step) void playEffect('bubble');
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
  unlockSound();
  const control = event.target.closest('[data-action]');
  if (!control) return;
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

const waveZones = [
  [-85, 'storm', 'Ого. Даже спасательный круг не поможет?'],
  [-15, 'ebb', 'Кажется, отлив. Оставляем так?'],
  [14, 'calm', 'Прямо посередине? Дипломатично.'],
  [84, 'swell', 'Так-так, волна пошла!'],
  [100, 'crest', 'Точно настолько? Тут уже цунами!'],
];
let waveImpact;

app.addEventListener('input', event => {
  if (event.target.id !== 'scale') return;
  const rating = Number(event.target.value);
  const value = percent(rating);
  event.target.setAttribute('aria-valuetext', value);
  const reading = document.querySelector('#reading');
  const meter = document.querySelector('.wave-meter');
  reading.value = value;
  meter.style.setProperty('--waterline', (50 - rating * .42) + '%');
  const [, zone, line] = waveZones.find(([limit]) => rating <= limit);
  if (meter.dataset.zone === zone) return;
  meter.dataset.zone = zone;
  document.querySelector('#host-line').textContent = line;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    waveImpact?.cancel();
    waveImpact = reading.animate(
      [{ transform: 'scale(.91)' }, { transform: 'scale(1.09)', offset: .48 }, { transform: 'scale(1)' }],
      { duration: 230, easing: 'ease-out' },
    );
  }
});

async function poll() {
  if (!busy) await sync();
  setTimeout(poll, 900);
}

if (session) app.textContent = 'Подключаемся к комнате…';
else showEntrance();
void poll();
setInterval(updateClock, 100);
