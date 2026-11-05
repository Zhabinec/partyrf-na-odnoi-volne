const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function percent(value) {
  return value < 0 ? '−' + Math.abs(value) + '%' : (value > 0 ? '+' : '') + value + '%';
}

const button = (label, action) => `<button type="button" data-action="${action}">${label}</button>`;
const kicker = text => `<p class="kicker">${text}</p>`;

export function entrance(code) {
  return `
    <section class="intro">
      ${kicker('03–10 ИГРОКОВ / ОНЛАЙН')}
      <h1>На одной<br><em>волне</em></h1>
      <p class="lede">Ты знаешь, что думают твои друзья? Проверь по шкале от −100% до +100%.</p>
      <ol class="beats"><li>Предложи тему</li><li>Поставь оценку</li><li>Угадай друзей</li></ol>
    </section>
    <section class="panel entry">
      ${kicker('ТОЧКА ВХОДА')}
      <h2>${code ? 'Тебя ждут в комнате' : 'Собираем компанию'}</h2>
      <form data-form="entry">
        <label for="name">Твоё имя</label>
        <input id="name" name="name" maxlength="24" required autocomplete="nickname" placeholder="Например, Саша">
        <label for="code">Код комнаты</label>
        <input id="code" class="room-code" name="code" maxlength="6" value="${escape(code)}" placeholder="Введи код друга" autocomplete="off" autocapitalize="characters">
        <button type="submit" name="mode" value="join">Войти в комнату</button>
        ${code ? '' : '<button type="submit" name="mode" value="create" class="secondary">Создать комнату</button>'}
      </form>
    </section>`;
}

function roster(state, scored = false) {
  const players = scored
    ? state.players.filter(player => player.id in state.scores).sort((a, b) => state.scores[b.id] - state.scores[a.id])
    : state.players;
  return `<ul class="roster">${players.map(({ id, name }) => `
    <li><span>${escape(name)} ${id === state.me ? '<small>ты</small>' : ''}</span>
    <b>${scored ? state.scores[id] : id === state.host ? 'Хост' : 'В комнате'}</b></li>`).join('')}</ul>`;
}

function slider(label, action) {
  return `<form data-form="${action}" class="scale-form">
    <label class="sr-only" for="scale">${label}</label>
    <output for="scale" id="reading">0%</output>
    <input id="scale" name="value" type="range" min="-100" max="100" value="0" aria-valuetext="0%">
    <p class="ends"><span>−100%<small>Против</small></span><span>0%<small>Нейтрально</small></span><span>+100%<small>За</small></span></p>
    <button type="submit">Зафиксировать ${action === 'rate' ? 'оценку' : 'догадку'}</button>
  </form>`;
}

function waiting(message) {
  return `<p class="waiting">${message}</p>`;
}

function roundScreen(state) {
  const nameOf = id => escape(state.players.find(player => player.id === id)?.name ?? 'Игрок');
  if (state.phase === 'lobby') {
    return `${kicker('ЛОББИ · ' + state.players.length + ' / 10')}
      <h1>Собираем<br><em>компанию</em></h1>
      <p class="lede">Отправь друзьям код или ссылку. Для старта нужно минимум три игрока.</p>
      <section class="invite"><strong>${state.code}</strong>${button('Скопировать ссылку', 'copy')}</section>
      <input id="invite-link" class="invite-link" aria-label="Ссылка на комнату" readonly>
      ${roster(state)}
      ${state.notice ? waiting(escape(state.notice)) : ''}
      ${state.host === state.me && state.players.length >= 3 ? button('Начать игру', 'start') : waiting('Ждём старта партии.')}`;
  }
  if (state.phase === 'finished') {
    const best = Math.max(...Object.values(state.scores));
    const winners = Object.keys(state.scores).filter(id => state.scores[id] === best).map(nameOf);
    return `${kicker('ФИНАЛ')}<h1>${best ? 'На одной <em>волне!</em>' : 'Партия окончена'}</h1>
      <p class="lede">${best ? (winners.length > 1 ? 'Победители — ' : 'Победитель — ') + winners.join(', ') : 'В этой партии никто не набрал очков.'}</p>
      ${roster(state, true)}${state.host === state.me ? button('Сыграть ещё', 'start') : waiting('Хост может начать новую партию.')}`;
  }
  if (state.phase === 'topics') {
    return `${kicker('01 / ТЕМЫ')}<h1>О чём <em>поговорим?</em></h1>
      <p class="lede">Напиши одну тему. Она случайно достанется кому-то в комнате.</p>
      ${state.done ? waiting('Тема принята. Ждём остальных.') : `
      <form data-form="topic"><label for="topic">Твоя тема</label>
        <input id="topic" name="value" maxlength="72" required placeholder="Например, деньги, караоке или ранние подъёмы">
        <button type="submit">Отправить тему</button>
      </form>`}`;
  }
  if (!state.active && state.phase !== 'reveal') {
    return `${kicker('ПАРТИЯ ИДЁТ')}<h1>Смотри <em>раунд</em></h1>${waiting('Ты сможешь сыграть в следующей партии.')}`;
  }
  if (state.phase === 'rating') {
    return `${kicker('02 / ТАЙНАЯ ОЦЕНКА')}<h1>Как ты к этому <em>относишься?</em></h1>
      <p class="topic">${escape(state.topic)}</p>
      ${state.done ? waiting('Оценка принята. Ждём остальных.') : slider('Твоё отношение', 'rate')}`;
  }
  const turn = state.turn.join(' / ');
  const topic = `<p class="topic">${escape(state.topic)}</p>`;
  if (state.phase === 'guessing') {
    return `${kicker('03 / УГАДЫВАНИЕ · ' + turn)}
      <h1>Какую оценку поставил игрок <em>${nameOf(state.subject)}</em>?</h1>${topic}
      ${state.subject === state.me ? waiting('Сейчас угадывают твою оценку.') :
        state.done ? waiting('Догадка принята. Ждём раскрытия.') : slider('Твоя догадка', 'guess')}`;
  }
  const { rating, guesses, winners } = state.result;
  return `${kicker('РАСКРЫТИЕ · ' + turn)}<h1>Ответ игрока <em>${nameOf(state.subject)}</em></h1>${topic}
    <strong class="reveal-value">${percent(rating)}</strong>
    ${guesses.length ? `<ul class="roster">${guesses.map(({ playerId, value, distance }) =>
      `<li><span>${nameOf(playerId)} <small>${percent(value)} · ошибка ${distance} п. п.</small></span>
      <b>${winners.includes(playerId) ? '+1 очко' : ''}</b></li>`).join('')}</ul>` : waiting('В этом ходу догадок не было.')}
    ${state.host === state.me ? button(state.turn[0] === state.turn[1] ? 'Показать итог' : 'Следующий игрок', 'next') : waiting('Ждём следующего хода.')}`;
}

export function roomScreen(state) {
  return `<section class="panel round">
    <section class="round-status" aria-label="Время и готовность"><span id="progress"></span><time id="timer"></time></section>
    ${roundScreen(state)}
  </section>`;
}
