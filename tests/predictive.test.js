import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PredictiveObserver,predictorKey,savePredictor,restorePredictor} from '../dist/predictive.js';
import {Engine} from '../dist/engine.js';
const signals=(n=1)=>({sessionTimeS:n/10,gameTimeS:n/10,intensity:.7,airborne:false,contact:false,feedback:false,jumps:0});
const recording=()=>({id:crypto.randomUUID(),revision:0});

test('observer records pre-update predictions, actual neural spikes and physical synapses',()=>{
 const p=new PredictiveObserver(12),r=recording();p.beginTrial(r,0);
 const row=p.sample(r,signals());
 assert.deepEqual(row.input,[1,1,0,0,0,0]);
 assert.ok(Number.isFinite(row.pre_update_surprise_nats));assert.ok(Number.isFinite(row.variational_free_energy_nats));
 assert.equal(row.spikes.length,4);assert.equal(r.predictive.role,'observer');
 assert.equal(r.predictive.observations.length,1);assert.ok(r.predictive.final.circuit.synapses.length>0);
 assert.ok(r.predictive.final.circuit.updates>0);assert.ok(r.revision>0);
 assert.equal(p.sample(r,signals()),null,'same time is not a second observation');
});
test('replacement game has no hidden predictive observer or observer recording',()=>{
 const e=new Engine({threshold:200});while(!e.crashed)e.step(.01);
 while(e.phase==='training')e.step(.01);
 assert.equal(e.predictor,undefined);assert.equal(e.currentRecording.predictive,undefined);
 assert.equal(e.export().predictive,undefined);
 const bridge=new Engine({mode:'bridge'});bridge.step(.05);assert.equal(bridge.currentRecording.predictive,undefined);
});
test('trial boundaries retain learned weights while reset creates a fresh predictor',()=>{
 const p=new PredictiveObserver(12),r=recording();p.beginTrial(r,0);p.sample(r,signals());
 const weights=p.circuit.synapses.map(s=>s.strength),next=recording();p.beginTrial(next,.1);
 assert.deepEqual(p.circuit.synapses.map(s=>s.strength),weights);
 p.learningEnabled=false;p.sample(next,{...signals(2),jumps:1});
 assert.equal(next.predictive.observations[0].executed_action,1);
 assert.deepEqual(p.circuit.synapses.map(s=>s.strength),weights);
 assert.notDeepEqual(new PredictiveObserver(12).circuit.synapses.map(s=>s.strength),weights);
});
test('predictor memory is separate, validated atomically and preserves physical learning',()=>{
 const map=new Map([['neurorunner.memory.v1','legacy intact']]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const p=new PredictiveObserver(12),r=recording();p.beginTrial(r,0);p.sample(r,signals());savePredictor(storage,p);
 assert.equal(map.get('neurorunner.memory.v1'),'legacy intact');
 const next=restorePredictor(storage,42);assert.equal(next.seed,12);
 assert.deepEqual(next.circuit.synapses.map(s=>s.strength),p.circuit.synapses.map(s=>s.strength));
 assert.deepEqual(next.circuit.transitionSynapses.map(s=>s.strength),p.circuit.transitionSynapses.map(s=>s.strength));
 assert.equal(next.statistics.samples,p.statistics.samples);
 const missingSeed=JSON.parse(map.get(predictorKey));delete missingSeed.seed;delete missingSeed.circuit.seed;map.set(predictorKey,JSON.stringify(missingSeed));
 assert.throws(()=>restorePredictor(storage,42),'checkpoint seed provenance is required');savePredictor(storage,p);
 const bad=JSON.parse(map.get(predictorKey));bad.circuit.synapses[0].strength=-1;map.set(predictorKey,JSON.stringify(bad));
 assert.throws(()=>restorePredictor(storage,42));assert.equal(map.get('neurorunner.memory.v1'),'legacy intact');
});
