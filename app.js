
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const ASSET = {
  0:'assets/swap0.png',
  1:'assets/card1.svg',
  2:'assets/card2.svg',
  3:'assets/koi3.png',
  4:'assets/tree4.png',
  5:'assets/cactus5.png',
  6:'assets/card6.svg',
  7:'assets/spy7.png',
  8:'assets/peek8.png',
  9:'assets/aurora9.png',
  10:'assets/card10.svg',
  11:'assets/card11.svg',
  12:'assets/card12.svg',
  13:'assets/card13.svg'
};
const BACK='assets/card-back-gold.png';
const COLORS=['#39e8ff','#bd63ff','#ff9a24','#ff4bb3'];
const BOT_NAMES=['Luna','Orion','Nova'];
const SPECIAL = {7:'peek',8:'peek',9:'spy',10:'spy',11:'swap',12:'swap'};

let audioCtx, masterGain, ambientOsc=[], soundOn=true, musicOn=true;
function ensureAudio(){
  if(audioCtx) return;
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  masterGain=audioCtx.createGain(); masterGain.gain.value=.045; masterGain.connect(audioCtx.destination);
  const freqs=[55,82.41,110];
  freqs.forEach((f,i)=>{
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=i===0?'sine':'triangle'; o.frequency.value=f; g.gain.value=i===0?.18:.06;
    o.connect(g); g.connect(masterGain); o.start(); ambientOsc.push(o);
  });
}
function beep(freq=440,d=.08,type='sine',gain=.08){
  if(!soundOn) return; ensureAudio();
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=freq;g.gain.value=gain;
  o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.stop(audioCtx.currentTime+d);
}
function setMusic(v){musicOn=v;ensureAudio(); masterGain.gain.value=musicOn?($('#volume').value/100)*.08:0; $('#pauseBtn').textContent=musicOn?'Ⅱ':'▶'}

let state={
  players:[], deck:[], discard:[], current:0, round:1, maxRounds:10,
  phase:'lobby', drawn:null, calledBy:null, finalTurnsLeft:null, selected:null,
  pendingSpecial:null, room:'K7DF9'
};

function makeDeck(){
  let d=[];
  for(let v=0;v<=13;v++){
    let copies=4;
    for(let i=0;i<copies;i++) d.push({id:`${v}-${i}-${Math.random()}`,value:v});
  }
  for(let i=d.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]}
  return d;
}
function cardImg(card, visible=true){ return visible?ASSET[card.value]:BACK; }
function sumHand(p){ return p.hand.reduce((a,c)=>a+c.value,0); }

function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>el.classList.remove('show'),1400)}
function log(msg){const el=$('#gameLog');const row=document.createElement('div');row.className='log-entry';row.innerHTML=msg;el.prepend(row)}
function roomCode(){return Math.random().toString(36).slice(2,7).toUpperCase()}

