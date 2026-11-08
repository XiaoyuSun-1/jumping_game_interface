import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {validateResearchSetup} from '../dist/research-protocol.js';

const land=e=>{for(let i=0;i<110&&e.phase==='play'&&!e.crashed;i++){e.step(.01);if(e.jumps&&e.y===0)break}};
test('successful default trials end at sixty seconds and a multi-trial session completes',()=>{
 assert.equal(validateResearchSetup().trial_limit_s,60);
 const e=new Engine({plasticity:false,emptyJumpPenalty:false});e.model.synapses[0].weight=4.8;
 e.startResearchSession({trial_count:2});
 for(let i=0;i<15000&&!e.researchComplete;i++)e.sessionStep(.01);
 assert.equal(e.researchComplete,true);assert.equal(e.researchSession.completed_trials,2);
 assert.ok(e.trials.every(t=>t.time_s<=60.000001));assert.ok(e.trials.some(t=>t.outcome==='time limit'));
});
test('obstacle dimensions and jump trajectory stay fixed across trials and clears',()=>{
 const e=new Engine({mode:'manual',difficultyRamp:true});e.clears=100;
 assert.equal(e.targetSpeed,290);assert.equal(e.obstacles[0].w,28);assert.equal(e.obstacles[0].h,46);
 e.obstacles[0].x=999;e.step(.01);assert.ok(e.obstacles.every(o=>o.w===28&&o.h===46));
 const paths=[];for(let trial=0;trial<2;trial++){
  e.nextTrial();e.clears=trial*100;e.obstacles=[{id:1,x:100000,w:28,h:46,cleared:false}];e.jump();
  let peak=0;while(e.y>0||e.vy>0){e.step(.01);peak=Math.max(peak,e.y)}paths.push([peak,e.distance]);
 }
 assert.deepEqual(paths[0],paths[1]);
});
test('empty jumps have an optional shorter punishment and gate commands without ending the trial',()=>{
 for(const enabled of [true,false]){
  const e=new Engine({mode:'manual',emptyJumpPenalty:enabled});e.obstacles=[{id:1,x:10000,w:28,h:46,cleared:false}];e.jump();land(e);
  assert.equal(e.phase,enabled?'punishment':'play');assert.equal(e.crashed,false);
  if(enabled){assert.equal(e.phaseRemaining,.5);assert.equal(e.jump(),false);const x=e.obstacles[0].x;
   for(let i=0;i<50;i++)e.step(.01);
   assert.equal(e.phase,'play');assert.equal(e.obstacles[0].x,x);assert.equal(e.jump(),true);
  }
 }
});
test('a jump that clears an obstacle is not punished and collision remains terminal',()=>{
 const e=new Engine({mode:'manual',emptyJumpPenalty:true});e.obstacles=[{id:1,x:210,w:28,h:46,cleared:false}];e.jump();land(e);
 assert.equal(e.crashed,false);assert.equal(e.clears,1);assert.equal(e.phase,'reward');
 const c=new Engine({emptyJumpPenalty:true});c.obstacles=[{id:1,x:130,w:28,h:46,cleared:false}];c.step(.01);
 assert.equal(c.currentRecording.result.outcome,'collision');assert.equal(c.phase,'training');
});
test('neural punishment depresses the plastic connection, records its cause, and frozen weights stay fixed',()=>{
 for(const plasticity of [true,false]){
  const e=new Engine({emptyJumpPenalty:true,plasticity,threshold:200});e.obstacles=[{id:1,x:10000,w:28,h:46,cleared:false}];
  const weight=e.model.synapses[0].weight;e.jump();land(e);
  for(let i=0;i<50;i++)e.step(.01);
  assert.equal(e.phase,'play');assert.equal(e.jumps,1);assert.equal(e.pending.length,0);
  assert.equal(e.model.synapses[0].weight<weight,plasticity);
  assert.ok(e.events.some(p=>p.type==='feedback'&&p.payload.outcome==='empty jump'));
  e.finishTrial('stopped');const r=e.exportRecordings().at(-1),counts=Array(8).fill(0);
  for(const p of r.events.filter(p=>p.type==='response'))p.payload.cell_counts.forEach((n,i)=>counts[i]+=n);
  assert.deepEqual(counts,r.network_end.neurons.map((n,i)=>n.spikes-r.network_start.neurons[i].spikes));
 }
});
test('a duration limit reached during punishment closes the trial without another jump',()=>{
 const e=new Engine({emptyJumpPenalty:true,threshold:200});e.startResearchSession({trial_count:1,trial_limit_s:1});
 e.obstacles=[{id:1,x:10000,w:28,h:46,cleared:false}];for(let i=0;i<20;i++)e.step(.01);e.jump();land(e);
 assert.equal(e.phase,'punishment');for(let i=0;i<20&&!e.researchComplete;i++)e.sessionStep(.01);
 assert.equal(e.researchComplete,true);assert.equal(e.currentRecording.result.outcome,'time limit');assert.ok(e.time<=1.000001);
});
test('no-training and feedback-off controls do not receive punishment stimulation',()=>{
 for(const control of [{trainingMode:'none'},{feedback:false}]){
  const e=new Engine({...control,emptyJumpPenalty:true,threshold:200});e.obstacles=[{id:1,x:10000,w:28,h:46,cleared:false}];
  const weight=e.model.synapses[0].weight;e.jump();land(e);assert.equal(e.phase,'punishment');
  for(let i=0;i<50;i++)e.step(.01);
  assert.equal(e.model.synapses[0].weight,weight);assert.ok(!e.events.some(p=>p.type==='feedback'));
 }
});
test('punishment pauses cannot earn extra survival credit for the training selector',()=>{
 const e=new Engine({emptyJumpPenalty:true,threshold:200});e.obstacles=[{id:1,x:10000,w:28,h:46,cleared:false}];e.jump();land(e);
 for(let i=0;i<50;i++)e.step(.01);
 e.finishTrial('collision');assert.ok(e.time>e.phaseTimes.play);
 assert.equal(e.currentRecording.training.credit.score_seconds,e.phaseTimes.play);
});
