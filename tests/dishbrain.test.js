import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {SpikingNetwork} from '../dist/network.js';
import {HeadlessEngine} from '../scripts/feedback-benchmark.mjs';

test('website defaults deliver one-second miss feedback and half-second success feedback',()=>{
 const e=new Engine();e.feedback('clear');assert.equal(e.phaseRemaining,.5);
 for(let i=0;i<50;i++)e.step(.01);assert.equal(e.phase,'play');
 const pulses=e.events.filter(p=>p.type==='pulse'&&p.payload.kind==='predictable');assert.equal(pulses.length,50);
 e.feedback('collision');assert.equal(e.phaseRemaining,1);
 for(let i=0;i<100;i++)e.step(.01);assert.equal(e.phase,'rest');assert.equal(e.phaseRemaining,0);
});
test('headless benchmark changes logging only, not neural dynamics or actions',()=>{
 const a=new Engine({seed:12,restSeconds:0,missSeconds:.1}),b=new HeadlessEngine({seed:12,restSeconds:0,missSeconds:.1});
 for(let i=0;i<800;i++){a.sessionStep(1/120);b.sessionStep(1/120)}
 assert.deepEqual(a.model.snapshot(),b.model.snapshot());assert.equal(a.trial,b.trial);assert.equal(a.jumps,b.jumps);assert.equal(a.clears,b.clears);
});
test('outcome feedback schedules sensory pulses without applying a signed weight update',()=>{
 const n=new SpikingNetwork(42),before=n.synapses.map(s=>s.weight);
 n.feedback('collision',1000);assert.deepEqual(n.synapses.map(s=>s.weight),before);
 n.advance(1000,{gain:1});const pulses=n.drainPulses();
 assert.ok(pulses.length>1);assert.ok(pulses.every(p=>p.channels.length===1&&[0,1].includes(p.channels[0])));
 assert.equal(new Set(pulses.map(p=>p.channels[0])).size,2);
});
test('success pattern is time-locked and synchronous on sensory pools',()=>{
 const n=new SpikingNetwork(1);n.feedback('clear',100);n.advance(100);
 const pulses=n.drainPulses();assert.equal(pulses.length,10);
 assert.ok(pulses.every(p=>p.channels.join(',')==='0,1'));
 for(let i=1;i<pulses.length;i++)assert.equal(pulses[i].network_time_ms-pulses[i-1].network_time_ms,10);
});
test('session separates miss feedback from optional rest and gates motor output',()=>{
 const e=new Engine({threshold:200,missSeconds:.2,restSeconds:.1});while(!e.crashed)e.sessionStep(.01);
 assert.equal(e.phase,'miss_feedback');const gameTime=e.time,jumps=e.jumps;
 e.configure({threshold:1});e.receive(Array(8).fill(100));assert.equal(e.jumps,jumps);
 for(let i=0;i<20;i++)e.sessionStep(.01);assert.equal(e.phase,'rest');assert.equal(e.time,gameTime);
 for(let i=0;i<10;i++)e.sessionStep(.01);assert.equal(e.trial,2);assert.equal(e.phase,'play');
 const zero=new Engine({threshold:200,missSeconds:0,restSeconds:0});while(!zero.crashed)zero.sessionStep(.01);
 zero.sessionStep(.01);assert.equal(zero.trial,2);
});
test('feedback pulses cannot contaminate the next motor decision and all phases are recorded',()=>{
 const e=new Engine({threshold:200,missSeconds:4,restSeconds:0});while(!e.crashed)e.step(.01);
 for(let i=0;i<400;i++)e.step(.01);
 assert.equal(e.rate,0);assert.equal(e.history.length,0);
 assert.ok(e.currentRecording.events.some(p=>p.type==='pulse'&&p.payload.phase==='miss_feedback'));
 assert.ok(e.currentRecording.events.some(p=>p.type==='phase'&&p.payload.phase==='rest'));
});
test('reported end-of-trial weights and clocks include feedback/rest plasticity',()=>{
 const e=new Engine({threshold:200,missSeconds:.1,restSeconds:.1});while(!e.crashed)e.step(.05);
 for(let i=0;i<4;i++)e.step(.05);
 const r=e.exportRecordings().at(-1);
 assert.equal(r.result.weight_drift_mV,r.network_end.weight_drift_mV);
 assert.equal(r.result.network_time_ms,r.network_end.time_ms);
 assert.equal(e.trials.at(-1).weight_drift_mV,r.network_end.weight_drift_mV);
});
test('all jump requests are blocked during predictable feedback, including manual ones',()=>{
 const e=new Engine({mode:'manual'});e.feedback('clear');assert.equal(e.crashed,false);assert.equal(e.jump(),false);
 for(let i=0;i<50;i++)e.step(.01);assert.equal(e.phase,'play');assert.equal(e.jump(),true);
});
