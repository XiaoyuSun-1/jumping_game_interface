import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
test('trial recording contains per-cell neural bins, settings, results and weight snapshots',()=>{
 const e=new Engine({threshold:200});while(!e.crashed)e.sessionStep(1/120);
 const record=e.export().recordings.at(-1);
 assert.equal(record.complete,true);assert.equal(record.result.outcome,'collision');
 assert.equal(record.network_start.neurons.length,6);assert.equal(record.network_end.neurons.length,6);
 const samples=record.events.filter(p=>p.type==='response');assert.ok(samples.length>0);
 for(const p of samples){assert.equal(p.payload.cell_counts.length,6);assert.equal(p.payload.voltages_mV.length,6);
  for(let electrode=0;electrode<6;electrode++)assert.equal(p.payload.counts[electrode],p.payload.cell_counts[electrode]);
 }
 const weights=record.network_end.synapses.map(s=>s.weight);e.nextTrial();
 assert.deepEqual(e.export().recordings.at(-1).network_start.synapses.map(s=>s.weight),weights);
});
test('recordings survive event-ring eviction, export is detached and external counts are not invented cells',()=>{
 const e=new Engine();e.step(.05);e.events=[];
 assert.ok(e.export().recordings[0].events.length>0);const exported=e.export();exported.recordings[0].network_start.neurons[0].bias=99;
 assert.notEqual(e.export().recordings[0].network_start.neurons[0].bias,99);
 const bridge=new Engine({mode:'bridge'});bridge.receive(Array(8).fill(1),'external bridge');
 const r=bridge.export().recordings[0];assert.equal(r.network_start,null);assert.equal(r.events[0].payload.cell_counts,null);
});
test('complete recordings include every generated spike even with feedback off or an interrupted trial',()=>{
 for(const feedback of [true,false]){
  const e=new Engine({feedback});for(let i=0;i<17;i++)e.step(1/120);e.finishTrial('stopped');
  const r=e.exportRecordings().at(-1),cells=Array(6).fill(0);
  for(const p of r.events.filter(p=>p.type==='response'))p.payload.cell_counts.forEach((n,id)=>cells[id]+=n);
  assert.deepEqual(cells,r.network_end.neurons.map((n,id)=>n.spikes-r.network_start.neurons[id].spikes));
 }
});
test('skipping rest or clearing memory flushes the final partial rest bin',()=>{
 for(const transition of ['nextTrial','reset']){
  const e=new Engine({threshold:200});while(!e.crashed)e.sessionStep(1/120);
  e.sessionStep(.033);const id=e.currentRecording.id;e[transition]();
  const r=e.exportRecordings().find(r=>r.id===id),counts=Array(6).fill(0);
  for(const p of r.events.filter(p=>p.type==='response'))p.payload.cell_counts.forEach((n,i)=>counts[i]+=n);
  assert.deepEqual(counts,r.network_end.neurons.map((n,i)=>n.spikes-r.network_start.neurons[i].spikes));
 }
});
