import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,defaults} from '../dist/engine.js';
import {saveMemory,restoreMemory,memoryKey} from '../dist/memory.js';
const stepPhase=e=>{for(let i=0;i<200&&e.phase!=='play'&&!e.researchComplete;i++)e.step(.01)};
function successfulJump(config={}){
 const e=new Engine({mode:'manual',...config});e.obstacles=[{id:1,x:210,w:28,h:46,cleared:false}];e.jump();
 for(let i=0;i<100&&e.phase==='play';i++)e.step(.01);return e;
}
test('requested default feedback periods are reward 1s, collision 1s and empty jump 0.5s',()=>{
 assert.equal(defaults.rewardSeconds,1);assert.equal(defaults.trainingSeconds,1);assert.equal(defaults.punishmentSeconds,.5);
});
test('a successful jump earns one gated 1s reward after landing, then play resumes',()=>{
 const e=successfulJump();assert.equal(e.phase,'reward');assert.equal(e.y,0);assert.equal(e.clears,1);assert.equal(e.phaseRemaining,1);assert.equal(e.jump(),false);
 const x=e.obstacles[0].x,jumps=e.jumps,play=e.phaseTimes.play;
 for(let i=0;i<100;i++)e.step(.01);
 assert.equal(e.phase,'play');assert.equal(e.obstacles[0].x,x);assert.equal(e.jumps,jumps);assert.equal(e.phaseTimes.play,play);assert.ok(Math.abs(e.phaseTimes.reward-1)<1e-8);
 assert.equal(e.events.filter(p=>p.type==='feedback'&&p.payload.outcome==='reward').length,1);
});
test('reward pairing changes actual plastic weights only when learning is enabled and does not contaminate decoding',()=>{
 for(const control of [{},{plasticity:false},{feedback:false},{trainingMode:'none'}]){
  const e=successfulJump({mode:'neural',threshold:200,...control});assert.equal(e.phase,'reward');const before=e.model.synapses[0].weight;
  stepPhase(e);assert.equal(e.phase,'play');assert.equal(e.pending.length,0);assert.equal(e.history.length,0);assert.equal(e.jumps,1);
  assert.equal(e.model.synapses[0].weight>before,!Object.keys(control).length);
  assert.ok(!e.events.some(p=>p.type==='feedback'&&p.payload.outcome==='collision'));
 }
});
test('duration limit can close a reward phase without extending the trial or triggering collision training',()=>{
 const e=new Engine({threshold:200});e.startResearchSession({trial_count:1,trial_limit_s:1});e.obstacles=[{id:1,x:210,w:28,h:46,cleared:false}];e.jump();
 for(let i=0;i<120&&!e.researchComplete;i++)e.sessionStep(.01);
 assert.equal(e.researchComplete,true);assert.ok(e.time<=1.0000001);assert.equal(e.currentRecording.result.outcome,'time limit');
 const cells=Array(8).fill(0);for(const p of e.currentRecording.events.filter(p=>p.type==='response'))p.payload.cell_counts.forEach((n,i)=>cells[i]+=n);
 assert.deepEqual(cells,e.currentRecording.network_end.neurons.map(n=>n.spikes));
});
test('new timing defaults replace previous browser defaults without losing learned weights',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},e=new Engine();saveMemory(storage,e);
 const saved=JSON.parse(data.get(memoryKey));saved.config.trainingSeconds=.3;saved.config.punishmentSeconds=.15;delete saved.config.rewardSeconds;data.set(memoryKey,JSON.stringify(saved));
 const restored=new Engine();restoreMemory(storage,restored);
 assert.equal(restored.config.trainingSeconds,1);assert.equal(restored.config.punishmentSeconds,.5);assert.equal(restored.config.rewardSeconds,1);assert.deepEqual(restored.model.synapses,e.model.synapses);
});
test('a time limit records an interrupted reward with its remaining duration',()=>{
 const e=new Engine({mode:'manual'});e.startResearchSession({trial_count:1,trial_limit_s:1});e.obstacles=[{id:1,x:210,w:28,h:46,cleared:false}];e.jump();
 for(let i=0;i<120&&!e.researchComplete;i++)e.sessionStep(.01);
 assert.equal(e.currentRecording.skipped_phase?.phase,'reward');assert.ok(e.currentRecording.skipped_phase.remaining_s>0);assert.equal(e.currentRecording.skipped_phase.reason,'time limit');
});
