import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type BackgroundPulse = 'peek'|'spy'|'swap'|'cabo'|null;

const pulseColors:Record<Exclude<BackgroundPulse,null>,string>={
  peek:'rgba(102,218,255,.32)',
  spy:'rgba(164,112,255,.34)',
  swap:'rgba(244,190,92,.38)',
  cabo:'rgba(255,207,103,.52)'
};

type Star={x:number;y:number;ox:number;oy:number;r:number;v:number;a:number;p:number;depth:number};
type Ripple={x:number;y:number;born:number;life:number;strength:number};

export function AnimatedBackground({enabled,pulse,resetKey}:{enabled:boolean;pulse:BackgroundPulse;resetKey?:string|number}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||!enabled)return;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;

    let raf=0;
    let stars:Star[]=[];
    let ripples:Ripple[]=[];
    let mouse={x:innerWidth/2,y:innerHeight/2,active:false};
    let smooth={x:mouse.x,y:mouse.y};

    const resize=()=>{
      const dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.floor(innerWidth*dpr);
      canvas.height=Math.floor(innerHeight*dpr);
      canvas.style.width=innerWidth+'px';
      canvas.style.height=innerHeight+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const count=Math.min(220,Math.max(110,Math.floor(innerWidth/7)));
      stars=Array.from({length:count},()=>{
        const x=Math.random()*innerWidth,y=Math.random()*innerHeight;
        return {x,y,ox:x,oy:y,r:Math.random()*1.55+.22,v:Math.random()*.095+.018,a:Math.random()*.58+.16,p:Math.random()*Math.PI*2,depth:Math.random()*.9+.1};
      });
    };

    const move=(e:PointerEvent)=>{
      mouse.x=e.clientX;mouse.y=e.clientY;mouse.active=true;
    };
    const leave=()=>{mouse.active=false};
    const click=(e:PointerEvent)=>{
      if(e.button!==0)return;
      ripples.push({x:e.clientX,y:e.clientY,born:performance.now(),life:1150,strength:1});
      if(ripples.length>8)ripples.shift();
    };

    const draw=(time:number)=>{
      ctx.clearRect(0,0,innerWidth,innerHeight);
      smooth.x+=(mouse.x-smooth.x)*.07;
      smooth.y+=(mouse.y-smooth.y)*.07;

      // Very faint gold constellation links around the cursor.
      if(mouse.active){
        const near=stars.filter(s=>Math.hypot(s.ox-smooth.x,s.oy-smooth.y)<150).slice(0,14);
        ctx.lineWidth=.45;
        for(let i=0;i<near.length-1;i++){
          const a=near[i],b=near[i+1];
          ctx.strokeStyle='rgba(230,184,92,.065)';
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        }
      }

      for(const s of stars){
        s.oy-=s.v;
        if(s.oy<-5){s.oy=innerHeight+5;s.ox=Math.random()*innerWidth}
        let tx=s.ox,ty=s.oy;

        // Cursor acts like a gentle gravitational lens / water displacement.
        if(mouse.active){
          const dx=s.ox-smooth.x,dy=s.oy-smooth.y;
          const dist=Math.max(1,Math.hypot(dx,dy));
          const radius=185;
          if(dist<radius){
            const force=(1-dist/radius)*22*s.depth;
            tx+=dx/dist*force;
            ty+=dy/dist*force;
          }
          // Tiny parallax across the entire field.
          tx+=(smooth.x-innerWidth/2)/innerWidth*8*s.depth;
          ty+=(smooth.y-innerHeight/2)/innerHeight*5*s.depth;
        }

        // Ripple waves displace stars as rings pass through them.
        for(const r of ripples){
          const age=time-r.born;
          if(age<0||age>r.life)continue;
          const progress=age/r.life;
          const radius=progress*360;
          const dx=s.ox-r.x,dy=s.oy-r.y;
          const dist=Math.max(1,Math.hypot(dx,dy));
          const band=Math.abs(dist-radius);
          if(band<42){
            const wave=(1-band/42)*(1-progress)*17*r.strength;
            tx+=dx/dist*wave;
            ty+=dy/dist*wave;
          }
        }

        s.x+=(tx-s.x)*.18;s.y+=(ty-s.y)*.18;
        const twinkle=.66+.34*Math.sin(time*.00115+s.p);
        ctx.globalAlpha=s.a*twinkle;
        const palette=s.p<2.1?'#f2c76e':s.p<4.2?'#8fdcff':'#b48cff';
        ctx.fillStyle=palette;
        ctx.shadowColor=palette;ctx.shadowBlur=s.r>1.15?5:0;
        ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;ctx.globalAlpha=1;

      // Render click ripples like luminous drops on cosmic water.
      ripples=ripples.filter(r=>time-r.born<r.life);
      for(const r of ripples){
        const age=time-r.born,progress=age/r.life;
        const ease=1-Math.pow(1-progress,2);
        const radius=ease*360;
        const alpha=(1-progress)*.52;
        const grad=ctx.createRadialGradient(r.x,r.y,Math.max(0,radius-10),r.x,r.y,radius+10);
        grad.addColorStop(0,'rgba(255,205,105,0)');
        grad.addColorStop(.48,`rgba(255,205,105,${alpha*.32})`);
        grad.addColorStop(.52,`rgba(125,190,255,${alpha*.38})`);
        grad.addColorStop(.56,'rgba(170,110,255,0)');
        ctx.fillStyle=grad;
        ctx.beginPath();ctx.arc(r.x,r.y,radius+12,0,Math.PI*2);ctx.fill();

        ctx.strokeStyle=`rgba(238,193,103,${alpha})`;
        ctx.lineWidth=1.4;
        ctx.beginPath();ctx.arc(r.x,r.y,radius,0,Math.PI*2);ctx.stroke();
        if(progress<.58){
          ctx.strokeStyle=`rgba(133,182,255,${alpha*.45})`;
          ctx.lineWidth=.8;
          ctx.beginPath();ctx.arc(r.x,r.y,radius*.68,0,Math.PI*2);ctx.stroke();
        }
      }

      raf=requestAnimationFrame(draw);
    };

    const visibility=()=>{
      if(document.visibilityState!=='visible')return;
      cancelAnimationFrame(raf);
      ripples=[];
      mouse={x:innerWidth/2,y:innerHeight/2,active:false};
      smooth={x:mouse.x,y:mouse.y};
      resize();
      ctx.clearRect(0,0,innerWidth,innerHeight);
      raf=requestAnimationFrame(draw);
    };

    resize();
    addEventListener('resize',resize);
    addEventListener('pointermove',move,{passive:true});
    addEventListener('pointerleave',leave);
    addEventListener('pointerdown',click,{passive:true});
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('focus',visibility);
    raf=requestAnimationFrame(draw);

    return()=>{
      cancelAnimationFrame(raf);
      removeEventListener('resize',resize);
      removeEventListener('pointermove',move);
      removeEventListener('pointerleave',leave);
      removeEventListener('pointerdown',click);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('focus',visibility);
      ctx.clearRect(0,0,innerWidth,innerHeight);
    };
  },[enabled,resetKey]);

  return <div className={`animated-bg ${enabled?'enabled':'disabled'}`} aria-hidden="true">
    <div className="cosmic-gold-haze"/>
    <div className="nebula nebula-one"/><div className="nebula nebula-two"/><div className="nebula nebula-three"/>
    <div className="aurora-band aurora-a"/><div className="aurora-band aurora-b"/>
    {enabled&&<canvas ref={canvasRef} className="star-canvas"/>}
    {enabled&&<div className="shooting-star shooting-one"/>}{enabled&&<div className="shooting-star shooting-two"/>}
    <AnimatePresence>{pulse&&<motion.div key={pulse} className={`game-pulse pulse-${pulse}`} initial={{opacity:0,scale:.15}} animate={{opacity:[0,.95,0],scale:[.15,.65,1.35]}} exit={{opacity:0}} transition={{duration:pulse==='cabo'?1.2:.75,ease:'easeOut'}} style={{'--pulse-color':pulseColors[pulse]} as React.CSSProperties}/>}</AnimatePresence>
  </div>
}
