import { useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, remove, runTransaction, set, update } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';

export type Language='en'|'de'|'fr'|'ar';
export type LobbyMember={id:string;name:string;bot:boolean;host?:boolean;color:string;zodiac:string};

const palette=['#39e8ff','#a768ff','#ff9a24','#ff4bb3','#53e38b','#ff5a5a'];
const zodiac=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const copy={
 en:{create:'CREATE GAME',join:'JOIN GAME',name:'Your name',createRoom:'CREATE ROOM',room:'ROOM',invite:'Invite your friends',copy:'COPY CODE',share:'SHARE',addBot:'ADD BOT',empty:'Waiting for player',start:'BEGIN THE NIGHT',leave:'LEAVE LOBBY',players:'PLAYERS',joinCode:'Room code',joinRoom:'JOIN ROOM',local:'Online friend joining will activate when Firebase is connected.',settings:'SETTINGS'},
 de:{create:'SPIEL ERSTELLEN',join:'SPIEL BEITRETEN',name:'Dein Name',createRoom:'RAUM ERSTELLEN',room:'RAUM',invite:'Lade deine Freunde ein',copy:'CODE KOPIEREN',share:'TEILEN',addBot:'BOT HINZUFÜGEN',empty:'Warte auf Spieler',start:'DIE NACHT BEGINNEN',leave:'LOBBY VERLASSEN',players:'SPIELER',joinCode:'Raumcode',joinRoom:'RAUM BEITRETEN',local:'Online-Beitritt wird aktiv, sobald Firebase verbunden ist.',settings:'EINSTELLUNGEN'},
 fr:{create:'CRÉER UNE PARTIE',join:'REJOINDRE',name:'Votre nom',createRoom:'CRÉER LE SALON',room:'SALON',invite:'Invitez vos amis',copy:'COPIER LE CODE',share:'PARTAGER',addBot:'AJOUTER UN BOT',empty:'En attente d’un joueur',start:'COMMENCER LA NUIT',leave:'QUITTER LE SALON',players:'JOUEURS',joinCode:'Code du salon',joinRoom:'REJOINDRE LE SALON',local:'Les amis pourront rejoindre en ligne dès que Firebase sera connecté.',settings:'PARAMÈTRES'},
 ar:{create:'إنشاء لعبة',join:'الانضمام',name:'اسمك',createRoom:'إنشاء الغرفة',room:'الغرفة',invite:'ادعُ أصدقاءك',copy:'نسخ الرمز',share:'مشاركة',addBot:'إضافة بوت',empty:'في انتظار لاعب',start:'ابدأ الليل',leave:'مغادرة الغرفة',players:'اللاعبون',joinCode:'رمز الغرفة',joinRoom:'انضم إلى الغرفة',local:'سينضم الأصدقاء عبر الإنترنت بعد ربط Firebase.',settings:'الإعدادات'}
} as const;
function makeCode(){return Math.random().toString(36).slice(2,7).toUpperCase()}

