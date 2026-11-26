import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence,motion } from 'framer-motion';
import { LoadingScreen } from './components/LoadingScreen';
import { Lobby } from './components/Lobby';
import type { Language, LobbyMember } from './components/Lobby';
import { SettingsModal } from './components/SettingsModal';
import { AnimatedBackground } from './components/AnimatedBackground';
import type { BackgroundPulse } from './components/AnimatedBackground';
import { Card as CardView, cardArt } from './components/Card';
import { createDeck } from './game/deck';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { auth, db } from './firebase/config';
import type { Card, Player, SpecialAction } from './game/types';

type AppPhase='loading'|'lobby'|'dealing'|'opening'|'game'|'roundEnd'|'gameEnd';
type TurnStage='draw'|'replace'|'special'|'waiting';

type GamePlayer=Player & {memory:Set<number>; bot:boolean};
const colors=['#39e8ff','#a768ff','#ff9a24','#ff4bb3'];
const botNames=['Luna','Orion','Nova'];
const BACK='/assets/card-back-gold.png';

function isPerfectEclipse(p:GamePlayer){
 const values=p.hand.map(c=>c.value).sort((a,b)=>a-b);
 return values.length===4 && values[0]===0 && values[1]===0 && values[2]===13 && values[3]===13;
}
function scoreHand(p:GamePlayer){return isPerfectEclipse(p)?0:p.hand.reduce((s,c)=>s+c.value,0)}
function randomCode(){return Math.random().toString(36).slice(2,7).toUpperCase()}
function specialName(c:Card|null){return c?.special ? c.special.toUpperCase() : ''}


const CARD_TAKE_SFX=['/assets/sfx/card-take-1.mp3','/assets/sfx/card-take-2.mp3','/assets/sfx/card-take-3.mp3'];
const CARD_PLACE_SFX='/assets/sfx/card-place.mp3';
function playCardSfx(kind:'take'|'place'){
  try{
    const src=kind==='take'?CARD_TAKE_SFX[Math.floor(Math.random()*CARD_TAKE_SFX.length)]:CARD_PLACE_SFX;
    const audio=new Audio(src);
    audio.volume=.62;
    void audio.play().catch(()=>{});
  }catch{}
}

function playShuffleSfx(){
  try{
    const audio=new Audio('/assets/sfx/card-shuffle.mp3');
    audio.volume=.52;
    void audio.play().catch(()=>{});
    return audio;
  }catch{return null}
}

function playResultSfx(kind:'round-win'|'round-lose'|'game-win'|'game-lose'){
  try{
    const files={
      'round-win':'/assets/sfx/round-winner.mp3',
      'round-lose':'/assets/sfx/round-loser.mp3',
      'game-win':'/assets/sfx/game-winner.mp3',
      'game-lose':'/assets/sfx/game-loser.mp3'
    };
    const audio=new Audio(files[kind]);
    audio.volume=kind.startsWith('game')?.72:.66;
    void audio.play().catch(()=>{});
    return audio;
  }catch{return null}
}

