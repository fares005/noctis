import { motion } from 'framer-motion';
import type { SpecialAction } from '../game/types';

const normalArt:Record<number,string>={
  0:'/assets/card-0.png',1:'/assets/card-1.png',2:'/assets/card-2.png',3:'/assets/card-3.png',
  4:'/assets/card-4.png',5:'/assets/card-5.png',6:'/assets/card-6.png',7:'/assets/card-7.png',
  8:'/assets/card-8.png',9:'/assets/card-9.png',10:'/assets/card-10.png',11:'/assets/card-11.png',
  12:'/assets/card-12.png',13:'/assets/card-13.png'
};

const specialArt:Partial<Record<number,string>>={
  7:'/assets/card-7-peek.png',
  8:'/assets/card-8-peek.png',
  9:'/assets/card-9-spy.png',
  10:'/assets/card-10-spy.png',
  11:'/assets/card-11-swap.png',
  12:'/assets/card-12-swap.png'
};

export function cardArt(value:number,special?:SpecialAction){
  return special && specialArt[value] ? specialArt[value]! : normalArt[value];
}

export function Card({value,special,hidden=false,onClick}:{value:number;special?:SpecialAction;hidden?:boolean;onClick?:()=>void}){
  return <motion.button className="card" whileHover={{y:-12,scale:1.03}} whileTap={{scale:.97}} onClick={onClick}>
    <img src={hidden?'/assets/card-back-gold.png':cardArt(value,special)} alt={hidden?'Hidden card':`${special?special.toUpperCase()+' ':''}Card ${value}`}/>
  </motion.button>
}