export function Lobby({language,onStart,onOpenSettings}:{language:Language;onStart:(name:string,members:LobbyMember[],room:string,rounds:number,memoryMode:'easy'|'hard')=>void;onOpenSettings:()=>void}){
 const t=copy[language], initialRoom=new URLSearchParams(window.location.search).get('room')?.toUpperCase()||'';
 const [tab,setTab]=useState<'create'|'join'>(initialRoom?'join':'create'),[name,setName]=useState('You'),[joinCode,setJoinCode]=useState(initialRoom),[room,setRoom]=useState<string|null>(null),[members,setMembers]=useState<LobbyMember[]>([]),[notice,setNotice]=useState('');
 const [color,setColor]=useState(localStorage.getItem('noctis-player-color')||palette[0]);
 const [sign,setSign]=useState(localStorage.getItem('noctis-zodiac')||'aries');
 const [rounds,setRounds]=useState(10),[custom,setCustom]=useState(12),[memoryMode,setMemoryMode]=useState<'easy'|'hard'>('hard');
 const [online,setOnline]=useState(false),[uid,setUid]=useState<string|null>(null),[roomHost,setRoomHost]=useState(false);
 const [countdown,setCountdown]=useState<number|null>(null),[countdownEndsAt,setCountdownEndsAt]=useState<number|null>(null);
 const roomRef=useRef<string|null>(null),startedRef=useRef(false),countdownStartRef=useRef(false);
 const firebaseReady=Boolean(import.meta.env.VITE_FIREBASE_API_KEY&&import.meta.env.VITE_FIREBASE_DATABASE_URL);
 const rtl=language==='ar',openSlots=4-members.length,canStart=members.length>=2;
 const inviteUrl=useMemo(()=>room?`${window.location.origin}${window.location.pathname}?room=${room}`:'',[room]);
 useEffect(()=>{
   if(!firebaseReady)return;
   signInAnonymously(auth).then(c=>{setUid(c.user.uid);setOnline(true)}).catch(()=>{setOnline(false)});
 },[firebaseReady]);
 useEffect(()=>{
   if(!room||!online)return;
   roomRef.current=room;startedRef.current=false;countdownStartRef.current=false;
   const rr=ref(db,`rooms/${room}`);
   const unsub=onValue(rr,snap=>{
     const data=snap.val();
     if(!data){setNotice('Room no longer exists.');return}
     const remoteMembers=(Object.values(data.members||{}) as LobbyMember[]).map(m=>({...m,host:m.id===data.hostId}));
     setMembers(remoteMembers);
     if(data.rounds)setRounds(data.rounds);
     if(data.memoryMode)setMemoryMode(data.memoryMode);
     const isHost=data.hostId===uid;setRoomHost(isHost);
     if(data.status==='countdown'&&data.countdownEndsAt){
       setCountdownEndsAt(data.countdownEndsAt);
     }else{
       setCountdownEndsAt(null);setCountdown(null);
     }
     if(data.status==='playing'&&data.startPayload&&!startedRef.current){
       startedRef.current=true;
       const p=data.startPayload;
       const localMember=remoteMembers.find(m=>m.id===uid);
       onStart(localMember?.name||name.trim()||'You',remoteMembers,room,p.rounds||data.rounds||10,p.memoryMode||data.memoryMode||'hard');
     }
   });
   return()=>unsub();
 },[room,online,uid]);

 useEffect(()=>{
   if(!countdownEndsAt||!room)return;
   const tick=()=>{
     const left=Math.max(0,Math.ceil((countdownEndsAt-Date.now())/1000));
     setCountdown(left);
     if(left===0&&roomHost&&!countdownStartRef.current){
       countdownStartRef.current=true;
       void update(ref(db,`rooms/${room}`),{
         status:'playing',
         countdownEndsAt:null,
         startPayload:{rounds,memoryMode,startedAt:Date.now()}
       });
     }
   };
   tick();const timer=window.setInterval(tick,200);
   return()=>window.clearInterval(timer);
 },[countdownEndsAt,room,roomHost,rounds,memoryMode]);

 const saveIdentity=()=>{localStorage.setItem('noctis-player-color',color);localStorage.setItem('noctis-zodiac',sign)};
 const colorTaken=(c:string)=>members.some(m=>!m.bot&&m.id!==uid&&m.color===c);
 const chooseColor=async(c:string)=>{
   if(colorTaken(c)){setNotice('That aura is already claimed by another player.');return}
   if(!online||!room||!uid){setColor(c);localStorage.setItem('noctis-player-color',c);return}
   const claimRef=ref(db,`rooms/${room}/colorClaims/${c.replace('#','')}`);
   const result=await runTransaction(claimRef,current=>current&&current!==uid?undefined:uid);
   if(!result.committed){setNotice('That aura was just claimed by another player.');return}
   const previous=color;
   setColor(c);localStorage.setItem('noctis-player-color',c);setNotice('');
   await update(ref(db,`rooms/${room}/members/${uid}`),{color:c});
   if(previous!==c)await remove(ref(db,`rooms/${room}/colorClaims/${previous.replace('#','')}`));
 };
 async function createRoom(){
   saveIdentity();const code=makeCode();
   const me:LobbyMember={id:uid||'host',name:name.trim()||'You',bot:false,host:true,color,zodiac:sign};
   setRoom(code);setMembers([me]);setRoomHost(true);setNotice('');
   if(online&&uid){
     await set(ref(db,`rooms/${code}`),{hostId:uid,status:'lobby',rounds,memoryMode,createdAt:Date.now(),members:{[uid]:me},colorClaims:{[color.replace('#','')]:uid}});
   }
 }
 async function addBot(){
   if(online&&!roomHost)return;
   if(members.length>=4)return;const names=['Luna','Orion','Nova'];const used=members.filter(m=>m.bot).length;
   const bot:LobbyMember={id:`bot-${Date.now()}`,name:names[used]||`Bot ${used+1}`,bot:true,color:palette[(used+1)%palette.length],zodiac:zodiac[(used+1)%zodiac.length]};
   if(online&&room)await set(ref(db,`rooms/${room}/members/${bot.id}`),bot);else setMembers(m=>[...m,bot]);
 }
 async function removeBot(id:string){
   if(online&&!roomHost)return;
   if(online&&room)await remove(ref(db,`rooms/${room}/members/${id}`));else setMembers(m=>m.filter(x=>x.id!==id));
 }
 async function beginCountdown(){
   if(!room||!roomHost||!canStart)return;
   countdownStartRef.current=false;
   await update(ref(db,`rooms/${room}`),{status:'countdown',countdownEndsAt:Date.now()+5000,rounds,memoryMode});
 }
 async function copyCode(){if(!room)return;try{await navigator.clipboard.writeText(room);setNotice('✓ '+t.copy)}catch{setNotice(room)}}
 async function share(){if(!room)return;try{if(navigator.share)await navigator.share({title:'NOCTIS',text:`Join my NOCTIS room: ${room}`,url:inviteUrl});else await navigator.clipboard.writeText(inviteUrl);setNotice('✓ '+t.share)}catch{}}
 async function attemptJoin(){
   saveIdentity();const code=joinCode.trim().toUpperCase();
   if(!online||!uid){setNotice('Firebase is not configured yet. Add the VITE_FIREBASE_* values to enable online rooms.');return}
   if(!code){setNotice('Enter a room code.');return}
   setRoomHost(false);setRoom(code);setNotice('Joining…');
   try{
     let joinColor=color;
     let claim=await runTransaction(ref(db,`rooms/${code}/colorClaims/${joinColor.replace('#','')}`),current=>current&&current!==uid?undefined:uid);
     if(!claim.committed){
       const used=members.map(m=>m.color);
       const alternatives=palette.filter(c=>!used.includes(c));
       let found:string|null=null;
       for(const candidate of alternatives){
         const r=await runTransaction(ref(db,`rooms/${code}/colorClaims/${candidate.replace('#','')}`),current=>current?undefined:uid);
         if(r.committed){found=candidate;break}
       }
       if(!found){setRoom(null);setNotice('All player auras in this room are already claimed.');return}
       joinColor=found;setColor(found);localStorage.setItem('noctis-player-color',found);
     }
     const me:LobbyMember={id:uid,name:name.trim()||'Player',bot:false,color:joinColor,zodiac:sign};
     await set(ref(db,`rooms/${code}/members/${uid}`),me);setNotice('');
   }catch{setRoom(null);setNotice('Could not join that room.')}
 }
 const setHostRounds=(n:number)=>{
   if(online&&!roomHost)return;
   setRounds(n);setCustom(n);
   if(online&&room)void update(ref(db,`rooms/${room}`),{rounds:n});
 };
 const setHostMemory=(mode:'easy'|'hard')=>{
   if(online&&!roomHost)return;
   setMemoryMode(mode);
   if(online&&room)void update(ref(db,`rooms/${room}`),{memoryMode:mode});
 };
 const identity=<div className="identity-forge"><div className="forge-title"><span>✦ CELESTIAL IDENTITY</span><small>Choose your color and zodiac seal</small></div><div className="color-row">{palette.map(c=>{const taken=colorTaken(c);return <button key={c} aria-label={taken?`${c} unavailable`:c} title={taken?'Aura already claimed':''} disabled={taken} className={`${color===c?'chosen ':''}${taken?'taken':''}`} style={{'--pick':c} as CSSProperties} onClick={()=>void chooseColor(c)}>{taken&&<span>×</span>}</button>})}</div><div className="zodiac-grid">{zodiac.map(z=><button key={z} className={sign===z?'chosen':''} onClick={()=>setSign(z)}><img src={`/assets/zodiac/${z}.png`}/><span>{z}</span></button>)}</div></div>;
 if(room)return <div className="lobby cosmic-lobby" dir={rtl?'rtl':'ltr'}>
  {countdown!==null&&<div className="night-countdown"><motion.div initial={{scale:.65,opacity:0}} animate={{scale:1,opacity:1}} key={countdown}><small>THE NIGHT BEGINS IN</small><strong>{countdown||'✦'}</strong><span>Prepare for the night</span></motion.div></div>}
  <motion.div className="lobby-box room-lobby cosmic-panel" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
   <div className="lobby-topline"><div><div className="moon small">☾</div><h1>NOCTIS</h1></div><button className="settings-chip" onClick={onOpenSettings}>⚙ {t.settings}</button></div>
   <p className="lobby-subtitle">{online?'● ONLINE':'○ LOCAL'} · THE NIGHT AWAITS · {t.room} <b className="neon-code">{room}</b></p>
   <div className="invite-panel"><span>{t.invite}</span><strong>{room}</strong><div><button onClick={copyCode}>⧉ {t.copy}</button><button onClick={share}>↗ {t.share}</button></div>{notice&&<small>{notice}</small>}</div>
   <div className={`night-length ${online&&!roomHost?'guest-locked':''}`}><span>LENGTH OF THE NIGHT</span><small>{roomHost?'You are the host · choose the number of rounds':'Host controls the number of rounds'}</small><div>{[3,5,7,10,15].map(n=><button disabled={online&&!roomHost} className={rounds===n?'active':''} onClick={()=>setHostRounds(n)} key={n}>✦ {n}</button>)}<button disabled={online&&!roomHost} className={![3,5,7,10,15].includes(rounds)?'active':''} onClick={()=>setHostRounds(custom)}>CUSTOM</button></div>{![3,5,7,10,15].includes(rounds)&&<input disabled={online&&!roomHost} type="number" min="1" max="30" value={custom} onChange={e=>setHostRounds(Math.max(1,Math.min(30,Number(e.target.value)||1)))}/>}<b>{rounds} ROUNDS</b></div>
   <div className={`memory-mode ${online&&!roomHost?'guest-locked':''}`}><span>MEMORY MODE</span><small>{roomHost?'You are the host · choose one rule for everyone':'Host controls the memory mode'}</small><div className="memory-options"><button disabled={online&&!roomHost} className={memoryMode==='easy'?'active easy':''} onClick={()=>setHostMemory('easy')}><b>✦ CELESTIAL</b><em>EASY</em><small>Seen cards stay visible to you.</small></button><button disabled={online&&!roomHost} className={memoryMode==='hard'?'active hard':''} onClick={()=>setHostMemory('hard')}><b>☾ VEIL</b><em>HARD</em><small>Cards hide again. Remember them.</small></button></div></div>
   <div className="lobby-members-title"><span>{t.players}</span><b>{members.length}/4</b></div>
   <div className="member-grid">{members.map(m=><div className="member-slot filled" key={m.id} style={{'--member':m.color} as CSSProperties}><div className="member-avatar">{m.name[0].toUpperCase()}</div><div className="member-copy"><b>{m.name}</b><small>{m.host?'HOST':m.bot?'BOT':'PLAYER'} · {m.zodiac.toUpperCase()}</small></div>{m.bot&&roomHost&&<button className="remove-bot" onClick={()=>void removeBot(m.id)}>×</button>}</div>)}{Array.from({length:openSlots}).map((_,i)=><div className="member-slot empty" key={i}><div className="empty-avatar">＋</div><div><b>{t.empty}</b>{roomHost&&<button onClick={()=>void addBot()}>{t.addBot}</button>}</div></div>)}</div>
   <div className="lobby-actions"><button className="secondary-lobby" onClick={()=>{setRoom(null);setMembers([]);setRoomHost(false)}}>{t.leave}</button>{roomHost?<button className="primary" disabled={!canStart||countdown!==null} onClick={()=>online?void beginCountdown():onStart(name.trim()||'You',members,room,rounds,memoryMode)}>{t.start}</button>:<button className="primary guest-waiting" disabled>WAITING FOR HOST</button>}</div>
  </motion.div>
 </div>;
 return <div className="lobby cosmic-lobby" dir={rtl?'rtl':'ltr'}><motion.div className="lobby-box cosmic-panel entry-panel" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}><div className="lobby-topline"><div className="lobby-brand"><div className="moon small">☾</div><h1>NOCTIS</h1></div><button className="settings-chip" onClick={onOpenSettings}>⚙</button></div><p className="lobby-subtitle">MEMORY · STRATEGY · MIDNIGHT</p><div className="tabs"><button className={tab==='create'?'active':''} onClick={()=>setTab('create')}>{t.create}</button><button className={tab==='join'?'active':''} onClick={()=>setTab('join')}>{t.join}</button></div><label>{t.name}<input value={name} onChange={e=>setName(e.target.value)} maxLength={14}/></label>{identity}{tab==='create'?<button className="primary" onClick={createRoom}>{t.createRoom}</button>:<><label>{t.joinCode}<input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={5} placeholder="K7DF9"/></label><button className="primary" onClick={attemptJoin}>{t.joinRoom}</button>{notice&&<div className="prototype-note">{notice}</div>}</>}</motion.div></div>
}
