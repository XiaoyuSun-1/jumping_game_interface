import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';

test('speed remains constant after clears, including a legacy ramp setting',()=>{
 const e=new Engine({mode:'manual',difficultyRamp:true});e.clears=9;
 e.obstacles=[{id:1,x:70,w:28,h:46,cleared:false},{id:2,x:100000,w:28,h:46,cleared:false}];
 e.step(.01);assert.equal(e.clears,10);assert.equal(e.currentSpeed,290);assert.equal(e.targetSpeed,290);
 e.clears=200;for(let i=0;i<200;i++)e.step(.1);assert.equal(e.currentSpeed,290);
 assert.equal(e.events.filter(p=>p.type==='difficulty').length,0);
 e.nextTrial();assert.equal(e.currentSpeed,290);assert.equal(e.targetSpeed,290);
});
test('fixed-speed control disables the ramp without changing the random course',()=>{
 const a=new Engine({seed:42,difficultyRamp:false}),b=new Engine({seed:42});
 assert.deepEqual(a.obstacles,b.obstacles);a.clears=20;a.obstacles=[{id:1,x:10000,w:28,h:46,cleared:false}];a.step(.1);
 assert.equal(a.currentSpeed,290);assert.equal(a.targetSpeed,290);
 assert.throws(()=>a.configure({difficultyRamp:'yes'}));
});
test('random gaps vary substantially, remain playable and replay with the same seed',()=>{
 function generate(seed){const e=new Engine({seed,mode:'manual'});for(let i=0;i<20;i++){e.obstacles=[e.obstacles.at(-1)];e.obstacles[0].x=999;e.step(.01)}return e.events.filter(p=>p.type==='obstacle').map(p=>p.payload)}
 const a=generate(41);assert.equal(a.length,20);assert.deepEqual(a,generate(41));assert.notDeepEqual(a,generate(42));
 assert.ok(a.every(o=>o.gap_px>=550&&o.gap_px<=1150&&o.w===28&&o.h===46));
 assert.ok(Math.max(...a.map(o=>o.gap_px))-Math.min(...a.map(o=>o.gap_px))>350);
 assert.ok(new Set(a.map(o=>o.gap_px)).size>10);
});
test('time-to-contact and distance use the current speed and recordings expose difficulty',()=>{
 const e=new Engine({mode:'manual'});e.currentSpeed=400;e.clears=40;e.step(.01);
 assert.ok(Math.abs(e.ttc-(e.nearest.x-128)/e.currentSpeed)<1e-12);
 assert.equal(e.distance,2.9);const r=e.exportRecordings().at(-1);
 assert.equal(r.game_current.speed_px_s,e.currentSpeed);assert.equal(r.engine_state_end.speed_px_s,e.currentSpeed);
});
