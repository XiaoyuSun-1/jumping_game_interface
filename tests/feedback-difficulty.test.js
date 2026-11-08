import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {SpikingNetwork} from '../dist/network.js';
import {HeadlessEngine} from '../scripts/feedback-benchmark.mjs';
test('reverse pairing weakens even a saturated input-to-jump connection',()=>{
 const n=new SpikingNetwork();n.synapses[0].weight=12;n.train([3,2],500);n.advance(500,{plasticity:true,learningRate:.5});
 assert.ok(n.synapses[0].weight<11.9,'punishment must not be canceled by a sensory-triggered motor spike');
});
test('adaptive speed rises after survived trials with clears, falls after collisions, stays fixed within each trial',()=>{
 const e=new Engine({adaptiveSpeed:true});e.clears=2;e.time=60;e.finishTrial('time limit');assert.equal(e.currentSpeed,290);assert.equal(e.nextSpeed,304.5);
 assert.equal(e.trials.at(-1).next_speed_px_s,304.5);e.nextTrial();assert.equal(e.currentSpeed,304.5);e.step(.1);assert.equal(e.currentSpeed,304.5);
 e.finishTrial('collision');assert.ok(Math.abs(e.nextSpeed-304.5*.95)<1e-8);assert.equal(e.currentRecording.result.speed_px_s,304.5);
});
test('difficulty ignores stopped/empty capped trials, supports a fixed control and stays bounded',()=>{
 for(const adaptiveSpeed of [true,false]){
  const e=new Engine({adaptiveSpeed});e.time=60;e.finishTrial('time limit');assert.equal(e.nextSpeed,290);e.nextTrial();e.clears=10;e.finishTrial('stopped');assert.equal(e.nextSpeed,290);
  e.nextTrial();e.finishTrial('collision');assert.equal(e.nextSpeed,adaptiveSpeed?275.5:290);
 }
 const e=new Engine({adaptiveSpeed:true,speed:500});e.clears=1;e.finishTrial('time limit');assert.equal(e.nextSpeed,500);
 const low=new Engine({adaptiveSpeed:true,speed:150});low.finishTrial('collision');assert.equal(low.nextSpeed,150);
});
test('punishment reduces unnecessary jumping from a saturated learned controller across matched courses',()=>{
 function run(emptyJumpPenalty){const e=new HeadlessEngine({emptyJumpPenalty});e.model.synapses[0].weight=12;e.startResearchSession({trial_count:30,trial_limit_s:20});for(let i=0;i<100000&&!e.researchComplete;i++)e.sessionStep(1/120);return e.trials.slice(-10)}
 const on=run(true),off=run(false),sum=(rows,key)=>rows.reduce((s,t)=>s+t[key],0);
 assert.ok(sum(on,'empty_jumps')<sum(off,'empty_jumps')/2,'punished controller should avoid repeating wasteful jumps');assert.ok(sum(on,'clears')>0,'suppression must retain useful actions');
});
test('a restored adaptive-speed session starts from its saved base speed',async()=>{
 const {saveMemory,restoreMemory}=await import('../dist/memory.js');const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const e=new Engine({adaptiveSpeed:true,speed:400});saveMemory(storage,e);const next=new Engine();restoreMemory(storage,next);assert.equal(next.currentSpeed,400);assert.equal(next.nextSpeed,400);
});
test('turning adaptive speed off while paused cannot alter the current airborne trial',()=>{
 const e=new Engine({mode:'manual',adaptiveSpeed:true});e.clears=1;e.finishTrial('time limit');e.nextTrial();e.jump();e.step(.1);
 const speed=e.currentSpeed,trial=e.trial;e.configure({adaptiveSpeed:false});e.step(.1);assert.equal(e.trial,trial);assert.equal(e.currentSpeed,speed);
 e.finishTrial('collision');assert.equal(e.nextSpeed,290);e.nextTrial();assert.equal(e.currentSpeed,290);
});
