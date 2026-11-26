import type { Card, SpecialAction } from './types';

function powerFor(value:number):SpecialAction|undefined{
  if(value===7 || value===8) return 'peek';
  if(value===9 || value===10) return 'spy';
  if(value===11 || value===12) return 'swap';
  return undefined;
}

export function createDeck():Card[]{
  const cards:Card[]=[];
  for(let value=0; value<=13; value++){
    for(let copy=0; copy<4; copy++){
      // Values 7–12: two normal cards + two magic cards.
      const special = value>=7 && value<=12 && copy<2 ? powerFor(value) : undefined;
      cards.push({
        id:`${value}-${special ?? 'normal'}-${copy}-${crypto.randomUUID()}`,
        value,
        special
      });
    }
  }
  return shuffle(cards);
}

export function shuffle<T>(a:T[]):T[]{
  const x=[...a];
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}
