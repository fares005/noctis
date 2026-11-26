import type { Language } from './Lobby';

const labels={
 en:{title:'SETTINGS',language:'Language',music:'Music',sound:'Sound effects',volume:'Music volume',animation:'Background animation',close:'DONE'},
 de:{title:'EINSTELLUNGEN',language:'Sprache',music:'Musik',sound:'Soundeffekte',volume:'Musiklautstärke',animation:'Hintergrundanimation',close:'FERTIG'},
 fr:{title:'PARAMÈTRES',language:'Langue',music:'Musique',sound:'Effets sonores',volume:'Volume de la musique',animation:'Animation de fond',close:'TERMINÉ'},
 ar:{title:'الإعدادات',language:'اللغة',music:'الموسيقى',sound:'المؤثرات الصوتية',volume:'مستوى صوت الموسيقى',animation:'حركة الخلفية',close:'تم'}
} as const;

export function SettingsModal({language,setLanguage,music,setMusic,sound,setSound,volume,setVolume,backgroundAnimation,setBackgroundAnimation,onClose}:{language:Language;setLanguage:(l:Language)=>void;music:boolean;setMusic:(v:boolean)=>void;sound:boolean;setSound:(v:boolean)=>void;volume:number;setVolume:(v:number)=>void;backgroundAnimation:boolean;setBackgroundAnimation:(v:boolean)=>void;onClose:()=>void}){
 const t=labels[language];
 return <div className="settings-overlay" dir={language==='ar'?'rtl':'ltr'}><div className="settings-modal">
   <div className="settings-head"><div><span>NOCTIS</span><h2>{t.title}</h2></div><button onClick={onClose}>×</button></div>
   <div className="setting-row"><div><b>🌐 {t.language}</b><small>English · Deutsch · Français · العربية</small></div><select value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="ar">العربية</option></select></div>
   <div className="setting-row"><div><b>♫ {t.music}</b><small>Midnight Horizon</small></div><button className={`toggle ${music?'active':''}`} onClick={()=>setMusic(!music)}><i/></button></div>
   <div className="setting-row"><div><b>◉ {t.sound}</b><small>Cards · turns · actions</small></div><button className={`toggle ${sound?'active':''}`} onClick={()=>setSound(!sound)}><i/></button></div>
   <div className="setting-row"><div><b>✦ {t.animation}</b><small>Nebula · stars · parallax · game pulses</small></div><button className={`toggle ${backgroundAnimation?'active':''}`} onClick={()=>setBackgroundAnimation(!backgroundAnimation)}><i/></button></div>
   <div className="volume-setting"><div><b>🔊 {t.volume}</b><strong>{volume}%</strong></div><input type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div>
   <button className="primary settings-done" onClick={onClose}>{t.close}</button>
 </div></div>
}
