export function performanceRows(trials){
 const groups=new Map();
 return trials.map(trial=>{
  const seconds=trial.time_s??0,distance=Number.isFinite(trial.distance_px)?trial.distance_px/30:null;
  const complete=trial.complete!==false;
  const cohort=[trial.model_version??'legacy',trial.feedback_protocol??'legacy',trial.mode,trial.plasticity,trial.feedback].join('|');
  const finished=groups.get(cohort)??[];if(complete)finished.push(trial);groups.set(cohort,finished);
  const window=finished.slice(-5);
  return {id:trial.id??null,started_at:trial.started_at??null,trial:trial.trial,mode:trial.mode,complete,
   model_version:trial.model_version??'legacy',feedback_protocol:trial.feedback_protocol??'legacy',seconds,distance_m:distance,clears:trial.clears??0,jumps:trial.jumps??0,outcome:trial.outcome??'in progress',
   plasticity:trial.plasticity??null,feedback:trial.feedback??null,
   rolling_5_clears:window.length?window.reduce((sum,t)=>sum+t.clears,0)/window.length:null,
   rolling_5_seconds:window.length?window.reduce((sum,t)=>sum+t.time_s,0)/window.length:null};
 });
}
export function recordingPerformance(records){
 return performanceRows(records.filter(r=>r.result||r.game_current).map(r=>({...r.result??r.game_current,started_at:r.started_at,id:r.id,complete:r.complete,outcome:r.complete?r.result.outcome:'incomplete'})));
}
