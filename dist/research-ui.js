import {drawConnections,drawPerformance,drawTrialFeedback,drawElectrodeMap,drawElectrodeCoactivity,drawWeights,connectivityForRecord,drawFeedback,drawWeightHistory,drawSpeed,syncWeightSelector} from './maps.js';
import {FINALSPARK_ELECTRODES,FINALSPARK_VERSION,finalSparkCorrelations} from './finalspark.js';
import {researchSetupKey,validateResearchSetup,csvTable} from './research-protocol.js';
import {researchTrialRows,summarizeSessions,neuralSummary,trialFeedbackTimeline,connectionChanges,sessionChoices,recordsForSession,UNASSIGNED_SESSION} from './research-data.js';

export function createResearchUI(e,$,{download,loadRecords,startSession,busy,onPrepared}){
 let records=[],sessionId=null,plotted=[],performancePoints=[];
 let draft=validateResearchSetup();
 try{const saved=localStorage.getItem(researchSetupKey);if(saved)draft=validateResearchSetup(JSON.parse(saved))}catch{$('researchStatus').textContent='Saved setup unavailable; previous saved value kept.'}
 $('research_experiment_id').value=draft.experiment_id??'';$('research_trial_count').value=draft.trial_count;
 $('research_initialization').value='continue';$('research_trial_limit_s').value=draft.trial_limit_s??60;
 // The visible saved setup and the newly restored network start in the same session configuration.
 e.startResearchSession({...draft,initialization:'continue',trial_limit_s:draft.trial_limit_s??60});
 const read=()=>validateResearchSetup({experiment_id:$('research_experiment_id').value,trial_count:Number($('research_trial_count').value),initialization:$('research_initialization').value,seed:42,trial_limit_s:Number($('research_trial_limit_s').value)});
 $('applyResearch').onclick=()=>{
  try{
   if(busy())throw Error('Pause the session first.');
   const setup=read();startSession(setup);
   $('research_initialization').value='continue';
   try{localStorage.setItem(researchSetupKey,JSON.stringify({...setup,initialization:'continue'}))}catch{$('researchStatus').textContent='Session ready; setup could not be saved.';return}
   $('researchStatus').textContent='';onPrepared();
  }catch(err){$('researchStatus').textContent=err.message}
 };
 const table=(id,rows,keys)=>{const body=$(id);body.replaceChildren();for(const row of rows){const tr=document.createElement('tr');for(const key of keys){const td=document.createElement('td'),value=row[key];td.textContent=typeof value==='number'&&!Number.isInteger(value)?value.toFixed(5):typeof value==='boolean'?value?'yes':'no':value??'—';tr.append(td)}body.append(tr)}};
 const currentRecords=()=>{const map=new Map(records.map(r=>[r.id,r]));for(const r of e.exportRecordings())if(r.events.length)map.set(r.id,r);return [...map.values()].sort((a,b)=>(a.started_at??'').localeCompare(b.started_at??''))};
 const searched=()=>{const query=$('researchFilter').value.trim().toLowerCase();return currentRecords().filter(r=>!query||[r.research?.experiment_id,r.research?.session_id].some(v=>String(v??'').toLowerCase().includes(query)))};
 const filtered=()=>recordsForSession(searched(),sessionId);
 const selected=()=>plotted.find(r=>r.id===$('recordSelect').value);
 function renderWeights(){
  const r=selected();if(!r)return;
  const id=$('recordNeuron').value;
  table('recordWeights',connectionChanges(r).filter(s=>id==='all'||s.from===Number(id)||s.to===Number(id)),['from','to','beginning','end','delta']);
 }
 function renderBins(){
  const r=selected();if(!r)return;
  const summary=neuralSummary(r),id=Number($('recordChannel').value),field=summary.kind==='cells'?'cell_counts':'counts';
  table('recordBins',(r.events??[]).filter(p=>p.type==='response').slice(-200).map(p=>({time_ms:p.session_time_ms??null,phase:p.payload.phase??p.payload.origin,bin_ms:p.payload.bin_ms,spikes:p.payload[field]?.[id]??null})),['time_ms','phase','bin_ms','spikes']);
 }
 function inspect(){
  const r=selected(),finalSpark=r?.model_version===FINALSPARK_VERSION;
  performancePoints=drawPerformance($('dataPerformanceMap'),plotted,{selectedId:r?.id,clearFloor:10});
  const timeline=trialFeedbackTimeline(r);
  drawTrialFeedback($('trialFeedbackMap'),timeline);
  $('trialFeedbackTimes').hidden=!timeline.events.length;
  table('trialFeedbackRows',timeline.events.map(event=>({
   time:event.seconds.toFixed(3)+' s',
   feedback:event.kind==='reward'?'Reward':event.punished?'Unneeded jump · punishment':'Unneeded jump',
   duration:event.duration>0?event.duration.toFixed(3)+' s':null,
  })),['time','feedback','duration']);
  $('dataConnectivityTitle').textContent=finalSpark?'Electrode connectivity':'Connections';
  $('dataConnectivityNote').hidden=!finalSpark;
  $('dataCorrelationDetails').hidden=!finalSpark;
  $('dataWeightCharts').hidden=finalSpark;$('dataWeightDetails').hidden=finalSpark;
  if(finalSpark){
   const matrix=finalSparkCorrelations(r.spike_generator?.profile);
   $('dataConnectivityNote').textContent=drawElectrodeMap($('dataConnectivityMap'),matrix,FINALSPARK_ELECTRODES);
   drawElectrodeCoactivity($('dataCoactivityMatrix'),matrix,FINALSPARK_ELECTRODES);
  }else{
   drawConnections($('dataConnectivityMap'),connectivityForRecord(r),r?.events??[]);
   drawWeights($('dataWeightMap'),r);syncWeightSelector($('dataWeightConnection'),r);
   drawWeightHistory($('dataWeightHistoryMap'),r,$('dataWeightConnection').value);
  }
  if(!r){$('recordInfo').textContent='No trial selected.';$('activityWarnings').textContent='';for(const id of ['recordWeights','recordChannels','recordBins','recordChannel'])$(id).replaceChildren();return}
  const summary=neuralSummary(r),game=r.result??r.game_current;
  const survived=Number.isFinite(game?.time_s)?game.time_s.toFixed(2)+' s survived':'Survival unavailable';
  $('recordInfo').textContent=`Trial ${r.research?.session_trial_index??r.trial} · ${survived} · ${game?.clears??'—'} clears · ${game?.outcome??'open'} · ${r.recording_complete?'Complete recording':'Partial recording'}${r.skipped_phase?' · Interrupted':''}.`;
  $('activityWarnings').textContent=[summary.duration_ms>0?`Recorded spike bins cover ${(summary.duration_ms/1000).toFixed(2)} s.`:'',...summary.warnings].filter(Boolean).join(' ');
  if(finalSpark)$('recordInfo').textContent+=' FinalSpark-trained simulation. Game feedback leaves its spike model fixed.';
  const neuron=$('recordNeuron'),previousNeuron=neuron.value;neuron.replaceChildren();
  const ids=r.network_start?.neurons?.map(n=>n.id)??[];
  for(const id of ['all',...ids]){const option=document.createElement('option');option.value=String(id);option.textContent=id==='all'?'All neurons':'N'+id;neuron.append(option)}
  neuron.value=ids.some(id=>String(id)===previousNeuron)?previousNeuron:'all';
  if(r.training?.pair)$('recordInfo').textContent+=` Training N${r.training.pair[0]} + N${r.training.pair[1]}: ${r.training.delivered?'delivered':'interrupted'}.`;
  table('recordChannels',summary.channels.map(cell=>finalSpark?{...cell,id:'E'+(cell.id+1)}:cell),['id','spikes','rate_hz']);
  const channel=$('recordChannel'),old=channel.value;channel.replaceChildren();for(const cell of summary.channels){const option=document.createElement('option');option.value=String(cell.id);option.textContent=finalSpark?'E'+(cell.id+1):(summary.kind==='cells'?'N':'E')+cell.id;channel.append(option)}channel.value=summary.channels.some(c=>String(c.id)===old)?old:String(summary.channels[0]?.id??'');
  renderWeights();renderBins();
 }
 $('recordNeuron').onchange=renderWeights;
 $('dataWeightConnection').onchange=()=>drawWeightHistory($('dataWeightHistoryMap'),selected(),$('dataWeightConnection').value);
 function renderData(){
  const choices=sessionChoices(searched()),session=$('researchSession');
  if(choices.length&&!choices.some(c=>c.id===sessionId))sessionId=choices.some(c=>c.id===e.researchSession.id)?e.researchSession.id:choices[0].id;
  session.replaceChildren();
  for(const choice of choices){
   const option=document.createElement('option');option.value=choice.id;
   const date=Number.isFinite(Date.parse(choice.started_at))?new Date(choice.started_at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
   option.textContent=choice.id===UNASSIGNED_SESSION?`Unassigned · ${choice.trials} trials`:`${choice.id===e.researchSession.id?'Live · ':''}${choice.experiment_id??'Session'} · ${date} · ${choice.id.slice(0,8)} · ${choice.trials} trials`;
   session.append(option);
  }
  if(!choices.length){const option=document.createElement('option');option.value='';option.textContent='No sessions';session.append(option)}
  session.disabled=!choices.length;session.value=choices.length?sessionId:'';
  const items=filtered(),rows=researchTrialRows(items),sessions=summarizeSessions(items).reverse();
  plotted=items;drawFeedback($('dataFeedbackMap'),items);drawSpeed($('dataSpeedMap'),items);
  table('sessionRows',sessions,['experiment_id','session_id','completed','incomplete','mean_seconds','mean_clears','mean_jumps','settings_changed']);
  table('researchRows',rows.slice(-500).reverse(),['trial','seconds','speed_px_s','clears','jumps','outcome','settings_changed']);
  $('researchDataCount').textContent=choices.length?`${rows.length} trials`:'No sessions';
  const select=$('recordSelect'),old=select.value,counts=new Map();
  for(const r of items){
   const no=r.research?.session_trial_index??r.trial;counts.set(no,(counts.get(no)??0)+1);
  }
  select.replaceChildren();
  for(const r of items.slice().reverse()){
   const option=document.createElement('option'),no=r.research?.session_trial_index??r.trial;
   const duplicate=counts.get(no)>1?` · ${String(r.id).slice(0,8)}`:'';
   option.value=r.id;
   option.textContent=`Trial ${no} · ${(r.result??r.game_current)?.outcome??'Live'}${r.spike_generator?' · FinalSpark-trained':''}${duplicate}`;
   select.append(option);
  }
  select.value=items.some(r=>r.id===old)?old:items.at(-1)?.id??'';select.disabled=!items.length;inspect();
 }
 const performanceCanvas=$('dataPerformanceMap');
 performanceCanvas.onclick=event=>{
  const box=performanceCanvas.getBoundingClientRect();
  let nearest=null,best=16**2;
  for(const point of performancePoints){
   const dx=box.left+point.x*box.width/performanceCanvas.width-event.clientX;
   const dy=box.top+point.y*box.height/performanceCanvas.height-event.clientY;
   const distance=dx*dx+dy*dy;
   if(distance<best){nearest=point;best=distance}
  }
  if(!nearest)return;
  const select=$('recordSelect');
  select.value=nearest.id;inspect();
  select.focus({preventScroll:true});$('trialFeedback').scrollIntoView({block:'start'});
 };
 async function reload(){try{records=await loadRecords();$('researchDataStatus').textContent=''}catch{$('researchDataStatus').textContent='Archive unavailable; showing retained recordings.'}renderData()}
 $('researchSession').onchange=()=>{sessionId=$('researchSession').value;renderData()};
 $('refreshResearch').onclick=reload;$('researchFilter').oninput=renderData;$('recordSelect').onchange=inspect;$('recordChannel').onchange=renderBins;
 $('researchTrialsCsv').onclick=()=>download(csvTable(researchTrialRows(filtered()),['id','experiment_id','session_id','trial','seconds','speed_px_s','next_speed_px_s','rewards','empty_jump_punishments','clears','jumps','outcome','complete','settings_changed','model_version','feedback_protocol']),'text/csv','neurorunner-performance.csv');
 function render(){const s=e.researchSession;$('activeResearch').textContent=`${s.setup.experiment_id?s.setup.experiment_id+' · ':''}${s.completed_trials}/${s.setup.trial_count} trials`;$('applyResearch').disabled=busy();for(const id of ['research_experiment_id','research_trial_count','research_trial_limit_s','research_initialization'])$(id).disabled=busy();}
 return {reload,render,read};
}
