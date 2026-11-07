const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function percent(value) {
  return value < 0 ? '−' + Math.abs(value) + '%' : (value > 0 ? '+' : '') + value + '%';
}

function reaction(value) {
  if (value <= -75) return ['against', 'Даже не уговаривайте!'];
  if (value < -15) return ['against', 'Я, пожалуй, пас.'];
  if (value <= 15) return ['neutral', 'Мне норм в обе стороны.'];
  if (value < 75) return ['for', 'Вообще-то мне заходит!'];
  return ['for', 'Да! Где записаться?'];
}

function whyLine(value) {
  if (value <= -75) return 'Почему это так бесит?';
  if (value < -15) return 'Что тут не зашло?';
  if (value <= 15) return 'Почему так ровно?';
  if (value < 75) return 'А что тебе здесь нравится?';
  return 'Почему тебе это так заходит?';
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
  'Друг говорит «я уже выхожу», но ещё дома',
  'Поехать в отпуск вместе и ни разу не поесть вместе',
  'Заказать себе десерт, когда все сказали «мы не будем»',
  'Послать другу голосовое на семь минут без предупреждения',
  'Устроить сюрприз тому, кто терпеть не может сюрпризы',
  'Отдать другу последний кусок пиццы, если он не просил',
];

function surfer() {
  return `<svg class="surfer" viewBox="0 0 92 72" aria-hidden="true" focusable="false">
    <path class="surfboard" d="M8 59Q19 49 53 52Q78 54 86 58Q70 65 39 65Q13 65 8 59Z"/>
    <path class="board-stripe" d="M23 60Q43 56 72 59"/>
    <g class="surfer-calm">
      <path d="M41 30L47 45L61 49M47 43L31 52M44 35L58 40" />
      <circle cx="38" cy="21" r="8"/>
    </g>
    <g class="surfer-crest">
      <path d="M47 28L44 43L31 48L26 56M44 43L60 56M46 31L62 32L74 21M45 31L30 34L20 24"/>
      <circle cx="49" cy="17" r="8"/>
    </g>
    <g class="surfer-ebb">
      <path d="M45 35L55 45L61 53M47 39L34 53M49 41L69 51"/>
      <circle cx="37" cy="29" r="8"/>
    </g>
  </svg>`;
}

