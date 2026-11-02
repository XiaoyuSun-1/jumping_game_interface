import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Engine} from '../dist/engine.js';
// Skip recording serialization only; dynamics and all feedback/rest phases are unchanged.
export class HeadlessEngine extends Engine {
 emit(type,payload){return {seq:++this.seq,trial:this.trial,t_ms:Math.round(this.time*1000),network_time_ms:this.model.timeMs,type,payload}}
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
const seed=Number(process.argv[2]||42),trials=Number(process.argv[3]||5000);
if(!Number.isInteger(seed)||seed<1||seed>999999||!Number.isInteger(trials)||trials<1||trials>10000)throw Error('Expected seed and trial count');
for(const plasticity of [false,true]){
 const e=new HeadlessEngine({seed,plasticity});const scores=[];
 for(let t=0;t<trials;t++){
  for(let step=0;step<4000;step++){
   if(e.phase==='play'&&e.time>=15){e.finishTrial('15 s limit');e.crashed=true;e.setPhase('rest',e.config.restSeconds)}
   e.step(1/120);
   if(e.trialRecorded&&e.phase==='rest'&&e.phaseRemaining<1e-8)break;
  }
  scores.push({trial:e.trial,clears:e.clears,seconds:e.time,jumps:e.jumps,drift:e.model.snapshot().weight_drift_mV});
  if((t+1)%100===0||t+1===trials){const mean=rows=>rows.reduce((s,r)=>s+r.clears,0)/rows.length;
   console.log(JSON.stringify({seed,plasticity,trials:t+1,mean_first_100:mean(scores.slice(0,100)),mean_last_100:mean(scores.slice(-100)),drift:scores.at(-1).drift}));}
  if(t+1<trials)e.nextTrial();
 }
}

}
