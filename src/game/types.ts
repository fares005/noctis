export type SpecialAction='peek'|'spy'|'swap';
export type Card={id:string;value:number;special?:SpecialAction};
export type Player={id:string;name:string;score:number;hand:Card[];isHost?:boolean;color?:string;zodiac?:string};
export type GamePhase='loading'|'lobby'|'openingPeek'|'playing'|'roundEnd'|'gameEnd';
