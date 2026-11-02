import {TemporalCircuit} from './predictive-temporal.js';
export const predictorKey='neurorunner.predictor.v1';
export const predictorFeatures=['proximity > .25','proximity > .50','proximity > .75','airborne','contact','feedback phase'];

export class PredictiveObserver {
 constructor(seed=42){
  this.seed=seed;this.learningEnabled=true;this.error=null;
  this.circuit=new TemporalCircuit({seed,features:6,causes:2,tonicDrive:3,inhibitionIncrement:1.5,normalizationTauMs:5});
  this.statistics={samples:0,totalSurpriseNats:0,recentSurprise:[]};this.last=null;this.recordingId=null;this.lastSessionS=0;this.lastJumps=0;
 }
 beginTrial(recording,sessionTimeS=0){
  this.circuit.memoryCounts.fill(0);this.recordingId=recording.id;this.lastSessionS=sessionTimeS;this.lastJumps=0;
  recording.predictive={schema:'neurorunner.predictive-trial.v1',role:'observer',features:[...predictorFeatures],
   note:'Predictions only; no motor-control pathway. Circuit time is separate from game/session time.',initial:this.snapshot(),final:this.snapshot(),observations:[]};
 }
 prediction(input,action){
  // Observational diagnostic only. This value never enters circuit learning or the game decoder.
  const c=this.circuit,total=c.memoryCounts.reduce((a,b)=>a+b,0)+c.memoryPrior*c.causes,prior=Array(c.causes).fill(0),normalizers=Array(2*c.causes).fill(0);
  for(const s of c.transitionSynapses)normalizers[s.action*c.causes+s.from]+=Math.exp(-s.strength);
  for(const s of c.transitionSynapses)if(s.action===action)prior[s.to]+=Math.exp(-s.strength)/normalizers[s.action*c.causes+s.from]*(c.memoryCounts[s.from]+c.memoryPrior)/total;
  const logLikelihood=Array(c.causes).fill(0);
  for(const s of c.synapses)logLikelihood[s.to]-=s.strength*(s.rail==='on'?input[s.feature]:1-input[s.feature]);
  const logJoint=prior.map((p,k)=>Math.log(p)+logLikelihood[k]),max=Math.max(...logJoint);
  const logEvidence=max+Math.log(logJoint.reduce((sum,x)=>sum+Math.exp(x-max),0));
  return {prior,logJoint,surprise:Math.max(0,-logEvidence)};
 }
 sample(recording,{sessionTimeS,gameTimeS,intensity,airborne,contact,feedback,jumps,force=false}){
  if(!Number.isFinite(sessionTimeS)||sessionTimeS<0||!Number.isFinite(gameTimeS)||gameTimeS<0||!Number.isFinite(intensity)||intensity<0||intensity>1||
   [airborne,contact,feedback,force].some(x=>typeof x!=='boolean')||!Number.isSafeInteger(jumps)||jumps<0)throw Error('Invalid predictive observation');
  if(this.error)return null;
  if(this.recordingId!==recording.id)this.beginTrial(recording,sessionTimeS);
  if(!force&&sessionTimeS-this.lastSessionS<.1-1e-8)return null;
  const interval=Math.max(0,sessionTimeS-this.lastSessionS),action=jumps>this.lastJumps?1:0;
  const input=[intensity>.25?1:0,intensity>.5?1:0,intensity>.75?1:0,airborne?1:0,contact?1:0,feedback?1:0];
  const before=this.prediction(input,action);
  const response=this.circuit.observe(input,{action,learn:this.learningEnabled,inferenceSpikes:4,learningRate:.03});
  const belief=response.memoryCounts.map(n=>n/4);
  const F=belief.reduce((sum,p,k)=>sum+(p?p*(Math.log(p)-before.logJoint[k]):0),0);
  this.last={sample:++this.statistics.samples,session_time_s:sessionTimeS,game_time_s:gameTimeS,observation_interval_s:interval,
   input,executed_action:action,learning:this.learningEnabled,prior:before.prior,belief,
   pre_update_surprise_nats:before.surprise,variational_free_energy_nats:F,
   inference_duration_ms:response.events.at(-1).latencyMs,spikes:response.events};
  this.statistics.totalSurpriseNats+=before.surprise;this.statistics.recentSurprise.push(before.surprise);
  if(this.statistics.recentSurprise.length>50)this.statistics.recentSurprise.shift();
  this.lastSessionS=sessionTimeS;this.lastJumps=jumps;
  recording.predictive.observations.push(structuredClone(this.last));recording.predictive.final=this.snapshot();recording.revision++;
  return this.last;
 }
 snapshot(){return structuredClone({schema:'neurorunner.predictor.v1',role:'observer',seed:this.seed,learningEnabled:this.learningEnabled,
  statistics:this.statistics,circuit:this.circuit.snapshot()});}
}

export function savePredictor(storage,predictor){storage.setItem(predictorKey,JSON.stringify(predictor.snapshot()))}
export function restorePredictor(storage,defaultSeed=42){
 const text=storage.getItem(predictorKey);if(!text)return new PredictiveObserver(defaultSeed);
 const data=JSON.parse(text);if(data?.schema!=='neurorunner.predictor.v1'||data.role!=='observer'||typeof data.learningEnabled!=='boolean'||!Number.isInteger(data.seed)||data.seed<1||data.seed>0xffffffff)throw Error('Invalid predictor memory');
 const p=new PredictiveObserver(data.seed),saved=data.circuit;
 if(!saved||saved.model!=='spiking-predictive-temporal-v0'||saved.seed!==data.seed||saved.features!==6||saved.causes!==2||saved.tonicDrive!==3||saved.inhibitionIncrement!==1.5||saved.normalizationTauMs!==5||saved.adaptationIncrement!==0||!Number.isSafeInteger(saved.updates)||saved.updates<0)throw Error('Incompatible predictor memory');
 for(const key of ['synapses','transitionSynapses']){
  if(!Array.isArray(saved[key])||saved[key].length!==p.circuit[key].length)throw Error('Invalid predictor synapses');
  saved[key].forEach((s,i)=>{
   const target=p.circuit[key][i];
   for(const name of ['from','to','rail','feature','action','sign','sourceRelay','edgeId','pool'])if(s[name]!==target[name])throw Error('Invalid predictor topology');
   if(!Number.isFinite(s.strength)||s.strength<=0||s.strength>50)throw Error('Invalid predictor conductance');
   target.strength=s.strength;
  });
 }
 for(let i=0;i<p.circuit.synapses.length;i+=2)if(Math.abs(Math.exp(-p.circuit.synapses[i].strength)+Math.exp(-p.circuit.synapses[i+1].strength)-1)>1e-8)throw Error('Invalid predictor likelihood');
 const stats=data.statistics;
 if(!stats||!Number.isSafeInteger(stats.samples)||stats.samples<0||!Number.isFinite(stats.totalSurpriseNats)||stats.totalSurpriseNats<0||
  !Array.isArray(stats.recentSurprise)||stats.recentSurprise.length>50||stats.recentSurprise.some(x=>!Number.isFinite(x)||x<0))throw Error('Invalid predictor statistics');
 p.circuit.updates=saved.updates;p.statistics=structuredClone(stats);p.learningEnabled=data.learningEnabled;return p;
}
