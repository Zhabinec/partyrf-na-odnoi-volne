import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,tick} from '../src/game.mjs';

test('equally close guesses each earn exactly one point',()=>{
 const game=newGame();let now=0;const players=['a','b','c'];
 const send=(id,type,value)=>assert.equal(act(game,{id,isHost:id==='a',players},{type,value,step:game.step},now),undefined);
 send('a','start');now=game.deadline;tick(game,now);
 for(const id of players)send(id,'topic','Тема '+id);
 now=game.deadline;tick(game,now);
 for(const id of players)send(id,'rate',50);
 now=game.deadline;tick(game,now);
 const subject=game.turns[game.turnIndex];const others=players.filter(id=>id!==subject);
 send(others[0],'guess',40);send(others[1],'guess',60);
 assert.deepEqual(game.scores,Object.fromEntries(players.map(id=>[id,id===subject?0:1])));
 assert.deepEqual(new Set(game.results[0].winners),new Set(others));
});
