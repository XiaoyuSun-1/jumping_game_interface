import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,defaults} from '../dist/engine.js';

test('manual jump leaves ground, rejects double jump and lands',()=>{const e=new Engine({mode:'manual'});assert.equal(e.jump(),true);assert.equal(e.jump(),false);e.step(.075);e.step(.075);assert.ok(e.y>0);for(let i=0;i<90;i++)e.step(1/120);assert.equal(e.y,0)});
test('collision terminates the manual episode without simulated training',()=>{const e=new Engine({mode:'manual'});for(let i=0;i<1000&&!e.crashed;i++)e.step(1/120);assert.equal(e.crashed,true);assert.equal(e.phase,'training');assert.equal(e.phaseRemaining,1);assert.ok(!e.events.some(x=>x.type==='feedback'))});
test('sensory gate suppresses stimulus packets',()=>{const e=new Engine({sensory:false});for(let i=0;i<60;i++)e.step(1/120);assert.equal(e.events.filter(x=>x.type==='stimulus').length,0)});
test('feedback gate suppresses feedback packets',()=>{const e=new Engine({mode:'manual',feedback:false});for(let i=0;i<1000&&!e.crashed;i++)e.step(1/120);assert.equal(e.events.filter(x=>x.type==='feedback').length,0)});
test('untrained responses are delayed and expose eight simulated cells',()=>{const e=new Engine();for(let i=0;i<8;i++)e.step(.008);assert.equal(e.events.filter(x=>x.type==='response').length,0);for(let i=0;i<1800&&!e.crashed;i++)e.step(1/120);assert.ok(e.events.some(x=>x.type==='response'));assert.equal(e.model.neurons.length,8);assert.ok(e.currentRecording.network_start.neurons.every(n=>n.spikes===0))});
test('unreachable threshold prevents neural jump',()=>{const e=new Engine({threshold:200});for(let i=0;i<1000&&!e.crashed;i++)e.step(1/120);assert.equal(e.jumps,0);assert.equal(e.crashed,true)});
test('seed reproduces complete loop',()=>{const a=new Engine({seed:23}),b=new Engine({seed:23});for(let i=0;i<600;i++){a.step(1/120);b.step(1/120)}assert.deepEqual(a.events,b.events)});
test('invalid numeric config rejected',()=>{assert.throws(()=>new Engine({speed:NaN}));assert.throws(()=>new Engine({latency:-1}));assert.ok(defaults.threshold>0)});
test('reset clears pending packets and session history',()=>{const e=new Engine();e.step(.04);e.reset();assert.equal(e.time,0);assert.equal(e.pending.length,0);assert.equal(e.events.length,0)});
test('zero stimulus strength keeps encoded output at zero',()=>{const e=new Engine({stimulusGain:0});for(let i=0;i<1000&&!e.crashed;i++)e.step(1/120);assert.ok(e.events.filter(p=>p.type==='stimulus').every(p=>p.payload.normalized_intensity===0))});
test('encoding horizon changes the information sent to the platform',()=>{const a=new Engine({horizon:3000}),b=new Engine({horizon:500});a.step(.05);b.step(.05);assert.ok(a.latestStim.payload.normalized_intensity>b.latestStim.payload.normalized_intensity)});
test('trial transition preserves weights and parameter edits, reset restores seeded network',()=>{
 const e=new Engine({threshold:200});const initial=e.model.snapshot();e.model.configureNeuron(0,{bias:15});
 for(let i=0;i<1000&&!e.crashed;i++)e.step(1/120);
 assert.equal(e.trials.length,1);const weights=e.model.synapses.map(s=>s.weight),clock=e.model.timeMs;
 e.nextTrial();assert.equal(e.trial,2);assert.equal(e.time,0);assert.deepEqual(e.model.synapses.map(s=>s.weight),weights);
 assert.equal(e.model.neurons[0].bias,15);assert.equal(e.model.timeMs,clock);assert.equal(e.pending.length,0);
 e.reset();assert.deepEqual(e.model.snapshot(),initial);assert.equal(e.trials.length,0);
});
test('plasticity freeze keeps all weights fixed, with or without feedback',()=>{
 for(const config of [{feedback:false,plasticity:false},{plasticity:false}]){
  const e=new Engine(config),before=e.model.synapses.map(s=>s.weight);
  for(let i=0;i<1000&&!e.crashed;i++)e.step(1/120);
  assert.deepEqual(e.model.synapses.map(s=>s.weight),before);
 }
});
test('delivered training exports full model and trial history',()=>{
 const e=new Engine();for(let i=0;i<1000&&!e.crashed;i++)e.step(1/120);
 while(e.phase==='training')e.step(.01);
 const data=e.export();assert.equal(data.recordings.at(-1).training.delivered,true);assert.ok(Number.isFinite(data.network.weight_drift_mV));
 assert.equal(data.network.neurons.length,8);assert.equal(data.trials.length,1);
 assert.equal(data.trials[0].outcome,'collision');assert.equal(data.trials[0].clears,e.clears);
});
test('terminal feedback runs on neural time before the next trial without causing jumps',()=>{
 const e=new Engine({threshold:200,trainingSeconds:.3});while(!e.crashed)e.step(.01);
 const neuralTime=e.model.timeMs;for(let i=0;i<30;i++)e.step(.01);
 assert.equal(e.model.trainingLeft,0);assert.equal(e.jumps,0);assert.equal(e.phase,'rest');
 assert.equal(e.model.timeMs-neuralTime,300);
 const bins=e.events.filter(p=>p.type==='response'&&p.payload.phase==='training');assert.equal(bins.length,6);
});
test('session waits through rest then automatically starts another trial retaining weights',()=>{
 const e=new Engine({threshold:200,trainingSeconds:0,restSeconds:1,plasticity:false});
 while(!e.crashed)e.sessionStep(1/120);
 const weights=e.model.synapses.map(s=>s.weight),neuralTime=e.model.timeMs;
 for(let i=0;i<60;i++)e.sessionStep(1/120);
 assert.equal(e.trial,1);assert.ok(e.restRemaining>.49&&e.restRemaining<.51);
 assert.ok(e.model.timeMs>neuralTime);assert.equal(e.jumps,0);
 for(let i=0;i<60;i++)e.sessionStep(1/120);
 assert.equal(e.trial,2);assert.equal(e.crashed,false);assert.equal(e.time,0);
 assert.deepEqual(e.model.synapses.map(s=>s.weight),weights);assert.equal(e.trials.length,1);
});
test('ordinary single steps do not advance session rest, reset clears it',()=>{
 const e=new Engine({threshold:200,restSeconds:1});while(!e.crashed)e.sessionStep(.05);
 const remaining=e.restRemaining;assert.equal(e.restRemaining,remaining);
 e.reset();assert.equal(e.restRemaining,null);assert.equal(e.trial,1);
 assert.throws(()=>e.configure({restSeconds:-1}));
});

