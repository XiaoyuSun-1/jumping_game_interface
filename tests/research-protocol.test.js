import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResearchSession,attachResearch,validateResearchSetup,csvTable} from '../dist/research-protocol.js';
import {Engine} from '../dist/engine.js';

test('unlimited sessions do not terminate surviving trials after fifteen seconds',()=>{
 const e=new Engine({threshold:200});e.startResearchSession({trial_count:1,trial_limit_s:null});
 e.obstacles=[{id:1,x:100000,w:28,h:46,cleared:false}];
 for(let i=0;i<1800;i++)e.sessionStep(.01);
 assert.ok(e.time>17.9);assert.equal(e.trialRecorded,false);assert.equal(e.researchComplete,false);
});

test('hardware session selection retains its channel mapping and closes simulated trials before mode changes',()=>{
 const e=new Engine();e.step(.05);
 const old=e.currentRecording;
 e.startResearchSession({},{mode:'bridge'});
 assert.equal(old.mode,'neural');assert.equal(old.result.mode,'neural');assert.equal(old.result.config.mode,'neural');
 e.researchSession.adapter={recording_channels:[0,1,2,3,4,5,6,7]};
 e.startResearchSession({});assert.deepEqual(e.currentRecording.research.adapter.recording_channels,[0,1,2,3,4,5,6,7]);
 e.reset();assert.deepEqual(e.currentRecording.research.adapter.recording_channels,[0,1,2,3,4,5,6,7]);
});

test('CSV protects text formulas without changing numeric measurements',()=>{
 const csv=csvTable([{label:'=1+2',value:-2}],['label','value']);
 assert.ok(csv.includes('"\'=1+2"'));assert.ok(csv.includes('"-2"'));
});

test('research setup validates before creating a session and freezes trial provenance',()=>{
 const setup=validateResearchSetup({experiment_id:' OI-1 ',condition:'baseline',preparation_id:'SIM-42',notes:'test',trial_count:2,trial_limit_s:3,initialization:'continue',seed:42});
 assert.equal(setup.experiment_id,'OI-1');
 const session=createResearchSession(setup,{threshold:28}),record={};attachResearch(record,session,{threshold:28},42);
 session.setup.condition='changed';assert.equal(record.research.condition,'baseline');
 assert.equal(record.research.session_id,session.id);assert.equal(record.research.session_trial_index,1);
 for(const patch of [{trial_count:0},{trial_limit_s:NaN},{initialization:'magic'},{seed:0},{notes:'x'.repeat(5001)}])assert.throws(()=>validateResearchSetup({...setup,...patch}));
});
test('session boundaries retain model weights or explicitly initialize fresh without deleting trial records',()=>{
 const e=new Engine({seed:42,threshold:200});for(let i=0;i<20;i++)e.step(.05);
 const old=e.currentRecording,weights=e.model.synapses.map(s=>s.weight);
 e.startResearchSession({experiment_id:'OI-1',condition:'frozen',trial_count:2,trial_limit_s:2,initialization:'continue',seed:12});
 assert.deepEqual(e.model.synapses.map(s=>s.weight),weights);assert.equal(e.model.seed,42);
 assert.equal(e.currentRecording.research.condition,'frozen');assert.notEqual(e.currentRecording.research.session_id,old.research.session_id);
 assert.ok(e.recordings.includes(old));assert.equal(old.result.outcome,'stopped');
 e.startResearchSession({experiment_id:'OI-1',trial_count:1,trial_limit_s:1,initialization:'fresh',seed:12});
 assert.equal(e.model.seed,12);assert.equal(e.model.weightUpdates,0);
});
test('planned trial duration and session count terminate the runner without extra trials',()=>{
 const e=new Engine({seed:42,threshold:200});e.startResearchSession({trial_count:1,trial_limit_s:1,initialization:'continue',seed:42});
 for(let i=0;i<250;i++)e.sessionStep(.01);
 assert.equal(e.researchComplete,true);assert.equal(e.researchSession.completed_trials,1);assert.equal(e.trial,2);
 assert.equal(e.currentRecording.result.outcome,'time limit');assert.ok(e.time<=1.011);
});
test('invalid session setup leaves current trial and learned state untouched',()=>{
 const e=new Engine();e.step(.05);const id=e.currentRecording.id,state=e.model.snapshot();
 assert.throws(()=>e.startResearchSession({trial_count:-1}));assert.equal(e.currentRecording.id,id);assert.deepEqual(e.model.snapshot(),state);
});
test('recording provenance contains random-generator and engine states without advancing the model',()=>{
 const e=new Engine(),rng=e.model.rng;
 assert.equal(e.currentRecording.network_start.state.rng,rng);assert.equal(e.currentRecording.engine_state_start.game_rng,e.rng);
 const state=e.model.snapshot();e.refreshRecording();assert.deepEqual(e.model.snapshot(),state);
 assert.equal(e.currentRecording.engine_state_end.phase,'play');
});

test('changing controller closes the old recording under its original mode and preserves its selector state',()=>{
 const e=new Engine({threshold:200});e.step(.1);const old=e.currentRecording;
 e.startResearchSession({},{mode:'bridge'});
 assert.equal(old.game_current.mode,'neural');assert.ok(old.training_state_end);assert.equal(old.recording_complete,true);
 assert.equal(e.currentRecording.mode,'bridge');assert.equal(e.currentRecording.training_state_start,null);
});
