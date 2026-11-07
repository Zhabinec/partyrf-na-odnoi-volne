const headerMenu = document.querySelector('#header-menu');
const menuToggle = headerMenu.querySelector('summary');
let phase;
let gameStep;
const soundToggle = document.querySelector('#sound-toggle');
const soundSettings = document.querySelector('#sound-settings');
const musicLevel = document.querySelector('#music-level');
const effectsLevel = document.querySelector('#effects-level');
const volumeKey = 'on-wave-volume';
let levels = {};
try { levels = JSON.parse(localStorage.getItem(volumeKey)) ?? {}; } catch {}
musicLevel.value = levels.music ?? 100;
effectsLevel.value = levels.effects ?? 100;
let audio;
let effectsOutput;
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
  if (!phase) {
    music?.stop();
    music = null;
    musicVolume = undefined;
    return;
  }
  if (!audio || (!music && musicLevel.valueAsNumber === 0)) return;
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
    musicGain.connect(audio.destination);
    music = audio.createBufferSource();
    music.buffer = musicClip;
    music.loop = true;
    music.connect(musicGain);
    const gain = musicGain;
    music.onended = () => gain.disconnect();
    music.start();
  }
  const silent = document.hidden || ['intro', 'sealed', 'recap-why', 'winner', 'moment', 'finished'].includes(phase);
  const phaseVolume = phase === 'lobby' ? .42 : .24;
  const volume = silent ? 0 : phaseVolume * musicLevel.valueAsNumber / 100;
  if (volume === musicVolume) return;
  musicVolume = volume;
  musicGain.gain.setTargetAtTime(volume, audio.currentTime, .09);
}

export function unlockSound() {
  if (!window.AudioContext) return;
  if (!audio) {
    audio = new AudioContext();
    effectsOutput = audio.createGain();
    effectsOutput.gain.value = effectsLevel.valueAsNumber / 100;
    effectsOutput.connect(audio.destination);
    for (const [file] of Object.values(effects)) {
      clips.set(file, loadClip(file));
    }
  }
  if (audio.state !== 'running') void audio.resume().catch(() => {});
  updateMusic(true);
}

export async function playEffect(kind) {
  if (effectsLevel.valueAsNumber === 0 || document.hidden || audio?.state !== 'running') return;
  const step = gameStep;
  const [file, volume, limit] = effects[kind];
  const buffer = await clips.get(file);
  if (!buffer || effectsLevel.valueAsNumber === 0 || document.hidden || gameStep !== step) return;
  const voice = audio.createBufferSource();
  const gain = audio.createGain();
  const duration = Math.min(limit, buffer.duration);
  const start = audio.currentTime;
  voice.buffer = buffer;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.setValueAtTime(volume, start + Math.max(0, duration - .12));
  gain.gain.linearRampToValueAtTime(0, start + duration);
  voice.connect(gain).connect(effectsOutput);
  voice.onended = () => gain.disconnect();
  voice.start(start, 0, duration);
}

soundToggle.addEventListener('click', () => {
  unlockSound();
  headerMenu.open = false;
  soundSettings.showModal();
});
soundSettings.addEventListener('close', () => menuToggle.focus());

function showVolumeLevels() {
  document.querySelector('#music-value').textContent = musicLevel.value + '%';
  document.querySelector('#effects-value').textContent = effectsLevel.value + '%';
}

showVolumeLevels();
soundSettings.addEventListener('input', () => {
  unlockSound();
  if (effectsOutput) effectsOutput.gain.setTargetAtTime(effectsLevel.valueAsNumber / 100, audio.currentTime, .025);
  showVolumeLevels();
  try {
    localStorage.setItem(volumeKey, JSON.stringify({ music: musicLevel.valueAsNumber, effects: effectsLevel.valueAsNumber }));
  } catch {}
});
document.addEventListener('visibilitychange', () => updateMusic());

export function setSoundPhase(next, step = gameStep) {
  phase = next;
  gameStep = step;
  updateMusic();
}
