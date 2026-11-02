import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpikingNetwork} from '../dist/network.js';

test('network is seeded, heterogeneous and has 24 excitatory / 8 inhibitory cells',()=>{
 const a=new SpikingNetwork(42),b=new SpikingNetwork(42);
 assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(a.neurons.length,32);
 assert.equal(a.neurons.filter(n=>n.type==='E').length,24);
 assert.ok(new Set(a.neurons.map(n=>n.tauMs)).size>1);
 for(const s of a.synapses){assert.notEqual(s.from,s.to);assert.equal(Math.sign(s.weight),a.neurons[s.from].type==='E'?1:-1)}
});
test('LIF voltage leaks toward rest without input',()=>{
 const n=new SpikingNetwork(2);n.synapses=[];n.neurons.forEach(c=>{c.bias=0;c.v=-55});
 n.advance(20,{rateHz:0,gain:0});
 assert.ok(n.neurons.every(c=>c.v<-55&&c.v>c.rest));
});
test('threshold crossing spikes, resets voltage and enforces refractory time',()=>{
 const n=new SpikingNetwork(3);n.synapses=[];const cell=n.neurons[0];
 n.configureNeuron(0,{bias:30,refractoryMs:10,threshold:-55});cell.v=-54;
 n.advance(1,{rateHz:0,gain:1});assert.equal(cell.spikes,1);assert.equal(cell.v,cell.reset);
 n.advance(9,{rateHz:0,gain:1});assert.equal(cell.spikes,1);
});
test('all counts are actual simulated spikes and reproduce across time chunks',()=>{
 const a=new SpikingNetwork(12),b=new SpikingNetwork(12);
 a.advance(1000,{rateHz:25,gain:1});for(let i=0;i<100;i++)b.advance(10,{rateHz:25,gain:1});
 assert.deepEqual(a.snapshot(),b.snapshot());const counts=a.drainCounts();
 assert.equal(counts.reduce((s,x)=>s+x,0),a.neurons.reduce((s,n)=>s+n.spikes,0));assert.deepEqual(a.drainCounts(),Array(8).fill(0));
});
test('local causal STDP updates weights without an outcome, and freezing disables updates',()=>{
 const n=new SpikingNetwork(5),syn=n.synapses.find(s=>n.neurons[s.from].type==='E');n.synapses=[syn];
 n.neurons.forEach(c=>{c.bias=0;c.v=c.rest});const before=syn.weight;n.neurons[syn.from].v=0;
 n.advance(1,{gain:0,plasticity:true});n.neurons[syn.to].v=0;n.advance(1,{gain:0,plasticity:true});
 assert.ok(syn.weight>before);const frozen=syn.weight;n.feedback('collision',100);assert.equal(syn.weight,frozen);
 n.advance(100,{plasticity:false});assert.equal(syn.weight,frozen);
});
test('local plasticity respects bounds and inhibitory sign',()=>{
 const n=new SpikingNetwork(8);n.advance(1000,{rateHz:40,plasticity:true,learningRate:1});
 for(const s of n.synapses)assert.ok(n.neurons[s.from].type==='E'?s.weight>=0&&s.weight<=6:s.weight<0);
});
test('neuron edits reject invalid values without partial mutations',()=>{
 const n=new SpikingNetwork(1),before={...n.neurons[0]};
 assert.throws(()=>n.configureNeuron(0,{tauMs:0}));assert.throws(()=>n.configureNeuron(0,{bias:NaN}));
 assert.throws(()=>n.configureNeuron(33,{bias:1}));assert.deepEqual(n.neurons[0],before);
 n.configureNeuron(0,{tauMs:25,bias:12});assert.equal(n.neurons[0].tauMs,25);
});
