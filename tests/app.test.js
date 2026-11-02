import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('simplified interface preserves sessions, recordings, neural inspection and refresh behavior',async()=>{
 const recordingRows=new Map();let broken=false;
 const db={transaction(){if(broken)throw Error('storage failed');const tx={objectStore:()=>({put:r=>recordingRows.set(r.id,structuredClone(r)),getAll:()=>({result:[...recordingRows.values()]})})};queueMicrotask(()=>tx.oncomplete());return tx}};
 globalThis.indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request}};
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),nodes=new Map(),saved=new Map();
 globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
 function element(id){return {id,value:'',checked:true,style:{},textContent:'',tagName:'DIV',hidden:false,children:[],setAttribute(k,v){this[k]=v},click(){},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},focus(){},getContext(){return new Proxy({},{get:()=>()=>{}})}}}
 for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element(match[1]));
 const node=id=>{assert.ok(nodes.has(id),'Referenced UI element must exist: '+id);return nodes.get(id)};
 globalThis.document={getElementById:node,createElement:element,addEventListener(){},activeElement:{tagName:'BODY'}};
 const windowEvents=new Map();globalThis.window={addEventListener:(type,fn)=>windowEvents.set(type,fn)};let nextFrame;globalThis.requestAnimationFrame=fn=>{nextFrame=fn};
 let exported;URL.createObjectURL=blob=>{exported=blob;return 'blob:test'};URL.revokeObjectURL=()=>{};
 await import('../dist/app.js');
 assert.ok(!html.includes('id="export"'));assert.ok(!html.includes('id="showPredictive"'));assert.ok(!html.includes('id="clearMemory"'));assert.ok(!html.includes('research_trial_limit_s'));
 node('research_initialization').value='continue';node('research_experiment_id').value='UI-test';node('research_trial_count').value='25';node('applyResearch').onclick();
 node('threshold').value='200';node('threshold').onchange();node('plasticity').checked=false;node('plasticity').onchange();
 await node('runTrials').onclick();await node('downloadRecordings').onclick();const archive=JSON.parse(await exported.text());
 const trials=archive.trials.filter(r=>r.research.experiment_id==='UI-test');assert.equal(trials.length,25,'archive must survive the 20-record memory cap');assert.ok(trials.every(r=>r.recording_complete));assert.ok(trials.every(r=>r.research.protocol.trial_limit_s===null));
 assert.ok(trials.every(r=>r.network_start.synapses.every((s,i)=>s.weight===r.network_end.synapses[i].weight)),'frozen weights remain unchanged');
 assert.equal(node('start').textContent,'Session complete');
 await node('showPerformance').onclick();assert.ok(node('researchRows').children.length>=25);assert.equal(node('recordChannels').children.length,32);assert.ok(node('recordWeights').children.length>0);
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
