import {Engine} from './engine.js';
import {openArchive,writeRecords,readRecords} from './archive.js';
import {saveMemory,restoreMemory} from './memory.js';
import {PredictiveObserver,savePredictor,restorePredictor} from './predictive.js';
import {createInspector} from './inspector.js';
import {createResearchUI} from './research-ui.js';
const $=id=>document.getElementById(id),e=new Engine();
let running=false,training=false,cancel=false,last=0,acc=0,paint=0,lastSave=-Infinity;
let memoryEnabled=true,predictorEnabled=true;
try{restoreMemory(localStorage,e)}catch{memoryEnabled=false;$('memoryStatus').textContent='Saved network unavailable; refresh the network to replace it.'}
try{e.predictor=restorePredictor(localStorage,e.model.seed)}catch{e.predictor=new PredictiveObserver(e.model.seed);predictorEnabled=false;$('memoryStatus').textContent='Saved observer unavailable; refresh the network to replace it.'}
e.predictor.beginTrial(e.currentRecording,e.clock);
const archive=openArchive(globalThis.indexedDB);archive.catch(()=>{});
let recordingQueue=Promise.resolve(),archiveHealthy=true,lastArchive=-Infinity;
const archivedRevisions=new Map();
function persistRecordings(force=false){
 if(!force&&performance.now()-lastArchive<1000)return;lastArchive=performance.now();e.refreshRecording();
 const dirty=e.recordings.filter(r=>r.events.length&&archivedRevisions.get(r.id)!==r.revision);
 if(!dirty.length)return;
 const snapshot=structuredClone(dirty);for(const r of snapshot)archivedRevisions.set(r.id,r.revision);
 recordingQueue=recordingQueue.then(async()=>writeRecords(await archive,snapshot)).then(()=>{archiveHealthy=true;$('recordingStatus').textContent='Recording saved in this browser.'}).catch(()=>{archiveHealthy=false;archivedRevisions.clear();$('recordingStatus').textContent='Archive save failed. Download JSON now for retained recordings.'});
}
function persistMemory(force=false){
 if(!force&&performance.now()-lastSave<1000)return;lastSave=performance.now();
 try{if(memoryEnabled)saveMemory(localStorage,e);if(predictorEnabled)savePredictor(localStorage,e.predictor)}catch{$('memoryStatus').textContent='Memory save failed; download recordings for backup.'}
}
function download(body,type,name){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function loadRecords(){persistRecordings(true);await recordingQueue;return readRecords(await archive)}
const research=createResearchUI(e,$,{download,loadRecords,startSession:setup=>{e.startResearchSession(setup);if(setup.initialization==='fresh'){memoryEnabled=true;predictorEnabled=true}syncControls();persistMemory(true);persistRecordings(true);update();draw()},busy:()=>running||training});
function notice(text){$('notice').textContent=text;$('notice').style.display='block';clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').style.display='none',4000)}
function showView(name){for(const [id,view]of [['showExperiment','experimentView'],['showGame','gameView'],['showPerformance','performanceView'],['showHardware','hardwareView']]){$(view).hidden=view!==name;$(id).setAttribute('aria-pressed',String(view===name))}if(name==='performanceView')return research.reload()}
$('showExperiment').onclick=()=>showView('experimentView');$('showGame').onclick=()=>showView('gameView');$('showPerformance').onclick=()=>showView('performanceView');$('showHardware').onclick=()=>showView('hardwareView');
function setRunning(value){running=value&&!e.researchComplete;last=0;acc=0;persistMemory(true);persistRecordings(true);update()}
$('start').onclick=()=>setRunning(!running);
function newSession(){if(training)return;setRunning(false);e.startResearchSession({...e.researchSession.setup,initialization:'continue',trial_limit_s:null});persistRecordings(true);persistMemory(true);update();draw()}
$('reset').onclick=newSession;
$('step').onclick=()=>{if(training||running||e.researchComplete)return;for(let i=0;i<6;i++)e.step(1/120);persistRecordings(true);update();draw()};
$('runTrials').onclick=async()=>{
 if(training){cancel=true;return}
 if(e.config.mode!=='neural'){notice('Run faster is available for the spiking network.');return}
 setRunning(false);training=true;cancel=false;
 if(e.researchComplete)e.startResearchSession({...e.researchSession.setup,initialization:'continue',trial_limit_s:null});
 try{
  for(let i=0;!cancel&&!e.researchComplete;i++){
   const previous=e.trial;e.sessionStep(1/120);
   if(e.trial!==previous){persistRecordings(true);await recordingQueue;if(!archiveHealthy){cancel=true;notice('Run paused because recordings could not be saved. Download JSON.')}}
   if(i%120===119){update();draw();await new Promise(resolve=>setTimeout(resolve,0))}
  }
 }finally{training=false;setRunning(false);draw();await recordingQueue}
};
function jump(){if(e.config.mode==='manual'&&running)e.jump()}
$('game').onclick=jump;
window.addEventListener('keydown',event=>{if(event.code!=='Space'||['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)||e.config.mode!=='manual')return;event.preventDefault();jump()});
$('mode').onchange=()=>{if(running||training)return;e.startResearchSession({...e.researchSession.setup,initialization:'continue',trial_limit_s:null},{mode:$('mode').value});persistRecordings(true);update();draw()};
const numeric=['stimulusGain','horizon','threshold','latency','learningRate'],toggles=['sensory','feedback','plasticity'];
function syncControls(){for(const key of numeric)$(key).value=e.config[key];for(const key of toggles)$(key).checked=e.config[key];$('mode').value=e.config.mode}
for(const key of [...numeric,...toggles])$(key).onchange=()=>{try{e.configure({[key]:toggles.includes(key)?$(key).checked:Number($(key).value)});persistMemory(true);update()}catch(err){notice(err.message);syncControls()}};
$('downloadRecordings').onclick=async()=>{
 let saved=[],archiveAvailable=true;try{saved=await loadRecords()}catch{archiveAvailable=false}
 const records=new Map(saved.map(r=>[r.id,r]));for(const r of e.exportRecordings())if(r.events.length)records.set(r.id,r);
 download(JSON.stringify({schema:'neurorunner.recordings.v2',exported_at:new Date().toISOString(),archive_available:archiveAvailable,trials:[...records.values()].sort((a,b)=>a.started_at.localeCompare(b.started_at))},null,2),'application/json','neurorunner-recordings.json');
 if(!archiveAvailable)notice('Archive unavailable. JSON contains retained recordings only.');
};
const ctx=$('game').getContext('2d'),rctx=$('raster').getContext('2d');
const renderInspector=createInspector(e,()=>!running&&!training&&e.config.mode==='neural',()=>{persistMemory(true);update();draw()});
function update(){
 research.render();renderInspector();persistRecordings();persistMemory();
 const active=running||training,complete=e.researchComplete;
 $('status').textContent=complete?'Session complete':active?'Running':e.time?'Paused':'Ready';
 $('start').textContent=running?'Pause':complete?'Session complete':e.time?'Resume':'Start session';$('start').disabled=training||complete;
 $('runTrials').textContent=training?'Pause fast run':'Run faster';$('runTrials').disabled=running||e.config.mode!=='neural';
 $('reset').disabled=training;$('step').disabled=active||complete;$('mode').disabled=active;for(const key of [...numeric,...toggles])$(key).disabled=active;
 $('clock').textContent=e.time.toFixed(2)+' s';$('clears').textContent=e.clears;$('jumps').textContent=e.jumps;$('sensoryRate').textContent=e.phase==='play'?(e.config.sensory?e.modelRate:0).toFixed(1)+' Hz':'Gated during feedback';
 const proximity=e.phase==='play'&&e.config.sensory?(e.latestStim?.payload.normalized_intensity??0):0;$('proximity').value=proximity;$('proximityValue').textContent=proximity.toFixed(2);$('bodyInput').textContent=e.phase==='play'?'E1 body input: '+(e.y>0?'airborne':'grounded')+' · '+(e.config.sensory?e.modelProprio:0)+' Hz':'Normal sensory input is gated during feedback.';
 $('phaseStatus').textContent=e.phase==='play'?(e.config.mode==='manual'?'Space or click the game to jump.':'Spikes from E2–E5 control jumps.'):(e.phase==='clear_feedback'?'Clear feedback':e.phase==='miss_feedback'?'Random sensory feedback':complete?'Session complete':'Trial ended')+(e.phaseRemaining>0?' · '+e.phaseRemaining.toFixed(2)+' s remaining':'');
}
function draw(){
 const ground=245;ctx.clearRect(0,0,1000,300);ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,300);ctx.strokeStyle='#aaa';ctx.beginPath();ctx.moveTo(0,ground);ctx.lineTo(1000,ground);ctx.stroke();ctx.fillStyle='#222';
 for(const o of e.obstacles)ctx.fillRect(o.x,ground-o.h,o.w,o.h);
 ctx.beginPath();ctx.arc(114,ground-e.y-14,14,0,Math.PI*2);ctx.fill();
 rctx.clearRect(0,0,1000,420);rctx.fillStyle='#fff';rctx.fillRect(0,0,1000,420);rctx.font='10px monospace';
 for(let cell=0;cell<32;cell++){const y=cell*13;rctx.fillStyle='#555';rctx.fillText('N'+cell,2,y+10);rctx.strokeStyle=cell%4===3?'#ddd':'#f4f4f4';rctx.beginPath();rctx.moveTo(32,y+12);rctx.lineTo(1000,y+12);rctx.stroke()}
 for(const p of e.currentRecording.events){if(p.type!=='response'||!p.payload.cell_counts)continue;const age=(e.model.timeMs-p.payload.network_time_ms)/1000;if(age<0||age>5)continue;const x=32+968*(1-age/5);rctx.fillStyle='#222';p.payload.cell_counts.forEach((count,cell)=>{for(let j=0;j<count;j++)rctx.fillRect(x-j*2,cell*13+3,1,6)})}
}
function frame(now){
 if(running){if(last)acc+=Math.min((now-last)/1000,.05);while(acc>=1/120&&running){const previous=e.trial;e.sessionStep(1/120);acc-=1/120;if(e.trial!==previous)persistRecordings(true);if(e.researchComplete)setRunning(false)}}
 last=now;if(now-paint>100){update();draw();paint=now}requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel=true;if(running)setRunning(false)}});
window.addEventListener('pagehide',()=>{persistMemory(true);persistRecordings(true)});
syncControls();update();draw();requestAnimationFrame(frame);
