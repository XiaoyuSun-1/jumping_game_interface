import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../dist/engine.js';
import {connectionMap,drawConnections,connectivityForRecord} from '../dist/maps.js';
const topology=()=>({schema:'neurorunner.channel-connectivity.v1',channels:[{id:12,label:'Input',role:'sensory',count_index:0},{id:37,label:'Motor',role:'motor',count_index:2},{id:91,label:'Training',role:'training'}],connections:[{from:12,to:37,kind:'functional',strength:.8}],strength_units:'response probability'});
test('external topology can be updated and recorded without simulating neuron connections or missing activity',()=>{
 const e=new Engine({mode:'bridge'});e.updateChannelConnectivity(topology());e.receive([2,0,3,0,0,0,0,0]);
 const map=connectionMap(e.connectivitySnapshot,e.currentRecording.events);
 assert.deepEqual(map.nodes.map(n=>n.id),[12,37,91]);assert.equal(map.kind,'channels');assert.equal(map.nodes[0].rate,40);assert.equal(map.nodes[1].rate,60);assert.equal(map.nodes[2].rate,null);
 assert.equal(map.edges[0].weight,.8);assert.equal(map.edges[0].plastic,null);assert.equal(e.currentRecording.network_end,null);
 const r=e.exportRecordings().at(-1);assert.equal(connectivityForRecord(r).channels[1].id,37);
 const updated=topology();updated.channels.push({id:101,label:'Extra'});updated.connections=[];e.updateChannelConnectivity(updated);
 assert.equal(connectionMap(e.connectivitySnapshot).nodes.length,4);assert.equal(e.currentRecording.events.filter(p=>p.type==='connectivity').length,2);
 e.nextTrial();assert.equal(e.connectivitySnapshot.channels.length,4);assert.equal(e.currentRecording.channel_connectivity_start.channels.length,4);
});
test('topology updates validate all references atomically and never reinterpret simulation channels',()=>{
 assert.throws(()=>new Engine().updateChannelConnectivity(topology()));
 const e=new Engine({mode:'bridge'});e.updateChannelConnectivity(topology());const original=e.connectivitySnapshot;
 for(const mutate of [x=>x.channels.push({...x.channels[0]}),x=>x.connections[0].to=999,x=>x.channels[1].count_index=0,x=>x.connections[0].strength=NaN]){
  const bad=topology();mutate(bad);assert.throws(()=>e.updateChannelConnectivity(bad));assert.deepEqual(e.connectivitySnapshot,original);
 }
});
test('external chart renders nonconsecutive channel IDs and unknown weights without fake neuron labels',()=>{
 const e=new Engine({mode:'bridge'}),t=topology();delete t.connections[0].strength;e.updateChannelConnectivity(t);
 const labels=[],attrs={},c={width:800,height:340,setAttribute:(k,v)=>attrs[k]=v,getContext:()=>new Proxy({fillText:text=>labels.push(text)},{get:(o,k)=>o[k]??(()=>{})})};
 drawConnections(c,e.connectivitySnapshot,[]);assert.ok(labels.includes('CH12'));assert.ok(labels.includes('CH37'));assert.ok(labels.some(x=>x.includes('functional')));assert.ok(!labels.some(x=>x==='N12'));assert.match(attrs['aria-label'],/channels/);
});
test('changing the adapter channel mapping does not reinterpret old response bins',()=>{
 const e=new Engine({mode:'bridge'});e.updateChannelConnectivity(topology());e.receive([2,0,3,0,0,0,0,0]);
 const t=topology();t.channels[0].count_index=2;t.channels[1].count_index=0;e.updateChannelConnectivity(t);
 const map=connectionMap(e.connectivitySnapshot,e.currentRecording.events);assert.equal(map.nodes[0].rate,null);assert.equal(map.nodes[1].rate,null);
 e.receive([4,0,1,0,0,0,0,0]);const fresh=connectionMap(e.connectivitySnapshot,e.currentRecording.events);assert.equal(fresh.nodes[0].rate,20);assert.equal(fresh.nodes[1].rate,80);
});