export function entrance(code, testBots = false) {
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
        ${testBots && !code ? '<button type="submit" name="mode" value="create-test" class="secondary" formnovalidate>Тест с ботами</button>' : ''}
      </form>
    </section>`;
}

function roster(state, scored = false) {
  const players = scored
    ? state.players.filter(player => player.id in state.scores).sort((a, b) => state.scores[b.id] - state.scores[a.id])
    : state.players;
  return `<ul class="roster">${players.map(({ id, name, left, disconnected }) => `
    <li><span>${escape(name)} ${id === state.me ? '<small>ты</small>' : ''}</span>
    <b>${scored ? state.scores[id] : left ? 'Вышел' : disconnected ? 'Нет связи' : id === state.host ? 'Хост' : 'В комнате'}</b></li>`).join('')}</ul>`;
}

function slider(label, action) {
  return `<form data-form="${action}" class="scale-form">
    <label class="sr-only" for="scale">${label}</label>
    <div class="wave-meter" data-zone="calm">
      <svg class="water-art" viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true">
        <path class="meter-water" d="M0 0Q50 -20 100 0T200 0T300 0T400 0V230H0Z"/>
        <path class="meter-foam" d="M0 0Q50 -20 100 0T200 0T300 0T400 0"/>
      </svg>
      ${surfer()}
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

function receipt(title, message) {
  return `<div class="answer-receipt" role="status"><span aria-hidden="true">✓</span>${surfer()}
    <div><strong>${title}</strong><p>${message}</p></div></div>`;
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
  if (state.display && ['topics', 'rating', 'guessing'].includes(state.phase)) {
    const [title, hint] = {
      topics: ['Придумайте тему', 'Отправьте темы со своих телефонов.'],
      rating: ['Секретные оценки', 'Поставьте отношение к своей теме на телефоне. Оценки пока скрыты.'],
      guessing: ['Как думает ' + nameOf(state.subject) + '?', 'Отметьте догадку на телефоне. Ответы раскроются в финале.'],
    }[state.phase];
    return `<section class="show-card">${surfer()}<h1>${title}</h1>
      ${state.phase === 'guessing' ? '<p class="topic">' + escape(state.topic) + '</p>' : ''}
      <p>${hint}</p></section>`;
  }
  if (state.phase === 'intro') {
    const lines = {
      topics: ['РАЗОГРЕВ', 'А теперь —', 'подкиньте тему!', 'Что расколет вашу компанию на два лагеря?'],
      rating: ['СЕКРЕТНЫЙ ЭТАП', 'А вот и', 'ваши темы!', 'Ставьте честную оценку. Подглядывать нельзя.'],
      guessing: ['ГЛАВНЫЙ ЗАПЛЫВ', 'Как хорошо вы', 'знаете друг друга?', 'Посмотрим, кто попадёт в чужую волну.'],
      winner: ['ФИНАЛ', 'И победил…', 'Так, где барабанщик?', 'Сейчас узнаем, кто поймал волну.'],
    };
    const [label, first, second, caption] = lines[state.nextPhase];
    return `<section class="show-card">${surfer()}${kicker(label)}
      <h1>${first}<br><em>${second}</em></h1><p>${caption}</p></section>`;
  }
  if (state.phase === 'recap-why') {
    const { card } = state;
    return `<section class="show-card finale-scene why-scene">
      ${surfer()}${kicker('ПОДОЖДИТЕ-КА')}
      <h1>А <em>почему?</em></h1>
      <p class="why-topic">«${escape(card.topic)}» · ${percent(card.rating)}</p>
      <p class="why-question">${nameOf(card.subject)}, ${whyLine(card.rating).toLowerCase()}</p>
      ${state.host === state.me ? button('Ладно, дальше!', 'next-recap') : ''}
    </section>`;
  }
  if (state.phase === 'recap') {
    const { card } = state;
    const [tone, line] = reaction(card.rating);
    return `${kicker('ФИНАЛ · КАРТОЧКА ' + state.turn.join(' / '))}
      <h1>Вот как думает <em>${nameOf(card.subject)}</em></h1>
      <section class="reaction-card" data-tone="${tone}">
        <p class="reaction-topic">«${escape(card.topic)}»</p>
        <p class="reaction-line">${line}</p>
        <strong>${percent(card.rating)}</strong>
      </section>
        ${recap(card, nameOf, false)}
        ${state.host === state.me ? button(state.turn[0] === state.turn[1] ? 'Объявить победителя' : 'Следующая карточка', 'next-recap')
          : waiting('Хост перелистнёт, когда все договорят.')}`;
  }
  if (state.phase === 'lobby') {
    return `${kicker('ЛОББИ · ' + state.players.filter(player => !player.disconnected).length + ' / 10')}
      <h1>Собираем<br><em>компанию</em></h1>
      <p class="lede">Отправь друзьям код или ссылку. Для старта нужно минимум три игрока.</p>
      <details class="rules"><summary>Как играть · 5–10 минут</summary>
        <ol><li>Каждый пишет тему. Получив случайную тему, тайно ставит отношение от −100% до +100%.</li>
        <li>На телефоне угадывайте оценку друга. Ближайшая догадка приносит очко, при равенстве — каждому из ближайших.</li>
        <li>В финале открываются ответы и победитель. Темы и оценки держите в секрете.</li></ol>
      </details>
      <section class="invite"><strong>${state.code}</strong>${button('Скопировать ссылку', 'copy')}</section>
      <input id="invite-link" class="invite-link" aria-label="Ссылка на комнату" readonly>
      ${roster(state)}
      ${state.notice ? waiting(escape(state.notice)) : ''}
      ${state.host === state.me && state.players.filter(player => !player.disconnected).length >= 3 ? button('Начать игру', 'start') : waiting('Ждём старта партии.')}`;
  }
  if (state.phase === 'winner') {
    const winners = state.winners.map(nameOf);
    return `<section class="show-card finale-scene">
      <div class="winner-stage">
        ${winners.length ? '<div class="confetti" aria-hidden="true">' + '<i></i>'.repeat(12) + '</div>' : ''}
        <div class="winner-card">
          <p>${winners.length > 1 ? 'Поймали волну' : winners.length ? 'Поймал волну' : 'Партия окончена'}</p>
          <h1>${winners.length ? winners.join(' · ') : 'Волна унесла все очки'}</h1>
        </div>
      </div>
      ${state.host === state.me ? button('Момент партии', 'next-finale') : ''}
    </section>`;
  }
  if (state.phase === 'moment') {
    const { topic, subject, average, rating } = state.highlight;
    return `<section class="show-card finale-scene">
      ${surfer()}${kicker('МОМЕНТ ПАРТИИ')}
      <h1>«${escape(topic)}»</h1>
      <div class="moment-pair">
        ${average === null ? '' : `<p>Друзья думали<strong>${percent(average)}</strong></p>`}
        <p>${nameOf(subject)} на самом деле<strong>${percent(rating)}</strong></p>
      </div>
      ${state.host === state.me ? button('Послесловие', 'next-finale') : ''}
    </section>`;
  }
  if (state.phase === 'finished') {
    return `${kicker('ПОСЛЕСЛОВИЕ')}<h1>После <em>волны</em></h1>
      ${state.host === state.me ? button('Сыграть ещё', 'start') : waiting('Хост может начать новую партию.')}
      <section class="final-lineup">
      <h2>Таблица результатов</h2>
      ${roster(state, true)}
      <h2>Что было на самом деле</h2>
      <div class="recap-deck">${state.results.map((result, i) => `<details class="recap-card">
        <summary><span>Ход ${i + 1} · ${nameOf(result.subject)}</span><strong>${percent(result.rating)}</strong>
          <span class="recap-topic">«${escape(result.topic)}»</span></summary>
        ${recap(result, nameOf)}
      </details>`).join('')}</div>
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
      ${receipt('Догадки под замком', 'Все ответы откроются в финале.')}`;
  }
  if (!state.active) {
    return `${kicker('ПАРТИЯ ИДЁТ')}<h1>Смотри <em>раунд</em></h1>${waiting('Ты сможешь сыграть в следующей партии.')}`;
  }
  if (state.phase === 'rating') {
    return `${kicker('02 / ТАЙНАЯ ОЦЕНКА')}<h1>Как ты к этому <em>относишься?</em></h1>
      <p class="topic">${escape(state.topic)}</p>
      ${state.done ? receipt('Оценка на борту!', 'Ждём, пока остальные поймают волну.') : slider('Твоё отношение', 'rate')}`;
  }
  const turn = state.turn.join(' / ');
  const topic = `<p class="topic">${escape(state.topic)}</p>`;
  return `${kicker('03 / УГАДЫВАНИЕ · ' + turn)}
      <h1>Какую оценку поставил игрок <em>${nameOf(state.subject)}</em>?</h1>${topic}
      ${state.subject === state.me ? waiting('Сейчас угадывают твою оценку.') :
        state.done ? receipt('Догадка под замком!', 'Пока держим интригу.') : slider('Твоя догадка', 'guess')}`;
}

function recap({ rating, guesses, winners, debate }, nameOf, detailed = true) {
  return `${detailed ? revealScale(rating, guesses, winners) : ''}
    ${guesses.length ? `<ul class="recap-guesses">${guesses.map(({ playerId, value, distance }) =>
      `<li${winners.includes(playerId) ? ' class="recap-hit"' : ''}><span>${nameOf(playerId)}</span><strong>${percent(value)}</strong>
      ${detailed ? `<small>Мимо на ${distance} п. п.</small>` : ''}
      ${winners.includes(playerId) ? '<small>Ближе всех</small>' : ''}</li>`).join('')}</ul>` : waiting('В этом ходу догадок не было.')}
    ${debate ? `<aside class="why-card"><strong>Разные берега</strong>
      <p>${nameOf(debate[0].playerId)} — ${percent(debate[0].value)}, а ${nameOf(debate[1].playerId)} — ${percent(debate[1].value)}. Кто как рассуждал?</p></aside>` : ''}`;
}

export function roomScreen(state) {
  if (state.spectator) return '<section class="panel round"><section class="round-status"><span id="progress"></span></section><h1>Партия уже идёт</h1><p class="waiting">Ты вернулся после начала новой партии. Дождись финала, чтобы присоединиться к следующей.</p></section>';
  return `<section class="panel round">
    <section class="round-status" aria-label="Время и готовность">
      <span id="progress"></span>
      ${state.deadline !== null && !['sealed', 'intro'].includes(state.phase) ? `
        <div class="round-clock">
          <span class="clock-face" aria-hidden="true"><span class="clock-hand"></span></span>
          <span class="clock-readout"><small>ДО КОНЦА ХОДА</small><time id="timer" role="timer"></time></span>
        </div>` : ''}
    </section>
    ${roundScreen(state)}
  </section>`;
}
