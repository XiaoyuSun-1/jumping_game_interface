import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as training from '../dist/training.js';

test('patterns are sampled reproducibly and receive credit only after delivery and a later trial',()=>{
 const a=new training.TrainingSelector(42),b=new training.TrainingSelector(42);
 const initial=a.snapshot();a.observe(12);
 assert.deepEqual(a.snapshot().values,initial.values,'first trial has no preceding treatment');
 const choice=a.choose('adaptive');assert.deepEqual(choice,b.choose('adaptive'));
 assert.ok(Math.abs(choice.probabilities.reduce((x,y)=>x+y,0)-1)<1e-12);
 a.observe(20);assert.deepEqual(a.snapshot().values,initial.values,'selection alone is not delivery');
 a.delivered(choice.index);const credit=a.observe(20);
 assert.equal(credit.eligibility[choice.index],1);assert.equal(a.snapshot().values[choice.index],6.7);
 assert.ok(a.choose('adaptive').probabilities[choice.index]>1/15);
 a.resetCredit();const values=a.snapshot().values;a.observe(1);assert.deepEqual(a.snapshot().values,values);
});
test('random control uses the same pair budget and null training chooses nothing',()=>{
 const t=new training.TrainingSelector(5),choice=t.choose('random');
 assert.equal(choice.pair.length,2);assert.equal(new Set(choice.pair).size,2);assert.ok(choice.pair.every(id=>id>=2&&id<=7));
 assert.ok(choice.probabilities.every(p=>p===1/15));assert.equal(t.choose('none'),null);
 assert.throws(()=>t.observe(NaN));assert.throws(()=>t.delivered(99));assert.throws(()=>t.choose('unknown'));
});
test('selector snapshots are detached, validated and replayable',()=>{
 const t=new training.TrainingSelector(4);t.delivered(0);t.observe(4);
 const state=t.snapshot(),copy=training.TrainingSelector.restore(state);
 assert.deepEqual(t.choose('adaptive'),copy.choose('adaptive'));
 state.values[0]=NaN;assert.throws(()=>training.TrainingSelector.restore(state));
});
