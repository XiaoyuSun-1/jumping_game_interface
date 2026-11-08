import {SpikingNetwork,MODEL_VERSION} from './network.js';
import {TrainingSelector} from './training.js';
import {createResearchSession} from './research-protocol.js';
export const memoryKey='neurorunner.memory.simple-lif-v3';
export const priorEightMemoryKey='neurorunner.memory.simple-lif-v2';
export const previousMemoryKey='neurorunner.memory.simple-lif-v1';
export const legacyMemoryKey='neurorunner.memory.v1';
export function saveMemory(storage,engine){
 storage.setItem(memoryKey,JSON.stringify({version:3,model_version:MODEL_VERSION,seed:engine.model.seed,config:engine.config,
  neurons:engine.model.neurons.map(({threshold,tauMs,refractoryMs,bias})=>({threshold,tauMs,refractoryMs,bias})),
  synapses:structuredClone(engine.model.synapses),updates:engine.model.weightUpdates,training:engine.trainer.snapshot(),
  trial:engine.trial,trials:engine.trials}));
}
export function restoreMemory(storage,engine){
 const text=storage.getItem(memoryKey)??storage.getItem(priorEightMemoryKey)??storage.getItem(previousMemoryKey);if(!text)return false;
 const data=JSON.parse(text);
 const old=data.version===2&&data.model_version==='simple-lif-v1';
 if((!old&&(data.version!==3||![MODEL_VERSION,'simple-lif-v2'].includes(data.model_version)))||!Number.isInteger(data.seed)||data.seed<1||data.seed>999999)throw Error('Invalid network memory');
 const savedConfig={...data.config};
 // Migrate the prior browser defaults while retaining explicit timing overrides.
 if(savedConfig.trainingSeconds===.3)savedConfig.trainingSeconds=1;
 if(savedConfig.punishmentSeconds===.15)savedConfig.punishmentSeconds=.5;
 const config={...engine.config,...savedConfig,seed:data.seed,mode:'neural',difficultyRamp:false};engine.validate(config);
 const model=new SpikingNetwork(data.seed),trainer=TrainingSelector.restore(data.training);
 if(data.neurons?.length!==(old?6:8))throw Error('Incompatible network memory');
 data.neurons.forEach((patch,id)=>{
  if(!patch||Object.keys(patch).length!==4||!['threshold','tauMs','refractoryMs','bias'].every(k=>Object.hasOwn(patch,k)))throw Error('Invalid saved neuron');
  model.configureNeuron(id,patch);
 });
 if(old){
  if(data.weights?.length!==5)throw Error('Incompatible network memory');
  data.weights.forEach((weight,i)=>{if(!Number.isFinite(weight)||(i===0?weight<0||weight>12:weight!==20))throw Error('Invalid saved weight');model.synapses[i].weight=weight});
 }else{
  if(!Array.isArray(data.synapses)||data.synapses.length>56)throw Error('Invalid saved connections');
  model.synapses=[];
  for(const s of data.synapses){
   if(!s||typeof s.plastic!=='boolean'||!Number.isFinite(s.initial)||s.initial<0||s.initial>(s.plastic?12:20))throw Error('Invalid saved connection');
   model.addConnection(s.from,s.to,s.weight,s.plastic);model.synapses.at(-1).initial=s.initial;
  }
 }
 if(!Number.isSafeInteger(data.updates)||data.updates<0||!Number.isSafeInteger(data.trial)||data.trial<1||data.trial>=Number.MAX_SAFE_INTEGER)throw Error('Invalid memory counters');
 if(!Array.isArray(data.trials)||data.trials.length>500||data.trials.some(t=>
  !t||!Number.isSafeInteger(t.trial)||t.trial<1||t.trial>data.trial||
  !Number.isSafeInteger(t.clears)||t.clears<0||!Number.isSafeInteger(t.jumps)||t.jumps<0||
  !Number.isFinite(t.time_s)||t.time_s<0||!Number.isFinite(t.weight_drift_mV)||t.weight_drift_mV<0||
  !['collision','stopped','15 s limit','time limit'].includes(t.outcome)||!['neural','manual','bridge'].includes(t.mode)))throw Error('Invalid saved trial history');
 model.weightUpdates=data.updates;model.memoryOrigin=old?'migrated-six-cell':'saved-simple-lif-v3';trainer.resetCredit();
 engine.config=config;engine.nextSpeed=config.speed;engine.model=model;engine.trainer=trainer;engine.trial=data.trial+1;engine.trials=data.trials;
 engine.rng=model.rng;engine.recordings=[];engine.events=[];engine.seq=0;engine.researchSession=createResearchSession({initialization:'continue',seed:model.seed},config);engine.resetGame();
 return true;
}
