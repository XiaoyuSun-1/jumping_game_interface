import {TRAINING_PAIRS} from './training.js';
const $=id=>document.getElementById(id);
function tableRow(values,heading=false){
 const row=document.createElement('tr');
 for(const value of values){const cell=document.createElement(heading?'th':'td');cell.textContent=value;row.append(cell)}
 return row;
}
export function createInspector(engine,canEdit,onChange){
 let model=null,lastPaint=-Infinity;
 for(const n of engine.model.neurons){const option=document.createElement('option');option.value=n.id;option.textContent=`N${n.id} · ${n.label} · ${n.role}`;$('neuronSelect').append(option)}
 for(const id of ['connectionFrom','connectionTo'])for(const n of engine.model.neurons){const option=document.createElement('option');option.value=n.id;option.textContent='N'+n.id;$(id).append(option)}
 $('connectionFrom').value='2';$('connectionTo').value='4';
 function editConnection(action){
  if(!canEdit()){$('connectionStatus').textContent='Pause first';return}
  try{
   const from=Number($('connectionFrom').value),to=Number($('connectionTo').value);
   if(action==='add'){
    if(!String($('connectionWeight').value).trim())throw Error('Enter a weight');
    engine.model.addConnection(from,to,Number($('connectionWeight').value),$('connectionPlastic').checked);
   }else engine.model.removeConnection(from,to);
   engine.emit('settings',{connection:{action,from,to,weight:action==='add'?Number($('connectionWeight').value):null,plastic:action==='add'?$('connectionPlastic').checked:null},origin:'user'});
   $('connectionStatus').textContent=action==='add'?'Added':'Removed';onChange();render(true);
  }catch(err){$('connectionStatus').textContent=err.message}
 }
 $('addConnection').onclick=()=>editConnection('add');$('removeConnection').onclick=()=>editConnection('remove');
 const fields={cellThreshold:'threshold',cellTau:'tauMs',cellRefractory:'refractoryMs',cellBias:'bias'};
 function fill(){
  const n=engine.model.neurons[Number($('neuronSelect').value)||0];
  for(const [id,key]of Object.entries(fields))$(id).value=n[key].toFixed(2);
 }
 $('neuronSelect').onchange=()=>{fill();render(true)};
 $('applyNeuron').onclick=()=>{
  if(!canEdit()){ $('editStatus').textContent='Pause first';return }
  try{
   const patch={};for(const [id,key]of Object.entries(fields)){
    if(!String($(id).value).trim())throw Error('Enter all four values');patch[key]=Number($(id).value);
   }
   engine.model.configureNeuron(Number($('neuronSelect').value)||0,patch);
   engine.emit('settings',{neuron:Number($('neuronSelect').value)||0,parameters:patch});
   $('editStatus').textContent='Applied';onChange();render(true);
  }catch(err){$('editStatus').textContent=err.message}
 };
 function render(force=false){
  const network=engine.model;
  $('networkPanel').hidden=engine.config.mode==='bridge';
  $('trialNumber').textContent=engine.currentRecording.research?.session_trial_index??engine.trial;
  $('learningState').textContent=engine.config.mode!=='neural'?'Manual':engine.config.plasticity?(network.weightUpdates?network.weightUpdates+' updates':'Plasticity on'):'Frozen';
  $('cellEditor').disabled=!canEdit();$('connectionEditor').disabled=!canEdit();
  if(model!==network){model=network;fill();$('editStatus').textContent='';force=true}
  if(!force&&performance.now()-lastPaint<250)return;lastPaint=performance.now();
  const patterns=$('patternRows');patterns.replaceChildren();
  const values=engine.trainer.values,total=values.reduce((a,b)=>a+b,0);
  TRAINING_PAIRS.forEach((pair,i)=>patterns.append(tableRow([pair.map(id=>'N'+id).join(' + '),values[i].toFixed(2),!engine.config.feedback||engine.config.trainingMode==='none'?'off':((engine.config.trainingMode==='random'?1/TRAINING_PAIRS.length:values[i]/total)*100).toFixed(1)+'%'])));
  const state=network.snapshot();
  $('weightDrift').textContent=state.weight_drift_mV.toFixed(4);
  const history=$('trialRows');history.replaceChildren();
  const sessionTrials=engine.trials.filter(t=>t.research?.session_id===engine.researchSession.id);
  for(const trial of sessionTrials.slice(-20).reverse())history.append(tableRow([
   trial.research?.session_trial_index??trial.trial,trial.clears,trial.jumps,trial.time_s.toFixed(2),trial.outcome,
   trial.mode==='neural'&&trial.plasticity?'on':'off',trial.weight_drift_mV.toFixed(4)
  ]));
  if(!sessionTrials.length)history.append(tableRow(['—','—','—','—','—','—','—']));
  if(!$('neuronDetails').open&&!force)return;
  const cells=$('neuronRows');cells.replaceChildren();
  for(const n of network.neurons)cells.append(tableRow([
   `N${n.id} ${n.label}`,n.type,`CH${n.electrode}`,n.role,n.v.toFixed(2),n.threshold.toFixed(2),n.tauMs.toFixed(2),n.refractoryMs,n.bias.toFixed(2),n.spikes
  ]));
  const selected=Number($('neuronSelect').value)||0,weights=$('weightRows');weights.replaceChildren();
  for(const s of network.synapses.filter(s=>s.from===selected||s.to===selected))weights.append(tableRow([
   `N${s.from} → N${s.to}`,s.weight.toFixed(5),s.initial.toFixed(5),(s.weight-s.initial).toFixed(5),s.plastic?'learns':'fixed'
  ]));
  $('selectedVoltage').textContent=`N${selected}: ${network.neurons[selected].v.toFixed(2)} mV · ${network.neurons[selected].spikes} spikes total`;
 }
 $('neuronDetails').ontoggle=()=>render(true);
 return render;
}
