function latestRecords(records){
 const latest=new Map();
 for(const record of records){
  const key=record.id??record,previous=latest.get(key);
  if(!previous||(record.revision??0)>=(previous.revision??0))latest.set(key,record);
 }
 return [...latest.values()];
}

const measured=value=>Number.isFinite(value)?value:null;
const assigned=value=>typeof value==='string'&&value.trim()?value:null;
function settingsChanged(record){
 const start=record.config_start??{};
 const differs=config=>Object.entries(config??{}).some(([key,value])=>value!==start[key]);
 return (record.events??[]).some(event=>event.type==='settings'&&(!event.payload?.config||differs(event.payload.config)))||differs(record.result?.config);
}

export function researchTrialRows(records){
 return latestRecords(records).map(record=>{
  const data=record.result??record.game_current??{},research=record.research??{};
  const complete=record.complete===true&&record.result!=null;
  return {id:record.id??null,trial:research.session_trial_index??record.trial??data.trial??null,
   experiment_id:assigned(research.experiment_id),session_id:assigned(research.session_id),condition:assigned(research.condition),preparation_id:assigned(research.preparation_id),
   source:record.mode==='bridge'||record.simulation===false?'external-bridge':record.simulation===true||record.mode?'browser-simulator':null,
   model_version:record.model_version??data.model_version??null,feedback_protocol:record.feedback_protocol??data.feedback_protocol??null,
   seconds:measured(data.time_s),distance_m:Number.isFinite(data.distance_px)?data.distance_px/30:null,
   clears:measured(data.clears),jumps:measured(data.jumps),outcome:complete?data.outcome??'unknown':'incomplete',complete,settings_changed:settingsChanged(record)};
 });
}

export function summarizeSessions(records){
 const groups=new Map(),latest=latestRecords(records),rows=researchTrialRows(latest);
 rows.forEach((row,index)=>{
  if(!row.session_id)return;
  const key=JSON.stringify([row.experiment_id,row.session_id]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({row,research:latest[index].research});
 });
 return [...groups.values()].map(entries=>{
  const rows=entries.map(entry=>entry.row),first=entries[0].research,finished=rows.filter(row=>row.complete);
  const unique=key=>[...new Set(rows.map(row=>row[key]).filter(value=>value!=null))];
  const mean=key=>{const values=finished.map(row=>row[key]).filter(Number.isFinite);return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null};
  const warnings=[];
  if(rows.some(row=>row.settings_changed))warnings.push('Settings changed during one or more trials.');
  for(const key of ['condition','preparation_id','model_version','feedback_protocol','source'])if(unique(key).length>1)warnings.push(`Session contains different ${key} values.`);
  if(entries.some(entry=>JSON.stringify(entry.research.protocol??null)!==JSON.stringify(first.protocol??null)))warnings.push('Session contains different protocols.');
  return {experiment_id:rows[0].experiment_id,session_id:rows[0].session_id,session_started_at:first.session_started_at??null,
   condition:unique('condition').length===1?unique('condition')[0]:null,preparation_id:unique('preparation_id').length===1?unique('preparation_id')[0]:null,
   notes:first.notes??'',protocol:first.protocol??null,adapter:first.adapter??null,
   trials:rows.length,completed:finished.length,incomplete:rows.length-finished.length,settings_changed:rows.filter(row=>row.settings_changed).length,
   mean_seconds:mean('seconds'),mean_distance_m:mean('distance_m'),mean_clears:mean('clears'),mean_jumps:mean('jumps'),
   sources:unique('source'),model_versions:unique('model_version'),feedback_protocols:unique('feedback_protocol'),warnings};
 });
}

export function neuralSummary(record){
 const bins=(record.events??[]).filter(event=>event.type==='response').map(event=>event.payload??{});
 const external=record.mode==='bridge'||record.simulation===false;
 const cells=!external&&bins.some(bin=>Array.isArray(bin.cell_counts)&&bin.cell_counts.length);
 const field=cells?'cell_counts':'counts',warnings=[],totals=[];
 let duration=0;
 for(const bin of bins){
  const counts=bin[field];
  if(!Number.isFinite(bin.bin_ms)||bin.bin_ms<=0||!Array.isArray(counts)||!counts.length||counts.some(count=>!Number.isInteger(count)||count<0)||totals.length&&counts.length!==totals.length){
   if(!warnings.length)warnings.push('Missing or invalid neural bins were excluded; rates cover valid recorded bins only.');
   continue;
  }
  duration+=bin.bin_ms;
  counts.forEach((count,index)=>totals[index]=(totals[index]??0)+count);
 }
 if(!duration)return {kind:'unavailable',duration_ms:0,channels:[],warnings: warnings.length?warnings:['No recorded neural bins available.']};
 return {kind:cells?'cells':'electrodes',duration_ms:duration,channels:totals.map((spikes,id)=>({id,spikes,rate_hz:spikes/(duration/1000)})),warnings};
}

export function connectionChanges(record){
 const ending=new Map((record.network_end?.synapses??[]).map(s=>[`${s.from}:${s.to}`,s.weight]));
 return (record.network_start?.synapses??[]).map(s=>{
  const end=ending.get(`${s.from}:${s.to}`);
  return {from:s.from,to:s.to,beginning:s.weight,end:end??null,delta:Number.isFinite(end)?end-s.weight:null};
 });
}
