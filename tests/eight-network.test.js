import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpikingNetwork} from '../dist/network.js';
import {TRAINING_PAIRS,TrainingSelector} from '../dist/training.js';
import {Engine} from '../dist/engine.js';
import {saveMemory,restoreMemory,memoryKey} from '../dist/memory.js';
import {weightChanges} from '../dist/maps.js';
test('eight cells include six mutually connected training cells and 15 selectable pairs',()=>{
 const n=new SpikingNetwork(42);assert.equal(n.neurons.length,8);assert.equal(n.neurons.filter(c=>c.role==='training').length,6);
 for(let id=2;id<8;id++)assert.ok(n.synapses.some(s=>s.from===id&&s.to>=2&&s.plastic));
 assert.equal(TRAINING_PAIRS.length,15);assert.ok(TRAINING_PAIRS.some(p=>p.includes(7)));assert.equal(new TrainingSelector().values.length,15);
 n.train([6,7],1000);n.advance(1000,{plasticity:true});assert.equal(n.drainCellCounts().length,8);
});
test('training connections adjust actual weights and freezing prevents changes',()=>{
 for(const plasticity of [true,false]){
  const n=new SpikingNetwork(42),before=n.synapses.filter(s=>s.from>=2&&s.to>=2).map(s=>s.weight);
  assert.ok(before.length>0);n.train([2,3],1000);n.advance(1000,{plasticity});
  const after=n.synapses.filter(s=>s.from>=2&&s.to>=2).map(s=>s.weight);assert.equal(after.some((w,i)=>w!==before[i]),plasticity);
 }
});
test('connections can be added and removed with duplicate and parameter validation',()=>{
 const n=new SpikingNetwork();n.addConnection(0,7,4,true);assert.ok(n.synapses.some(s=>s.from===0&&s.to===7&&s.weight===4));
 const before=n.snapshot();for(const f of [()=>n.addConnection(0,7,2),()=>n.addConnection(7,7,2),()=>n.addConnection(9,0,2),()=>n.addConnection(1,6,NaN)])assert.throws(f);
 assert.deepEqual(n.snapshot(),before);n.removeConnection(0,7);assert.ok(!n.synapses.some(s=>s.from===0&&s.to===7));assert.throws(()=>n.removeConnection(0,7));
});
test('editable topology, neuron parameters and all pair values survive memory restoration',()=>{
 const values=new Map(),store={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},e=new Engine();
 e.model.removeConnection(0,1);e.model.addConnection(1,7,5,true);e.model.configureNeuron(7,{bias:12});e.trainer.values[14]=8;saveMemory(store,e);
 const restored=new Engine();restoreMemory(store,restored);assert.deepEqual(restored.model.synapses,e.model.synapses);assert.equal(restored.model.neurons[7].bias,12);assert.equal(restored.trainer.values[14],8);
 const data=JSON.parse(values.get(memoryKey));data.synapses.push({...data.synapses[0]});values.set(memoryKey,JSON.stringify(data));const before=restored.model.snapshot();assert.throws(()=>restoreMemory(store,restored));assert.deepEqual(restored.model.snapshot(),before);
});
test('weight map distinguishes added and removed edges from a changed weight',()=>{
 const r={network_start:{synapses:[{from:0,to:1,weight:3},{from:2,to:3,weight:1}]},network_end:{synapses:[{from:2,to:3,weight:2},{from:7,to:1,weight:4}]}};
 const rows=weightChanges(r);assert.equal(rows.find(s=>s.from===0).status,'removed');assert.equal(rows.find(s=>s.from===7).status,'added');assert.equal(rows.find(s=>s.from===2).delta,1);
});
test('optional structural learning adds causal training edges and removes weak ones, while frozen controls hold topology',()=>{
 for(const enabled of [true,false]){
  const n=new SpikingNetwork();n.addConnection(2,4,.001,true);
  n.train([4,6],1000);n.advance(1000,{plasticity:enabled,rewiring:true,learningRate:.5});
  assert.equal(n.synapses.some(s=>s.from===4&&s.to===6),enabled);
  assert.equal(n.synapses.some(s=>s.from===2&&s.to===4),!enabled);
  if(enabled){const changes=n.drainTopologyChanges();assert.ok(changes.some(c=>c.action==='add'));assert.ok(changes.some(c=>c.action==='remove'))}
 }
});
test('six-cell browser memory migrates by neuron and pair identity without deleting the prior save',async()=>{
 const {previousMemoryKey}=await import('../dist/memory.js');
 const values=new Map(),store={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const patches=Array.from({length:6},()=>({threshold:-55,tauMs:30,refractoryMs:3,bias:0}));patches[5].bias=2;
 const old={version:2,model_version:'simple-lif-v1',seed:42,config:{},neurons:patches,weights:[4.5,20,20,20,20],updates:3,trial:2,trials:[],training:{version:1,rng:10,values:[2,3,4,5,6,7],eligibility:Array(6).fill(0),observations:2}};
 const text=JSON.stringify(old);values.set(previousMemoryKey,text);const e=new Engine();assert.equal(restoreMemory(store,e),true);
 assert.equal(e.model.neurons.length,8);assert.equal(e.model.synapses[0].weight,4.5);assert.equal(e.model.neurons[5].bias,2);
 assert.equal(e.trainer.values[TRAINING_PAIRS.findIndex(p=>String(p)==='4,5')],7);assert.equal(e.trainer.values[14],1);
 saveMemory(store,e);assert.equal(values.get(previousMemoryKey),text);assert.ok(values.has(memoryKey));
});
test('no-training and feedback-off controls freeze all newly connected training pathways',()=>{
 for(const control of [{trainingMode:'none'},{feedback:false}]){
  const e=new Engine({...control,threshold:200,rewiring:true});e.model.addConnection(0,2,12,true);e.model.addConnection(0,3,12,true);
  const weights=e.model.synapses.map(s=>s.weight);for(let i=0;i<180;i++)e.step(.01);
  assert.deepEqual(e.model.synapses.map(s=>s.weight),weights);
 }
});
test('drift from fresh includes added and removed connections by edge identity',()=>{
 const n=new SpikingNetwork(),original=n.synapses.find(s=>s.from===0&&s.to===1).weight;
 n.removeConnection(0,1);n.addConnection(0,7,4,true);
 assert.ok(Math.abs(n.snapshot().weight_drift_mV-(original+4))<1e-10);
});
