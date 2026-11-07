import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {HeadlessEngine as Engine} from './feedback-benchmark.mjs';

const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
function run(engine,trials,maxSeconds){
 engine.startResearchSession({trial_count:trials,trial_limit_s:maxSeconds,initialization:'continue',seed:engine.model.seed});
 const budget=Math.ceil(trials*(maxSeconds+engine.config.trainingSeconds+1)*120);
 for(let i=0;i<budget&&!engine.researchComplete;i++)engine.sessionStep(1/120);
 if(!engine.researchComplete)throw Error('Experiment did not complete within its step budget');
 return engine.trials.slice(-trials);
}
function evaluate(seed,weights,evaluationTrials,maxSeconds,difficultyRamp){
 // Separate course seed, identical before/after and across conditions. No learning during evaluation.
 const e=new Engine({seed:seed+10000,difficultyRamp,trainingMode:'none',feedback:false,plasticity:false});
 e.model.synapses.forEach((s,i)=>s.weight=weights[i]);
 const rows=run(e,evaluationTrials,maxSeconds).map(t=>({seconds:t.time_s,clears:t.clears,jumps:t.jumps,capped:t.outcome==='time limit',speed_px_s:t.speed_px_s}));
 return {mean_seconds:mean(rows.map(t=>t.seconds)),mean_clears:mean(rows.map(t=>t.clears)),capped_trials:rows.filter(t=>t.capped).length,
  weights_changed:e.model.synapses.some((s,i)=>s.weight!==weights[i]),trials:rows};
}
export function runCondition({seed=42,mode='adaptive',trials=200,evaluationTrials=10,maxSeconds=45,difficultyRamp=true}={}){
 if(typeof difficultyRamp!=='boolean'||!Number.isInteger(seed)||seed<1||seed>980000||!['adaptive','random','none'].includes(mode)||
  !Number.isInteger(trials)||trials<1||trials>500||!Number.isInteger(evaluationTrials)||evaluationTrials<1||evaluationTrials>500||
  !Number.isFinite(maxSeconds)||maxSeconds<1||maxSeconds>600)throw Error('Invalid experiment options');
 const e=new Engine({seed,trainingMode:mode,difficultyRamp}),initial=e.model.synapses.map(s=>s.weight);
 const before=evaluate(seed,initial,evaluationTrials,maxSeconds,difficultyRamp),patterns=Array(6).fill(0);
 const emit=e.emit.bind(e);e.emit=(type,payload)=>{if(type==='feedback')patterns[payload.index]++;return emit(type,payload)};
 const rows=run(e,trials,maxSeconds),weights=e.model.synapses.map(s=>s.weight);
 const after=evaluate(seed,weights,evaluationTrials,maxSeconds,difficultyRamp);
 return {seed,mode,difficultyRamp,weight_before:initial[0],weight_after:weights[0],before,after,
  improvement_seconds:after.mean_seconds-before.mean_seconds,improvement_clears:after.mean_clears-before.mean_clears,
  training:{completed_trials:rows.length,pattern_counts:patterns,values:e.trainer.values,mean_seconds:mean(rows.map(t=>t.time_s))}};
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{seeds:{type:'string',default:'211,419,811,1597,3203,6421,12853,25717'},trials:{type:'string',default:'200'},'evaluation-trials':{type:'string',default:'10'},'max-seconds':{type:'string',default:'45'},'fixed-speed':{type:'boolean',default:false},output:{type:'string'}}});
 if(!values.output)throw Error('Specify a new JSON output path with --output');
 const seeds=values.seeds.split(',').map(Number),trials=Number(values.trials),evaluationTrials=Number(values['evaluation-trials']),maxSeconds=Number(values['max-seconds']);
 const difficultyRamp=!values['fixed-speed'],results=[];
 for(const seed of seeds)for(const mode of ['adaptive','random','none']){
  const row=runCondition({seed,mode,trials,evaluationTrials,maxSeconds,difficultyRamp});results.push(row);
  console.log(JSON.stringify({seed,mode,before:row.before.mean_seconds,after:row.after.mean_seconds,change:row.improvement_seconds}));
 }
 const summary=['adaptive','random','none'].map(mode=>{const rows=results.filter(r=>r.mode===mode);return {mode,seeds:rows.length,
  before_seconds:mean(rows.map(r=>r.before.mean_seconds)),after_seconds:mean(rows.map(r=>r.after.mean_seconds)),
  improvement_seconds:mean(rows.map(r=>r.improvement_seconds)),improved_seeds:rows.filter(r=>r.improvement_seconds>1e-8).length,
  before_clears:mean(rows.map(r=>r.before.mean_clears)),after_clears:mean(rows.map(r=>r.after.mean_clears))}});
 await writeFile(values.output,JSON.stringify({model:'simple-lif-v1',protocol:'paired-training-v1',seeds,trials,evaluationTrials,maxSeconds,difficultyRamp,
  method:'Matched initial weights; fixed held-out courses before/after; learning disabled during evaluation. Survival is capped; seeds are software replicates, not biological replicates.',summary,results},null,2),{flag:'wx'});
 console.log(JSON.stringify({summary,output:values.output}));
}
