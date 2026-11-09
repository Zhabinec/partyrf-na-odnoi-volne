import { randomUUID } from 'node:crypto';
import { act } from './game.mjs';

export const testBotsEnabled = process.env.TEST_BOTS !== '0';
const profiles = [
  { name: 'Бот Буй', topic: 'Пицца с ананасом на всех', rating: -83 },
  { name: 'Бот Пена', topic: 'Отпуск по расписанию', rating: 42 },
  { name: 'Бот Риф', topic: 'Голосовое на семь минут', rating: 96 },
  { name: 'Бот Прибой', topic: 'Плавать в море ночью', rating: 65 },
  { name: 'Бот Чайка', topic: 'Мокрые кеды после пляжа', rating: -35 },
];

export function addTestBots(room) {
  room.testBots = profiles.map(profile => {
    const bot = { ...profile, id: randomUUID() };
    room.members.set(randomUUID(), { id: bot.id, name: bot.name, isBot: true });
    return bot;
  });
}

export function runTestBots(room, now) {
  const { game, testBots } = room;
  if (!testBots || !['topics', 'rating', 'guessing'].includes(game.phase)) return;
  const { phase, step } = game;
  const subject = game.turns[game.turnIndex];
  const players = [...room.members.values()].map(player => player.id);
  for (const bot of testBots) {
    if (game.step !== step) break;
    if (!game.active.includes(bot.id)) continue;
    let action;
    if (phase === 'topics' && !Object.hasOwn(game.topics, bot.id)) {
      const taken = Object.values(game.topics).some(topic => topic.toLowerCase() === bot.topic.toLowerCase());
      action = { type: 'topic', value: taken ? bot.topic + ' (версия бота)' : bot.topic };
    } else if (phase === 'rating' && !Object.hasOwn(game.ratings, bot.id)) {
      action = { type: 'rate', value: bot.rating };
    } else if (phase === 'guessing' && bot.id !== subject && !Object.hasOwn(game.guesses, bot.id)) {
      action = { type: 'guess', value: ((bot.rating + 100 + game.turnIndex * 43) % 201) - 100 };
    }
    if (action) act(game, { id: bot.id, isHost: false, players }, { ...action, step }, now);
  }
}