function setupPlayers(count,name){
  state.players=[{name:name||'You',human:true,score:0,hand:[],memory:new Set()}];
  for(let i=0;i<count-1;i++) state.players.push({name:BOT_NAMES[i],human:false,score:0,hand:[],memory:new Set()});
  state.room=roomCode(); $('#roomCode').textContent=state.room; $('#playersMeta').textContent=`${count} / ${count}`; $('#youName').textContent=state.players[0].name;
}
function dealRound(){
  state.deck=makeDeck();state.discard=[];state.current=0;state.drawn=null;state.selected=null;state.calledBy=null;state.finalTurnsLeft=null;state.pendingSpecial=null;state.phase='opening';
  state.players.forEach(p=>{p.hand=[];p.memory=new Set();for(let i=0;i<4;i++)p.hand.push(state.deck.pop())});
  state.discard.push(state.deck.pop());
  // Bots remember two random starting cards.
  state.players.slice(1).forEach(p=>{p.memory.add(0);p.memory.add(1)});
  renderAll(); showOpeningPeek();
}
function startGame(count,name){
  setupPlayers(count,name); state.round=1; state.players.forEach(p=>p.score=0);
  $('#lobbyScreen').classList.add('hidden');$('#gameUI').classList.remove('hidden'); ensureAudio(); setMusic(true); dealRound();
}
function renderAll(){renderScores();renderOpponents();renderHand();renderPiles();renderTurn();$('#roundNum').textContent=state.round}
function renderScores(){
  $('#scoreRows').innerHTML=state.players.map((p,i)=>`<div class="score-row ${i===0?'you':''}"><span class="dot" style="background:${COLORS[i]}"></span><span>${p.name}</span><b>${p.score}</b></div>`).join('');
}
function opponentPosition(i){
  if(state.players.length===2) return 'top-player';
  if(state.players.length===3) return i===1?'left-player':'right-player';
  return i===1?'top-player':i===2?'right-player':'left-player';
}
function renderOpponents(){
  const wrap=$('#opponents');wrap.innerHTML='';
  state.players.forEach((p,i)=>{
    if(i===0)return;
    const el=document.createElement('div');el.className=`player ${opponentPosition(i)} ${state.current===i?'active-turn':''}`;el.style.color=COLORS[i];
    const cards=p.hand.map(()=>`<img src="${BACK}" alt="Hidden card">`).join('');
    el.innerHTML=`<div class="avatar">${p.name[0]}</div><div class="name">${p.name}</div><div class="badge">${sumHand(p)}</div><div class="opponent-cards">${cards}</div>`;
    wrap.appendChild(el);
  });
}
function renderHand(){
  const hand=$('#hand');hand.innerHTML='';
  const p=state.players[0];
  p.hand.forEach((c,i)=>{
    const btn=document.createElement('button');btn.className='card-button';
    if(state.selected===i)btn.classList.add('selected');
    if(p.memory.has(i))btn.classList.add('memory');
    const visible=state.phase==='reveal' || p.memory.has(i);
    btn.innerHTML=`<img src="${cardImg(c,visible)}" alt="Card ${visible?c.value:'hidden'}">`;
    btn.onclick=()=>humanCardClick(i);
    hand.appendChild(btn);
  });
}
function renderPiles(){
  $('#discardImg').src=cardImg(state.discard[state.discard.length-1],true);
}
function renderTurn(){
  const human=state.current===0;
  $('#turnTitle').textContent=human?'◷ YOUR TURN':`◷ ${state.players[state.current]?.name||''}'S TURN`;
  let t='Wait for your turn.';
  if(human && state.phase==='turn') t=state.drawn?'Choose one of your cards to replace.':'Draw from the deck or discard pile.';
  if(state.phase==='special') t='Resolve your special action.';
  if(state.calledBy!==null) t=`${state.players[state.calledBy].name} called CABO — final turns.`;
  $('#turnText').textContent=t;
  $('#callBtn').disabled=!human || state.phase!=='turn' || !!state.drawn || state.calledBy!==null;
  $('#callHint').textContent=state.calledBy!==null?'Final turn in progress':human?'You can call Cabo before drawing.':'Watch the other players.';
}
function showOpeningPeek(){
  const o=$('#peekOverlay');o.classList.remove('hidden');const g=$('#peekCards');g.innerHTML='';
  state.players[0].hand.forEach((c,i)=>{
    const b=document.createElement('button');b.className='peek-card';b.dataset.i=i;b.innerHTML=`<img src="${BACK}">`;
    b.onclick=()=>selectOpening(i,b);g.appendChild(b);
  });
  $('#peekCount').textContent='0 / 2 selected';$('#confirmPeek').disabled=true;
}
let openingSelected=[];
function selectOpening(i,b){
  if(openingSelected.includes(i)){openingSelected=openingSelected.filter(x=>x!==i);b.classList.remove('selected');b.querySelector('img').src=BACK}
  else if(openingSelected.length<2){openingSelected.push(i);b.classList.add('selected');b.querySelector('img').src=ASSET[state.players[0].hand[i].value];beep(650,.08,'triangle',.06)}
  $('#peekCount').textContent=`${openingSelected.length} / 2 selected`;$('#confirmPeek').disabled=openingSelected.length!==2;
}
$('#confirmPeek').onclick=()=>{
  openingSelected.forEach(i=>state.players[0].memory.add(i));openingSelected=[];$('#peekOverlay').classList.add('hidden');state.phase='turn';log('<strong>Round begins.</strong> Everyone memorized two cards.');renderAll();toast('Your turn');
};

