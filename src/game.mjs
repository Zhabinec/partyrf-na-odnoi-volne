export const limits = { minPlayers: 3, maxPlayers: 10, name: 24, topic: 72 };
export const durations = { topics: 55_000, rating: 40_000, guessing: 30_000, sealed: 1800, intro: 2400 };

export function newGame() {
  return { phase: 'lobby', step: 0, deadline: null };
}

function enter(game, phase, now) {
  game.phase = phase;
  game.step++;
  game.deadline = durations[phase] ? now + durations[phase] : null;
}

function announce(game, nextPhase, now) {
  game.nextPhase = nextPhase;
  enter(game, 'intro', now);
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sealRound(game, now) {
  const turn = game.turns[game.turnIndex];
  const rating = game.ratings[turn];
  const guesses = Object.entries(game.guesses).map(([playerId, value]) => ({
    playerId, value, distance: Math.abs(value - rating),
  })).sort((a, b) => a.distance - b.distance);
  const winners = guesses.filter(guess => guess.distance === guesses[0].distance);
  for (const { playerId } of winners) game.scores[playerId]++;
  const result = {
    subject: turn, topic: game.assigned[turn], rating, guesses, winners: winners.map(guess => guess.playerId),
    askWhy: game.whyPlayers.includes(turn),
  };
  if (!game.hadDebate && !result.askWhy && guesses.length >= 2) {
    const ordered = [...guesses].sort((a, b) => a.value - b.value);
    const low = ordered[0];
    const high = ordered.at(-1);
    if (high.value - low.value >= 100) {
      result.debate = [low, high];
      game.hadDebate = true;
    }
  }
  game.results.push(result);
  if (guesses.length) {
    const average = Math.round(guesses.reduce((sum, guess) => sum + guess.value, 0) / guesses.length);
    const gap = Math.abs(average - rating);
    if (!game.highlight || gap > game.highlight.gap) {
      game.highlight = { subject: turn, topic: game.assigned[turn], average, rating, gap };
    }
  }
  enter(game, 'sealed', now);
}

function advance(game, now, random) {
  switch (game.phase) {
    case 'intro':
      enter(game, game.nextPhase, now);
      break;
    case 'topics': {
      const entries = Object.entries(game.topics);
      if (entries.length < limits.minPlayers) {
        game.notice = 'Нужно хотя бы три темы. Попробуйте ещё раз.';
        enter(game, 'lobby', now);
        break;
      }
      game.active = entries.map(([id]) => id);
      const topics = shuffle(entries.map(([, topic]) => topic), random);
      game.assigned = Object.fromEntries(game.active.map((id, i) => [id, topics[i]]));
      game.scores = Object.fromEntries(game.active.map(id => [id, 0]));
      announce(game, 'rating', now);
      break;
    }
    case 'rating':
      game.turns = game.active.filter(id => id in game.ratings);
      if (!game.turns.length) {
        game.notice = 'Никто не успел поставить оценку. Попробуйте ещё раз.';
        enter(game, 'lobby', now);
        break;
      }
      const questionCount = Math.max(1, Math.round(game.turns.length / 3));
      game.whyPlayers = shuffle(game.turns, random).slice(0, questionCount);
      game.turnIndex = -1;
      nextTurn(game, now);
      break;
    case 'guessing':
      sealRound(game, now);
      break;
    case 'sealed':
      nextTurn(game, now);
      break;
  }
}

function nextTurn(game, now) {
  game.turnIndex++;
  game.guesses = {};
  if (game.turnIndex === game.turns.length) {
    game.recapIndex = 0;
    enter(game, 'recap', now);
  }
  else if (game.turnIndex === 0) announce(game, 'guessing', now);
  else enter(game, 'guessing', now);
}

export function tick(game, now, random = Math.random) {
  if (game.deadline !== null && now >= game.deadline) advance(game, now, random);
  settle(game, now, random);
}

function required(game) {
  return (game.active ?? []).filter(id => !game.departed?.includes(id));
}

function settle(game, now, random = Math.random) {
  const answers = { topics: game.topics, rating: game.ratings, guessing: game.guesses }[game.phase];
  if (!answers) return;
  const players = required(game).filter(id => game.phase !== 'guessing' || id !== game.turns[game.turnIndex]);
  if (players.every(id => Object.hasOwn(answers, id))) advance(game, now, random);
}

export function depart(game, id, now) {
  game.departed ??= [];
  if (!game.departed.includes(id)) game.departed.push(id);
  settle(game, now);
}

export function act(game, { id, isHost, players }, action, now, random = Math.random) {
  tick(game, now, random);
  if (action.step !== game.step) return 'Этап уже закончился. Экран обновлён.';
  if (action.type === 'next-recap' && ['recap', 'recap-why'].includes(game.phase)) {
    if (!isHost) return 'Карточки листает хост.';
    if (game.phase === 'recap' && game.results[game.recapIndex].askWhy) {
      enter(game, 'recap-why', now);
      return;
    }
    game.recapIndex++;
    if (game.recapIndex === game.results.length) announce(game, 'winner', now);
    else enter(game, 'recap', now);
    return;
  }
  if (action.type === 'next-finale' && ['winner', 'moment'].includes(game.phase)) {
    if (!isHost) return 'Финал листает хост.';
    enter(game, game.phase === 'winner' ? 'moment' : 'finished', now);
    return;
  }
  if (action.type === 'start' && ['lobby', 'finished'].includes(game.phase)) {
    if (!isHost) return 'Партию запускает хост.';
    if (players.length < limits.minPlayers) return 'Нужно хотя бы три игрока.';
    Object.assign(game, {
      active: players, departed: [], topics: {}, assigned: {}, ratings: {}, scores: {},
      turns: [], guesses: {}, results: [], notice: '', hadDebate: false, highlight: null,
    });
    announce(game, 'topics', now);
    return;
  }
  if (!game.active?.includes(id)) return 'Дождись следующей партии.';

  if (action.type === 'topic' && game.phase === 'topics') {
    if (id in game.topics) return 'Тема уже принята.';
    const value = typeof action.value === 'string' ? action.value.trim().replace(/\s+/g, ' ') : '';
    if (!value || value.length > limits.topic) return 'Введи тему до 72 символов.';
    const normalize = topic => topic.toLowerCase().replaceAll('ё', 'е');
    if (Object.values(game.topics).some(topic => normalize(topic) === normalize(value))) {
      return 'Такая тема уже есть. Придумай другую.';
    }
    game.topics[id] = value;
    settle(game, now, random);
    return;
  }

  const isRating = game.phase === 'rating' && action.type === 'rate';
  const isGuess = game.phase === 'guessing' && action.type === 'guess' && id !== game.turns[game.turnIndex];
  if (!isRating && !isGuess) return 'Это действие сейчас недоступно.';
  if (!Number.isInteger(action.value) || Math.abs(action.value) > 100) return 'Выбери число от −100 до +100.';
  const answers = isRating ? game.ratings : game.guesses;
  if (id in answers) return 'Ответ уже принят.';
  answers[id] = action.value;
  settle(game, now, random);
}

export function view(game, id) {
  const { phase, step, deadline } = game;
  const data = { phase, step, deadline, duration: durations[phase] ?? null, notice: game.notice };
  if (phase === 'lobby') return data;
  if (phase === 'intro') return { ...data, nextPhase: game.nextPhase };
  if (phase === 'winner') {
    const best = Math.max(...Object.values(game.scores));
    const winners = best ? Object.keys(game.scores).filter(id => game.scores[id] === best) : [];
    return { ...data, winners };
  }
  if (phase === 'moment') {
    const { subject, topic, rating } = game.results[0];
    return { ...data, highlight: game.highlight ?? { subject, topic, rating, average: null } };
  }
  if (phase === 'finished') return { ...data, scores: game.scores, results: game.results };
  if (phase === 'recap' || phase === 'recap-why') {
    const result = game.results[game.recapIndex];
    const { subject, topic, rating, guesses, winners, debate } = result;
    const card = phase === 'recap' ? { subject, topic, rating, guesses, winners, debate } : { subject, topic, rating };
    return { ...data, card, turn: [game.recapIndex + 1, game.results.length] };
  }
  if (phase === 'sealed') return { ...data, turn: [game.turnIndex + 1, game.turns.length] };
  data.active = game.active.includes(id);
  if (phase === 'topics' || phase === 'rating') {
    const answers = phase === 'topics' ? game.topics : game.ratings;
    data.done = Object.hasOwn(answers, id);
    data.progress = [required(game).filter(player => Object.hasOwn(answers, player)).length, required(game).length];
    if (phase === 'rating') data.topic = game.assigned[id];
    return data;
  }
  data.subject = game.turns[game.turnIndex];
  data.topic = game.assigned[data.subject];
  data.turn = [game.turnIndex + 1, game.turns.length];
  data.done = Object.hasOwn(game.guesses, id);
  const guessers = required(game).filter(player => player !== data.subject);
  data.progress = [guessers.filter(player => Object.hasOwn(game.guesses, player)).length, guessers.length];
  return data;
}

export function publicView(game) {
  const { active, done, topic, ...data } = view(game, null);
  return { ...data, ...(game.phase === 'guessing' ? { topic } : {}), display: true };
}

export function resume(game, id) {
  if (game.departed) game.departed = game.departed.filter(player => player !== id);
}
