import {SensoryCircuit} from './predictive-circuit.js';

// Experimental message/current-clamp circuit. The instantaneous relays and
// presynaptic normalization need a finite-dynamics implementation before game use.
export class TemporalCircuit extends SensoryCircuit {
 constructor(options={}){
  super(options);this.memoryCounts=Array(this.causes).fill(0);this.memoryPrior=1;
  this.normalizationTauMs=options.normalizationTauMs??0;
  if(!Number.isFinite(this.normalizationTauMs)||this.normalizationTauMs<0||this.normalizationTauMs>100)throw Error('Invalid normalization time constant');
  this.memoryRelays=Array.from({length:this.causes},(_,from)=>({id:this.causes+2*this.features+from,type:'I',role:'previous-cause relay',from}));
  this.transitionSynapses=[];this.edgeNeurons=[];this.columnNormalization=[];
  for(const action of [0,1])for(let from=0;from<this.causes;from++){
   this.columnNormalization.push({action,from,lastLogZ:0,current:0});
   for(let to=0;to<this.causes;to++){
    const id=this.causes+2*this.features+this.causes+this.edgeNeurons.length;
    this.edgeNeurons.push({id,type:'E',action,from,to,v:-65,spikes:0});
    this.transitionSynapses.push({action,from,to,pool:this.columnNormalization.length-1,sourceRelay:this.memoryRelays[from].id,edgeId:id,sign:-1,strength:Math.log(this.causes)});
   }
  }
 }
 validateAction(action){if(action!==0&&action!==1)throw Error('Expected executed action 0 or 1')}
 edgeTick(action){
  this.timeMs++;for(const n of this.neurons)n.adaptation*=Math.exp(-1/200);
  this.commonInhibition*=Math.exp(-1/5);
  if(this.normalizationTauMs>0){
   const totals=Array(this.columnNormalization.length).fill(0);
   for(const s of this.transitionSynapses)totals[s.pool]+=Math.exp(-s.strength);
   for(let i=0;i<totals.length;i++)this.columnNormalization[i].current+=(Math.log(totals[i])-this.columnNormalization[i].current)*(1-Math.exp(-1/this.normalizationTauMs));
  }
  if(this.inhibitionLeftMs>0){this.inhibitionLeftMs--;for(const n of this.edgeNeurons)n.v=-68;return null}
  const sensory=this.neurons.map(n=>-n.adaptation);
  for(const s of this.synapses)sensory[s.to]-=s.strength*this.relays[s.from-this.causes].trace;
  const total=this.memoryCounts.reduce((a,b)=>a+b,0)+this.memoryPrior*this.causes;
  if(!(total>0))throw Error('Previous-cause population has no activity or prior');
  let winner=null,earliest=1;
  for(let i=0;i<this.transitionSynapses.length;i++){
   const synapse=this.transitionSynapses[i],cell=this.edgeNeurons[i];if(synapse.action!==action)continue;
   const prior=(this.memoryCounts[synapse.from]+this.memoryPrior)/total;
   cell.v=-50+2*(Math.log(prior)-synapse.strength-this.columnNormalization[synapse.pool].current+sensory[synapse.to]+this.tonicDrive-this.commonInhibition);
   const wait=-Math.log(this.random())/Math.exp((cell.v+50)/2);
   if(wait<earliest){winner=i;earliest=wait}
  }
  if(winner===null)return null;
  const edge=this.edgeNeurons[winner],cause=this.neurons[edge.to];
  edge.spikes++;cause.spikes++;cause.adaptation+=this.adaptationIncrement;cause.v=edge.v;
  this.inhibitionLeftMs=2;
  this.commonInhibition+=this.inhibitionIncrement;
  return {type:'spike',edgeId:edge.id,action,from:edge.from,to:edge.to,winner:edge.to,timeMs:this.timeMs-1+earliest};
 }
 learnTransition(event,learningRate){
  const column=this.transitionSynapses.filter(s=>s.action===event.action&&s.from===event.from);
  const pool=this.columnNormalization[column[0].pool];
  // This normalization is restricted to one presynaptic resource pool, not an
  // independently learned probability table. Its biological dynamics are unverified.
  const raw=column.map(s=>-s.strength+learningRate*((s.to===event.to?1:0)-Math.exp(-s.strength-pool.current)));
  const max=Math.max(...raw),logZ=max+Math.log(raw.reduce((sum,x)=>sum+Math.exp(x-max),0));
  for(let i=0;i<column.length;i++)column[i].strength=this.normalizationTauMs>0?Math.max(1e-6,-raw[i]):-raw[i]+logZ;
  pool.lastLogZ=logZ;
 }
 sampleTransition(input,{action,learn=false,learningRate=.03}={}){
  this.validateInput(input);this.validateLearning({learn,learningRate});this.validateAction(action);
  const start=this.timeMs;this.present(input);
  for(let i=0;i<10000;i++){
   const event=this.edgeTick(action);if(!event)continue;
   if(learn&&learningRate>0){this.learnTransition(event,learningRate);this.learnCause(event.to,learningRate)}
   return {...event,latencyMs:event.timeMs-start};
  }
  throw Error('No temporal response within 10 neural seconds');
 }
 observe(input,{action,learn=false,learningRate=.03,inferenceSpikes=16}={}){
  this.validateInput(input);this.validateLearning({learn,learningRate});this.validateAction(action);
  if(!Number.isInteger(inferenceSpikes)||inferenceSpikes<1||inferenceSpikes>1000)throw Error('Invalid inference spike count');
  const events=[],start=this.timeMs;this.present(input);
  for(let i=0;i<10000*inferenceSpikes&&events.length<inferenceSpikes;i++){
   const event=this.edgeTick(action);if(event)events.push({...event,latencyMs:event.timeMs-start});
  }
  if(events.length!==inferenceSpikes)throw Error('Insufficient temporal inference spikes; record the failed observation');
  if(learn&&learningRate>0){const last=events.at(-1);this.learnTransition(last,learningRate);this.learnCause(last.to,learningRate)}
  this.memoryCounts=Array(this.causes).fill(0);for(const event of events)this.memoryCounts[event.to]++;
  return {events,memoryCounts:[...this.memoryCounts]};
 }
 snapshot(){return {...super.snapshot(),model:'spiking-predictive-temporal-v0',memoryCounts:[...this.memoryCounts],memoryPrior:this.memoryPrior,
  normalizationTauMs:this.normalizationTauMs,memoryRelays:structuredClone(this.memoryRelays),transitionSynapses:structuredClone(this.transitionSynapses),edgeNeurons:structuredClone(this.edgeNeurons),columnNormalization:structuredClone(this.columnNormalization)};}
}