function drawFrom(source){
  if(state.current!==0||state.phase!=='turn'||state.drawn)return;
  beep(source==='deck'?420:520,.08,'triangle',.07);
  if(source==='deck'){
    if(!state.deck.length) reshuffle();
    state.drawn=state.deck.pop(); log(`<strong>${state.players[0].name}</strong> drew from the deck.`);
  }else{
    state.drawn=state.discard.pop(); log(`<strong>${state.players[0].name}</strong> took the discard.`);
  }
  state.phase='replace';
  showDrawn();
  renderTurn();
}
function showDrawn(){
  const c=state.drawn;toast(`Drawn: ${c.value}${SPECIAL[c.value]?` · ${SPECIAL[c.value].toUpperCase()}`:''}`);
  $('#discardImg').src=ASSET[c.value];
}
function humanCardClick(i){
  if(state.phase==='replace' && state.drawn){
    state.selected=i;renderHand();
    setTimeout(()=>replaceHuman(i),140);
  }
}
function replaceHuman(i){
  const p=state.players[0];const old=p.hand[i];p.hand[i]=state.drawn;state.discard.push(old);p.memory.delete(i);p.memory.add(i);
  const special=SPECIAL[state.drawn.value];const used=state.drawn;state.drawn=null;state.selected=null;state.phase='turn';
  log(`<strong>${p.name}</strong> replaced a card.`);
  beep(300,.09,'sine',.08);renderAll();
  if(special){state.pendingSpecial=special;openSpecial(special,used)}
  else endTurn();
}
function discardDrawnForPower(){
  const c=state.drawn;state.discard.push(c);state.drawn=null;const sp=SPECIAL[c.value];state.pendingSpecial=sp;renderPiles();
  if(sp)openSpecial(sp,c); else endTurn();
}
function openSpecial(type,card){
  state.phase='special';const ov=$('#actionOverlay');ov.classList.remove('hidden');
  $('#actionKicker').textContent=`${type.toUpperCase()} · CARD ${card.value}`;
  $('#actionTitle').textContent=type==='peek'?'Peek at one of your cards':type==='spy'?'Spy on an opponent':'Swap one of your cards';
  $('#actionHelp').textContent=type==='peek'?'Choose a hidden card to reveal briefly.':type==='spy'?'Choose one opponent card to reveal briefly.':'Choose your card first, then an opponent card.';
  renderSpecialChoices(type);
  $$('.action-btn').forEach(b=>b.classList.toggle('available',b.dataset.action===type));
}
function renderSpecialChoices(type){
  const box=$('#actionChoices');box.innerHTML='';
  if(type==='peek'){
    state.players[0].hand.forEach((c,i)=>box.appendChild(choiceBtn(BACK,`Your card ${i+1}`,()=>resolvePeek(i))));
  }else if(type==='spy'){
    state.players.forEach((p,pi)=>{if(pi===0)return;p.hand.forEach((c,ci)=>box.appendChild(choiceBtn(BACK,`${p.name} · ${ci+1}`,()=>resolveSpy(pi,ci))))});
  }else{
    state.players[0].hand.forEach((c,i)=>box.appendChild(choiceBtn(BACK,`Your ${i+1}`,()=>chooseSwapMine(i))));
  }
}
function choiceBtn(src,label,fn){const b=document.createElement('button');b.className='choice-card';b.innerHTML=`<img src="${src}"><span>${label}</span>`;b.onclick=fn;return b}
function resolvePeek(i){
  const c=state.players[0].hand[i];const btn=$$('#actionChoices .choice-card')[i];btn.querySelector('img').src=ASSET[c.value];state.players[0].memory.add(i);beep(760,.12,'triangle',.07);
  setTimeout(closeSpecial,1100);log(`<strong>${state.players[0].name}</strong> used Peek.`);
}
function resolveSpy(pi,ci){
  const buttons=$$('#actionChoices .choice-card');let idx=0;for(let p=1;p<pi;p++)idx+=state.players[p].hand.length;idx+=ci;
  buttons[idx].querySelector('img').src=ASSET[state.players[pi].hand[ci].value];beep(820,.12,'triangle',.07);setTimeout(closeSpecial,1100);log(`<strong>${state.players[0].name}</strong> spied on ${state.players[pi].name}.`);
}
let swapMine=null;
function chooseSwapMine(i){
  swapMine=i;$('#actionTitle').textContent='Now choose an opponent card';$('#actionChoices').innerHTML='';
  state.players.forEach((p,pi)=>{if(pi===0)return;p.hand.forEach((c,ci)=>$('#actionChoices').appendChild(choiceBtn(BACK,`${p.name} · ${ci+1}`,()=>resolveSwap(pi,ci))))});
}
function resolveSwap(pi,ci){
  const a=state.players[0].hand[swapMine];state.players[0].hand[swapMine]=state.players[pi].hand[ci];state.players[pi].hand[ci]=a;state.players[0].memory.delete(swapMine);
  beep(260,.08,'square',.05);setTimeout(()=>beep(520,.12,'triangle',.05),80);log(`<strong>${state.players[0].name}</strong> swapped with ${state.players[pi].name}.`);closeSpecial();
}
function closeSpecial(){state.phase='turn';state.pendingSpecial=null;swapMine=null;$('#actionOverlay').classList.add('hidden');$$('.action-btn').forEach(b=>b.classList.remove('available'));renderAll();endTurn()}
$('#cancelAction').onclick=closeSpecial;

