export const limits = { minPlayers: 3, maxPlayers: 10, name: 24, topic: 72 };
export const durations = { topics: 55_000, rating: 40_000, guessing: 30_000, debate: 10_000 };

export function newGame() {
  return { phase: 'lobby', step: 0, deadline: null };
}

function enter(game, phase, now) {
  game.phase = phase;
  game.step++;
  game.deadline = durations[phase] ? now + durations[phase] : null;
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function reveal(game, now) {
  const turn = game.turns[game.turnIndex];
  const rating = game.ratings[turn];
  const guesses = Object.entries(game.guesses).map(([playerId, value]) => ({
    playerId, value, distance: Math.abs(value - rating),
  })).sort((a, b) => a.distance - b.distance);
  const winners = guesses.filter(guess => guess.distance === guesses[0].distance);
  for (const { playerId } of winners) game.scores[playerId]++;
  game.result = {
    rating, guesses, winners: winners.map(guess => guess.playerId),
    askWhy: game.whyPlayers.includes(turn),
  };
  if (guesses.length >= 2) {
    const average = Math.round(guesses.reduce((sum, guess) => sum + guess.value, 0) / guesses.length);
    const gap = Math.abs(average - rating);
    if (gap > (game.highlight?.gap ?? 0)) {
      game.highlight = { subject: turn, topic: game.assigned[turn], average, rating, gap };
    }
  }
  enter(game, 'reveal', now);
}

function finishGuessing(game, now) {
  const subject = game.turns[game.turnIndex];
  if (!game.debate && !game.whyPlayers.includes(subject)) {
    const guesses = Object.entries(game.guesses).sort((a, b) => a[1] - b[1]);
    const low = guesses[0];
    const high = guesses.at(-1);
    if (low && high[1] - low[1] >= 100) {
      game.debate = [low, high];
      enter(game, 'debate', now);
      return;
    }
  }
  reveal(game, now);
}

function advance(game, now, random) {
  switch (game.phase) {
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
      enter(game, 'rating', now);
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
      finishGuessing(game, now);
      break;
    case 'debate':
      reveal(game, now);
      break;
  }
}

function nextTurn(game, now) {
  game.turnIndex++;
  game.guesses = {};
  game.result = null;
  enter(game, game.turnIndex === game.turns.length ? 'finished' : 'guessing', now);
}

export function tick(game, now, random = Math.random) {
  if (game.deadline !== null && now >= game.deadline) advance(game, now, random);
}

export function act(game, { id, isHost, players }, action, now, random = Math.random) {
  tick(game, now, random);
  if (action.step !== game.step) return 'Этап уже закончился. Экран обновлён.';
  if (action.type === 'start' && ['lobby', 'finished'].includes(game.phase)) {
    if (!isHost) return 'Партию запускает хост.';
    if (players.length < limits.minPlayers) return 'Нужно хотя бы три игрока.';
    Object.assign(game, {
      active: players, topics: {}, assigned: {}, ratings: {}, scores: {},
      turns: [], guesses: {}, result: null, notice: '', debate: null, highlight: null,
    });
    enter(game, 'topics', now);
    return;
  }
  if (action.type === 'next' && game.phase === 'reveal' && isHost) {
    nextTurn(game, now);
    return;
  }
  if (action.type === 'reveal' && game.phase === 'debate' && isHost) {
    reveal(game, now);
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
    if (Object.keys(game.topics).length === game.active.length) advance(game, now, random);
    return;
  }

  const isRating = game.phase === 'rating' && action.type === 'rate';
  const isGuess = game.phase === 'guessing' && action.type === 'guess' && id !== game.turns[game.turnIndex];
  if (!isRating && !isGuess) return 'Это действие сейчас недоступно.';
  if (!Number.isInteger(action.value) || Math.abs(action.value) > 100) return 'Выбери число от −100 до +100.';
  const answers = isRating ? game.ratings : game.guesses;
  if (id in answers) return 'Ответ уже принят.';
  answers[id] = action.value;
  if (Object.keys(answers).length === game.active.length - Number(isGuess)) advance(game, now, random);
}

export function view(game, id) {
  const { phase, step, deadline } = game;
  const data = { phase, step, deadline, notice: game.notice, scores: game.scores ?? {} };
  if (phase === 'lobby') return data;
  if (phase === 'finished') return { ...data, highlight: game.highlight };
  data.active = game.active.includes(id);
  if (phase === 'topics' || phase === 'rating') {
    const answers = phase === 'topics' ? game.topics : game.ratings;
    data.done = Object.hasOwn(answers, id);
    data.progress = [Object.keys(answers).length, game.active.length];
    if (phase === 'rating') data.topic = game.assigned[id];
    return data;
  }
  data.subject = game.turns[game.turnIndex];
  data.topic = game.assigned[data.subject];
  data.turn = [game.turnIndex + 1, game.turns.length];
  if (phase === 'reveal') data.result = game.result;
  else if (phase === 'debate') data.debate = game.debate;
  else {
    data.done = Object.hasOwn(game.guesses, id);
    data.progress = [Object.keys(game.guesses).length, game.active.length - 1];
  }
  return data;
}
