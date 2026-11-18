import profiles from './finalspark-model.json' with {type:'json'};

export const FINALSPARK_VERSION='finalspark-markov-100ms-v1';
export const FINALSPARK_BIN_MS=100;
export const FINALSPARK_ORIGIN='FinalSpark simulated spikes';
const stateEdges=[1,2,4,8];

export function createFinalSparkSource(seed,trial){
 const initialSeed=(seed^Math.imul(trial,0x85ebca6b))>>>0;
 let rng=initialSeed;
 const random=()=>{
  rng=(Math.imul(1664525,rng)+1013904223)>>>0;
  return rng/4294967296;
 };
 const {name,patterns,weights}=profiles[Math.floor(random()*profiles.length)];
 const cumulative=weights.map(row=>{
  let total=0;
  return row.map(weight=>total+=weight);
 });
 const nextRows=patterns.map(counts=>{
  const total=counts.reduce((sum,count)=>sum+count,0);
  return 1+stateEdges.filter(edge=>total>=edge).length;
 });
 let row=0;
 return {
  profile:name,
  seed:initialSeed,
  next(){
   const bounds=cumulative[row],draw=random()*bounds.at(-1);
   let low=0,high=bounds.length-1;
   while(low<high){
    const mid=Math.floor((low+high)/2);
    if(draw<bounds[mid])high=mid;else low=mid+1;
   }
   row=nextRows[low];
   return [...patterns[low]];
  }
 };
}
