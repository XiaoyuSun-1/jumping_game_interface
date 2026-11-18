import profiles from './finalspark-model.json' with {type:'json'};

export const FINALSPARK_VERSION='finalspark-markov-100ms-v1';
export const FINALSPARK_BIN_MS=100;
export const FINALSPARK_ORIGIN='FinalSpark simulated spikes';
export const FINALSPARK_ELECTRODES=8;
const stateEdges=[1,2,4,8];

export function finalSparkCorrelations(profileName){
 const profile=profiles.find(p=>p.name===profileName);
 if(!profile)return null;
 const {patterns,weights:[weights]}=profile;
 const size=weights.reduce((sum,w)=>sum+w,0);
 const channels=Array.from({length:FINALSPARK_ELECTRODES},(_,electrode)=>
  patterns.map(counts=>counts[electrode]));
 const centered=channels.map(values=>{
  const mean=values.reduce((sum,n,k)=>sum+n*weights[k],0)/size;
  return values.map(n=>n-mean);
 });
 const variance=centered.map(values=>values.reduce((sum,n,k)=>sum+n*n*weights[k],0));
 return centered.map((a,i)=>centered.map((b,j)=>{
  if(!variance[i]||!variance[j])return null;
  if(i===j)return 1;
  const covariance=a.reduce((sum,n,k)=>sum+n*b[k]*weights[k],0);
  return Math.max(-1,Math.min(1,covariance/Math.sqrt(variance[i]*variance[j])));
 }));
}

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
