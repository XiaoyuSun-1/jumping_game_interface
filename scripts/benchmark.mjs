import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';

const runs=[];
for(const plasticity of [false,true])for(let seed=1;seed<=20;seed++){
 const engine=new Engine({seed,plasticity});
 for(let trial=0;trial<20;trial++){
  for(let i=0;i<1800&&!engine.crashed;i++)engine.step(1/120);
  engine.finishTrial(engine.crashed?'collision':'15 s limit');
  runs.push({seed,plasticity,...engine.trials.at(-1)});
  if(!plasticity)assert.equal(engine.model.snapshot().weight_drift_mV,0);
  if(trial<19)engine.nextTrial();
 }
}
const average=rows=>rows.reduce((s,r)=>s+r.clears,0)/rows.length;
const summary=[false,true].map(plasticity=>{
 const rows=runs.filter(r=>r.plasticity===plasticity),first=rows.filter(r=>r.trial===1);
 return {plasticity,seeds:20,trials_per_seed:20,first_trial_zero_clear_fraction:first.filter(r=>r.clears===0).length/20,
  mean_clears_first_5:average(rows.filter(r=>r.trial<=5)),mean_clears_last_5:average(rows.filter(r=>r.trial>15)),mean_clears_all:average(rows)};
});
console.log(JSON.stringify({note:'Synthetic software benchmark. Score differences are not evidence of biological learning; seed noise and the learning rule both affect scores.',summary,runs},null,2));
