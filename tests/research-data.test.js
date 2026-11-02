import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchTrialRows,summarizeSessions,neuralSummary,connectionChanges} from '../dist/research-data.js';
import {Engine} from '../dist/engine.js';

const manifest={schema:'neurorunner.research.v1',experiment_id:'exp-a',session_id:'session-a',session_started_at:'2026-11-01T10:00:00Z',condition:'baseline',preparation_id:'prep-a',notes:'First session',protocol:{speed:290},adapter:null};
const trial={id:'a',revision:2,trial:1,mode:'neural',simulation:true,model_version:'fixed-v1',feedback_protocol:'feedback-v1',research:manifest,config_start:{speed:290},complete:true,result:{time_s:2,distance_px:600,clears:1,jumps:2,outcome:'stopped'},events:[]};

test('connection changes compare trial snapshots by connection rather than array order or fresh seed',()=>{
 const r={network_start:{synapses:[{from:0,to:2,weight:1},{from:1,to:2,weight:-2}]},network_end:{synapses:[{from:1,to:2,weight:-2},{from:0,to:2,weight:1.5}]}};
 assert.deepEqual(connectionChanges(r),[{from:0,to:2,beginning:1,end:1.5,delta:.5},{from:1,to:2,beginning:-2,end:-2,delta:0}]);
 assert.equal(connectionChanges({network_start:r.network_start})[0].end,null);assert.deepEqual(connectionChanges({mode:'bridge'}),[]);
});

test('research rows keep latest checkpoints, actual metrics and explicit missing session assignments',()=>{
 const incomplete={...trial,id:'b',complete:false,result:null,game_current:{time_s:1,distance_px:150,clears:0,jumps:1},events:[{type:'settings',payload:{config:{speed:300}}}]};
 const rows=researchTrialRows([{...trial,revision:1,result:null,complete:false},trial,incomplete,{id:'legacy',trial:5,result:{time_s:3},complete:true}]);
 assert.equal(rows.length,3);
 assert.deepEqual(rows[0],{id:'a',trial:1,experiment_id:'exp-a',session_id:'session-a',condition:'baseline',preparation_id:'prep-a',source:'browser-simulator',model_version:'fixed-v1',feedback_protocol:'feedback-v1',seconds:2,distance_m:20,clears:1,jumps:2,outcome:'stopped',complete:true,settings_changed:false});
 assert.equal(rows[1].complete,false);assert.equal(rows[1].outcome,'incomplete');assert.equal(rows[1].seconds,1);assert.equal(rows[1].settings_changed,true);
 assert.equal(rows[2].session_id,null);assert.equal(rows[2].experiment_id,null);assert.equal(rows[2].distance_m,null);assert.equal(rows[2].clears,null);
 assert.equal(researchTrialRows([{...trial,complete:true,result:null}])[0].complete,false);
});

test('settings flag reflects actual changes rather than unchanged settings snapshots',()=>{
 assert.equal(researchTrialRows([{...trial,events:[{type:'settings',payload:{config:{speed:290}}}]}])[0].settings_changed,false);
 assert.equal(researchTrialRows([{...trial,result:{...trial.result,config:{speed:300}}}])[0].settings_changed,true);
 assert.equal(researchTrialRows([{...trial,events:[{type:'settings',payload:{neuron:0,threshold:-45}}]}])[0].settings_changed,true);
});

test('session comparison counts unique trials and averages only complete observations',()=>{
 const second={...trial,id:'b',result:{time_s:4,distance_px:900,clears:3,jumps:4,outcome:'stopped'}};
 const partial={...trial,id:'c',complete:false,result:null,game_current:{time_s:99,clears:99,jumps:99},events:[{type:'settings',payload:{config:{speed:300}}}]};
 const records=[{...trial,revision:1},trial,second,partial,{...trial,id:'legacy',research:null},{...trial,id:'other',research:{...manifest,experiment_id:'exp-b'}}];
 const sessions=summarizeSessions(records);
 assert.equal(sessions.length,2);
 assert.equal(sessions[0].trials,3);assert.equal(sessions[0].completed,2);assert.equal(sessions[0].incomplete,1);assert.equal(sessions[0].settings_changed,1);
 assert.equal(sessions[0].mean_seconds,3);assert.equal(sessions[0].mean_distance_m,25);assert.equal(sessions[0].mean_clears,2);assert.equal(sessions[0].mean_jumps,3);
 assert.equal(sessions[0].condition,'baseline');assert.deepEqual(sessions[0].protocol,{speed:290});assert.deepEqual(sessions[0].sources,['browser-simulator']);
 assert.ok(sessions[0].warnings.length);assert.equal(sessions[1].experiment_id,'exp-b');
});

test('neural rates use actual partial bins, including terminal bins after game end',()=>{
 const summary=neuralSummary({...trial,events:[{type:'response',payload:{bin_ms:50,cell_counts:[1,2],counts:[3]}},{type:'response',payload:{bin_ms:25,cell_counts:[2,1],counts:[3]}}]});
 assert.equal(summary.kind,'cells');assert.equal(summary.duration_ms,75);
 assert.deepEqual(summary.channels,[{id:0,spikes:3,rate_hz:40},{id:1,spikes:3,rate_hz:40}]);
 const engine=new Engine({plasticity:false});engine.step(.033);engine.finishTrial('stopped');
 const real=neuralSummary(engine.exportRecordings()[0]);assert.equal(real.duration_ms,33);assert.equal(real.channels.length,32);
});

test('external recordings expose electrode counts without inventing per-cell observations',()=>{
 const external={...trial,mode:'bridge',simulation:false,events:[{type:'response',payload:{bin_ms:50,counts:[1,2],cell_counts:[20,20,20]}}]};
 assert.deepEqual(neuralSummary(external),{kind:'electrodes',duration_ms:50,channels:[{id:0,spikes:1,rate_hz:20},{id:1,spikes:2,rate_hz:40}],warnings:[]});
 assert.equal(neuralSummary({...trial,events:[]}).kind,'unavailable');
});

test('invalid neural bins are excluded with warnings and never diluted into rates',()=>{
 const summary=neuralSummary({...trial,events:[{type:'response',payload:{bin_ms:50,cell_counts:[1,2]}},{type:'response',payload:{bin_ms:0,cell_counts:[99,99]}},{type:'response',payload:{bin_ms:25,cell_counts:[1]}},{type:'response',payload:{bin_ms:25,cell_counts:[-1,1]}}]});
 assert.equal(summary.duration_ms,50);assert.deepEqual(summary.channels,[{id:0,spikes:1,rate_hz:20},{id:1,spikes:2,rate_hz:40}]);assert.ok(summary.warnings.length);
});
