const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function percent(value) {
  return value < 0 ? '−' + Math.abs(value) + '%' : (value > 0 ? '+' : '') + value + '%';
}

const button = (label, action) => `<button type="button" data-action="${action}">${label}</button>`;
const kicker = text => `<p class="kicker">${text}</p>`;

export const situations = [
  'Друг просит скинуть ему 47 ₽ за такси',
  'Отпуск с друзьями по расписанию',
  'Заказать одну пиццу с ананасом на всех',
  'Прийти на вечеринку на час раньше',
  'Слушать голосовые на двойной скорости',
  'Петь в караоке песню, которую знаешь только по припеву',
  'Смотреть финал сериала без друга, с которым начал',
  'Уйти с вечеринки по-английски',
  'Делить счёт поровну, когда ты заказал только чай',
  'Поехать на выходные в случайный город',
  'Включить общий плейлист и дать всем по одному треку',
  'Принести на день рождения еду вместо подарка',
];

export function entrance(code) {
  return `
    <section class="intro">
      <svg class="surf-art" viewBox="0 0 580 320" aria-hidden="true" focusable="false">
        <circle class="surf-sun" cx="438" cy="111" r="76"/>
        <path class="surf-swell" d="M0 259C122 256 179 231 252 153S440 35 495 116C443 88 391 114 408 151C433 203 518 167 580 127V320H0Z"/>
        <path class="surf-foam" d="M0 278C146 267 201 223 273 151S435 63 495 116M224 280C332 223 370 197 426 203S510 222 580 172M358 283C448 240 512 255 580 214"/>
      </svg>
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
    <div class="wave-meter">
      <svg viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true">
        <path class="meter-water" d="M0 0Q50 -20 100 0T200 0T300 0T400 0V230H0Z"/>
      </svg>
      <output for="scale" id="reading">0%</output>
    </div>
    <input id="scale" name="value" type="range" min="-100" max="100" value="0" aria-valuetext="0%">
    <p class="ends"><span>−100%<small>Против</small></span><span>0%<small>Нейтрально</small></span><span>+100%<small>За</small></span></p>
    <p class="host-line" id="host-line">Прямо посередине? Дипломатично.</p>
    <button type="submit">Зафиксировать ${action === 'rate' ? 'оценку' : 'догадку'}</button>
  </form>`;
}

function waiting(message) {
  return `<p class="waiting">${message}</p>`;
}

