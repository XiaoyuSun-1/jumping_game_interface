import {researchSetupKey,validateResearchSetup,csvTable} from './research-protocol.js';
import {researchTrialRows,summarizeSessions,neuralSummary,connectionChanges} from './research-data.js';

export function createResearchUI(e,$,{download,loadRecords,startSession,busy,onPrepared}){
 let records=[];
 let draft=validateResearchSetup();
 try{const saved=localStorage.getItem(researchSetupKey);if(saved)draft=validateResearchSetup(JSON.parse(saved))}catch{$('researchStatus').textContent='Saved setup unavailable; previous saved value kept.'}
 $('research_experiment_id').value=draft.experiment_id??'';$('research_trial_count').value=draft.trial_count;
 $('research_initialization').value='continue';
 const read=()=>validateResearchSetup({experiment_id:$('research_experiment_id').value,trial_count:Number($('research_trial_count').value),initialization:$('research_initialization').value,seed:42,trial_limit_s:null});
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
 const filtered=()=>{const query=$('researchFilter').value.trim().toLowerCase();return currentRecords().filter(r=>!query||[r.research?.experiment_id,r.research?.session_id].some(v=>String(v??'').toLowerCase().includes(query)))};
 const selected=()=>filtered().find(r=>r.id===$('recordSelect').value);
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
  const r=selected();if(!r){$('recordInfo').textContent='—';for(const id of ['recordWeights','recordChannels','recordBins'])$(id).replaceChildren();$('recordChannel').replaceChildren();return}
  const summary=neuralSummary(r),game=r.result??r.game_current;
  $('recordInfo').textContent=`Trial ${r.research?.session_trial_index??r.trial} · ${game?.outcome??'open'} · ${r.recording_complete?'Complete':'Partial'} · ${(summary.duration_ms/1000).toFixed(2)} s${r.skipped_phase?' · Interrupted':''}. ${summary.warnings.join(' ')}`;
  const neuron=$('recordNeuron'),previousNeuron=neuron.value;neuron.replaceChildren();
  const ids=r.network_start?.neurons?.map(n=>n.id)??[];
  for(const id of ['all',...ids]){const option=document.createElement('option');option.value=String(id);option.textContent=id==='all'?'All neurons':'N'+id;neuron.append(option)}
  neuron.value=ids.some(id=>String(id)===previousNeuron)?previousNeuron:'all';
  if(r.training?.pair)$('recordInfo').textContent+=` Training N${r.training.pair[0]} + N${r.training.pair[1]}: ${r.training.delivered?'delivered':'interrupted'}.`;
  table('recordChannels',summary.channels,['id','spikes','rate_hz']);
  const channel=$('recordChannel'),old=channel.value;channel.replaceChildren();for(const cell of summary.channels){const option=document.createElement('option');option.value=String(cell.id);option.textContent=(summary.kind==='cells'?'N':'E')+cell.id;channel.append(option)}channel.value=summary.channels.some(c=>String(c.id)===old)?old:String(summary.channels[0]?.id??'');
  renderWeights();renderBins();
 }
 $('recordNeuron').onchange=renderWeights;
 function renderData(){
  const items=filtered(),rows=researchTrialRows(items),sessions=summarizeSessions(items).reverse();
  table('sessionRows',sessions,['experiment_id','session_id','completed','incomplete','mean_seconds','mean_clears','mean_jumps','settings_changed']);
  table('researchRows',rows.slice(-500).reverse(),['session_id','trial','seconds','clears','jumps','outcome','settings_changed']);
  $('researchDataCount').textContent=`${sessions.length} sessions · ${rows.length} trials`;
  const select=$('recordSelect'),old=select.value;select.replaceChildren();for(const r of items.slice().reverse()){const option=document.createElement('option');option.value=r.id;option.textContent=`${r.research?.experiment_id??'Unassigned'} · trial ${r.research?.session_trial_index??r.trial} · ${r.started_at}`;select.append(option)}select.value=items.some(r=>r.id===old)?old:items.at(-1)?.id??'';inspect();
 }
 async function reload(){try{records=await loadRecords();$('researchDataStatus').textContent=''}catch{$('researchDataStatus').textContent='Archive unavailable; showing retained recordings.'}renderData()}
 $('refreshResearch').onclick=reload;$('researchFilter').oninput=renderData;$('recordSelect').onchange=inspect;$('recordChannel').onchange=renderBins;
 $('researchTrialsCsv').onclick=()=>download(csvTable(researchTrialRows(filtered()),['id','experiment_id','session_id','trial','seconds','clears','jumps','outcome','complete','settings_changed','model_version','feedback_protocol']),'text/csv','neurorunner-performance.csv');
 function render(){const s=e.researchSession;$('activeResearch').textContent=`${s.setup.experiment_id??'Experiment'} · ${s.completed_trials}/${s.setup.trial_count} trials`;$('applyResearch').disabled=busy();}
 return {reload,render,read};
}
