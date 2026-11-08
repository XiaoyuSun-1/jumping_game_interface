// Software pattern selection, separate from the simulated synaptic learning rule.
export const TRAINING_PAIRS=Object.freeze(Array.from({length:6},(_,i)=>i+2).flatMap((from,i,ids)=>ids.slice(i+1).map(to=>Object.freeze([from,to]))));
export class TrainingSelector {
 constructor(seed=42){
  if(!Number.isInteger(seed)||seed<1||seed>999999)throw Error('Invalid training seed');
  this.rng=(seed^0x9e3779b9)>>>0;this.values=Array(TRAINING_PAIRS.length).fill(1);this.eligibility=Array(TRAINING_PAIRS.length).fill(0);this.observations=0;
 }
 observe(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid trial performance');
  const credit={score_seconds:seconds,eligibility:[...this.eligibility],values_before:[...this.values]};
  for(let i=0;i<TRAINING_PAIRS.length;i++){
   this.values[i]=Math.max(1,this.values[i]+.3*(seconds-this.values[i])*this.eligibility[i]);
   this.eligibility[i]*=.3;
  }
  this.observations++;return {...credit,values_after:[...this.values]};
 }
 choose(mode='adaptive'){
  if(!['adaptive','random','none'].includes(mode))throw Error('Invalid training mode');
  if(mode==='none')return null;
  const weights=mode==='random'?Array(TRAINING_PAIRS.length).fill(1):this.values,total=weights.reduce((a,b)=>a+b,0),probabilities=weights.map(w=>w/total);
  this.rng=(Math.imul(1664525,this.rng)+1013904223)>>>0;
  let sample=this.rng/4294967296,index=TRAINING_PAIRS.length-1;
  for(let i=0;i<TRAINING_PAIRS.length;i++){sample-=probabilities[i];if(sample<0){index=i;break}}
  return {index,pair:[...TRAINING_PAIRS[index]],probabilities,mode};
 }
 delivered(index){
  if(!Number.isInteger(index)||index<0||index>=TRAINING_PAIRS.length)throw Error('Invalid pattern index');
  this.eligibility[index]+=1;
 }
 resetCredit(){this.eligibility.fill(0)}
 snapshot(){return {version:2,rng:this.rng,values:[...this.values],eligibility:[...this.eligibility],observations:this.observations,learning_rate:.3,trace_decay:.3}}
 static restore(state){
  const oldPairs=[[2,3],[2,4],[2,5],[3,4],[3,5],[4,5]],length=state?.version===1?oldPairs.length:TRAINING_PAIRS.length;
  if(!state||![1,2].includes(state.version)||!Number.isInteger(state.rng)||state.rng<0||state.rng>0xffffffff||
   !Number.isSafeInteger(state.observations)||state.observations<0||
   !Array.isArray(state.values)||state.values.length!==length||state.values.some(v=>!Number.isFinite(v)||v<1)||
   !Number.isFinite(state.values.reduce((a,b)=>a+b,0))||
   !Array.isArray(state.eligibility)||state.eligibility.length!==length||state.eligibility.some(v=>!Number.isFinite(v)||v<0||v>1.43))throw Error('Invalid training memory');
  const result=new TrainingSelector();result.rng=state.rng;result.observations=state.observations;
  if(state.version===1){oldPairs.forEach((pair,i)=>{const j=TRAINING_PAIRS.findIndex(p=>String(p)===String(pair));result.values[j]=state.values[i];result.eligibility[j]=state.eligibility[i]})}
  else{result.values=[...state.values];result.eligibility=[...state.eligibility]}
  return result;
 }
}
