import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {saveMemory,restoreMemory,memoryKey} from '../dist/memory.js';
const storage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
test('reload retains simple network, selector values and settings but clears temporal credit',()=>{
 const store=storage(),e=new Engine({restSeconds:4,threshold:200});while(!e.crashed)e.step(1/120);
 while(e.phase==='training')e.step(.01);
 e.trainer.observe(5);e.trainer.delivered(1);e.model.configureNeuron(0,{bias:15});saveMemory(store,e);
 const next=new Engine();assert.equal(restoreMemory(store,next),true);assert.equal(next.config.restSeconds,4);
 assert.deepEqual(next.model.synapses.map(s=>s.weight),e.model.synapses.map(s=>s.weight));
 assert.equal(next.model.neurons[0].bias,15);assert.deepEqual(next.trials,e.trials);
 assert.deepEqual(next.trainer.values,e.trainer.values);assert.ok(next.trainer.eligibility.every(v=>v===0));
 assert.equal(next.trial,e.trial+1);assert.equal(next.time,0);assert.equal(next.model.trainingLeft,0);
});
test('legacy memory is preserved separately and cannot be applied to the replacement',()=>{
 const store=storage();store.setItem('neurorunner.memory.v1','legacy value');
 assert.notEqual(memoryKey,'neurorunner.memory.v1');assert.equal(restoreMemory(store,new Engine()),false);
 saveMemory(store,new Engine());assert.equal(store.getItem('neurorunner.memory.v1'),'legacy value');
});
test('malformed network and selector memory is rejected atomically',()=>{
 const store=storage(),e=new Engine(),before=e.model.snapshot(),trainer=e.trainer.snapshot();saveMemory(store,e);
 const valid=store.getItem(memoryKey);
 for(const mutate of [d=>d.synapses[0].weight=null,d=>d.neurons[0].tauMs=0,d=>d.training.values[0]=-1,d=>d.training.eligibility[0]=99,d=>d.model_version='wrong',d=>d.synapses[4].to=99,d=>delete d.synapses[0].plastic]){
  const data=JSON.parse(valid);mutate(data);store.setItem(memoryKey,JSON.stringify(data));assert.throws(()=>restoreMemory(store,e));
  assert.deepEqual(e.model.snapshot(),before);assert.deepEqual(e.trainer.snapshot(),trainer);
 }
 e.reset();saveMemory(store,e);const next=new Engine();restoreMemory(store,next);assert.equal(next.model.snapshot().weight_drift_mV,0);
});
