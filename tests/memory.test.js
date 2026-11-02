import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {saveMemory,restoreMemory} from '../dist/memory.js';
const storage=()=>{let text=null;return {getItem:()=>text,setItem:(_,v)=>{text=v}}};
test('reload retains learned weights, edited parameters and trial history',()=>{
 const store=storage(),e=new Engine({restSeconds:4});while(!e.crashed)e.step(1/120);
 e.model.configureNeuron(0,{bias:15});saveMemory(store,e);
 const next=new Engine();assert.equal(restoreMemory(store,next),true);
 assert.equal(next.config.restSeconds,0,'reload removes the old rest duration without clearing learned memory');
 assert.deepEqual(next.model.synapses.map(s=>s.weight),e.model.synapses.map(s=>s.weight));
 assert.equal(next.model.neurons[0].bias,15);assert.deepEqual(next.trials,e.trials);
 assert.equal(next.trial,e.trial+1);assert.equal(next.time,0);
});
test('malformed memory is rejected atomically and fresh reset removes learning',()=>{
 const store=storage(),e=new Engine(),before=e.model.snapshot();
 store.setItem('',JSON.stringify({version:1,seed:42,neurons:[],weights:[]}));
 assert.throws(()=>restoreMemory(store,e));assert.deepEqual(e.model.snapshot(),before);
 e.model.synapses[0].weight=NaN;saveMemory(store,e);assert.throws(()=>restoreMemory(store,new Engine()));
 e.reset();saveMemory(store,e);const next=new Engine();restoreMemory(store,next);
 assert.equal(next.model.snapshot().weight_drift_mV,0);
});