function revealScale(rating, guesses, winners) {
  const position = value => 20 + (value + 100) * 1.8;
  const winningValues = new Set(guesses.filter(guess => winners.includes(guess.playerId)).map(guess => guess.value));
  const values = [...new Set(guesses.map(guess => guess.value))];
  const answer = position(rating);
  return `<figure class="reveal-scale" aria-label="Догадки и настоящий ответ на шкале">
    <svg viewBox="0 0 400 52" aria-hidden="true">
      <path class="reveal-rail" d="M20 31H380 M200 25V37"/>
      ${values.map(value => `<circle class="guess-marker${winningValues.has(value) ? ' closest' : ''}" cx="${position(value)}" cy="31" r="5"/>`).join('')}
      <g class="answer-marker">
        <path d="M${answer} 10v35"/>
        <circle cx="${answer}" cy="31" r="9"/>
      </g>
    </svg>
    <figcaption><span>−100%</span><span>0%</span><span>+100%</span></figcaption>
    <p class="scale-key"><span>● Догадки</span><span>◎ Настоящий ответ</span></p>
  </figure>`;
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
    return `${kicker('ФИНАЛ')}<h1>Кто поймал <em>волну?</em></h1>
      <section class="winner-stage">
        ${best ? '<div class="confetti" aria-hidden="true">' + '<i></i>'.repeat(12) + '</div>' : ''}
        <p class="drum-caption" aria-hidden="true">Бр-р-р-р…</p>
        <div class="winner-card">
          <p>${best ? (winners.length > 1 ? 'Делят победу' : 'Победитель') : 'Партия окончена'}</p>
          <h2>${best ? winners.join(', ') : 'Волна унесла все очки'}</h2>
          ${best ? `<p>Счёт: ${best}</p>` : ''}
        </div>
      </section>
      <section class="final-lineup">
      <h2>Таблица результатов</h2>
      ${roster(state, true)}
      ${state.highlight ? `<aside class="why-card">
        <strong>Момент партии</strong>
        <p>«${escape(state.highlight.topic)}»</p>
        <p>Средняя догадка — ${percent(state.highlight.average)}. Оценка игрока ${nameOf(state.highlight.subject)} — ${percent(state.highlight.rating)}.</p>
      </aside>` : ''}
      <h2>Что было на самом деле</h2>
      <div class="recap-deck">${state.results.map((result, i) => `<details class="recap-card">
        <summary><span>Ход ${i + 1} · ${nameOf(result.subject)}</span><strong>${percent(result.rating)}</strong>
          <span class="recap-topic">«${escape(result.topic)}»</span></summary>
        ${recap(result, nameOf, state.me)}
      </details>`).join('')}</div>
      ${state.host === state.me ? button('Сыграть ещё', 'start') : waiting('Хост может начать новую партию.')}
      </section>`;
  }
  if (state.phase === 'topics') {
    return `${kicker('01 / ТЕМЫ')}<h1>О чём <em>поговорим?</em></h1>
      <p class="lede">Напиши одну тему. Она случайно достанется кому-то в комнате.</p>
      ${state.done ? waiting('Тема принята. Ждём остальных.') : `
      <form data-form="topic"><label for="topic">Твоя тема</label>
        <input id="topic" name="value" maxlength="72" required placeholder="Например, деньги, караоке или ранние подъёмы">
        <button type="button" class="secondary" data-action="suggest">Подкинь ситуацию</button>
        <button type="submit">Отправить тему</button>
      </form>`}`;
  }
  if (state.phase === 'sealed') {
    return `${kicker('ХОД ' + state.turn.join(' / '))}<h1>Всё, <em>запечатали!</em></h1>
      <p class="lede">Догадки записаны. Все ответы откроются в финале.</p>`;
  }
  if (!state.active) {
    return `${kicker('ПАРТИЯ ИДЁТ')}<h1>Смотри <em>раунд</em></h1>${waiting('Ты сможешь сыграть в следующей партии.')}`;
  }
  if (state.phase === 'rating') {
    return `${kicker('02 / ТАЙНАЯ ОЦЕНКА')}<h1>Как ты к этому <em>относишься?</em></h1>
      <p class="topic">${escape(state.topic)}</p>
      ${state.done ? waiting('Оценка принята. Ждём остальных.') : slider('Твоё отношение', 'rate')}`;
  }
  const turn = state.turn.join(' / ');
  const topic = `<p class="topic">${escape(state.topic)}</p>`;
  return `${kicker('03 / УГАДЫВАНИЕ · ' + turn)}
      <h1>Какую оценку поставил игрок <em>${nameOf(state.subject)}</em>?</h1>${topic}
      ${state.subject === state.me ? waiting('Сейчас угадывают твою оценку.') :
        state.done ? waiting('Догадка принята. Пока держим интригу.') : slider('Твоя догадка', 'guess')}`;
}

function recap({ subject, rating, guesses, winners, askWhy, debate }, nameOf, me) {
  return `${revealScale(rating, guesses, winners)}
    ${guesses.length ? `<ul class="roster">${guesses.map(({ playerId, value, distance }) =>
      `<li${winners.includes(playerId) ? ' class="round-winner"' : ''}><span>${nameOf(playerId)} <small>${percent(value)} · ошибка ${distance} п. п.</small></span>
      <b>${winners.includes(playerId) ? '+1 очко' : ''}</b></li>`).join('')}</ul>` : waiting('В этом ходу догадок не было.')}
    ${askWhy ? `<aside class="why-card">
      <strong>А почему?</strong>
      <p>${subject === me
        ? 'Расскажи компании, почему ты поставил именно такую оценку.'
        : `${nameOf(subject)}, расскажи, почему именно такая оценка!`}</p>
    </aside>` : ''}
    ${debate ? `<aside class="why-card"><strong>Разные берега</strong>
      <p>${nameOf(debate[0].playerId)} — ${percent(debate[0].value)}, а ${nameOf(debate[1].playerId)} — ${percent(debate[1].value)}. Кто как рассуждал?</p></aside>` : ''}`;
}

export function roomScreen(state) {
  return `<section class="panel round">
    <section class="round-status" aria-label="Время и готовность">
      <span id="progress"></span>
      ${state.deadline !== null && state.phase !== 'sealed' ? `
        <div class="round-clock">
          <span class="clock-face" aria-hidden="true"><span class="clock-hand"></span></span>
          <span class="clock-readout"><small>ДО КОНЦА ХОДА</small><time id="timer" role="timer"></time></span>
        </div>` : ''}
    </section>
    ${roundScreen(state)}
  </section>`;
}
