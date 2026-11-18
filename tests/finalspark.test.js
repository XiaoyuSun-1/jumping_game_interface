import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {neuralSummary} from '../dist/research-data.js';

test('FinalSpark drives jumps with reproducible 100 ms electrode bins and preserves source metadata', () => {
 const create=()=>new Engine({simulationSource:'finalspark',threshold:1,emptyJumpPenalty:false});
 const a=create(),b=create();
 for(const engine of [a,b]){
  engine.step(.05);
  assert.equal(engine.events.filter(packet=>packet.type==='response').length,0);
  for(let i=0;i<39;i++)engine.step(.05);
 }
 const record=a.exportRecordings().at(-1);
 assert.deepEqual(a.events,b.events);
 assert.equal(record.mode,'neural');
 assert.equal(record.model_version,'finalspark-markov-100ms-v1');
 assert.equal(record.simulation,true);
 assert.equal(record.network_end,null);
 assert.equal(record.feedback_protocol,null);
 assert.equal(record.spike_generator.profile,'fs396-org0');
 assert.notEqual(record.model_instance_id,a.modelId);
 assert.ok(!record.events.some(packet=>['stimulus','pulse','weights'].includes(packet.type)));
 const bins=record.events.filter(packet=>packet.type==='response');
 assert.equal(bins.length,20);
 assert.ok(bins.every((packet,i)=>packet.t_ms===(i+1)*100&&packet.payload.bin_ms===100&&packet.payload.counts.length===8));
 // Independently sampled from the fitted NumPy weights with the browser seed.
 assert.deepEqual(bins.slice(0,8).map(packet=>packet.payload.counts[6]),[1,0,0,0,0,2,2,2]);
 const action=record.events.find(packet=>packet.type==='action');
 assert.equal(action.payload.controller,'FinalSpark simulated spikes');
 assert.equal(neuralSummary(record).duration_ms,2000);
});

test('changing simulation sources starts a new session and retains the learning network', () => {
 const engine=new Engine();
 engine.model.configureNeuron(0,{bias:17});
 engine.step(.05);
 const network=engine.model.snapshot();
 engine.startResearchSession({}, {simulationSource:'finalspark'});
 for(let i=0;i<10;i++)engine.step(.05);
 assert.deepEqual(engine.model.snapshot().synapses,network.synapses);
 assert.equal(engine.model.timeMs,network.time_ms);
 assert.equal(engine.recordings[0].model_version,network.model_version);
 engine.startResearchSession({}, {simulationSource:'lif'});
 assert.equal(engine.model.neurons[0].bias,17);
 assert.equal(engine.currentRecording.network_start.model_version,network.model_version);
});

test('a FinalSpark trial captures all full play bins across penalty and collision boundaries', () => {
 const engine=new Engine({simulationSource:'finalspark',threshold:1});
 engine.obstacles[0].x=10000;
 for(let i=0;i<100;i++)engine.step(.05);
 assert.ok(engine.emptyJumpPunishments>=2);
 const responses=()=>engine.events.filter(packet=>packet.type==='response');
 assert.equal(responses().length,Math.floor(engine.phaseTimes.play*10+1e-8));

 const collision=new Engine({simulationSource:'finalspark'});
 collision.obstacles[0].x=130;
 collision.step(.1);
 assert.equal(collision.crashed,true);
 assert.ok(collision.events.some(packet=>packet.type==='response'&&packet.payload.bin_ms===100));
 assert.equal(collision.jumps,0);
});
