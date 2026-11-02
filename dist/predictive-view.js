export function createPredictiveView(engine,$){
 let painted=-Infinity;
 const cell=(row,value)=>{const node=document.createElement('td');node.textContent=String(value);row.append(node)};
 const table=(id,rows)=>{const body=$(id);body.replaceChildren();for(const values of rows){const row=document.createElement('tr');values.forEach(value=>cell(row,value));body.append(row)}};
 return function render(force=false){
  if(!force&&($('predictiveView').hidden||performance.now()-painted<250))return;painted=performance.now();
  const p=engine.predictor,c=p.circuit,stats=p.statistics,recent=stats.recentSurprise.slice(-10);
  $('predictiveLearning').checked=p.learningEnabled;
  $('predictiveSamples').textContent=String(stats.samples);
  $('predictiveLoss').textContent=recent.length?(recent.reduce((a,b)=>a+b,0)/recent.length).toFixed(3):'—';
  $('predictiveLatency').textContent=p.last?p.last.inference_duration_ms.toFixed(1)+' ms':'—';
  $('predictiveState').textContent=p.error?'Observer paused: '+p.error:engine.config.mode==='bridge'?'Observer paused in external bridge mode':p.learningEnabled?'Learning predictions from gameplay':'Predictive synapses frozen';
  $('predictiveUpdateCount').textContent=String(c.updates);
  const observations=engine.currentRecording.predictive?.observations??[];
  table('predictiveRows',observations.slice(-20).reverse().map(r=>[r.session_time_s.toFixed(2),r.input.join(' '),r.executed_action?'Jump':'No jump',r.pre_update_surprise_nats.toFixed(3),r.variational_free_energy_nats.toFixed(3),r.belief.map(x=>x.toFixed(2)).join(' / '),r.learning?'on':'off']));
  const cells=[...c.neurons,...c.relays,...c.memoryRelays,...c.edgeNeurons];
  table('predictiveCells',cells.map(n=>[n.id,n.type,n.role??(n.rail?`feature ${n.feature}: ${n.rail}`:`transition ${n.from} → ${n.to}, action ${n.action}`),Number.isFinite(n.v)?n.v.toFixed(2):'—',n.adaptation?.toFixed(3)??'—',n.trace??'—',n.spikes??'—']));
  const totals=Array(c.columnNormalization.length).fill(0);
  for(const s of c.transitionSynapses)totals[s.pool]+=Math.exp(-s.strength);
  table('predictiveSynapses',[
   ...c.synapses.map(s=>[s.from,s.to,`${s.feature}: ${s.rail}`,'inhibitory',s.strength.toFixed(5),Math.exp(-s.strength).toFixed(4)]),
   ...c.transitionSynapses.map(s=>[s.sourceRelay,s.edgeId,`${s.from} → ${s.to}, action ${s.action}`,'inhibitory',s.strength.toFixed(5),(Math.exp(-s.strength)/totals[s.pool]).toFixed(4)])]);
  table('predictiveCompartments',c.columnNormalization.map(n=>[`${n.action} / ${n.from}`,n.current.toFixed(5),n.lastLogZ.toFixed(5)]));
 };
}
