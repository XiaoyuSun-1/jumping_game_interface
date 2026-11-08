import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectionMap,performanceSeries,weightChanges} from '../dist/maps.js';
import {Engine} from '../dist/engine.js';
test('connection map uses actual topology, rates and plasticity without fabricating silent cell activity',()=>{
 const e=new Engine();for(let i=0;i<180;i++)e.step(.01);
 const map=connectionMap(e.model.snapshot(),e.currentRecording.events);
 assert.equal(map.nodes.length,8);assert.equal(map.edges.length,19);assert.equal(map.edges.filter(s=>s.plastic).length,13);
 assert.ok(map.nodes[0].rate>0);assert.equal(map.nodes[2].rate,0);assert.equal(connectionMap(null,[]).nodes.length,0);
});
test('performance series separate sessions, retain open trials, and mark duration caps',()=>{
 const records=[{id:'1',research:{session_id:'a',session_trial_index:1},result:{time_s:60,clears:10,outcome:'time limit'}},
 {id:'2',research:{session_id:'b',session_trial_index:1},game_current:{time_s:2,clears:0}},
 {id:'3',research:{session_id:'a',session_trial_index:2},result:{time_s:4,clears:1,outcome:'collision'}}];
 const groups=performanceSeries(records);assert.equal(groups.length,2);assert.deepEqual(groups[0].points.map(p=>p.trial),[1,2]);
 assert.equal(groups[0].points[0].capped,true);assert.equal(groups[1].points[0].open,true);
});
test('weight changes join by connection identity and leave unavailable snapshots absent',()=>{
 const r={network_start:{synapses:[{from:0,to:1,weight:3},{from:2,to:0,weight:20}]},network_end:{synapses:[{from:2,to:0,weight:20},{from:0,to:1,weight:4}]}};
 assert.deepEqual(weightChanges(r).map(s=>s.delta),[1,0]);assert.deepEqual(weightChanges({network_start:r.network_start}),[]);
});
test('refresh activity never includes spikes from the previous network lifetime',async()=>{
 const {recentModelEvents}=await import('../dist/maps.js');
 const e=new Engine();for(let i=0;i<200;i++)e.step(.01);
 assert.ok(connectionMap(e.model.snapshot(),recentModelEvents(e.recordings)).nodes[0].rate>0);
 e.startResearchSession({initialization:'fresh'});
 assert.equal(connectionMap(e.model.snapshot(),recentModelEvents(e.recordings)).nodes[0].rate,0);
 for(let i=0;i<150;i++)e.step(.01);
 assert.equal(recentModelEvents(e.recordings).length,e.currentRecording.events.length);
});
test('historical STDP connections use recorded neuron types rather than appearing fixed',()=>{
 const old={model_version:'lif-dishbrain-v2',time_ms:0,neurons:[{id:0,type:'E'},{id:1,type:'I'}],synapses:[{from:0,to:1,weight:2},{from:1,to:0,weight:-2}]};
 assert.deepEqual(connectionMap(old).edges.map(s=>s.plastic),[true,false]);
});
test('empty maps replace stale accessible descriptions',async()=>{
 const {drawConnections,drawPerformance,drawWeights}=await import('../dist/maps.js');
 for(const draw of [c=>drawConnections(c,null),c=>drawPerformance(c,[]),c=>drawWeights(c,null)]){
  const c={width:800,height:390,label:'stale trial information',setAttribute(k,v){if(k==='aria-label')this.label=v},getContext(){return new Proxy({},{get:()=>()=>{}})}};
  draw(c);assert.notEqual(c.label,'stale trial information');assert.match(c.label,/No |Start /);
 }
});
test('feedback graph counts actual periods and separates disabled punishment from empty actions',async()=>{
 const {feedbackRows}=await import('../dist/maps.js');
 const rows=feedbackRows([{research:{session_id:'s',session_trial_index:1},result:{rewards:2,empty_jumps:5,empty_jump_punishments:0,outcome:'time limit'},config_start:{emptyJumpPenalty:false}},
 {trial:2,result:{outcome:'collision',rewards:1,empty_jump_punishments:3},config_start:{trainingSeconds:1}}]);
 assert.equal(rows[0].rewards,2);assert.equal(rows[0].empty,0);assert.equal(rows[0].collisions,0);assert.equal(rows[1].empty,3);assert.equal(rows[1].collisions,1);
});
test('weight traces use real samples and preserve gaps for removed connections',async()=>{
 const {weightHistory}=await import('../dist/maps.js');
 const r={network_start:{time_ms:0,synapses:[{from:0,to:1,weight:3}]},network_end:{time_ms:1000,synapses:[]},events:[{type:'weights',network_time_ms:250,payload:{synapses:[{from:0,to:1,weight:4}]}},{type:'weights',network_time_ms:500,payload:{synapses:[]}}]};
 assert.deepEqual(weightHistory(r,'0:1').map(p=>p.weight),[3,4,null,null]);assert.deepEqual(weightHistory(r,'0:1').map(p=>p.seconds),[0,.25,.5,1]);
});
test('feedback line series retain every trial and break across sessions or missing trials',async()=>{
 const {feedbackLines}=await import('../dist/maps.js');
 const records=Array.from({length:45},(_,i)=>({research:{session_id:'a',session_trial_index:i+1},result:{rewards:i,empty_jump_punishments:i%3,outcome:i%2?'collision':'time limit'}}));
 records.push({research:{session_id:'b',session_trial_index:1},result:{rewards:7,empty_jump_punishments:2,outcome:'time limit'}});
 records.push({research:{session_id:'b',session_trial_index:3},game_current:{rewards:2,empty_jump_punishments:1}});
 const chart=feedbackLines(records);assert.equal(chart.rows.length,47);assert.equal(chart.series.length,3);
 const reward=chart.series.find(s=>s.key==='rewards');assert.equal(reward.points.length,47);assert.equal(reward.points[44].value,44);
 assert.equal(reward.points[1].connect,true);assert.equal(reward.points[45].connect,false);assert.equal(reward.points[46].connect,false);assert.equal(reward.points[46].open,true);
 assert.equal(chart.series.find(s=>s.key==='collisions').points[1].value,1);
});
