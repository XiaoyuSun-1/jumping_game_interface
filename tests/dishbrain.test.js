import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {HeadlessEngine} from '../scripts/feedback-benchmark.mjs';
const finish=e=>{while(!e.crashed)e.step(.01)};
const train=e=>{while(e.phase==='training')e.step(.01)};

test('clears do not pause play and natural trial completion starts dedicated paired training',()=>{
 const e=new Engine({threshold:200});e.obstacles=[{id:1,x:60,w:28,h:46,cleared:false}];e.step(.01);
 assert.equal(e.clears,1);assert.equal(e.phase,'play');assert.equal(e.events.filter(p=>p.type==='feedback').length,0);
 e.obstacles=[{id:2,x:130,w:28,h:46,cleared:false}];finish(e);
 assert.equal(e.phase,'training');assert.equal(e.phaseRemaining,1);const gameTime=e.time,jumps=e.jumps;
 train(e);assert.equal(e.time,gameTime);assert.equal(e.jumps,jumps);assert.equal(e.phase,'rest');
 const r=e.exportRecordings().at(-1);assert.equal(r.training.delivered,true);assert.equal(r.feedback_protocol,'paired-training-v5');
 assert.equal(r.events.filter(p=>p.type==='pulse'&&p.payload.kind==='training').length,20);
});
test('headless logging leaves neural dynamics, actions and selector unchanged',()=>{
 const a=new Engine({seed:12}),b=new HeadlessEngine({seed:12});
 for(let i=0;i<800;i++){a.sessionStep(1/120);b.sessionStep(1/120)}
 assert.deepEqual(a.model.snapshot(),b.model.snapshot());assert.deepEqual(a.trainer.snapshot(),b.trainer.snapshot());assert.equal(a.trial,b.trial);
});
test('training gates all jump requests and response bins cannot leak into the next trial',()=>{
 const e=new Engine({threshold:200});finish(e);assert.equal(e.phase,'training');
 e.configure({threshold:1});e.receive(Array(8).fill(100));assert.equal(e.jump(),false);assert.equal(e.jumps,0);
 train(e);e.nextTrial();assert.equal(e.history.length,0);assert.equal(e.pending.length,0);assert.equal(e.rate,0);
 assert.equal(e.model.previous.length,0);assert.ok(e.model.neurons.every(n=>n.v===n.rest));
});
test('manual, external, disabled training and stopped trials do not train or update selector',()=>{
 for(const config of [{mode:'manual'},{mode:'bridge'},{feedback:false},{trainingMode:'none'}]){
  const e=new Engine(config);finish(e);assert.equal(e.phase,'training');assert.equal(e.phaseRemaining,1);assert.equal(e.model.trainingLeft,0);train(e);assert.equal(e.phase,'rest');
  assert.ok(e.trainer.snapshot().values.every(v=>v===1));assert.ok(!e.events.some(p=>p.type==='feedback'));
 }
 const e=new Engine();e.step(.1);e.finishTrial('stopped');assert.equal(e.phase,'rest');assert.equal(e.trainer.observations,0);
});
test('only fully delivered patterns are credited by subsequent completed trials',()=>{
 const e=new Engine({threshold:200});finish(e);const first=e.currentRecording;
 assert.ok(first.training.credit.eligibility.every(v=>v===0));const selected=first.training.index;
 train(e);e.nextTrial();finish(e);assert.equal(e.currentRecording.training.credit.eligibility[selected],1);
 const interrupted=new Engine({threshold:200});finish(interrupted);interrupted.step(.05);const old=interrupted.currentRecording;
 interrupted.nextTrial();assert.equal(old.training.delivered,false);assert.equal(old.skipped_phase.phase,'training');
 finish(interrupted);assert.ok(interrupted.currentRecording.training.credit.eligibility.every(v=>v===0));
});
test('final recordings include training plasticity, all spikes and selector delivery state',()=>{
 const e=new Engine({threshold:200});finish(e);train(e);const r=e.exportRecordings().at(-1);
 assert.equal(r.result.weight_drift_mV,r.network_end.weight_drift_mV);assert.equal(r.result.network_time_ms,r.network_end.time_ms);
 assert.equal(r.training_state_end.eligibility[r.training.index],1);assert.equal(r.recording_complete,true);
 const counts=Array(8).fill(0);for(const p of r.events.filter(p=>p.type==='response'))p.payload.cell_counts.forEach((n,i)=>counts[i]+=n);
 assert.deepEqual(counts,r.network_end.neurons.map((n,i)=>n.spikes-r.network_start.neurons[i].spikes));
});

test('surviving a configured evaluation horizon credits prior training but does not perturb a successful network',()=>{
 const e=new Engine();e.startResearchSession({trial_count:1,trial_limit_s:1});e.trainer.delivered(0);
 for(let i=0;i<110;i++)e.sessionStep(.01);
 assert.equal(e.researchComplete,true);assert.equal(e.currentRecording.result.outcome,'time limit');
 assert.equal(e.currentRecording.training.reason,'evaluation horizon reached');assert.equal(e.currentRecording.training.pair,undefined);
 assert.equal(e.trainer.observations,1);assert.ok(!e.events.some(p=>p.type==='feedback'));
});
