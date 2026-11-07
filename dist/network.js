// A deliberately small software model, not a fitted model of an organoid.
export const MODEL_VERSION='simple-lif-v1';
export const CELL_LABELS=['Obstacle','Jump','Train A','Train B','Train C','Train D'];
export class SpikingNetwork {
 constructor(seed=42){
  this.seed=seed;this.rng=seed;this.timeMs=0;this.remainder=0;
  this.trace=Array(6).fill(0);this.counts=Array(6).fill(0);this.cellCounts=Array(6).fill(0);
  this.trainingLeft=0;this.trainingDuration=0;this.trainingPair=[];this.weightUpdates=0;this.lastDelta=0;this.pulses=[];this.inputPhase=[0];
  this.neurons=CELL_LABELS.map((label,id)=>({id,label,type:'E',electrode:id,role:id===0?'sensory':id===1?'motor':'training',
   rest:-65,reset:-65,threshold:-55,tauMs:30,refractoryMs:3,bias:0,v:-65,refractoryLeft:0,spikes:0}));
  const link=(from,to,weight,plastic=false)=>({from,to,weight,initial:weight,plastic});
  this.random(); // Mix the seed before choosing an initially weak, untrained connection.
  this.synapses=[link(0,1,3+this.random(),true),link(2,0,20),link(3,1,20),link(4,1,20),link(5,0,20)];
  this.previous=[];
 }
 random(){this.rng=(Math.imul(1664525,this.rng)+1013904223)>>>0;return this.rng/4294967296}
 configureNeuron(id,patch){
  const cell=this.neurons[id];if(!cell)throw Error('Unknown neuron');
  const bounds={threshold:[-60,-40],tauMs:[5,100],refractoryMs:[1,20],bias:[0,30]};
  for(const [key,value]of Object.entries(patch))if(!bounds[key]||!Number.isFinite(value)||value<bounds[key][0]||value>bounds[key][1])throw Error(`Invalid ${key}`);
  Object.assign(cell,patch);
 }
 advance(ms,{rateHz=0,proprioHz=0,gain=1,plasticity=false,learningRate=.12}={}){
  if(!Number.isFinite(ms)||ms<0||ms>1000||!Number.isFinite(rateHz)||rateHz<0||rateHz>100||!Number.isFinite(gain)||gain<0||gain>2)throw Error('Invalid neural input');
  if(!Number.isFinite(proprioHz)||proprioHz<0||proprioHz>100||typeof plasticity!=='boolean'||!Number.isFinite(learningRate)||learningRate<0||learningRate>1)throw Error('Invalid plasticity or proprioceptive input');
  this.remainder+=ms;const steps=Math.floor(this.remainder+1e-9);this.remainder-=steps;
  for(let t=0;t<steps;t++)this.tick(rateHz,proprioHz,gain,plasticity,learningRate);
 }
 tick(rateHz,proprioHz,gain,plasticity,learningRate){
  const impulse=Array(6).fill(0),fired=[],training=this.trainingLeft>0;
  for(const s of this.synapses)if(this.previous.includes(s.from))impulse[s.to]+=s.weight*gain;
  const pulse=(id,kind)=>{impulse[id]+=20*gain;this.pulses.push({network_time_ms:this.timeMs+1,channels:[id],magnitude_mV:20*gain,kind})};
  if(training){
   const offset=(this.trainingDuration-this.trainingLeft)%100;
   if(offset===0)pulse(this.trainingPair[0],'training');
   if(offset===5)pulse(this.trainingPair[1],'training');
  }else{
   for(const [id,rate]of [rateHz].entries()){
    if(rate===0){this.inputPhase[id]=0;continue}
    this.inputPhase[id]+=rate/1000;
    if(this.inputPhase[id]>=1-1e-9){this.inputPhase[id]-=1;pulse(id,id===0?'sensory':'proprioception')}
   }
  }
  for(const n of this.neurons){
   if(n.refractoryLeft>0){n.refractoryLeft--;n.v=n.reset;continue}
   const target=n.rest+n.bias*gain;
   n.v=Math.max(-90,target+(n.v-target)*Math.exp(-1/n.tauMs)+impulse[n.id]);
   if(n.v>=n.threshold){fired.push(n.id);n.spikes++;this.counts[n.id]++;this.cellCounts[n.id]++;n.v=n.reset;n.refractoryLeft=Math.ceil(n.refractoryMs)}
  }
  this.lastDelta=0;
  if(training&&plasticity)for(const s of this.synapses){
   if(!s.plastic)continue;
   const delta=(fired.includes(s.to)?.2*this.trace[s.from]:0)-(fired.includes(s.from)?.21*this.trace[s.to]:0);
   const weight=Math.max(0,Math.min(12,s.weight+learningRate*delta));this.lastDelta+=Math.abs(weight-s.weight);s.weight=weight;
  }
  if(this.lastDelta>0)this.weightUpdates++;
  for(let i=0;i<6;i++)this.trace[i]=this.trace[i]*Math.exp(-1/20)+(fired.includes(i)?1:0);
  this.previous=fired;this.timeMs++;this.trainingLeft=Math.max(0,this.trainingLeft-1);
 }
 train(pair,durationMs=300){
  if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(id=>!Number.isInteger(id)||id<2||id>5)||!Number.isInteger(durationMs)||durationMs<0||durationMs>60000)throw Error('Invalid training pattern');
  this.trainingPair=[...pair];this.trainingDuration=durationMs;this.trainingLeft=durationMs;
  this.trace.fill(0);this.previous=[];this.inputPhase.fill(0);
 }
 resetTransient(){
  this.trainingLeft=0;this.trainingDuration=0;this.trainingPair=[];this.previous=[];this.trace.fill(0);this.inputPhase.fill(0);
  this.neurons.forEach(n=>{n.v=n.rest;n.refractoryLeft=0});
 }
 drainCounts(){const counts=this.counts;this.counts=Array(6).fill(0);return counts}
 drainCellCounts(){const counts=this.cellCounts;this.cellCounts=Array(6).fill(0);return counts}
 drainPulses(){const pulses=this.pulses;this.pulses=[];return pulses}
 snapshot(){return {
  model:'6-cell leaky integrate-and-fire',model_version:MODEL_VERSION,plasticity_rule:'pair STDP on obstacle-to-jump connections during training only (software assumption)',
  memory_origin:this.memoryOrigin??'fresh',seed:this.seed,time_ms:this.timeMs,integration_ms:1,stdp_tau_ms:20,a_plus:.2,a_minus:.21,max_excitatory_weight_mV:12,
  last_delta_mV:this.lastDelta,weight_updates:this.weightUpdates,weight_drift_mV:this.synapses.reduce((sum,s)=>sum+Math.abs(s.weight-s.initial),0),
  state:{rng:this.rng,remainder_ms:this.remainder,trace:[...this.trace],previous_spikes:[...this.previous],input_phase:[...this.inputPhase],
   pooled_counts:[...this.counts],cell_counts:[...this.cellCounts],training:{pair:[...this.trainingPair],duration_ms:this.trainingDuration,remaining_ms:this.trainingLeft},pending_pulses:structuredClone(this.pulses)},
  neurons:this.neurons.map(n=>({...n})),synapses:this.synapses.map(s=>({...s})),
  note:'Each simulated cell maps to one channel. Model voltages are not physical stimulation settings. Training selection is a separate software algorithm.'
 }}
}
