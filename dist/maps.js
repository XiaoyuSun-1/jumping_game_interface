export function recentModelEvents(recordings){
 const latest=recordings.at(-1);if(!latest)return [];
 const same=latest.model_instance_id?recordings.filter(r=>r.model_instance_id===latest.model_instance_id):[latest];
 return same.slice(-2).flatMap(r=>r.events??[]);
}
// Chart data is derived from recorded spikes and snapshots, never inferred activity.
export function connectivityForRecord(record){
 return record?.simulation===false?record.channel_connectivity_end??record.channel_connectivity_start??null:record?.network_end??null;
}
export function connectionMap(network,events=[],windowMs=1000){
 if(!network)return {nodes:[],edges:[],kind:'neurons'};
 const external=network.schema==='neurorunner.channel-connectivity.v1';
 const boundary=external?events.findLastIndex(p=>p.type==='connectivity'):-1;
 const responses=events.slice(boundary+1).filter(p=>{
  const time=external?p.session_time_ms:p.payload?.network_time_ms;
  return p.type==='response'&&(external?p.payload.counts:p.payload.cell_counts)&&time>network.time_ms-windowMs&&time<=network.time_ms;
 });
 const duration=responses.reduce((sum,p)=>sum+(p.payload.bin_ms??0),0);
 const nodes=(external?network.channels:network.neurons).map(n=>{
  const index=external?n.count_index:n.id,field=external?'counts':'cell_counts';
  return {...n,rate:external&&(index===undefined||duration===0)?null:duration?responses.reduce((sum,p)=>sum+(p.payload[field][index]??0),0)*1000/duration:0};
 });
 const edges=external?network.connections.map(s=>({...s,weight:s.strength??null,plastic:null})):network.synapses.map(s=>({...s,plastic:s.plastic??(network.model_version==='lif-dishbrain-v2'&&network.neurons.find(n=>n.id===s.from)?.type==='E')}));
 return {nodes,edges,kind:external?'channels':'neurons',strength_units:network.strength_units};
}
export function performanceSeries(records){
 const groups=new Map();
 for(const r of records){
  const game=r.result??r.game_current;if(!game||!Number.isFinite(game.time_s))continue;
  const id=r.research?.session_id??'Unassigned';
  if(!groups.has(id))groups.set(id,{id,points:[]});
  groups.get(id).points.push({trial:r.research?.session_trial_index??r.trial,seconds:game.time_s,clears:game.clears??0,capped:game.outcome==='time limit',open:!r.result});
 }
 return [...groups.values()].map(g=>({...g,points:g.points.sort((a,b)=>a.trial-b.trial)}));
}
export function weightChanges(record){
 const start=record?.network_start?.synapses,end=record?.network_end?.synapses;if(!start||!end)return [];
 const ending=new Map(end.map(s=>[`${s.from}:${s.to}`,s]));
 const beginning=new Map(start.map(s=>[`${s.from}:${s.to}`,s]));
 return [...new Set([...beginning.keys(),...ending.keys()])].map(key=>{
  const a=beginning.get(key),b=ending.get(key),edge=a??b;
  return {from:edge.from,to:edge.to,beginning:a?.weight??null,end:b?.weight??null,delta:(b?.weight??0)-(a?.weight??0),...(!a?{status:'added'}:!b?{status:'removed'}:{})};
 });
}
const colors=['#175b87','#91431c','#52672a','#705487'];
function surface(canvas){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.font='13px Arial';c.fillStyle='#334155';return c}
function label(c,text,x,y,color='#334155'){c.fillStyle=color;c.fillText(text,x,y)}
export function drawConnections(canvas,network,events=[]){
 const c=surface(canvas),map=connectionMap(network,events),nodes=map.nodes;
 if(!nodes.length){canvas.setAttribute('aria-label','No connectivity data has been supplied for this recording.');label(c,'No connectivity data has been supplied for this recording.',22,35);return}
 const w=canvas.width,h=canvas.height,external=map.kind==='channels',prefix=external?'CH':'N';
 const six=!external&&nodes.length===6;
 const coords=six?[[w*.35,h*.37],[w*.65,h*.37],[w*.13,h*.77],[w*.87,h*.77],[w*.72,h*.77],[w*.28,h*.77]]:nodes.map((n,i)=>[w/2+Math.cos(i/nodes.length*Math.PI*2)*w*.35,h*.56+Math.sin(i/nodes.length*Math.PI*2)*h*.25]);
 const positions=new Map(nodes.map((n,i)=>[n.id,coords[i]])),radius=six||nodes.length<=12?23:9;
 for(const s of map.edges){
  const a=positions.get(s.from),b=positions.get(s.to);if(!a||!b)continue;
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),ex=b[0]-Math.cos(angle)*(radius+4),ey=b[1]-Math.sin(angle)*(radius+4);
  c.strokeStyle=external?'#536273':s.plastic?'#175b87':'#a4adb7';c.lineWidth=s.plastic?1+Math.min(4,Math.abs(s.weight??0)/3):1;c.setLineDash(external||s.plastic?[]:[5,4]);
  c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(ex,ey);c.stroke();c.setLineDash([]);
  c.fillStyle=c.strokeStyle;c.beginPath();c.moveTo(ex,ey);c.lineTo(ex-9*Math.cos(angle-.5),ey-9*Math.sin(angle-.5));c.lineTo(ex-9*Math.cos(angle+.5),ey-9*Math.sin(angle+.5));c.fill();
  if(six||external||s.from===0&&s.to===1)label(c,external?`${s.kind??'unknown'}${s.weight===null?'':': '+s.weight.toFixed(2)}`:`${s.weight.toFixed(2)}${s.plastic?' · learns':''}`,(a[0]+b[0])/2-20,(a[1]+b[1])/2-12,s.plastic?'#175b87':'#5c6773');
 }
 for(const n of nodes){const [x,y]=positions.get(n.id);if(!Number.isFinite(x))continue;c.beginPath();c.arc(x,y,radius,0,2*Math.PI);c.fillStyle=n.rate>0?'#dcecf5':'#f1f4f7';c.fill();c.strokeStyle='#536273';c.lineWidth=1;c.stroke();
  label(c,`${prefix}${n.id}`,x-(n.id<10?9:13),y+4);
  if(nodes.length<=12){label(c,n.label??n.role??'',x-26,y-radius-12);label(c,n.rate===null?'rate unavailable':`${n.rate.toFixed(1)} Hz`,x-24,y+radius+20)}
 }
 label(c,external?`Adapter-reported channel connections · ${map.strength_units??'strength units not supplied'}`:'Solid: learns · dashed: fixed',18,24);
 canvas.setAttribute('aria-label',`Connectivity: ${nodes.length} ${map.kind} and ${map.edges.length} connections. `+nodes.map(n=>`${prefix}${n.id} ${n.rate===null?'rate unavailable':n.rate.toFixed(1)+' Hz'}`).join('; '));
}
export function drawPerformance(canvas,records){
 const c=surface(canvas),groups=performanceSeries(records);
 if(!groups.length){canvas.setAttribute('aria-label','No performance observations. Start a run or select recorded trials.');label(c,'Start a run to see survival and obstacle clears by trial.',22,40);return}
 const all=groups.flatMap(g=>g.points),maxX=Math.max(2,...all.map(p=>p.trial));
 const left=58,right=canvas.width-24,plotWidth=right-left;
 for(const [panel,key,title]of [[0,'seconds','Survival (s)'],[1,'clears','Obstacles cleared']]){
  const top=40+panel*165,bottom=top+110,maxY=Math.max(1,...all.map(p=>p[key]));
  label(c,title,14,top-14);c.strokeStyle='#e2e8f0';c.lineWidth=1;
  for(let i=0;i<=2;i++){const y=bottom-i*55;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();label(c,(maxY*i/2).toFixed(1),8,y+4)}
  for(const [gi,g]of groups.entries()){
   c.strokeStyle=colors[gi%colors.length];c.lineWidth=1.5;c.setLineDash(gi%2?[5,3]:[]);c.beginPath();
   g.points.forEach((p,i)=>{const x=left+(p.trial-1)/(maxX-1)*plotWidth,y=bottom-p[key]/maxY*110;i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();c.setLineDash([]);
   for(const p of g.points){const x=left+(p.trial-1)/(maxX-1)*plotWidth,y=bottom-p[key]/maxY*110;c.fillStyle=colors[gi%colors.length];c.strokeStyle=c.fillStyle;
    if(p.capped)c.fillRect(x-3,y-3,6,6);else{c.beginPath();c.arc(x,y,3,0,Math.PI*2);p.open?c.stroke():c.fill()}
   }
  }
  label(c,'1',left,bottom+18);label(c,`${maxX}  Trial`,right-70,bottom+18);
 }
 label(c,`${groups.length} session${groups.length===1?'':'s'} · square: capped · hollow: active`,14,canvas.height-12);
 canvas.setAttribute('aria-label',`Learning performance: ${all.length} trials across ${groups.length} sessions. Latest survival ${all.at(-1).seconds.toFixed(2)} seconds, ${all.at(-1).clears} clears. Squares mark duration caps.`);
}
export function drawWeights(canvas,record,title='Δ weight (mV) · beginning → current / end'){
 const c=surface(canvas),rows=weightChanges(record);
 if(!rows.length){canvas.setAttribute('aria-label','No beginning/end connection snapshots are available.');label(c,'No beginning/end connection snapshots are available.',22,40);return}
 const ids=[...new Set(rows.flatMap(s=>[s.from,s.to]))].sort((a,b)=>a-b),size=Math.min(46,240/ids.length),left=50,top=62;
 const max=Math.max(.001,...rows.map(s=>Math.abs(s.delta))),matrix=new Map(rows.map(s=>[`${s.from}:${s.to}`,s]));
 label(c,title,18,24);
 for(let i=0;i<ids.length;i++){
  label(c,`N${ids[i]}`,left+i*size+2,top-9);label(c,`N${ids[i]}`,12,top+i*size+size*.7);
  for(let j=0;j<ids.length;j++){
   const row=matrix.get(`${ids[i]}:${ids[j]}`);c.fillStyle=!row?'#fff':Math.abs(row.delta)<1e-8?'#e8edf2':row.delta>0?`rgba(23,91,135,${.25+.75*Math.abs(row.delta)/max})`:`rgba(161,67,32,${.25+.75*Math.abs(row.delta)/max})`;
   c.fillRect(left+j*size,top+i*size,size-2,size-2);c.strokeStyle='#d5dce4';c.lineWidth=1;c.strokeRect(left+j*size,top+i*size,size-2,size-2);
  }
 }
 const format=value=>value===null?'—':value.toFixed(3);
 const tx=330;label(c,'Connection     Before → After       Δ mV',tx,52);c.font='13px monospace';
 const shown=rows.filter(s=>Math.abs(s.delta)>1e-8).concat(rows.filter(s=>Math.abs(s.delta)<=1e-8)).slice(0,12);
 shown.forEach((s,i)=>label(c,`N${s.from} → N${s.to}     ${format(s.beginning)} → ${format(s.end)}   ${s.delta>=0?'+':''}${s.delta.toFixed(4)}${s.status?' '+s.status:''}`,tx,76+i*21));
 label(c,'Rows: from · columns: to. Blue + · rust − · gray 0 · blank: no connection.',18,canvas.height-16);
 canvas.setAttribute('aria-label','Weight changes in millivolts. '+shown.map(s=>`N${s.from} to N${s.to}: ${s.delta>=0?'+':''}${s.delta.toFixed(4)}`).join('; '));
}

export function feedbackRows(records){
 return records.flatMap((r,index)=>{
  const g=r.result??r.game_current;if(!g)return [];
  const phases=(name)=>(r.events??[]).filter(p=>p.type==='phase'&&p.payload.phase===name).length;
  return [{session:r.research?.session_id??'',trial:r.research?.session_trial_index??r.trial??index+1,open:!r.result,rewards:g.rewards??phases('reward'),
   empty:g.empty_jump_punishments??phases('punishment'),collisions:g.outcome==='collision'&&(r.config_start?.trainingSeconds??1)>0?1:phases('training'),speed:g.speed_px_s??r.config_start?.speed??null}];
 });
}
export function weightHistory(record,key){
 if(!record?.network_start||!record?.network_end)return [];
 const start=record.network_start.time_ms??0,points=[];
 const append=(time,synapses)=>{if(!Number.isFinite(time)||!Array.isArray(synapses))return;const s=synapses.find(s=>`${s.from}:${s.to}`===key);points.push({seconds:(time-start)/1000,weight:s?.weight??null})};
 append(start,record.network_start.synapses);
 for(const p of record.events??[])if(p.type==='weights')append(p.network_time_ms,p.payload.synapses);
 append(record.network_end.time_ms,record.network_end.synapses);return points;
}
export function syncWeightSelector(select,record){
 const keys=new Set();
 for(const snapshot of [record?.network_start,record?.network_end,...(record?.events??[]).filter(p=>p.type==='weights').map(p=>p.payload)])for(const s of snapshot?.synapses??[])keys.add(`${s.from}:${s.to}`);
 const list=[...keys].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),signature=list.join('|');
 if(select._weightKeys!==signature){const old=select.value;select.replaceChildren();for(const key of list){const o=document.createElement('option');o.value=key;o.textContent=key.split(':').map(id=>'N'+id).join(' → ');select.append(o)}select.value=list.includes(old)?old:list.includes('0:1')?'0:1':list[0]??'';select._weightKeys=signature}
 select.disabled=!list.length;
}
export function feedbackLines(records){
 const sessions=new Map(),rows=feedbackRows(records).map(r=>{if(!sessions.has(r.session))sessions.set(r.session,sessions.size+1);return {...r,sessionNumber:sessions.get(r.session)}});
 const series=[['rewards','Reward','#236c4b',[]],['collisions','Collision','#9e3f30',[7,4]],['empty','Unneeded','#a36a17',[2,3]]].map(([key,label,color,dash])=>({key,label,color,dash,points:rows.map((r,index)=>({index,trial:r.trial,session:r.session,value:r[key],open:r.open,connect:index>0&&rows[index-1].session===r.session&&rows[index-1].trial+1===r.trial}))}));
 return {rows,series,sessions:sessions.size};
}
export function drawFeedback(canvas,records){
 const c=surface(canvas),chart=feedbackLines(records),{rows,series}=chart,left=48,right=canvas.width-20,header=24,panelHeight=(canvas.height-52)/3;
 if(!rows.length){canvas.setAttribute('aria-label','No reward or punishment observations.');label(c,'No feedback yet',20,35);return}
 const x=i=>rows.length===1?(left+right)/2:left+i/(rows.length-1)*(right-left);
 label(c,'Events / trial',left,16);
 for(let band=0;band<series.length;band++){
  const s=series[band],panelTop=header+band*panelHeight,top=panelTop+30,bottom=panelTop+panelHeight-16;
  label(c,s.label,12,panelTop+12,s.color);
  if(s.key==='collisions'){
   const center=(top+bottom)/2,completed=s.points.filter(p=>!p.open),failed=completed.filter(p=>p.value>0).length;
   label(c,completed.length?`${failed} / ${completed.length}`:'—',right-55,panelTop+12,s.color);
   c.lineWidth=1;c.strokeStyle='#e2e8f0';c.beginPath();c.moveTo(left,center);c.lineTo(right,center);c.stroke();
   for(const p of s.points){
    if(p.value>0){c.fillStyle=s.color;const width=Math.max(1,Math.min(4,(right-left)/rows.length*.4));c.fillRect(x(p.index)-width/2,center-13,width,26)}
    else{c.beginPath();c.arc(x(p.index),center,rows.length>50?1:2,0,Math.PI*2);c.strokeStyle='#aab4bf';c.fillStyle=p.open?'#fff':'#c8d0d8';c.fill();if(p.open)c.stroke()}
   }
  }else{
   const max=s.points.reduce((m,p)=>Math.max(m,p.value),1),y=value=>bottom-(bottom-top)*value/max;
   c.lineWidth=1;c.strokeStyle='#e2e8f0';
   for(const value of [0,max]){const yy=y(value);c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();label(c,String(value),12,yy+4)}
   c.strokeStyle=s.color;c.lineWidth=1.8;c.beginPath();
   for(const p of s.points)p.connect?c.lineTo(x(p.index),y(p.value)):c.moveTo(x(p.index),y(p.value));c.stroke();
   for(const p of s.points)if(rows.length<=20||p.open||p.index===rows.length-1){c.beginPath();c.arc(x(p.index),y(p.value),2.5,0,Math.PI*2);c.fillStyle=p.open?'#fff':s.color;c.strokeStyle=s.color;c.lineWidth=1;c.fill();c.stroke()}
  }
 }
 c.strokeStyle='#cbd5df';c.lineWidth=1;c.setLineDash([2,5]);
 for(let i=1;i<rows.length;i++)if(rows[i].session!==rows[i-1].session){const xx=(x(i-1)+x(i))/2;c.beginPath();c.moveTo(xx,header);c.lineTo(xx,canvas.height-36);c.stroke()}c.setLineDash([]);
 const every=Math.max(1,Math.ceil(rows.length/7)),ticks=[0];for(let i=every;i<rows.length-1;i+=every)if(rows.length-1-i>=every*.75)ticks.push(i);if(rows.length>1)ticks.push(rows.length-1);
 ticks.forEach(i=>{const r=rows[i],text=chart.sessions>1?`S${r.sessionNumber}:${r.trial}`:String(r.trial);label(c,text,Math.max(4,Math.min(canvas.width-text.length*7-5,x(i)-4)),canvas.height-20)});
 label(c,'Trial',right-28,canvas.height-4);
 const r=rows.at(-1);canvas.setAttribute('aria-label',`Feedback chart: ${rows.length} trials across ${chart.sessions} sessions. Separate reward and unneeded-jump count panels; collision ticks mark failed trials. Events per trial. Latest trial: ${r.rewards} rewards, ${r.collisions} collision punishments, ${r.empty} unneeded-jump punishments.`);
}
export function drawWeightHistory(canvas,record,key){
 const c=surface(canvas),points=weightHistory(record,key),known=points.filter(p=>p.weight!==null),left=50,right=canvas.width-20,top=34,bottom=canvas.height-36;
 if(!known.length){canvas.setAttribute('aria-label','No weight samples for this connection.');label(c,'No weight samples',20,35);return}
 const maxT=Math.max(1,...points.map(p=>p.seconds)),lo=Math.min(...known.map(p=>p.weight)),hi=Math.max(...known.map(p=>p.weight)),pad=Math.max(.05,(hi-lo)*.15),min=Math.max(0,lo-pad),max=hi+pad;
 c.strokeStyle='#e2e8f0';c.lineWidth=1;for(let i=0;i<=2;i++){const y=bottom-(bottom-top)*i/2;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();label(c,(min+(max-min)*i/2).toFixed(2),4,y+4)}
 c.strokeStyle='#175b87';c.lineWidth=2;c.beginPath();let connected=false;
 for(const p of points){if(p.weight===null){connected=false;continue}const x=left+p.seconds/maxT*(right-left),y=bottom-(p.weight-min)/(max-min)*(bottom-top);connected?c.lineTo(x,y):c.moveTo(x,y);connected=true}c.stroke();
 for(const p of known){const x=left+p.seconds/maxT*(right-left),y=bottom-(p.weight-min)/(max-min)*(bottom-top);c.beginPath();c.arc(x,y,2,0,Math.PI*2);c.fillStyle='#175b87';c.fill()}
 label(c,'mV',10,18);label(c,`0`,left,bottom+22);label(c,`${maxT.toFixed(1)} s`,right-45,bottom+22);
 canvas.setAttribute('aria-label',`${key.replace(':',' to ')} weight samples: ${known[0].weight.toFixed(3)} to ${known.at(-1).weight.toFixed(3)} mV. Gaps mean no connection.`);
}
export function drawSpeed(canvas,records){
 const c=surface(canvas),rows=feedbackRows(records).filter(r=>Number.isFinite(r.speed)),left=50,right=canvas.width-20,top=30,bottom=canvas.height-34;
 if(!rows.length){canvas.setAttribute('aria-label','No speed history.');label(c,'No speed history',20,35);return}
 const min=150,max=500;c.strokeStyle='#e2e8f0';c.lineWidth=1;for(let i=0;i<=2;i++){const y=bottom-(bottom-top)*i/2;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();label(c,String(min+(max-min)*i/2),4,y+4)}
 c.strokeStyle='#536a90';c.lineWidth=2;c.beginPath();let previousSession=null;
 rows.forEach((r,i)=>{const x=left+i/Math.max(1,rows.length-1)*(right-left),y=bottom-(r.speed-min)/(max-min)*(bottom-top);i&&r.session===previousSession?c.lineTo(x,y):c.moveTo(x,y);previousSession=r.session});c.stroke();
 rows.forEach((r,i)=>{c.fillStyle='#536a90';c.fillRect(left+i/Math.max(1,rows.length-1)*(right-left)-2,bottom-(r.speed-min)/(max-min)*(bottom-top)-2,4,4)});
 label(c,'px/s',8,17);label(c,'Trial',right-30,bottom+22);canvas.setAttribute('aria-label',`Speed history across ${rows.length} trials, latest ${rows.at(-1).speed.toFixed(1)} pixels per second.`);
}
