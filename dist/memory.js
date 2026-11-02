import {SpikingNetwork} from './network.js';
import {createResearchSession} from './research-protocol.js';
export const memoryKey='neurorunner.memory.v1';
export function saveMemory(storage,engine){
 storage.setItem(memoryKey,JSON.stringify({version:1,model_version:'lif-dishbrain-v2',memory_origin:engine.model.memoryOrigin??'fresh',seed:engine.model.seed,config:engine.config,
  neurons:engine.model.neurons.map(({threshold,tauMs,refractoryMs,bias})=>({threshold,tauMs,refractoryMs,bias})),
  weights:engine.model.synapses.map(s=>s.weight),updates:engine.model.weightUpdates,
  trial:engine.trial,trials:engine.trials}));
}
export function restoreMemory(storage,engine){
 const text=storage.getItem(memoryKey);if(!text)return false;
 const data=JSON.parse(text);
 if(data.version!==1||!Number.isInteger(data.seed)||data.seed<1||data.seed>999999)throw Error('Invalid network memory');
 const config={...engine.config,...data.config,seed:data.seed,mode:'neural',restSeconds:0,missSeconds:1,clearSeconds:.5};engine.validate(config);
 const model=new SpikingNetwork(data.seed);
 if(data.neurons?.length!==32||data.weights?.length!==model.synapses.length)throw Error('Incompatible network memory');
 data.neurons.forEach((patch,id)=>model.configureNeuron(id,patch));
 model.synapses.forEach((s,i)=>{
  const w=data.weights[i];if(!Number.isFinite(w)||(model.neurons[s.from].type==='E'?w<0||w>6:w!==s.initial))throw Error('Invalid saved weight');
  s.weight=w;
 });
 if(!Number.isSafeInteger(data.updates)||data.updates<0||!Number.isSafeInteger(data.trial)||data.trial<1||data.trial>=Number.MAX_SAFE_INTEGER)throw Error('Invalid memory counters');
 if(!Array.isArray(data.trials)||data.trials.length>500||data.trials.some(t=>
  !Number.isSafeInteger(t.trial)||t.trial<1||t.trial>data.trial||
  !Number.isSafeInteger(t.clears)||t.clears<0||!Number.isSafeInteger(t.jumps)||t.jumps<0||
  !Number.isFinite(t.time_s)||t.time_s<0||!Number.isFinite(t.weight_drift_mV)||t.weight_drift_mV<0||
  !['collision','stopped','15 s limit','time limit'].includes(t.outcome)||!['neural','manual','bridge'].includes(t.mode)))throw Error('Invalid saved trial history');
 model.weightUpdates=data.updates;model.memoryOrigin=data.memory_origin??(data.model_version==='lif-dishbrain-v2'?'saved-v2':'legacy-outcome-STDP-weights');
 engine.config=config;engine.model=model;engine.trial=data.trial+1;engine.trials=data.trials;
 engine.rng=model.rng;engine.recordings=[];engine.events=[];engine.seq=0;engine.researchSession=createResearchSession({initialization:'continue',seed:model.seed},config);engine.resetGame();
 return true;
}