export default function App(){
 const [phase,setPhase]=useState<AppPhase>('loading');
 const [players,setPlayers]=useState<GamePlayer[]>([]);
 const [deck,setDeck]=useState<Card[]>([]);
 const [discard,setDiscard]=useState<Card[]>([]);
 const [round,setRound]=useState(1);
 const [maxRounds,setMaxRounds]=useState(10);
 const [current,setCurrent]=useState(0);
 const [stage,setStage]=useState<TurnStage>('waiting');
 const [drawn,setDrawn]=useState<Card|null>(null);
 const [selected,setSelected]=useState<number|null>(null);
 const [room,setRoom]=useState('K7DF9');
 const [onlineGame,setOnlineGame]=useState(false);
 const [myUid,setMyUid]=useState<string|null>(null);
 const [turnSeconds,setTurnSeconds]=useState(30);
 const turnDeadlineRef=useRef<number|null>(null);
 const timeoutKeyRef=useRef('');
 const botKeyRef=useRef('');
 const applyingRemote=useRef(false);
 const lastGameRevision=useRef(0);
 const specialResolvingRef=useRef(false);
 const botProcessingRef=useRef(false);
 const [openingConfirmed,setOpeningConfirmed]=useState(false);
 const promotingOpeningRef=useRef(false);
 const [log,setLog]=useState<string[]>([]);
 const [opening,setOpening]=useState<number[]>([]);
 const [special,setSpecial]=useState<SpecialAction|null>(null);
 const [specialMine,setSpecialMine]=useState<number|null>(null);
 const [calledBy,setCalledBy]=useState<number|null>(null);
 const [finalTurns,setFinalTurns]=useState<number|null>(null);
 const [roundScores,setRoundScores]=useState<number[]>([]);
 const [perfectEclipseIndex,setPerfectEclipseIndex]=useState<number|null>(null);
 const [roundAdvanceAt,setRoundAdvanceAt]=useState<number|null>(null);
 const [dealingEndsAt,setDealingEndsAt]=useState<number|null>(null);
 const [memoryMode,setMemoryMode]=useState<'easy'|'hard'>('hard');
 const [toast,setToast]=useState('');
 const [inspectCard,setInspectCard]=useState<{src:string;label:string}|null>(null);
 const [sound,setSound]=useState(true);
 const [music,setMusic]=useState(true);
 const [volume,setVolume]=useState(()=>Number(localStorage.getItem('noctis-volume')||42));
 const [language,setLanguage]=useState<Language>(()=>(localStorage.getItem('noctis-language') as Language)||'en');
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [chatOpen,setChatOpen]=useState(false);
 const [chatMinimized,setChatMinimized]=useState(false);
 const [chatText,setChatText]=useState('');
 const [chatMessages,setChatMessages]=useState<{name:string;text:string}[]>([]);
 const [activeEmote,setActiveEmote]=useState<string|null>(null);
 const [interactionEvent,setInteractionEvent]=useState<null|{
   type:'spy'|'swap';actorId:string;actorName:string;actorColor:string;actorZodiac:string;
   targetId:string;targetName:string;nonce:string
 }>(null);
 const lastInteractionNonce=useRef('');
 const lastEmoteNonce=useRef('');
 const [backgroundAnimation,setBackgroundAnimation]=useState(()=>localStorage.getItem('noctis-background-animation')!=='off');
 const [backgroundPulse,setBackgroundPulse]=useState<BackgroundPulse>(null);
 const playerPalette=['#39e8ff','#a768ff','#ff9a24','#ff4bb3','#53e38b','#ff5a5a'];
 const [myColor,setMyColor]=useState(()=>localStorage.getItem('noctis-player-color')||'#39e8ff');
 const [moveAnim,setMoveAnim]=useState<{value:number;special?:SpecialAction;from:string;to:string;hidden?:boolean}|null>(null);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const playersRef=useRef<GamePlayer[]>([]);
 const deckRef=useRef<Card[]>([]);
 const discardRef=useRef<Card[]>([]);
 const calledRef=useRef<number|null>(null);
 const finalRef=useRef<number|null>(null);
 useEffect(()=>{playersRef.current=players},[players]);
 useEffect(()=>{deckRef.current=deck},[deck]);
 useEffect(()=>{discardRef.current=discard},[discard]);
 useEffect(()=>{calledRef.current=calledBy},[calledBy]);
 useEffect(()=>{finalRef.current=finalTurns},[finalTurns]);

 useEffect(()=>{const t=setTimeout(()=>setPhase('lobby'),2100);return()=>clearTimeout(t)},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),1500);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{
   if(!inspectCard)return;
   const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setInspectCard(null)};
   window.addEventListener('keydown',close);
   return()=>window.removeEventListener('keydown',close);
 },[inspectCard]);
 useEffect(()=>{
   const a=new Audio('/audio/midnight-background.mp3');
   a.loop=true;a.preload='auto';a.volume=volume/100;audioRef.current=a;
   if(music) a.play().catch(()=>{});
   const unlock=()=>{ if(music && a.paused) a.play().catch(()=>{}); };
   window.addEventListener('pointerdown',unlock,{once:true});
   window.addEventListener('keydown',unlock,{once:true});
   return()=>{a.pause();window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);audioRef.current=null};
 },[]);
 useEffect(()=>{const a=audioRef.current;if(!a)return;a.volume=volume/100;localStorage.setItem('noctis-volume',String(volume));if(music){a.play().catch(()=>{})}else{a.pause()}},[music,phase,volume]);
 const startLoadingMusic=()=>{const a=audioRef.current;if(!a)return;a.volume=volume/100;a.play().then(()=>setMusic(true)).catch(()=>{});};
 useEffect(()=>{localStorage.setItem('noctis-language',language);document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr'},[language]);
 useEffect(()=>{localStorage.setItem('noctis-background-animation',backgroundAnimation?'on':'off')},[backgroundAnimation]);
 useEffect(()=>{
   // Never carry a transient PEEK/SPY/SWAP/NOCTIS pulse into a new screen/round.
   setBackgroundPulse(null);
 },[phase,round,backgroundAnimation]);
 useEffect(()=>{localStorage.setItem('noctis-player-color',myColor)},[myColor]);

 const addLog=(m:string)=>setLog(l=>[m,...l].slice(0,60));
 const emotes=[
   {id:'laugh',label:'Laugh',image:'/assets/emotes/laugh.png',sfx:'/assets/sfx/emote-laugh.mp3'},
   {id:'mad',label:'Mad',image:'/assets/emotes/mad.png',sfx:'/assets/sfx/emote-mad.mp3'},
   {id:'surprised',label:'Surprised',image:'/assets/emotes/surprised.png',sfx:'/assets/sfx/emote-surprised.mp3'},
   {id:'sad',label:'Sad',image:'/assets/emotes/sad.png',sfx:'/assets/sfx/emote-sad.mp3'},
   {id:'gg',label:'GG',image:'/assets/emotes/gg.png',sfx:'/assets/sfx/emote-gg.mp3'}
 ];
 const showEmote=(id:string,name?:string)=>{const e=emotes.find(x=>x.id===id);if(!e)return;setActiveEmote(e.image);setTimeout(()=>setActiveEmote(null),2600);if(sound){try{const x=new Audio(e.sfx);x.volume=.72;void x.play().catch(()=>{})}catch{}};if(name)addLog(`${name} sent ${e.label}.`)};
 const sendEmote=(id:string)=>{const e=emotes.find(x=>x.id===id);if(!e)return;showEmote(id,playersRef.current[0]?.name||'You');if(onlineGame&&room&&myUid){const nonce=`${Date.now()}-${myUid}-${Math.random()}`;lastEmoteNonce.current=nonce;void update(ref(db,`rooms/${room}/game`),firebaseSafe({emote:{id,senderId:myUid,senderName:playersRef.current[0]?.name||'Player',nonce}}))}};
 const sendChat=()=>{const text=chatText.trim().slice(0,120);if(!text)return;setChatMessages(m=>[...m.slice(-19),{name:playersRef.current[0]?.name||'You',text}]);setChatText('');};
 const publishInteraction=(type:'spy'|'swap',target:GamePlayer)=>{
   if(!onlineGame||!room||!myUid)return;
   const actor=playersRef.current[0];
   const nonce=`${Date.now()}-${myUid}-${type}-${Math.random().toString(36).slice(2,7)}`;
   lastInteractionNonce.current=nonce;
   void update(ref(db,`rooms/${room}/game`),firebaseSafe({
     interactionEvent:{
       type,actorId:myUid,actorName:actor?.name||'Player',actorColor:actor?.color||'#d8bd72',
       actorZodiac:actor?.zodiac||'',targetId:target.id,targetName:target.name,nonce,at:Date.now()
     }
   })).catch(err=>console.error('NOCTIS interaction animation sync failed',err));
 };

 const animateCard=(value:number,from:string,to:string,hidden=false,special?:SpecialAction)=>{
   setMoveAnim({value,special,from,to,hidden});
   window.setTimeout(()=>setMoveAnim(null),620);
 };
 const ping=(m:string)=>{setToast(m); if(sound && 'vibrate' in navigator) navigator.vibrate?.(15)};
 const pulseBackground=(kind:Exclude<BackgroundPulse,null>)=>{if(!backgroundAnimation)return;setBackgroundPulse(null);requestAnimationFrame(()=>{setBackgroundPulse(kind);setTimeout(()=>setBackgroundPulse(null),kind==='cabo'?1250:800)})};

 const firebaseSafe=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const packPlayers=(ps:GamePlayer[])=>firebaseSafe(ps.map(p=>({...p,memory:[...p.memory]})));
 const unpackPlayers=(ps:any[])=>ps.map(p=>({...p,memory:new Set<number>(Array.isArray(p.memory)?p.memory:[])})) as GamePlayer[];
 const canonicalPlayers=(ps:GamePlayer[])=>[...ps].sort((a,b)=>a.isHost===b.isHost?a.id.localeCompare(b.id):(a.isHost?-1:1));
 const publishCore=async(patch:Record<string,unknown>)=>{if(!onlineGame||!room)return;try{await update(ref(db,`rooms/${room}/game`),firebaseSafe(patch))}catch(err){console.error('NOCTIS Firebase game sync failed',err)}};
 const publishPrivate=async(patch:Record<string,unknown>)=>{
   if(!onlineGame||!room||!myUid)return;
   try{await update(ref(db,`rooms/${room}/private/${myUid}`),firebaseSafe(patch))}catch(err){console.error('NOCTIS private sync failed',err)}
 };
 const clearPrivate=async()=>{
   if(!onlineGame||!room||!myUid)return;
   try{await remove(ref(db,`rooms/${room}/private/${myUid}`))}catch(err){console.error('NOCTIS private clear failed',err)}
 };
 function start(name:string,members:LobbyMember[],roomCode:string,rounds:number,memory:'easy'|'hard'){setMemoryMode(memory);
   if(audioRef.current){audioRef.current.volume=volume/100;audioRef.current.play().catch(()=>{});}
   const uid=auth.currentUser?.uid||null;
   const ordered=[...members].sort((a,b)=>a.host===b.host?a.id.localeCompare(b.id):(a.host?-1:1));
   const li=Math.max(0,ordered.findIndex(m=>m.id===uid)),rotated=[...ordered.slice(li),...ordered.slice(0,li)];
   const ps:GamePlayer[]=rotated.map(m=>({id:m.id,name:m.id===uid?name:m.name,score:0,hand:[],memory:new Set(),bot:m.bot,isHost:!!m.host,color:m.color,zodiac:m.zodiac}));
   const isOnline=Boolean(uid&&roomCode);setOnlineGame(isOnline);setMyUid(uid);
   playersRef.current=ps;setPlayers(ps);setRoom(roomCode);setMaxRounds(rounds);setRound(1);setLog([]);
   if(isOnline){if(ps[0]?.isHost)beginRound(ps,1,true,roomCode)}else beginRound(ps,1);
 }
 function beginRound(basePlayers=players,roundNo=round,broadcast=false,syncRoom=room){
   const d=createDeck();
   const ps=basePlayers.map((p,i)=>({...p,hand:d.splice(0,4),memory:new Set(i===0?[]:[0,1])}));
   const first=d.shift()!;
   playersRef.current=ps;deckRef.current=d;discardRef.current=[first];setPlayers(ps);setDeck(d);setDiscard([first]);setCurrent(0);setStage('waiting');setDrawn(null);setSelected(null);setSpecial(null);setSpecialMine(null);setCalledBy(null);setFinalTurns(null);setOpening([]);setOpeningConfirmed(false);promotingOpeningRef.current=false;setRoundScores([]);setPerfectEclipseIndex(null);setRoundAdvanceAt(null);setRound(roundNo);setPhase('dealing');
   addLog(`Round ${roundNo} started.`);
    if(broadcast&&syncRoom){
      const canon=canonicalPlayers(ps);
      const dealDurationMs=Math.round((.45+((canon.length*4)-1)*.26+.58+1.15)*1000);
      const dealEnd=Date.now()+dealDurationMs;
      setDealingEndsAt(dealEnd);
      void set(ref(db,`rooms/${syncRoom}/game`),firebaseSafe({
        round:roundNo,phase:'dealing',dealingEndsAt:dealEnd,stage:'waiting',current:0,
        deck:d,discard:[first],players:packPlayers(canon),openingReady:{},
        roundScoresById:{},perfectEclipsePlayerId:null,roundAdvanceAt:null,
        drawn:null,calledBy:null,finalTurns:null,revision:Date.now()
      })).catch(err=>console.error('NOCTIS initial game sync failed',err))
    }
 }
 function toggleOpening(i:number){
   // Opening memory is intentionally irreversible:
   // once a card has been revealed, it stays one of this round's two memorized cards.
   setOpening(sel=>{
     if(sel.includes(i))return sel;
     if(sel.length>=2)return sel;
     return [...sel,i];
   });
 }
 function confirmOpening(){
   if(opening.length!==2||openingConfirmed)return;
   const chosen=[...opening];
   const ps=playersRef.current.map((p,i)=>i? p : {...p,memory:new Set(chosen)});playersRef.current=ps;setPlayers(ps);
   setOpeningConfirmed(true);
   addLog(`${players[0]?.name||'You'} memorized two cards.`);
   if(onlineGame&&room&&myUid){
     const canon=canonicalPlayers(ps);
     const ci=Math.max(0,canon.findIndex(p=>p.id===myUid));
     void update(ref(db,`rooms/${room}/game`),firebaseSafe({
       [`players/${ci}/memory`]:chosen,
       [`openingReady/${myUid}`]:true,
       revision:Date.now()
     })).catch(err=>console.error('NOCTIS opening sync failed',err));
     return;
   }
   setOpening([]);setPhase('game');setStage('draw');ping('Your turn');
 }
 function reshuffleIfNeeded(d:Card[],disc:Card[]){
   if(d.length)return {d,disc};
   if(disc.length<=1)return {d,disc};
   const top=disc[disc.length-1];
   const rest=disc.slice(0,-1).sort(()=>Math.random()-.5);
   return {d:rest,disc:[top]};
 }
 useEffect(()=>{
   if(!onlineGame||!room)return;
   const unsub=onValue(ref(db,`rooms/${room}/game`),snap=>{
     const g=snap.val();if(!g?.players)return;
     const revision=Number(g.revision||0);
     if(revision&&revision<lastGameRevision.current)return;
     if(revision)lastGameRevision.current=revision;
     applyingRemote.current=true;
     const raw=unpackPlayers(g.players),li=Math.max(0,raw.findIndex(p=>p.id===myUid));
     const ps=[...raw.slice(li),...raw.slice(0,li)];
     const currentUid=raw[Math.max(0,Math.min(raw.length-1,Number(g.current??0)))]?.id;
     const lc=Math.max(0,ps.findIndex(p=>p.id===currentUid));
     playersRef.current=ps;deckRef.current=g.deck||[];discardRef.current=g.discard||[];
     setPlayers(ps);setDeck(g.deck||[]);setDiscard(g.discard||[]);setCurrent(lc);setStage(g.stage||'waiting');
     if(lc!==0){setDrawn(null);setSpecial(null);setSpecialMine(null)}
     if(lc!==0||g.stage!=='special')specialResolvingRef.current=false;
     const remoteCalledBy=g.calledBy;
     if(remoteCalledBy===null||remoteCalledBy===undefined){
       calledRef.current=null;setCalledBy(null);
     }else{
       const callerUid=raw[Math.max(0,Math.min(raw.length-1,Number(remoteCalledBy)))]?.id;
       const localCaller=Math.max(0,ps.findIndex(p=>p.id===callerUid));
       calledRef.current=localCaller;setCalledBy(localCaller);
     }
     turnDeadlineRef.current=g.turnEndsAt?Number(g.turnEndsAt):null;
     if(g.turnEndsAt)setTurnSeconds(Math.max(0,Math.ceil((Number(g.turnEndsAt)-Date.now())/1000)));
     else setTurnSeconds(30);
     finalRef.current=g.finalTurns??null;setFinalTurns(g.finalTurns??null);setRound(g.round||1);
     if(g.emote?.nonce&&g.emote.nonce!==lastEmoteNonce.current){lastEmoteNonce.current=g.emote.nonce;if(g.emote.senderId!==myUid)showEmote(g.emote.id,g.emote.senderName||'Player')}
     if(g.interactionEvent?.nonce&&g.interactionEvent.nonce!==lastInteractionNonce.current){
       lastInteractionNonce.current=g.interactionEvent.nonce;
       if(g.interactionEvent.targetId===myUid){
         setInteractionEvent(g.interactionEvent);
         if(g.interactionEvent.type==='spy')pulseBackground('spy');else pulseBackground('swap');
         window.setTimeout(()=>setInteractionEvent(null),2800);
       }
     }
     if(g.phase==='dealing'){
       setDealingEndsAt(g.dealingEndsAt?Number(g.dealingEndsAt):null);
       setStage('waiting');setPhase('dealing');
     }else if(g.phase==='opening'){
       setDealingEndsAt(null);
       setPhase('opening');
       const humanIds=raw.filter(p=>!p.bot).map(p=>p.id);
       const ready=g.openingReady||{};
       const allOpened=humanIds.length>0&&humanIds.every(id=>ready[id]===true);
       const localIsHost=ps[0]?.isHost===true;
       if(allOpened&&localIsHost&&!promotingOpeningRef.current){
         promotingOpeningRef.current=true;
         void update(ref(db,`rooms/${room}/game`),firebaseSafe({
           phase:'game',stage:'draw',current:0,turnEndsAt:Date.now()+30000,revision:Date.now()
         })).catch(err=>{promotingOpeningRef.current=false;console.error('NOCTIS game phase promotion failed',err)});
       }
     }else if(g.phase==='game'){
       setPhase('game');setOpeningConfirmed(false);setOpening([]);
       promotingOpeningRef.current=false;

     }
     else if(g.phase==='roundEnd'){
       const scoresById=g.roundScoresById||{};
       setRoundScores(ps.map(p=>Number(scoresById[p.id]??0)));
       const eclipseId=g.perfectEclipsePlayerId||null;
       setPerfectEclipseIndex(eclipseId?ps.findIndex(p=>p.id===eclipseId):null);
       setRoundAdvanceAt(g.roundAdvanceAt?Number(g.roundAdvanceAt):null);
       setStage('waiting');setTurnSeconds(0);setPhase('roundEnd');
     }else if(g.phase==='gameEnd'){
       setRoundAdvanceAt(null);setStage('waiting');setPhase('gameEnd');
     }
     queueMicrotask(()=>{applyingRemote.current=false});
   });return()=>unsub();
 },[onlineGame,room,myUid]);

 useEffect(()=>{
   if(!onlineGame||phase!=='dealing'||!dealingEndsAt||!room||!playersRef.current[0]?.isHost)return;
   const delay=Math.max(0,dealingEndsAt-Date.now());
   const timer=window.setTimeout(()=>{
     void update(ref(db,`rooms/${room}/game`),firebaseSafe({
       phase:'opening',dealingEndsAt:null,stage:'waiting',revision:Date.now()
     })).catch(err=>console.error('NOCTIS dealing->opening sync failed',err));
   },delay);
   return()=>window.clearTimeout(timer);
 },[onlineGame,phase,dealingEndsAt,room]);

 useEffect(()=>{
   if(!onlineGame||!room||!myUid)return;
   const unsub=onValue(ref(db,`rooms/${room}/private/${myUid}`),snap=>{
     const p=snap.val()||{};
     if(current!==0){setDrawn(null);setSpecial(null);return}
     setDrawn(p.drawn||null);
     setSpecial(p.special||null);
   });
   return()=>unsub();
 },[onlineGame,room,myUid,current]);


 useEffect(()=>{
   if(!onlineGame||phase!=='game')return;
   const tick=()=>{
     const deadline=turnDeadlineRef.current;
     if(!deadline){setTurnSeconds(30);return}
     const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));
     setTurnSeconds(left);
     if(left>0)return;

     // Host is the single timeout authority, so disconnected/AFK humans can still be skipped.
     if(!playersRef.current[0]?.isHost)return;
     const canon=canonicalPlayers(playersRef.current);
     const currentLocal=playersRef.current[current];
     const activeCanonical=Math.max(0,canon.findIndex(p=>p.id===currentLocal?.id));
     const key=`${room}:${round}:${activeCanonical}:${deadline}`;
     if(timeoutKeyRef.current===key)return;
     timeoutKeyRef.current=key;

     let remaining=finalRef.current;
     const callerCanonical=calledRef.current===null?null:Math.max(0,canon.findIndex(p=>p.id===playersRef.current[calledRef.current!]?.id));
     if(callerCanonical!==null&&activeCanonical!==callerCanonical&&remaining!==null){
       remaining-=1;finalRef.current=remaining;setFinalTurns(remaining);
     }
     if(callerCanonical!==null&&remaining!==null&&remaining<=0){
       endRound(canon);
       return;
     }
     const next=(activeCanonical+1)%canon.length;
     void update(ref(db,`rooms/${room}/game`),firebaseSafe({
       phase:'game',current:next,stage:'draw',turnEndsAt:Date.now()+30000,
       players:packPlayers(canon),deck:deckRef.current,discard:discardRef.current,
       calledBy:callerCanonical,finalTurns:remaining,revision:Date.now()
     })).catch(err=>console.error('NOCTIS turn timeout sync failed',err));
   };
   tick();
   const timer=window.setInterval(tick,250);
   return()=>window.clearInterval(timer);
 },[onlineGame,phase,room,round,current]);

 useEffect(()=>{
   if(!onlineGame||phase!=='game'||stage!=='draw')return;
   const active=playersRef.current[current];
   if(!active?.bot||!playersRef.current[0]?.isHost)return;
   const deadline=turnDeadlineRef.current||0;
   const key=`${room}:${round}:${active.id}:${deadline}`;
   if(botKeyRef.current===key)return;
   botKeyRef.current=key;
   // Bots think briefly, then make a real legal move. If anything fails, the 30s timer still skips them.
   const timer=window.setTimeout(()=>void onlineBotTurn(active.id),900+Math.floor(Math.random()*1100));
   return()=>window.clearTimeout(timer);
 },[onlineGame,phase,stage,current,room,round]);


 useEffect(()=>{
   if(!onlineGame||phase!=='game'||!playersRef.current[0]?.isHost)return;
   if(calledRef.current===null||finalRef.current===null||finalRef.current>0)return;
   const key=`${room}:${round}:noctis-round-end`;
   if(timeoutKeyRef.current===key)return;
   timeoutKeyRef.current=key;
   endRound(playersRef.current);
 },[onlineGame,phase,finalTurns,calledBy,room,round]);

 function humanDraw(source:'deck'|'discard'){
   if(current!==0||stage!=='draw'||phase!=='game')return;
   let d=[...deck],di=[...discard];
   ({d,disc:di}=reshuffleIfNeeded(d,di));
   const card=source==='deck'?d.pop():di.pop();
   if(!card)return;
   playCardSfx('take');
   animateCard(card.value,source,'drawn',source==='deck',card.special);
   deckRef.current=d;discardRef.current=di;setDeck(d);setDiscard(di);setDrawn(card);setStage('replace');
   if(onlineGame){
     void publishCore({phase:'game',deck:d,discard:di,stage:'replace',revision:Date.now()});
     void publishPrivate({drawn:card,special:null});
   }
   addLog(`${players[0].name} drew from the ${source}.`);ping(`Drawn ${card.value}${card.special?` · ${specialName(card)}`:''}`);
 }
 function replaceHuman(i:number){
   if(current!==0||stage!=='replace'||!drawn)return;
   const power=drawn.special;
   const ps=playersRef.current.map(p=>({...p,hand:[...p.hand],memory:new Set(p.memory)}));
   const old=ps[0].hand[i];
   playCardSfx('place');
   animateCard(drawn.value,'drawn',`hand-${i}`,false,drawn.special);
   window.setTimeout(()=>{playCardSfx('place');animateCard(old.value,`hand-${i}`,'discard',!ps[0].memory.has(i),old.special)},230);
   ps[0].hand[i]=drawn;ps[0].memory.add(i);
   const di=[...discardRef.current,old];playersRef.current=ps;discardRef.current=di;setPlayers(ps);setDiscard(di);
   setDrawn(null);setSelected(null);addLog(`${players[0].name} replaced card ${i+1}.`);
   if(power){
     setSpecial(power);setStage('special');
     if(onlineGame){void publishCore({phase:'game',players:packPlayers(canonicalPlayers(ps)),discard:di,stage:'special',revision:Date.now()});void publishPrivate({drawn:null,special:power})}
     ping(`${power.toUpperCase()} available`);
   }else finishTurn({players:ps,discard:di});
 }
 function discardDrawn(){
   if(current!==0||stage!=='replace'||!drawn)return;
   const card=drawn;
   playCardSfx('place');
   animateCard(card.value,'drawn','discard',false,card.special);
   const di=[...discardRef.current,card];discardRef.current=di;setDiscard(di);setDrawn(null);
   addLog(`${players[0].name} discarded the drawn card${card.special?' without using its magic':''}.`);
   if(onlineGame)void clearPrivate();
   finishTurn({discard:di});
 }
 function useDrawnMagic(){
   specialResolvingRef.current=false;
   const power=drawn?.special;
   if(current!==0||stage!=='replace'||!drawn||!power)return;
   const card=drawn;
   playCardSfx('place');
   animateCard(card.value,'drawn','discard',false,power);
   const di=[...discardRef.current,card];discardRef.current=di;setDiscard(di);setDrawn(null);
   setSpecial(power);setStage('special');
   if(onlineGame){void publishCore({phase:'game',discard:di,stage:'special',revision:Date.now()});void publishPrivate({drawn:null,special:power})}
   addLog(`${players[0].name} discarded ${card.value} and activated ${power.toUpperCase()}.`);
   ping(`${power.toUpperCase()} activated`);
 }
 function resolvePeek(i:number){
   if(specialResolvingRef.current)return;
   if(current!==0||stage!=='special'||special!=='peek')return;
   specialResolvingRef.current=true;
   let ps=playersRef.current;
   if(memoryMode==='easy'){
     ps=playersRef.current.map((p,pi)=>pi?p:{...p,memory:new Set([...p.memory,i])});
     playersRef.current=ps;setPlayers(ps);
   }
   addLog(`${players[0].name} used PEEK.`);
   pulseBackground('peek');setSpecial(null);
   if(onlineGame)void clearPrivate();
   finishTurn({players:ps,special:null});
 }
 function resolveSpy(pi:number,ci:number){
   if(specialResolvingRef.current)return;
   if(current!==0||stage!=='special'||special!=='spy')return;
   specialResolvingRef.current=true;
   const target=playersRef.current[pi];
   addLog(`${players[0].name} used SPY on ${target.name}.`);pulseBackground('spy');ping(`${target.name}'s card is ${target.hand[ci].value}`);
   if(onlineGame)publishInteraction('spy',target);
   setSpecial(null);if(onlineGame)void clearPrivate();finishTurn({special:null});
 }
 function resolveSwap(myIndex:number,pi:number,ci:number){
   if(specialResolvingRef.current)return;
   if(current!==0||special!=='swap' || stage!=='special') return;
   if(pi<=0 || pi>=playersRef.current.length) return;
   if(myIndex<0 || myIndex>=playersRef.current[0].hand.length) return;
   if(ci<0 || ci>=playersRef.current[pi].hand.length) return;
   specialResolvingRef.current=true;
   const copy=playersRef.current.map(p=>({...p,hand:[...p.hand],memory:new Set(p.memory)}));
   const myCard=copy[0].hand[myIndex],theirCard=copy[pi].hand[ci];
   animateCard(myCard.value,`hand-${myIndex}`,`bot-${pi}`,!copy[0].memory.has(myIndex));
   window.setTimeout(()=>animateCard(theirCard.value,`bot-${pi}`,`hand-${myIndex}`,true),180);
   const a=copy[0].hand[myIndex];copy[0].hand[myIndex]=copy[pi].hand[ci];copy[pi].hand[ci]=a;copy[0].memory.delete(myIndex);playersRef.current=copy;setPlayers(copy);
   addLog(`${players[0].name} swapped card ${myIndex+1} with ${players[pi].name}'s card ${ci+1}.`);pulseBackground('swap');ping('Cards swapped');
   if(onlineGame)publishInteraction('swap',playersRef.current[pi]);
   setSpecialMine(null);setSpecial(null);if(onlineGame)void clearPrivate();finishTurn({players:copy,special:null});
 }
 function finishTurn(overrides:{players?:GamePlayer[];deck?:Card[];discard?:Card[];special?:SpecialAction|null}={}){
   setStage('waiting');
   const turnPlayers=overrides.players??playersRef.current;
   const turnDeck=overrides.deck??deckRef.current;
   const turnDiscard=overrides.discard??discardRef.current;
   if(overrides.players){playersRef.current=turnPlayers;setPlayers(turnPlayers)}
   if(overrides.deck){deckRef.current=turnDeck;setDeck(turnDeck)}
   if(overrides.discard){discardRef.current=turnDiscard;setDiscard(turnDiscard)}
   const callerLocal=calledRef.current;
   let remaining=finalRef.current;
   const activeId=turnPlayers[current]?.id;
   const callerId=callerLocal===null?null:playersRef.current[callerLocal]?.id;
   if(callerId!==null && activeId!==callerId && remaining!==null){
     remaining=Math.max(0,remaining-1);
     finalRef.current=remaining;setFinalTurns(remaining);
   }
   const next=(current+1)%turnPlayers.length;setCurrent(next);
   if(onlineGame){
     // IMPORTANT: the last final turn must end the round globally.
     // Previously we returned before writing the round-end state to Firebase,
     // which left the rest of the room playing forever.
     if(callerId!==null && remaining!==null && remaining<=0){
       void clearPrivate();
       window.setTimeout(()=>endRound(turnPlayers),180);
       return;
     }
     const canon=canonicalPlayers(turnPlayers);
     const activeCanonical=Math.max(0,canon.findIndex(p=>p.id===activeId));
     const remoteNext=(activeCanonical+1)%canon.length;
     const callerCanonical=callerId===null?null:Math.max(0,canon.findIndex(p=>p.id===callerId));
     void clearPrivate();
     void publishCore({
       phase:'game',current:remoteNext,stage:'draw',turnEndsAt:Date.now()+30000,actionResolvedAt:Date.now(),players:packPlayers(canon),deck:turnDeck,discard:turnDiscard,
       calledBy:callerCanonical,finalTurns:remaining,revision:Date.now()
     });
     return;
   }
   if(next===0)setStage('draw'); else setTimeout(()=>botTurn(next),650);
 }
 async function onlineBotTurn(botId:string){
   if(!onlineGame||botProcessingRef.current||!playersRef.current[0]?.isHost)return;
   botProcessingRef.current=true;
   try{
     const canon=canonicalPlayers(playersRef.current).map(p=>({...p,hand:[...p.hand],memory:new Set(p.memory)}));
     const bi=canon.findIndex(p=>p.id===botId);
     if(bi<0||!canon[bi]?.bot)return;
     let d=[...deckRef.current],di=[...discardRef.current];
     ({d,disc:di}=reshuffleIfNeeded(d,di));
     if(!d.length)return;
     const bot=canon[bi],card=d.pop()!;

     // Bots use magic cards too instead of behaving like passive placeholders.
     let usedMagic=false;
     let botInteraction:any=null;
     if(card.special&&Math.random()<.72){
       di.push(card);usedMagic=true;
       if(card.special==='peek'){
         const unknown=[0,1,2,3].filter(i=>!bot.memory.has(i));
         const pick=unknown.length?unknown[Math.floor(Math.random()*unknown.length)]:Math.floor(Math.random()*4);
         bot.memory.add(pick);
         addLog(`${bot.name} used PEEK.`);
       }else if(card.special==='spy'){
         const targets=canon.filter((p,i)=>i!==bi&&!p.bot);
         const target=targets[Math.floor(Math.random()*Math.max(1,targets.length))];
         addLog(`${bot.name} used SPY${target?` on ${target.name}`:''}.`);
         if(target)botInteraction={type:'spy',actorId:bot.id,actorName:bot.name,actorColor:bot.color,actorZodiac:bot.zodiac,targetId:target.id,targetName:target.name,nonce:`${Date.now()}-${bot.id}-spy-${Math.random()}`,at:Date.now()};
       }else if(card.special==='swap'){
         const opponents=canon.map((p,i)=>({p,i})).filter(x=>x.i!==bi);
         if(opponents.length){
           const ownIndex=bot.hand.reduce((best,c,i,a)=>c.value>a[best].value?i:best,0);
           const target=opponents[Math.floor(Math.random()*opponents.length)];
           const theirIndex=Math.floor(Math.random()*target.p.hand.length);
           const tmp=bot.hand[ownIndex];bot.hand[ownIndex]=target.p.hand[theirIndex];target.p.hand[theirIndex]=tmp;
           bot.memory.delete(ownIndex);
           addLog(`${bot.name} used SWAP on ${target.p.name}.`);
           botInteraction={type:'swap',actorId:bot.id,actorName:bot.name,actorColor:bot.color,actorZodiac:bot.zodiac,targetId:target.p.id,targetName:target.p.name,nonce:`${Date.now()}-${bot.id}-swap-${Math.random()}`,at:Date.now()};
         }
       }
     }

     if(!usedMagic){
       let target=0,best=-1;
       bot.hand.forEach((c,i)=>{if(bot.memory.has(i)&&c.value>best){best=c.value;target=i}});
       if(best<0)target=Math.floor(Math.random()*bot.hand.length);
       const replace=card.value<(best>=0?best:7)||Math.random()<.55;
       if(replace){
         const old=bot.hand[target];bot.hand[target]=card;bot.memory.add(target);di.push(old);
         addLog(`${bot.name} drew and replaced a card.`);
       }else{
         di.push(card);addLog(`${bot.name} discarded a card.`);
       }
     }

     playersRef.current=canon;deckRef.current=d;discardRef.current=di;
     setPlayers(canon);setDeck(d);setDiscard(di);

     let remaining=finalRef.current;
     const callerCanonical=calledRef.current===null?null:Math.max(0,canon.findIndex(p=>p.id===playersRef.current[calledRef.current!]?.id));
     if(callerCanonical!==null&&bi!==callerCanonical&&remaining!==null){
       remaining-=1;finalRef.current=remaining;setFinalTurns(remaining);
     }
     if(callerCanonical!==null&&remaining!==null&&remaining<=0){
       // A bot completed the last final turn: announce/end the round for the whole room.
       endRound(canon);
       return;
     }
     const next=(bi+1)%canon.length;
     await update(ref(db,`rooms/${room}/game`),firebaseSafe({
       phase:'game',current:next,stage:'draw',turnEndsAt:Date.now()+30000,
       players:packPlayers(canon),deck:d,discard:di,
       calledBy:callerCanonical,finalTurns:remaining,...(botInteraction?{interactionEvent:botInteraction}:{}),revision:Date.now()
     }));
   }catch(err){console.error('NOCTIS online bot turn failed',err)}
   finally{window.setTimeout(()=>{botProcessingRef.current=false},250)}
 }

 function botTurn(index:number){
   if(phase!=='game')return;
   let ps=playersRef.current.map(p=>({...p,hand:[...p.hand],memory:new Set(p.memory)}));
   let localDeck=[...deckRef.current],localDiscard=[...discardRef.current];
   ({d:localDeck,disc:localDiscard}=reshuffleIfNeeded(localDeck,localDiscard));
   if(!localDeck.length)return;
   const p=ps[index],c=localDeck.pop()!;
   playCardSfx('take');
   let target=0,best=-1;
   p.hand.forEach((x,i)=>{if(p.memory.has(i)&&x.value>best){best=x.value;target=i}});
   if(best<0)target=Math.floor(Math.random()*p.hand.length);
   if(c.value<(best>=0?best:7)||Math.random()<.5){
     const old=ps[index].hand[target];
     playCardSfx('place');
     animateCard(c.value,'deck',`bot-${index}`,true,c.special);
     window.setTimeout(()=>{playCardSfx('place');animateCard(old.value,`bot-${index}`,'discard',true,old.special)},230);
     ps[index].hand[target]=c;ps[index].memory.add(target);localDiscard.push(old);addLog(`${p.name} drew and replaced a card.`);
   }
   else{playCardSfx('place');animateCard(c.value,'deck','discard',true,c.special);localDiscard.push(c);addLog(`${p.name} discarded a card.`)}
   playersRef.current=ps;deckRef.current=localDeck;discardRef.current=localDiscard;setPlayers(ps);setDeck(localDeck);setDiscard(localDiscard);
   let cb=calledRef.current,rem=finalRef.current;
   if(cb===null && round>1 && Math.random()<.055){cb=index;rem=ps.length-1;calledRef.current=cb;finalRef.current=rem;setCalledBy(cb);setFinalTurns(rem);addLog(`${p.name} called NOCTIS!`);ping(`${p.name} called NOCTIS!`)}
   if(cb!==null && index!==cb && rem!==null){rem-=1;finalRef.current=rem;setFinalTurns(rem);if(rem<=0){setTimeout(()=>endRound(ps),450);return}}
   const next=(index+1)%ps.length;setCurrent(next);
   if(next===0){setStage('draw');ping('Your turn')}else setTimeout(()=>botTurn(next),650);
 }
 function callCabo(){
   if(current!==0||stage!=='draw'||calledBy!==null)return;
   const callerId=playersRef.current[0]?.id;
   const remaining=Math.max(0,playersRef.current.length-1);
   calledRef.current=0;finalRef.current=remaining;
   setCalledBy(0);setFinalTurns(remaining);
   addLog(`${players[0].name} called NOCTIS!`);
   pulseBackground('cabo');ping('NOCTIS HAS BEEN CALLED · Final turns begin.');

   if(onlineGame){
     void clearPrivate();
     const canon=canonicalPlayers(playersRef.current);
     const callerCanonical=Math.max(0,canon.findIndex(p=>p.id===callerId));
     const remoteNext=(callerCanonical+1)%canon.length;
     setStage('waiting');
     setCurrent((current+1)%playersRef.current.length);
     void publishCore({
       phase:'game',
       current:remoteNext,
       stage:'draw',
       turnEndsAt:Date.now()+30000,
       special:null,
       players:packPlayers(canon),
       deck:deckRef.current,
       discard:discardRef.current,
       drawn:null,
       calledBy:callerCanonical,
       finalTurns:remaining,
       revision:Date.now()
     });
     return;
   }

   finishTurn();
 }
 function endRound(snapshot=playersRef.current){
   const eclipseIndex=snapshot.findIndex(isPerfectEclipse);
   const scores=snapshot.map(scoreHand);
   const updated=snapshot.map((p,i)=>({...p,score:p.score+scores[i]}));
   playersRef.current=updated;setPlayers(updated);setRoundScores(scores);
   setPerfectEclipseIndex(eclipseIndex>=0?eclipseIndex:null);
   setPhase('roundEnd');setStage('waiting');setTurnSeconds(0);

   if(onlineGame&&room){
     const canon=canonicalPlayers(updated);
     const scoreById=Object.fromEntries(updated.map((p,i)=>[p.id,scores[i]]));
     const eclipseId=eclipseIndex>=0?snapshot[eclipseIndex].id:null;
     const autoAdvance=eclipseId?Date.now()+20500:null;
     setRoundAdvanceAt(autoAdvance);
     void publishCore({
       phase:'roundEnd',stage:'waiting',turnEndsAt:null,
       players:packPlayers(canon),roundScoresById:scoreById,
       perfectEclipsePlayerId:eclipseId,roundAdvanceAt:autoAdvance,
       current:0,drawn:null,special:null,revision:Date.now()
     });
   }
 }
 function nextRound(){
   if(onlineGame){
     if(!playersRef.current[0]?.isHost)return;
     if(round>=maxRounds){
       void publishCore({phase:'gameEnd',stage:'waiting',turnEndsAt:null,roundAdvanceAt:null,revision:Date.now()});
       return;
     }
     const canon=canonicalPlayers(playersRef.current);
     beginRound(canon,round+1,true,room);
     return;
   }
   if(round>=maxRounds){setPhase('gameEnd');return}
   beginRound(players,round+1);
 }

 useEffect(()=>{
   if(!onlineGame||phase!=='roundEnd'||!roundAdvanceAt||!playersRef.current[0]?.isHost)return;
   const delay=Math.max(0,roundAdvanceAt-Date.now());
   const timer=window.setTimeout(()=>nextRound(),delay);
   return()=>window.clearTimeout(timer);
 },[onlineGame,phase,roundAdvanceAt,round,maxRounds,room]);
 const winner=useMemo(()=>players.length?[...players].sort((a,b)=>a.score-b.score)[0]:null,[players]);

 if(phase==='loading')return <AnimatePresence mode="wait"><motion.div key="loading" exit={{opacity:0}}><LoadingScreen onStartMusic={startLoadingMusic} music={music}/></motion.div></AnimatePresence>;
 if(phase==='lobby')return <><AnimatedBackground enabled={backgroundAnimation} pulse={backgroundPulse} resetKey={`${phase}-${round}-${backgroundAnimation?'on':'off'}`}/><Lobby language={language} onStart={(name,members,code,rounds,memory)=>{const mine=members.find(m=>m.id===auth.currentUser?.uid);setMyColor(mine?.color||members[0]?.color||myColor);start(name,members,code,rounds,memory)}} onOpenSettings={()=>setSettingsOpen(true)}/>{settingsOpen&&<SettingsModal language={language} setLanguage={setLanguage} music={music} setMusic={setMusic} sound={sound} setSound={setSound} volume={volume} setVolume={setVolume} backgroundAnimation={backgroundAnimation} setBackgroundAnimation={setBackgroundAnimation} onClose={()=>setSettingsOpen(false)}/>}</>;
 if(phase==='dealing')return <><AnimatedBackground enabled={backgroundAnimation} pulse={backgroundPulse} resetKey={`${phase}-${round}-${backgroundAnimation?'on':'off'}`}/><DealingScreen players={players} round={round} sound={sound} onDone={()=>{if(!onlineGame)setPhase('opening')}}/></>;
 if(phase==='opening')return <><AnimatedBackground enabled={backgroundAnimation} pulse={backgroundPulse} resetKey={`${phase}-${round}-${backgroundAnimation?'on':'off'}`}/><Opening players={players} selected={opening} onToggle={toggleOpening} onConfirm={confirmOpening} confirmed={openingConfirmed}/></>;
 if(phase==='roundEnd')return <><AnimatedBackground enabled={backgroundAnimation} pulse={backgroundPulse} resetKey={`${phase}-${round}-${backgroundAnimation?'on':'off'}`}/>{perfectEclipseIndex!==null?<PerfectEclipseSequence winner={players[perfectEclipseIndex]} onNext={nextRound} final={round>=maxRounds} sound={sound} bgAudio={audioRef.current} musicEnabled={music} bgVolume={volume} online={onlineGame} isHost={players[0]?.isHost===true}/>:<RoundEnd players={players} roundScores={roundScores} onNext={nextRound} final={round>=maxRounds}/>}</>;
 if(phase==='gameEnd')return <><AnimatedBackground enabled={backgroundAnimation} pulse={backgroundPulse} resetKey={`${phase}-${round}-${backgroundAnimation?'on':'off'}`}/><Winner winner={winner} localPlayerId={players[0]?.id} onRematch={()=>{const reset=players.map(p=>({...p,score:0}));setPlayers(reset);beginRound(reset,1)}}/></>;

 return <><AnimatedBackground enabled={backgroundAnimation} pulse={backgroundPulse} resetKey={`${phase}-${round}-${backgroundAnimation?'on':'off'}`}/><AnimatePresence>{inspectCard&&<motion.div className="card-inspector" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={()=>setInspectCard(null)}><motion.div className="card-inspector-panel" initial={{scale:.78,y:28,rotateY:14}} animate={{scale:1,y:0,rotateY:0}} exit={{scale:.88,opacity:0}} transition={{duration:.25}} onMouseDown={e=>e.stopPropagation()}><span>✦ EXAMINE CARD ✦</span><img src={inspectCard.src} alt={inspectCard.label}/><b>{inspectCard.label}</b><small>Press ESC or click outside to close</small><button onClick={()=>setInspectCard(null)}>CLOSE</button></motion.div></motion.div>}</AnimatePresence><motion.div key="game" className="app" initial={{opacity:0}} animate={{opacity:1}}>
   <div className="game-header"><div><div className="brand">NOCTIS</div><small>MEMORY. STRATEGY. NOCTIS.</small></div><div className="icons"><button className={music?'on':''} onClick={()=>setMusic(!music)}>♫</button><button className={sound?'on':''} onClick={()=>setSound(!sound)}>🔊</button><button onClick={()=>setSettingsOpen(true)}>☰</button></div></div>
   <div className="hud-left"><section><span>ROOM CODE</span><strong>{room}</strong><div>PLAYERS <b>{players.length} / {players.length}</b></div><button className="leave" onClick={()=>setPhase('lobby')}>LEAVE ROOM</button></section><section className="round"><span>ROUND</span><strong>{round} / {maxRounds}</strong></section><section className="scores"><span>SCORE</span>{players.map((p,i)=><div key={p.id}><i style={{background:p.color||colors[i]}}/> {p.name}<b>{p.score}</b></div>)}</section></div>
   <div className="game-stage">
   <div className="table-surface" aria-hidden="true">
     <div className="table-nebula"/>
     <div className="table-mandala"/>
     <div className="table-orbit orbit-a"/>
     <div className="table-orbit orbit-b"/>
     <div className="table-orbit orbit-c"/>
     <div className="table-stars">✦ · ✧ · ✦ · ✧ · ✦</div>
   </div>
   <div className="ring"/>
   {players.slice(1).map((p,i)=><Opponent key={p.id} p={p} index={i+1} count={players.length} active={current===i+1}/>) }
   <AnimatePresence>{moveAnim&&<MovingCard key={`${moveAnim.value}-${moveAnim.from}-${moveAnim.to}`} move={moveAnim} playerCount={players.length}/>}</AnimatePresence>
   <div className="piles"><div><CardView value={0} hidden onClick={()=>humanDraw('deck')}/><span>DRAW PILE</span></div><div><CardView value={discard.at(-1)?.value??0} special={discard.at(-1)?.special} onClick={()=>humanDraw('discard')}/><span className="pink">DISCARD PILE</span></div></div>
   {drawn&&<motion.div className="drawn-tray" initial={{opacity:0,scale:.85,y:20}} animate={{opacity:1,scale:1,y:0}}><span>YOU DREW</span><CardView value={drawn.value} special={drawn.special}/><b>{drawn.value} {specialName(drawn)}</b><div className={`drawn-actions ${drawn.special?'has-magic':''}`}>
      <button className="discard-only" onClick={discardDrawn}>DISCARD</button>
      {drawn.special&&<button className={`use-magic magic-${drawn.special}`} onClick={useDrawnMagic}>✦ USE {drawn.special.toUpperCase()}</button>}
    </div></motion.div>}
   <div className={`you ${current===0?'active-human':''}`} style={{'--accent':myColor} as React.CSSProperties}><div className="hand player-hand-frame human-hand-frame" data-player={players[0].name} data-score={`${players[0].score} PTS`}>{players[0].hand.map((c,i)=>{const hidden=memoryMode==='hard'||!players[0].memory.has(i);return <div className={`${selected===i?'selected ':''} inspectable-card`} key={c.id}><CardView value={c.value} special={c.special} hidden={hidden} onClick={()=>{if(stage==='replace'){setSelected(i);replaceHuman(i)}}}/><button className="inspect-trigger" title="Examine card" aria-label={`Examine card ${i+1}`} onClick={(e)=>{e.stopPropagation();setInspectCard({src:hidden?BACK:cardArt(c.value,c.special),label:hidden?'HIDDEN CARD':`${c.special?c.special.toUpperCase()+' · ':''}CARD ${c.value}`})}}>⌕</button></div>})}</div><p>{calledBy!==null?`${players[calledBy].name} called NOCTIS · final turns`:current===0?(stage==='draw'?'Draw a card or Call Noctis.':'Choose a card to replace.'):`${players[current].name}'s turn`}</p><button className={`cabo noctis-seal ${calledBy!==null?'called':''}`} onClick={callCabo} disabled={current!==0||stage!=='draw'||calledBy!==null}>{calledBy!==null?<><span>☾ NOCTIS CALLED</span><small>{finalTurns??0} FINAL TURNS REMAIN</small></>:<><span>✦ CALL NOCTIS ✦</span><small>END THE NIGHT</small></>}</button></div></div>
   <div className="hud-right"><section className="music"><b>{music?'♫':'♩'} Midnight Horizon</b><small>{music?'Ambient synth playing':'Music paused'}</small><div className="wave"/><input className="game-volume" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><small>{volume}%</small></section><section className="log"><div className="log-head"><span>GAME LOG</span><small>{log.length} EVENTS</small></div><div className="log-scroll">{log.map((m,i)=><p key={i}>{m}</p>)}</div></section><section className={`hud-chat ${chatMinimized?'minimized':''}`}><div className="chat-title"><span>CHAT</span><button className="chat-minimize" onClick={()=>setChatMinimized(v=>!v)} title={chatMinimized?'Restore chat':'Minimize chat'} aria-label={chatMinimized?'Restore chat':'Minimize chat'}>{chatMinimized?'□':'—'}</button></div>{!chatMinimized&&<><div className="chat-feed">{chatMessages.length===0?<small>Send a message or an emote.</small>:chatMessages.map((m,i)=><p key={i}><b>{m.name}</b> {m.text}</p>)}</div><form className="chat-compose" onSubmit={e=>{e.preventDefault();sendChat()}}><input value={chatText} maxLength={120} onChange={e=>setChatText(e.target.value)} placeholder="Type a message..."/><button type="submit">➤</button></form></>}</section><div className="actions"><button className={special==='peek'?'available':''}>◉ PEEK</button><button className={special==='spy'?'available':''}>⌁ SPY</button><button className={special==='swap'?'available':''}>↔ SWAP</button></div><section className="turn"><b>◷ {current===0?'YOUR TURN':players[current].name.toUpperCase()}</b><div className={`turn-clock ${turnSeconds<=10?'urgent':''}`}><strong>{turnSeconds}</strong><span>SEC</span></div><i className={`mode-chip ${memoryMode}`}>{memoryMode==='easy'?'✦ CELESTIAL · EASY':'☾ VEIL · HARD'}</i><small>{stage==='draw'&&current===0?'Draw a card.':stage==='replace'?'Replace one of your cards.':stage==='special'?(special==='swap'?'Complete the SWAP.':'Resolve the special action.'):'Please wait.'}</small></section></div>
   <div className="social-dock compact-social">
     <button className="social-toggle" onClick={()=>setChatOpen(v=>!v)} aria-label="Open emotes">✦ EMOTES</button>
     {chatOpen&&<motion.div className="social-panel emote-only-panel" initial={{opacity:0,y:12,scale:.96}} animate={{opacity:1,y:0,scale:1}}>
       <div className="emote-strip">{emotes.map(e=><button key={e.id} title={e.label} onClick={()=>sendEmote(e.id)}><img src={e.image} alt={e.label}/></button>)}</div>
     </motion.div>}
   </div>
   <AnimatePresence>{activeEmote&&<motion.div className="emote-burst" initial={{opacity:0,scale:.35,y:30}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.7,y:-30}} transition={{type:'spring',stiffness:260,damping:18}}><img src={activeEmote}/></motion.div>}</AnimatePresence>
   <AnimatePresence>{interactionEvent&&<motion.div className={`interaction-alert ${interactionEvent.type}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
     <motion.div className="interaction-alert-card" style={{'--actor':interactionEvent.actorColor} as React.CSSProperties} initial={{scale:.65,y:35,rotateX:18}} animate={{scale:1,y:0,rotateX:0}} exit={{scale:.82,y:-22,opacity:0}} transition={{type:'spring',stiffness:240,damping:20}}>
       <div className="interaction-symbol">{interactionEvent.type==='spy'?'◉':'⇄'}</div>
       <small>{interactionEvent.type==='spy'?'A SHADOW WATCHES':'THE CARDS SHIFT'}</small>
       <strong>{interactionEvent.actorName.toUpperCase()}</strong>
       <b>{interactionEvent.type==='spy'?'SPIED ON YOU':'SWAPPED WITH YOU'}</b>
       <span>{interactionEvent.actorZodiac?interactionEvent.actorZodiac.toUpperCase():'NOCTIS PLAYER'}</span>
     </motion.div>
   </motion.div>}</AnimatePresence>
   {special&&<SpecialOverlay special={special} players={players} mine={specialMine} setMine={setSpecialMine} onPeek={resolvePeek} onSpy={resolveSpy} onSwap={resolveSwap}/>} 
   {settingsOpen&&<SettingsModal language={language} setLanguage={setLanguage} music={music} setMusic={setMusic} sound={sound} setSound={setSound} volume={volume} setVolume={setVolume} backgroundAnimation={backgroundAnimation} setBackgroundAnimation={setBackgroundAnimation} onClose={()=>setSettingsOpen(false)}/>}
   <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:-15,x:'-50%'}} animate={{opacity:1,y:0,x:'-50%'}} exit={{opacity:0,y:-10,x:'-50%'}}>{toast}</motion.div>}</AnimatePresence>
 </motion.div></>
}

function CosmicAvatar({index,name,compact=false}:{index:number;name:string;compact?:boolean}){
 const sigils=['✦','☾','☀','✧'];
 const labels=['NOVA CORE','LUNAR VEIL','SOLAR ORBIT','ASTRAL BLOOM'];
 return <div className={`cosmic-avatar avatar-${index} ${compact?'compact':''}`} title={`${name} · ${labels[index]}`}>
   <div className="avatar-orbit"/>
   <div className="avatar-orbit second"/>
   <div className="avatar-core"><span>{sigils[index]}</span></div>
   <i/>
 </div>
}

function Opponent({p,index,count,active}:{p:GamePlayer;index:number;count:number;active:boolean}){
 const pos=count===2?'top':count===3?(index===1?'leftseat':'rightseat'):(index===1?'top':index===2?'rightseat':'leftseat');
 return <motion.div className={`seat ${pos==='top'?'top':'side '+pos} ${active?'active-seat':''}`} style={{'--accent':p.color||colors[index]} as React.CSSProperties}>
   <div className="mini-hand">{p.hand.map(c=><img key={c.id} src={BACK} alt="Hidden card"/>)}</div>
   <div className={`seat-nameplate nameplate-${pos==='top'?'top':pos}`}>
     <span className="nameplate-symbol">{index===1?'☾':index===2?'☀':'✦'}</span>
     <b>{p.name}</b>
     <small>{p.score} PTS</small>
   </div>
 </motion.div>
}

function DealingScreen({players,round,sound,onDone}:{players:GamePlayer[];round:number;sound:boolean;onDone:()=>void}){
 const total=players.length*4;
 const step=.26;
 const duration=.58;

 useEffect(()=>{
   const timers:number[]=[];
   if(sound){
     playShuffleSfx();
     for(let i=0;i<total;i++){
       timers.push(window.setTimeout(()=>playCardSfx('place'),Math.round((.45+i*step+duration)*1000)));
     }
   }
   const done=window.setTimeout(onDone,Math.round((.45+(total-1)*step+duration+1.15)*1000));
   return()=>{timers.forEach(t=>window.clearTimeout(t));window.clearTimeout(done)};
 },[]);

 const target=(pi:number,ci:number)=>{
   const count=players.length;
   // You
   if(pi===0)return {left:`${43+ci*4.4}%`,top:'82%',rotate:(ci-1.5)*2};
   // 2 players: opponent at top
   if(count===2)return {left:`${43+ci*4.4}%`,top:'18%',rotate:(ci-1.5)*-2};
   // 3 players: left / right
   if(count===3){
     if(pi===1)return {left:'26%',top:`${34+ci*9}%`,rotate:-3};
     return {left:'74%',top:`${34+ci*9}%`,rotate:3};
   }
   // 4 players: top / right / left
   if(pi===1)return {left:`${43+ci*4.4}%`,top:'18%',rotate:(ci-1.5)*-2};
   if(pi===2)return {left:'75%',top:`${34+ci*9}%`,rotate:3};
   return {left:'25%',top:`${34+ci*9}%`,rotate:-3};
 };

 const cards=players.flatMap((p,pi)=>p.hand.map((c,ci)=>({p,pi,c,ci})));
 return <div className="deal-screen">
   <div className="deal-board">
     <div className="deal-orbit one"/><div className="deal-orbit two"/><div className="deal-orbit three"/>
     <div className="deal-title"><small>ROUND {round}</small><b>DEALING THE CARDS</b><span>✦</span></div>
     <div className="deal-deck">
       <img src={BACK}/><img src={BACK}/><img src={BACK}/>
     </div>
     {cards.map(({p,pi,c,ci},i)=>{
       const to=target(pi,ci);
       return <motion.div
         className="dealt-card"
         key={c.id}
         initial={{left:'50%',top:'50%',x:'-50%',y:'-50%',scale:.72,rotate:-8,opacity:0}}
         animate={{left:to.left,top:to.top,x:'-50%',y:'-50%',scale:1,rotate:to.rotate,opacity:1}}
         transition={{delay:.45+i*step,duration,ease:[.22,.8,.2,1]}}
       ><img src={BACK}/></motion.div>
     })}
     <div className="deal-seat-label label-you">{players[0]?.name||'You'}</div>
     {players.slice(1).map((p,i)=><div key={p.id} className={`deal-seat-label label-opponent label-${i+1}-${players.length}`}>{p.name}</div>)}
   </div>
 </div>
}

function Opening({players,selected,onToggle,onConfirm,confirmed=false}:{players:GamePlayer[];selected:number[];onToggle:(i:number)=>void;onConfirm:()=>void;confirmed?:boolean}){
 return <div className="opening-screen"><div className="opening-box"><div className="moon small">☾</div><span>OPENING MEMORY</span><h2>{confirmed?'Memory locked':'Choose two cards to memorize'}</h2><p>{confirmed?'Waiting for the other players to finish memorizing their cards…':'Choose carefully: once you reveal a card, that choice is locked for this round.'}</p><div className="opening-hand">{players[0].hand.map((c,i)=>{const picked=selected.includes(i),blocked=!picked&&selected.length>=2;return <div key={c.id} className={`${picked?'picked opening-locked':''} ${blocked?'opening-blocked':''}`}><CardView value={c.value} special={c.special} hidden={confirmed||!picked} onClick={()=>{if(!confirmed&&!blocked)onToggle(i)}}/>{picked&&!confirmed&&<small className="opening-lock-mark">LOCKED</small>}</div>})}</div><b>{confirmed?'✓ READY':`${selected.length} / 2 locked`}</b><button className="primary" disabled={confirmed||selected.length!==2} onClick={onConfirm}>{confirmed?'WAITING FOR PLAYERS…':'MEMORIZE & READY'}</button></div></div>
}

function SpecialOverlay({special,players,mine,setMine,onPeek,onSpy,onSwap}:{special:SpecialAction;players:GamePlayer[];mine:number|null;setMine:(i:number)=>void;onPeek:(i:number)=>void;onSpy:(p:number,c:number)=>void;onSwap:(my:number,p:number,c:number)=>void}){
 const [targetPlayer,setTargetPlayer]=useState<number|null>(null);
 const [targetCard,setTargetCard]=useState<number|null>(null);
 const [spyReveal,setSpyReveal]=useState<{pi:number;ci:number}|null>(null);
 const [spySeconds,setSpySeconds]=useState(4);
 const [peekReveal,setPeekReveal]=useState<number|null>(null);
 const [peekSeconds,setPeekSeconds]=useState(4);

 useEffect(()=>{
   if(peekReveal===null)return;
   setPeekSeconds(4);
   const tick=window.setInterval(()=>setPeekSeconds(s=>Math.max(0,s-1)),1000);
   const done=window.setTimeout(()=>{window.clearInterval(tick);onPeek(peekReveal)},4000);
   return()=>{window.clearInterval(tick);window.clearTimeout(done)};
 },[peekReveal]);

 useEffect(()=>{
   if(!spyReveal)return;
   setSpySeconds(4);
   const tick=window.setInterval(()=>setSpySeconds(s=>Math.max(0,s-1)),1000);
   const done=window.setTimeout(()=>{window.clearInterval(tick);onSpy(spyReveal.pi,spyReveal.ci)},4000);
   return()=>{window.clearInterval(tick);window.clearTimeout(done)};
 },[spyReveal]);

 if(special==='peek'&&peekReveal!==null){
   const card=players[0].hand[peekReveal];
   return <div className="special-overlay"><div className="special-box spy-reveal-box">
     <span>PEEK · MEMORY WINDOW</span><h2>Remember this card</h2>
     <p>It will turn face-down again in a few seconds.</p>
     <motion.div className="spy-revealed-card" initial={{rotateY:90,scale:.8,opacity:0}} animate={{rotateY:0,scale:1,opacity:1}} transition={{duration:.35}}>
       <img src={cardArt(card.value,card.special)}/><b>YOUR CARD {peekReveal+1}</b>
     </motion.div>
     <div className="spy-timer"><i style={{width:`${peekSeconds/4*100}%`}}/><span>{peekSeconds}s</span></div>
   </div></div>
 }

 if(special==='spy'&&spyReveal){
   const card=players[spyReveal.pi].hand[spyReveal.ci];
   return <div className="special-overlay"><div className="special-box spy-reveal-box">
     <span>SPY · MEMORY WINDOW</span><h2>Remember this card</h2>
     <p>You have a few seconds before it disappears.</p>
     <motion.div className="spy-revealed-card" initial={{rotateY:90,scale:.8,opacity:0}} animate={{rotateY:0,scale:1,opacity:1}} transition={{duration:.35}}>
       <img src={cardArt(card.value,card.special)}/><b>{players[spyReveal.pi].name} · CARD {spyReveal.ci+1}</b>
     </motion.div>
     <div className="spy-timer"><i style={{width:`${spySeconds/4*100}%`}}/><span>{spySeconds}s</span></div>
   </div></div>
 }

 return <div className="special-overlay"><div className="special-box"><span>SPECIAL ACTION</span><h2>{special.toUpperCase()}</h2>
 {special==='peek'&&<><p>Choose one of your cards to peek at.</p><div className="choice-grid">{players[0].hand.map((c,i)=><button key={c.id} onClick={()=>setPeekReveal(i)}><img src={BACK}/><small>Your card {i+1}</small></button>)}</div></>}

 {special==='spy'&&targetPlayer===null&&<><p>First choose the player you want to spy on.</p><div className="spy-player-grid">{players.slice(1).map((p,pi)=><motion.button key={p.id} className="spy-player" whileHover={{y:-5,scale:1.02}} whileTap={{scale:.98}} onClick={()=>setTargetPlayer(pi+1)} style={{'--spy-accent':colors[pi+1]} as React.CSSProperties}><CosmicAvatar index={pi+1} name={p.name} compact/><b>{p.name}</b><small>{p.hand.length} hidden cards</small><span>SELECT PLAYER →</span></motion.button>)}</div></>}
 {special==='spy'&&targetPlayer!==null&&<><div className="spy-step-head"><button onClick={()=>setTargetPlayer(null)}>← PLAYERS</button><p>Choose one of <strong>{players[targetPlayer].name}</strong>’s cards.</p></div><div className="spy-card-row">{players[targetPlayer].hand.map((c,ci)=><motion.button key={c.id} whileHover={{y:-12,scale:1.04}} whileTap={{scale:.97}} onClick={()=>setSpyReveal({pi:targetPlayer,ci})}><img src={BACK}/><small>CARD {ci+1}</small></motion.button>)}</div></>}

 {special==='swap'&&targetPlayer===null&&<><div className="magic-active-note">SWAP ACTIVE</div><p>Choose the player you want to swap with.</p><div className="spy-player-grid">{players.slice(1).map((p,pi)=><motion.button key={p.id} className="spy-player swap-player" whileHover={{y:-5,scale:1.02}} whileTap={{scale:.98}} onClick={()=>setTargetPlayer(pi+1)} style={{'--spy-accent':colors[pi+1]} as React.CSSProperties}><CosmicAvatar index={pi+1} name={p.name} compact/><b>{p.name}</b><small>Choose who to trade with</small><span>SELECT PLAYER →</span></motion.button>)}</div></>}
 {special==='swap'&&targetPlayer!==null&&targetCard===null&&<><div className="magic-active-note">SWAP ACTIVE</div><div className="spy-step-head"><button onClick={()=>setTargetPlayer(null)}>← PLAYERS</button><p>Choose one of <strong>{players[targetPlayer].name}</strong>’s cards.</p></div><div className="spy-card-row">{players[targetPlayer].hand.map((c,ci)=><motion.button key={c.id} whileHover={{y:-12,scale:1.04}} whileTap={{scale:.97}} onClick={()=>setTargetCard(ci)}><img src={BACK}/><small>CARD {ci+1}</small></motion.button>)}</div></>}
 {special==='swap'&&targetPlayer!==null&&targetCard!==null&&<><div className="magic-active-note">SWAP ACTIVE · FINAL STEP</div><div className="spy-step-head"><button onClick={()=>setTargetCard(null)}>← THEIR CARDS</button><p>Choose <strong>your</strong> card to swap with {players[targetPlayer].name}’s card {targetCard+1}.</p></div><div className="choice-grid">{players[0].hand.map((c,i)=><motion.button key={c.id} whileHover={{y:-10,scale:1.03}} onClick={()=>onSwap(i,targetPlayer,targetCard)}><img src={BACK}/><small>Your card {i+1}</small></motion.button>)}</div></>}
 </div></div>
}

function MovingCard({move,playerCount}:{move:{value:number;special?:SpecialAction;from:string;to:string;hidden?:boolean};playerCount:number}){
 const point=(key:string)=>{
   if(key==='deck') return {left:'calc(50% - 88px)',top:'43%'};
   if(key==='discard') return {left:'calc(50% + 88px)',top:'43%'};
   if(key==='drawn') return {left:'calc(50% + 205px)',top:'43%'};
   if(key.startsWith('hand-')){
     const i=Number(key.split('-')[1]);return {left:`calc(50% + ${(i-1.5)*153}px)`,top:'76%'};
   }
   if(key.startsWith('bot-')){
     const i=Number(key.split('-')[1]);
     if(playerCount===2||i===1) return {left:'50%',top:'18%'};
     if(i===2) return {left:'78%',top:'41%'};
     return {left:'22%',top:'41%'};
   }
   return {left:'50%',top:'50%'};
 };
 const from=point(move.from),to=point(move.to);
 return <motion.div className="moving-card" initial={{...from,scale:.72,opacity:.7,rotate:-6}} animate={{...to,scale:1,opacity:1,rotate:4}} exit={{opacity:0,scale:.86}} transition={{duration:.55,ease:[.2,.8,.2,1]}}><img src={move.hidden?BACK:cardArt(move.value,move.special)} alt="Moving card"/></motion.div>
}


function PerfectEclipseSequence({winner,onNext,final,sound,bgAudio,musicEnabled,bgVolume,online=false,isHost=false}:{winner:GamePlayer;onNext:()=>void;final:boolean;sound:boolean;bgAudio:HTMLAudioElement|null;musicEnabled:boolean;bgVolume:number;online?:boolean;isHost?:boolean}){
 const [ready,setReady]=useState(false);
 useEffect(()=>{
   let audio:HTMLAudioElement|null=null;
   let fadeOut:number|undefined;
   const originalTime=bgAudio?.currentTime||0;

   // Cinematic audio handoff: quickly fade the normal soundtrack away.
   if(bgAudio && !bgAudio.paused){
     const startVol=bgAudio.volume;
     const steps=12;
     let step=0;
     fadeOut=window.setInterval(()=>{
       step++;
       bgAudio.volume=Math.max(0,startVol*(1-step/steps));
       if(step>=steps){
         if(fadeOut) window.clearInterval(fadeOut);
         bgAudio.pause();
         bgAudio.volume=bgVolume/100;
       }
     },35);
   }

   if(sound){
     try{
       audio=new Audio('/assets/sfx/perfect-eclipse.mp3');
       audio.volume=.88;
       window.setTimeout(()=>void audio?.play().catch(()=>{}),300);
     }catch{}
   }

   const timer=window.setTimeout(()=>setReady(true),19300);
   return()=>{
     window.clearTimeout(timer);
     if(fadeOut) window.clearInterval(fadeOut);
     if(audio){audio.pause();audio.currentTime=0}
     // Resume the soundtrack from the same position after leaving the event.
     if(bgAudio && musicEnabled){
       bgAudio.currentTime=originalTime;
       bgAudio.volume=0;
       void bgAudio.play().then(()=>{
         let step=0;
         const target=bgVolume/100;
         const fadeIn=window.setInterval(()=>{
           step++;
           bgAudio.volume=Math.min(target,target*(step/14));
           if(step>=14) window.clearInterval(fadeIn);
         },45);
       }).catch(()=>{bgAudio.volume=bgVolume/100});
     }
   };
 },[sound,bgAudio,musicEnabled,bgVolume]);
 return <motion.div className="perfect-eclipse-screen" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.35}}>
   <div className="eclipse-space"/>
   <div className="eclipse-vignette"/>
   <motion.div className="eclipse-corona" initial={{scale:.55,opacity:0}} animate={{scale:[.55,1.03,1],opacity:[0,1,.86]}} transition={{duration:3.4,times:[0,.72,1],ease:'easeOut'}}/>
   <motion.div className="eclipse-content" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:2.5,duration:.8}}>
     <motion.div className="eclipse-zodiac" initial={{scale:0,rotate:-22,opacity:0}} animate={{scale:1,rotate:0,opacity:1}} transition={{delay:1.2,duration:.7,type:'spring'}}>
       <img src={`/assets/zodiac/${winner.zodiac||'aries'}.png`} alt={winner.zodiac||'zodiac'}/>
     </motion.div>
     <motion.span className="eclipse-kicker" initial={{letterSpacing:'2px',opacity:0}} animate={{letterSpacing:'8px',opacity:1}} transition={{delay:.45,duration:.8}}>PERFECT</motion.span>
     <motion.h1 initial={{scale:.76,opacity:0,filter:'blur(12px)'}} animate={{scale:1,opacity:1,filter:'blur(0px)'}} transition={{delay:.75,duration:.75}}>ECLIPSE</motion.h1>
     <motion.div className="eclipse-hand" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:1.55}}>13 · 13 · 0 · 0</motion.div>
     <motion.div className="eclipse-score" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:2.45}}>
       <span>26</span><b>→</b><strong>0</strong>
     </motion.div>
     <motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:3.1}}>0 POINTS · ROUND WON</motion.p>
     <motion.div className="eclipse-winner" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:3.55}} style={{'--eclipse-player':winner.color||'#d9aa4b'} as React.CSSProperties}>{winner.name.toUpperCase()}</motion.div>
     <AnimatePresence>{ready&&<motion.button className="eclipse-next" disabled={online&&!isHost} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0}} onClick={()=>{if(!online||isHost)onNext()}}>{online?(isHost?'EVENT COMPLETE · CONTINUE':'EVENT COMPLETE · WAITING FOR HOST'):(final?'SHOW CHAMPION':'NEXT ROUND')}</motion.button>}</AnimatePresence>
   </motion.div>
   <motion.div className="eclipse-flash" initial={{opacity:0}} animate={{opacity:[0,0,.72,0]}} transition={{duration:5.2,times:[0,.52,.58,.72]}}/>
 </motion.div>
}

function RoundEnd({players,roundScores,onNext,final}:{players:GamePlayer[];roundScores:number[];onNext:()=>void;final:boolean}){
 const min=Math.min(...roundScores);
 const localWon=roundScores.length>0 && roundScores[0]===min;
 useEffect(()=>{const a=playResultSfx(localWon?'round-win':'round-lose');return()=>{a?.pause()}},[]);
 return <div className="result-screen"><div className="result-box victory-box" style={{'--victory':players[roundScores.indexOf(min)]?.color||'#d9aa4b'} as React.CSSProperties}><div className="victory-emblem"><img src={`/assets/zodiac/${players[roundScores.indexOf(min)]?.zodiac||'aries'}.png`}/></div><span>ROUND COMPLETE</span><h2>{players[roundScores.indexOf(min)]?.name} wins the round</h2><div className="result-grid">{players.map((p,i)=><div className="result-player" key={p.id}><b>{p.name}</b><div className="result-cards">{p.hand.map(c=><img src={cardArt(c.value,c.special)} key={c.id}/>)}</div><strong>{roundScores[i]} pts</strong><small>Total: {p.score}</small></div>)}</div><button className="primary" onClick={onNext}>{final?'SHOW WINNER':'NEXT ROUND'}</button></div></div>
}

function Winner({winner,localPlayerId,onRematch}:{winner:GamePlayer|null;localPlayerId?:string;onRematch:()=>void}){
 const localWon=!!winner && winner.id===localPlayerId;
 useEffect(()=>{const a=playResultSfx(localWon?'game-win':'game-lose');return()=>{a?.pause()}},[]);
 return <div className="winner-screen"><div className="winner-box victory-box game-victory" style={{'--victory':winner?.color||'#d9aa4b'} as React.CSSProperties}><div className="victory-emblem grand"><img src={`/assets/zodiac/${winner?.zodiac||'aries'}.png`}/></div><div className="winner-star">✦</div><span>GAME COMPLETE</span><h1>NOCTIS CHAMPION</h1><h2>{winner?.name}</h2><p>{winner?.score} total points · lowest score wins</p><button className="primary" onClick={onRematch}>REMATCH</button></div></div>}
