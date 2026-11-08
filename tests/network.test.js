import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpikingNetwork} from '../dist/network.js';

test('eight seeded cells have explicit input, motor and training roles and simple wiring',()=>{
 const a=new SpikingNetwork(42),b=new SpikingNetwork(42);
 assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(a.neurons.length,8);
 assert.deepEqual(a.neurons.map(n=>n.role),['sensory','motor','training','training','training','training','training','training']);
 assert.equal(new Set(a.neurons.map(n=>n.tauMs)).size,1);
 assert.ok(a.synapses[0].weight>=3&&a.synapses[0].weight<4);assert.equal(a.synapses.length,19);assert.equal(a.synapses.filter(s=>s.plastic).length,13);
});
test('LIF voltage leaks toward rest without input and has no spontaneous noise',()=>{
 const n=new SpikingNetwork(2);n.neurons.forEach(c=>{c.v=-56});n.advance(20,{gain:0});
 assert.ok(n.neurons.every(c=>c.v<-56&&c.v>c.rest));assert.ok(n.neurons.every(c=>c.spikes===0));
});
test('threshold crossing spikes, resets voltage and enforces refractory time',()=>{
 const n=new SpikingNetwork(3);const cell=n.neurons[0];n.configureNeuron(0,{bias:30,refractoryMs:10,threshold:-55});cell.v=-54;
 n.advance(1);assert.equal(cell.spikes,1);assert.equal(cell.v,cell.reset);
 n.advance(9);assert.equal(cell.spikes,1);
});
test('counts are actual single-cell spikes and reproduce across time chunks',()=>{
 const a=new SpikingNetwork(12),b=new SpikingNetwork(12);
 a.advance(1000,{rateHz:100});for(let i=0;i<100;i++)b.advance(10,{rateHz:100});
 assert.deepEqual(a.snapshot(),b.snapshot());const counts=a.drainCounts();
 assert.deepEqual(counts,a.neurons.map(n=>n.spikes));assert.deepEqual(a.drainCounts(),Array(8).fill(0));assert.ok(counts[1]>0);
});
test('paired training uses only dedicated cells, suppresses sensory pulses and changes only plastic synapses',()=>{
 const n=new SpikingNetwork(42),before=n.synapses.map(s=>s.weight);
 n.train([2,3],300);n.advance(300,{rateHz:100,proprioHz:100,plasticity:true,learningRate:1});
 const pulses=n.drainPulses();assert.deepEqual(pulses.map(p=>p.network_time_ms),[1,6,101,106,201,206]);
 assert.deepEqual(pulses.map(p=>p.channels[0]),[2,3,2,3,2,3]);assert.ok(pulses.every(p=>p.kind==='training'));
 assert.ok(n.synapses.some((s,i)=>s.weight!==before[i]));
 for(const [i,s]of n.synapses.entries())if(!s.plastic)assert.equal(s.weight,before[i]);
 assert.equal(n.trainingLeft,0);
});
test('ordinary play and frozen training never update weights',()=>{
 const n=new SpikingNetwork(4),before=n.synapses.map(s=>s.weight);
 n.advance(1000,{rateHz:100,plasticity:true});assert.deepEqual(n.synapses.map(s=>s.weight),before);
 n.train([2,3]);n.advance(300,{plasticity:false});assert.deepEqual(n.synapses.map(s=>s.weight),before);
});
test('invalid edits and training requests are atomic',()=>{
 const n=new SpikingNetwork(1),before=n.snapshot();
 for(const pair of [[0,2],[2,2],[2],[2,9]])assert.throws(()=>n.train(pair));
 assert.throws(()=>n.train([2,3],NaN));assert.throws(()=>n.configureNeuron(0,{tauMs:0}));
 assert.throws(()=>n.configureNeuron(9,{bias:1}));assert.deepEqual(n.snapshot(),before);
 n.configureNeuron(0,{tauMs:25,bias:12});assert.equal(n.neurons[0].tauMs,25);
});
