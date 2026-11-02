// An educational LIF network, not a fitted model of cultured neurons.
export class SpikingNetwork {
 constructor(seed=42){
  this.seed=seed;this.rng=seed;this.timeMs=0;this.remainder=0;this.trace=Array(32).fill(0);this.counts=Array(8).fill(0);this.cellCounts=Array(32).fill(0);
  this.feedbackLeft=0;this.feedbackDuration=0;this.feedbackKind='clear';this.weightUpdates=0;this.lastReward=null;this.lastDelta=0;this.pulses=[];this.inputRng=(seed^0x51f15e)>>>0;this.feedbackRng=(seed^0x9e3779b9)>>>0;
  this.neurons=Array.from({length:32},(_,id)=>({
   id,type:id%4===3?'I':'E',electrode:Math.floor(id/4),
   role:id<8?'sensory':id<24?'motor':'context',
   rest:-65,reset:-68,threshold:-51+this.random()*3,tauMs:18+this.random()*12,
   refractoryMs:2+Math.floor(this.random()*4),bias:9+this.random()*4,
   v:-65+this.random()*8,refractoryLeft:0,adaptation:0,spikes:0
  }));
  this.synapses=[];
  for(const pre of this.neurons)for(const post of this.neurons){
   if(pre.id===post.id||this.random()>.2)continue;
   const weight=(pre.type==='E'?1:-1)*(.4+this.random()*2);
   this.synapses.push({from:pre.id,to:post.id,weight,initial:weight,eligibility:0});
  }
  this.previous=[];
 }
 random(){this.rng=(Math.imul(1664525,this.rng)+1013904223)>>>0;return this.rng/4294967296}
 configureNeuron(id,patch){
  const cell=this.neurons[id];if(!cell)throw Error('Unknown neuron');
  const bounds={threshold:[-60,-40],tauMs:[5,100],refractoryMs:[1,20],bias:[0,30]};
  for(const [key,value]of Object.entries(patch)){
   if(!bounds[key]||!Number.isFinite(value)||value<bounds[key][0]||value>bounds[key][1])throw Error(`Invalid ${key}`);
  }
  Object.assign(cell,patch);
 }
 inputRandom(key){this[key]=(Math.imul(1664525,this[key])+1013904223)>>>0;return this[key]/4294967296}
 advance(ms,{rateHz=0,proprioHz=0,gain=1,plasticity=false,learningRate=.12}={}){
  if(!Number.isFinite(ms)||ms<0||ms>1000||!Number.isFinite(rateHz)||rateHz<0||rateHz>100||!Number.isFinite(gain)||gain<0||gain>2)throw Error('Invalid neural input');
  if(!Number.isFinite(proprioHz)||proprioHz<0||proprioHz>100||typeof plasticity!=='boolean'||!Number.isFinite(learningRate)||learningRate<0||learningRate>1)throw Error('Invalid plasticity or proprioceptive input');
  this.remainder+=ms;const steps=Math.floor(this.remainder+1e-9);this.remainder-=steps;
  for(let t=0;t<steps;t++)this.tick(rateHz,proprioHz,gain,plasticity,learningRate);
 }
 tick(rateHz,proprioHz,gain,plasticity,learningRate){
  const impulse=Array(32).fill(0),fired=[];
  for(const s of this.synapses){if(this.previous.includes(s.from))impulse[s.to]+=s.weight; s.eligibility*=Math.exp(-1/1000)}
  const targets=[];
  const addPulse=(channels,kind)=>{targets.push(...channels);this.pulses.push({network_time_ms:this.timeMs+1,channels,magnitude_mV:7*gain,kind})};
  const sensory=this.inputRandom('inputRng')<rateHz/1000,proprio=this.inputRandom('inputRng')<proprioHz/1000;
  if(this.feedbackLeft>0){
   const predictable=this.feedbackKind==='clear';
   if(predictable&&(this.feedbackDuration-this.feedbackLeft)%10===0)addPulse([0,1],'predictable');
   if(!predictable&&this.inputRandom('feedbackRng')<.005)addPulse([this.inputRandom('feedbackRng')<.5?0:1],'unpredictable');
  }else{if(sensory)addPulse([0],'sensory');if(proprio)addPulse([1],'proprioception')}
  const background=this.neurons.map(()=>this.random()<.012);
  for(const n of this.neurons){
   n.adaptation*=Math.exp(-1/200);
   if(n.refractoryLeft>0){n.refractoryLeft--;n.v=n.reset;continue}
   const target=n.rest+n.bias*gain-n.adaptation;
   n.v=target+(n.v-target)*Math.exp(-1/n.tauMs);
   n.v+=impulse[n.id]*gain;
   if(background[n.id])n.v+=5*gain;
   if(targets.includes(n.electrode))n.v+=7*gain;
   n.v=Math.max(-90,n.v);
   if(n.v>=n.threshold){
    fired.push(n.id);n.spikes++;this.cellCounts[n.id]++;this.counts[n.electrode]++;
    n.v=n.reset;n.refractoryLeft=Math.ceil(n.refractoryMs);n.adaptation+=1.5;
   }
  }
  this.lastDelta=0;
  for(const s of this.synapses){
   if(this.neurons[s.from].type!=='E')continue;
   const delta=(fired.includes(s.to)?.02*this.trace[s.from]:0)-(fired.includes(s.from)?.021*this.trace[s.to]:0);
   s.eligibility+=delta;
   if(plasticity){const weight=Math.max(0,Math.min(6,s.weight+learningRate*delta));this.lastDelta+=Math.abs(weight-s.weight);s.weight=weight}
  }
  if(this.lastDelta>0)this.weightUpdates++;
  for(let i=0;i<32;i++)this.trace[i]=this.trace[i]*Math.exp(-1/20)+(fired.includes(i)?1:0);
  this.previous=fired;this.timeMs++;this.feedbackLeft=Math.max(0,this.feedbackLeft-1);
 }
 drainCounts(){const counts=this.counts;this.counts=Array(8).fill(0);return counts}
 feedback(outcome,durationMs=outcome==='clear'?500:1000){
  if(!['clear','collision'].includes(outcome)||!Number.isInteger(durationMs)||durationMs<0||durationMs>60000)throw Error('Invalid feedback');
  this.feedbackKind=outcome;this.feedbackDuration=durationMs;this.feedbackLeft=durationMs;
 }
 drainPulses(){const pulses=this.pulses;this.pulses=[];return pulses}
 drainCellCounts(){const counts=this.cellCounts;this.cellCounts=Array(32).fill(0);return counts}
 snapshot(){return {
  model:'32-cell heterogeneous leaky integrate-and-fire',model_version:'lif-dishbrain-v2',plasticity_rule:'local pair STDP (software assumption)',memory_origin:this.memoryOrigin??'fresh',seed:this.seed,time_ms:this.timeMs,
  integration_ms:1,noise_rate_hz:12,noise_jump_mV:5,adaptation_tau_ms:200,adaptation_increment_mV:1.5,
  stdp_tau_ms:20,eligibility_tau_ms:1000,a_plus:.02,a_minus:.021,max_excitatory_weight_mV:6,
  last_reward:this.lastReward,last_delta_mV:this.lastDelta,weight_updates:this.weightUpdates,
  weight_drift_mV:this.synapses.reduce((sum,s)=>sum+Math.abs(s.weight-s.initial),0),
  state:{rng:this.rng,input_rng:this.inputRng,feedback_rng:this.feedbackRng,remainder_ms:this.remainder,trace:[...this.trace],previous_spikes:[...this.previous],
   pooled_counts:[...this.counts],cell_counts:[...this.cellCounts],feedback:{kind:this.feedbackKind,duration_ms:this.feedbackDuration,remaining_ms:this.feedbackLeft},pending_pulses:structuredClone(this.pulses)},
  neurons:this.neurons.map(n=>({...n})),synapses:this.synapses.map(s=>({...s})),
  note:'Model parameters and signed synaptic voltage steps, not measured organoid cells or physical stimulation amplitudes.'
 }}
}