function endTurn(){
  if(state.calledBy!==null && state.current!==state.calledBy){state.finalTurnsLeft--;if(state.finalTurnsLeft<=0){finishRound();return}}
  state.current=(state.current+1)%state.players.length;renderAll();
  if(state.current!==0)setTimeout(botTurn,650);
}
function botTurn(){
  if(state.phase==='reveal')return;
  const p=state.players[state.current];
  if(state.calledBy===null && Math.random()<.06 && state.round>1){state.calledBy=state.current;state.finalTurnsLeft=state.players.length-1;log(`<strong>${p.name}</strong> called CABO!`);toast(`${p.name} called CABO!`);beep(160,.35,'sawtooth',.08)}
  if(!state.deck.length)reshuffle();
  const drawn=state.deck.pop();
  // Basic bot memory strategy: replace highest known card, otherwise random.
  let idx=0,max=-1;
  p.hand.forEach((c,i)=>{if(p.memory.has(i)&&c.value>max){max=c.value;idx=i}});
  if(max<0)idx=Math.floor(Math.random()*p.hand.length);
  if(drawn.value < (max>=0?max:7) || Math.random()<.55){
    const old=p.hand[idx];p.hand[idx]=drawn;state.discard.push(old);p.memory.add(idx);
    log(`<strong>${p.name}</strong> drew and replaced a card.`);
  }else{state.discard.push(drawn);log(`<strong>${p.name}</strong> discarded a drawn card.`)}
  const sp=SPECIAL[drawn.value];
  if(sp && Math.random()<.7) log(`<strong>${p.name}</strong> used ${sp.toUpperCase()}.`);
  beep(360+state.current*80,.07,'triangle',.04);renderAll();setTimeout(endTurn,600);
}
function reshuffle(){const top=state.discard.pop();state.deck=state.discard.splice(0);for(let i=state.deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[state.deck[i],state.deck[j]]=[state.deck[j],state.deck[i]]}state.discard=[top]}

$('#drawPileBtn').onclick=()=>drawFrom('deck');
$('#discardPileBtn').onclick=()=>drawFrom('discard');
$('#callBtn').onclick=()=>{
  if(state.current!==0||state.phase!=='turn'||state.drawn||state.calledBy!==null)return;
  state.calledBy=0;state.finalTurnsLeft=state.players.length-1;log(`<strong>${state.players[0].name}</strong> called CABO!`);toast('CABO called — final turns begin!');beep(140,.4,'sawtooth',.09);endTurn();
};
$$('.action-btn').forEach(b=>b.onclick=()=>{if(!b.classList.contains('available'))toast('Draw a matching special card first.')});

