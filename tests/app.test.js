import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('simplified interface preserves sessions, recordings, neural inspection and refresh behavior',async()=>{
 const recordingRows=new Map([['legacy',{id:'legacy',revision:1,started_at:'2020-01-01',trial:1,simulation:true,mode:'neural',model_version:'lif-dishbrain-v2',network_start:{neurons:Array.from({length:32},(_,id)=>({id})),synapses:[]},events:[{type:'response',payload:{bin_ms:50,cell_counts:Array(32).fill(1)}}]}]]);let broken=false;const paints=new Map();
 const db={transaction(){if(broken)throw Error('storage failed');const tx={objectStore:()=>({put:r=>recordingRows.set(r.id,structuredClone(r)),getAll:()=>({result:[...recordingRows.values()]})})};queueMicrotask(()=>tx.oncomplete());return tx}};
 globalThis.indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request}};
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),nodes=new Map(),saved=new Map();
 globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
 function element(id){return {id,value:'',checked:true,style:{},textContent:'',tagName:'DIV',hidden:false,children:[],setAttribute(k,v){this[k]=v},click(){},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},focus(){},getContext(){return new Proxy({},{get:(_,method)=>()=>{if(method==='clearRect')paints.set(id,(paints.get(id)??0)+1)}})}}}
 for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element(match[1]));
 const node=id=>{assert.ok(nodes.has(id),'Referenced UI element must exist: '+id);return nodes.get(id)};
 globalThis.document={getElementById:node,createElement:element,addEventListener(){},activeElement:{tagName:'BODY'}};
 const windowEvents=new Map();globalThis.window={addEventListener:(type,fn)=>windowEvents.set(type,fn)};let nextFrame;globalThis.requestAnimationFrame=fn=>{nextFrame=fn};
 let exported;URL.createObjectURL=blob=>{exported=blob;return 'blob:test'};URL.revokeObjectURL=()=>{};
 await import('../dist/app.js');
 const gamePaints=paints.get('game'),rasterPaints=paints.get('raster');
 for(const timestamp of [16,32,48,64,80,96])nextFrame(timestamp);
 assert.equal(paints.get('game')-gamePaints,6,'game renders on every animation frame');
 assert.equal(paints.get('raster'),rasterPaints,'neural raster stays on its slower refresh');
 assert.ok(!html.includes('id="export"'));assert.ok(!html.includes('id="showPredictive"'));assert.ok(!html.includes('id="clearMemory"'));assert.ok(!html.includes('research_trial_limit_s'));assert.ok(!html.includes('inputExplanation'));assert.ok(!html.includes('showHardware'));assert.ok(html.includes('Input → Jump → Training'));assert.match(html,/<option value="bridge" disabled>Organoid/);assert.ok(html.includes('trainingStatus'));
 node('research_initialization').value='continue';node('research_experiment_id').value='UI-test';node('research_trial_count').value='25';node('applyResearch').onclick();
 assert.equal(node('gameView').hidden,false);assert.equal(node('experimentView').hidden,true);
 node('threshold').value='200';node('threshold').onchange();node('plasticity').checked=false;node('plasticity').onchange();
 await node('runTrials').onclick();await node('downloadRecordings').onclick();const archive=JSON.parse(await exported.text());
 const trials=archive.trials.filter(r=>r.research?.experiment_id==='UI-test');assert.equal(trials.length,25,'archive must survive the 20-record memory cap');assert.ok(trials.every(r=>r.recording_complete));assert.ok(trials.every(r=>r.research.protocol.trial_limit_s===null));
 assert.ok(trials.every(r=>r.network_start.synapses.every((s,i)=>s.weight===r.network_end.synapses[i].weight)),'frozen weights remain unchanged');
 assert.equal(node('start').textContent,'Complete');
 await node('viewResults').onclick();assert.equal(node('performanceView').hidden,false);assert.equal(node('gameView').hidden,true);assert.ok(node('researchRows').children.length>=25);assert.equal(node('recordChannels').children.length,6);assert.ok(node('recordWeights').children.length>0);assert.equal(node('recordNeuron').children.length,7);
 node('researchFilter').value='';node('researchFilter').oninput();node('recordSelect').value='legacy';node('recordSelect').onchange();assert.equal(node('recordChannels').children.length,32);assert.equal(node('recordNeuron').children.length,33);
 node('researchFilter').value='UI-test';node('researchFilter').oninput();
 node('researchTrialsCsv').onclick();const csv=await exported.text();assert.ok(csv.includes('UI-test'));assert.ok(csv.includes('"seconds"'));assert.ok(!csv.includes('distance_m'));
 node('recordNeuron').value='0';node('recordNeuron').onchange();assert.ok(node('recordWeights').children.every(row=>row.children[0].textContent===0||row.children[1].textContent===0));
 node('researchFilter').value='does-not-exist';node('researchFilter').oninput();assert.equal(node('recordChannels').children.length,0);assert.equal(node('recordWeights').children.length,0);
 node('showGame').onclick();node('reset').onclick();node('neuronSelect').value='0';node('neuronSelect').onchange();node('cellBias').value='17';node('applyNeuron').onclick();node('reset').onclick();
 await node('downloadRecordings').onclick();let all=JSON.parse(await exported.text()).trials;assert.equal(all.at(-1).network_end.neurons[0].bias,17);
 node('research_initialization').value='fresh';node('applyResearch').onclick();node('step').onclick();await node('downloadRecordings').onclick();all=JSON.parse(await exported.text()).trials;assert.notEqual(all.at(-1).network_end.neurons[0].bias,17);assert.ok(all.length>=25,'refresh must retain archive');
 windowEvents.get('pagehide')();await import('../dist/app.js?reload');assert.ok(node('memoryStatus').textContent==='');
 // Fast execution must remain cancellable with no gameplay time cap.
 node('research_initialization').value='continue';const fast=node('runTrials').onclick();node('runTrials').onclick();await fast;assert.equal(node('start').disabled,false);
 broken=true;await node('runTrials').onclick();assert.ok(node('recordingStatus').textContent.includes('failed'));
});
