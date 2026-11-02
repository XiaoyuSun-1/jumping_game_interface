// Current-clamp calibration circuit, not yet a game controller or an organoid model.
export class SensoryCircuit {
 constructor({seed=42,features=4,causes=2,adaptationIncrement=0,tonicDrive=0,inhibitionIncrement=0}={}){
  if(!Number.isInteger(seed)||seed<1||seed>0xffffffff||!Number.isInteger(features)||features<1||features>32||!Number.isInteger(causes)||causes<2||causes>32||!Number.isFinite(adaptationIncrement)||adaptationIncrement<0||adaptationIncrement>1)throw Error('Invalid circuit configuration');
  if(!Number.isFinite(tonicDrive)||tonicDrive<0||tonicDrive>5||!Number.isFinite(inhibitionIncrement)||inhibitionIncrement<0||inhibitionIncrement>10)throw Error('Invalid shared-current configuration');
  this.seed=seed;this.rng=seed;this.features=features;this.causes=causes;this.adaptationIncrement=adaptationIncrement;
  this.timeMs=0;this.inhibitionLeftMs=0;this.currentInput=null;this.updates=0;
  this.tonicDrive=tonicDrive;this.inhibitionIncrement=inhibitionIncrement;this.commonInhibition=0;
  this.neurons=Array.from({length:causes},(_,id)=>({id,type:'E',role:'latent cause',threshold:-50,v:-65,priorBias:-Math.log(causes),adaptation:0,spikes:0}));
  this.relays=Array.from({length:features*2},(_,id)=>({id:causes+id,type:'I',feature:Math.floor(id/2),rail:id%2?'off':'on',trace:0,spikes:0}));
  this.synapses=[];
  for(let feature=0;feature<features;feature++)for(let to=0;to<causes;to++){
   const theta=.25+.5*this.random();
   for(const rail of ['on','off'])this.synapses.push({from:causes+2*feature+(rail==='off'?1:0),to,feature,rail,sign:-1,strength:-Math.log(rail==='on'?theta:1-theta)});
  }
 }
 random(){this.rng=(Math.imul(1664525,this.rng)+1013904223)>>>0;return (this.rng+.5)/4294967296}
 validateInput(input){if(!Array.isArray(input)||input.length!==this.features||[...input].some(x=>x!==0&&x!==1))throw Error('Expected one binary observation per feature')}
 validateLearning({learn=false,learningRate=.03}={}){
  if(typeof learn!=='boolean'||!Number.isFinite(learningRate)||learningRate<0||learningRate>1)throw Error('Invalid learning settings');
 }
 present(input){
  this.validateInput(input);this.currentInput=[...input];
  for(const relay of this.relays){relay.trace=relay.rail==='on'?input[relay.feature]:1-input[relay.feature];if(relay.trace)relay.spikes++}
 }
 tick({learn=false,learningRate=.03}={}){
  this.validateLearning({learn,learningRate});if(!this.currentInput)throw Error('Present observations first');
  this.timeMs++;
  this.commonInhibition*=Math.exp(-1/5);
  for(const n of this.neurons)n.adaptation*=Math.exp(-1/200);
  if(this.inhibitionLeftMs>0){this.inhibitionLeftMs--;for(const n of this.neurons)n.v=-68;return null}
  const drive=this.neurons.map(n=>n.priorBias-n.adaptation);
  for(const s of this.synapses)drive[s.to]-=s.strength*this.relays[s.from-this.causes].trace;
  let winner=null,earliest=1;
  for(const n of this.neurons){
   n.v=n.threshold+2*(drive[n.id]+this.tonicDrive-this.commonInhibition);
   // Independent exponential waiting times simulate competing escape-hazard cells.
   const wait=-Math.log(this.random())/Math.exp((n.v-n.threshold)/2);
   if(wait<earliest){earliest=wait;winner=n.id}
  }
  if(winner===null)return null;
  const n=this.neurons[winner];n.spikes++;n.adaptation+=this.adaptationIncrement;
  this.inhibitionLeftMs=2;
  this.commonInhibition+=this.inhibitionIncrement;
  if(learn&&learningRate>0)this.learnCause(winner,learningRate);
  return {type:'spike',winner,timeMs:this.timeMs-1+earliest};
 }
 learnCause(winner,learningRate){
   for(const s of this.synapses){
    if(s.to!==winner)continue;
    const theta=s.rail==='on'?Math.exp(-s.strength):1-Math.exp(-s.strength);
    const x=this.relays[s.from-this.causes].trace;
    const y=s.rail==='on'?x:1-x;
    const logit=Math.log(theta/(1-theta))+learningRate*(y-theta);
    const next=Math.max(.02,Math.min(.98,1/(1+Math.exp(-logit))));
    s.strength=-Math.log(s.rail==='on'?next:1-next);
   }
  this.updates++;
 }
 sample(input,options={}){
  this.validateInput(input);this.validateLearning(options);const start=this.timeMs;this.present(input);
  for(let i=0;i<10000;i++){const event=this.tick(options);if(event)return {...event,latencyMs:event.timeMs-start}}
  throw Error('No response within 10 neural seconds; record this failure instead of dropping the observation');
 }
 snapshot(){return structuredClone({model:'spiking-predictive-sensory-v0',seed:this.seed,rng:this.rng,features:this.features,causes:this.causes,timeMs:this.timeMs,
  inhibitionLeftMs:this.inhibitionLeftMs,adaptationIncrement:this.adaptationIncrement,tonicDrive:this.tonicDrive,inhibitionIncrement:this.inhibitionIncrement,commonInhibition:this.commonInhibition,currentInput:this.currentInput,updates:this.updates,
  neurons:this.neurons,relays:this.relays,synapses:this.synapses,
  assumptions:'Sensory on/off PSPs are held by an observation current clamp; common 2 ms inhibitory/refractory gate; exponential escape hazard, 2 mV scale, 1000 Hz reference; adaptation 200 ms. Not a full cellular circuit or a game learner.'});}
}