function finishRound(){
  state.phase='reveal';renderHand();const totals=state.players.map(sumHand);
  let min=Math.min(...totals),winners=totals.map((v,i)=>v===min?i:-1).filter(i=>i>=0);
  // Lowest score wins; add card total to cumulative score, lower overall is better.
  state.players.forEach((p,i)=>p.score+=totals[i]);
  $('#roundHeadline').textContent=`${state.players[winners[0]].name}${winners.length>1?' and others':''} win${winners.length===1?'s':''} the round`;
  $('#resultPlayers').innerHTML=state.players.map((p,i)=>`<div class="result-player"><strong>${p.name}</strong><div class="result-hand">${p.hand.map(c=>`<img src="${ASSET[c.value]}">`).join('')}</div><div class="result-score">${totals[i]} pts</div><div style="font-size:11px;color:#7fa1b6">Total ${p.score}</div></div>`).join('');
  $('#roundOverlay').classList.remove('hidden');beep(523,.12,'triangle',.07);setTimeout(()=>beep(659,.14,'triangle',.06),130);setTimeout(()=>beep(784,.18,'triangle',.05),280);renderScores();
}
$('#nextRound').onclick=()=>{
  $('#roundOverlay').classList.add('hidden');
  if(state.round>=state.maxRounds){showWinner();return}
  state.round++;dealRound();
}
function showWinner(){
  const sorted=[...state.players].sort((a,b)=>a.score-b.score),winner=sorted[0];
  $('#winnerText').innerHTML=`<div style="font-size:32px;color:var(--cyan);margin:10px">${winner.name}</div><div style="color:#91b7c8">wins with ${winner.score} points.</div>`;
  $('#winnerOverlay').classList.remove('hidden');beep(392,.2,'triangle',.08);setTimeout(()=>beep(523,.2,'triangle',.07),180);setTimeout(()=>beep(659,.35,'triangle',.06),360);
}
$('#rematchBtn').onclick=()=>{$('#winnerOverlay').classList.add('hidden');state.round=1;state.players.forEach(p=>p.score=0);dealRound()};

$('#copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText(state.room);toast('Room code copied')}catch{toast(`Room code: ${state.room}`)}};
$('#leaveRoom').onclick=()=>{state.phase='lobby';$('#gameUI').classList.add('hidden');$('#lobbyScreen').classList.remove('hidden');setMusic(false)};
$('#musicBtn').onclick=()=>{setMusic(!musicOn);toast(musicOn?'Music on':'Music off')};
$('#pauseBtn').onclick=()=>setMusic(!musicOn);
$('#soundBtn').onclick=()=>{soundOn=!soundOn;toast(soundOn?'Sound effects on':'Sound effects off')};
$('#volume').oninput=e=>{if(musicOn&&masterGain)masterGain.gain.value=(e.target.value/100)*.08};
$('#menuBtn').onclick=()=>toast('Settings menu coming next');
$('#chatBtn').onclick=()=>toast('Chat will be enabled with online multiplayer');
$('#emojiBtn').onclick=()=>toast('✨ Midnight reaction');
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('#createPane').classList.toggle('hidden',t.dataset.tab!=='create');$('#joinPane').classList.toggle('hidden',t.dataset.tab!=='join')});
$('#createGame').onclick=()=>startGame(parseInt($('#playerCount').value),$('#playerName').value.trim()||'You');
$('#joinGame').onclick=()=>{toast('Prototype room joined');startGame(4,$('#joinName').value.trim()||'You')};

// Loading sequence.
let pct=0;const loadInt=setInterval(()=>{pct+=Math.ceil(Math.random()*9);if(pct>=100){pct=100;clearInterval(loadInt);setTimeout(()=>{$('#loadingScreen').style.opacity='0';setTimeout(()=>{$('#loadingScreen').classList.add('hidden');$('#lobbyScreen').classList.remove('hidden')},650)},300)}$('#loaderBar').style.width=pct+'%';$('#loadingPercent').textContent=pct+'%'},90);

// Particles
const canvas=$('#particles'),ctx=canvas.getContext('2d');let particles=[];
function resize(){canvas.width=innerWidth;canvas.height=innerHeight;particles=Array.from({length:70},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*1.5+.3,s:Math.random()*.18+.05,a:Math.random()*.7+.15}))}
addEventListener('resize',resize);resize();
(function anim(){ctx.clearRect(0,0,canvas.width,canvas.height);for(const p of particles){p.y-=p.s;if(p.y<0)p.y=canvas.height;ctx.globalAlpha=p.a;ctx.fillStyle=Math.random()>.5?'#39e8ff':'#a768ff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}requestAnimationFrame(anim)})();
