import {performanceRows} from './performance.js';
import {SpikingNetwork,MODEL_VERSION} from './network.js';
import {TrainingSelector} from './training.js';
export const PROTOCOL_VERSION='paired-training-v1';
import {validateResearchSetup,createResearchSession,attachResearch} from './research-protocol.js';
export const defaults={stimulusGain:1,horizon:1500,mode:'neural',speed:290,threshold:20,latency:80,gain:1,seed:42,sensory:true,feedback:true,window:100,plasticity:true,learningRate:.5,restSeconds:0,trainingSeconds:.3,trainingMode:'adaptive',difficultyRamp:true};
const bounds={trainingSeconds:[0,2],restSeconds:[0,60],stimulusGain:[0,2],horizon:[400,3000],speed:[150,500],threshold:[1,200],latency:[0,1000],gain:[0,2],seed:[1,999999],window:[50,500],learningRate:[0,1]};
export class Engine {
 constructor(config={}){this.config={...defaults,...config};this.validate(this.config);this.reset()}
 validate(c){
  for(const [k,[lo,hi]]of Object.entries(bounds))if(!Number.isFinite(c[k])||c[k]<lo||c[k]>hi)throw Error(`Invalid ${k}: expected ${lo}–${hi}`);
  if(!['manual','neural','bridge'].includes(c.mode))throw Error('Invalid mode');
  if(!['adaptive','random','none'].includes(c.trainingMode))throw Error('Invalid training mode');
  for(const key of ['sensory','feedback','plasticity','difficultyRamp'])if(typeof c[key]!=='boolean')throw Error(`Invalid ${key}`);
 }
 configure(patch){const c={...this.config,...patch};this.validate(c);this.config=c;if(this.currentRecording)this.emit('settings',{config:{...c}})}
 random(){this.rng=(Math.imul(1664525,this.rng)+1013904223)>>>0;return this.rng/4294967296}
 reset(){if(this.currentRecording)this.settleTerminalFeedback();if(this.currentRecording&&this.time>0&&!this.trialRecorded)this.finishTrial('stopped');if(this.currentRecording)this.refreshRecording();this.recordings??=[];this.clock=0;this.rng=this.config.seed;const selectedAdapter=this.config.mode==='bridge'?structuredClone(this.researchSession?.adapter??null):null;this.researchSession=createResearchSession({...this.researchSession?.setup,initialization:'fresh',seed:this.config.seed},this.config);this.researchSession.adapter=selectedAdapter;this.model=new SpikingNetwork(this.config.seed);this.trainer=new TrainingSelector(this.config.seed);this.trial=1;this.trials=[];this.events=[];this.seq=0;this.resetGame()}
 resetGame(){
  this.rng=(this.config.seed^Math.imul(this.trial,0x9e3779b9))>>>0;
  this.phase='play';this.phaseRemaining=0;this.phaseTimes={play:0,training:0,rest:0};this.restRemaining=null;this.model.resetTransient();this.modelProprio=0;this.time=0;this.y=0;this.vy=0;this.distance=0;this.currentSpeed=this.config.speed;this.crashed=false;this.clears=0;this.jumps=0;
  this.pending=[];this.history=[];this.rate=0;this.lastStim=-1;this.lastJump=-2;this.feedbackUntil=0;
  this.latestStim=null;this.latestResponse=null;this.obstacles=[{id:1,x:700+Math.round(this.random()*300),w:22+Math.floor(this.random()*14),h:40+Math.floor(this.random()*12),cleared:false}];this.obstacleId=1;
  this.modelRate=0;this.neuralRemainder=0;this.captureMs=0;this.model.drainCounts();this.model.drainCellCounts();this.trialRecorded=false;
  this.currentRecording={id:crypto.randomUUID(),revision:0,schema:'neurorunner.trial.v2',model_version:this.config.mode==='bridge'?null:MODEL_VERSION,feedback_protocol:this.config.mode==='neural'?PROTOCOL_VERSION:null,memory_origin:this.model.memoryOrigin??'fresh',trial:this.trial,started_at:new Date().toISOString(),mode:this.config.mode,simulation:this.config.mode!=='bridge',config_start:{...this.config},network_start:this.config.mode==='bridge'?null:this.model.snapshot(),network_end:null,complete:false,result:null,events:[],sampling:{spike_bin_ms:50,voltage_sample_ms:50,note:'Per-cell values are simulated; external mode supplies electrode counts only.'}};
  this.currentRecording.recording_complete=false;this.currentRecording.engine_state_start=this.engineState();
  attachResearch(this.currentRecording,this.researchSession,this.config,this.model.seed);
  this.currentRecording.training_state_start=this.config.mode==='neural'?this.trainer.snapshot():null;
  this.recordings.push(this.currentRecording);if(this.recordings.length>20)this.recordings.shift();
 }
 closeRecording(){
  if(this.phaseRemaining>0)this.currentRecording.skipped_phase={phase:this.phase,remaining_s:this.phaseRemaining};
  if(this.time>0&&!this.trialRecorded)this.finishTrial('stopped');
  this.settleTerminalFeedback();this.refreshRecording();this.currentRecording.recording_complete=true;this.currentRecording.ended_at=new Date().toISOString();
 }
 nextTrial(){this.closeRecording();this.trial++;this.resetGame()}
 finishTrial(outcome){
  if(this.trialRecorded)return;this.settleTerminalFeedback();this.trialRecorded=true;this.researchSession.completed_trials++;
  this.trials.push({id:this.currentRecording.id,research:structuredClone(this.currentRecording.research),started_at:this.currentRecording.started_at,distance_px:this.distance,speed_px_s:this.currentSpeed,difficulty_level:1+Math.floor(this.clears/10),trial:this.trial,mode:this.config.mode,outcome,time_s:this.time,clears:this.clears,jumps:this.jumps,
   plasticity:this.config.plasticity,feedback:this.config.feedback,config:{...this.config},network_time_ms:this.model.timeMs,model_version:this.config.mode==='bridge'?null:MODEL_VERSION,feedback_protocol:this.config.mode==='neural'?PROTOCOL_VERSION:null,
   weight_drift_mV:this.model.snapshot().weight_drift_mV});
  this.currentRecording.complete=true;this.currentRecording.result={...this.trials.at(-1),distance_px:this.distance};this.refreshRecording();
  if(this.trials.length>500)this.trials.shift();
  this.crashed=true;this.planTraining(outcome);this.refreshRecording();
 }
 emit(type,payload){
  const packet={seq:++this.seq,trial:this.trial,t_ms:Math.round(this.time*1000),session_time_ms:Math.round(this.clock*1000),network_time_ms:this.config.mode==='bridge'?null:this.model.timeMs,type,source:this.config.mode==='bridge'?'external-bridge':'browser-simulator',payload};
  this.currentRecording.revision++;this.currentRecording.events.push(packet);this.events.push(packet);if(this.events.length>30000)this.events.shift();return packet;
 }
 jump(source='manual'){
  if(this.phase!=='play'||this.crashed||this.y>.01||this.vy>0)return false;
  this.vy=560;this.jumps++;this.lastJump=this.time;
  this.emit('action',{action:'jump',controller:source,rate_hz:+this.rate.toFixed(2),threshold_hz:this.config.threshold});return true;
 }
 get nearest(){return this.obstacles.find(o=>o.x+o.w>100)||null}
 get targetSpeed(){return this.config.difficultyRamp?Math.min(500,this.config.speed*(1+.1*Math.floor(this.clears/10))):this.config.speed}
 get ttc(){return this.nearest?Math.max(0,(this.nearest.x-128)/this.currentSpeed):Infinity}
 setPhase(phase,duration=0){
  this.settleTerminalFeedback();this.phase=phase;this.phaseRemaining=duration;this.restRemaining=phase==='rest'?duration:null;
  this.history=[];this.rate=0;if(phase==='rest')this.model.resetTransient();
  this.emit('phase',{phase,duration_ms:Math.round(duration*1000),controller_gated:phase!=='play'});
 }
 planTraining(outcome){
  const active=this.config.mode==='neural'&&this.config.feedback&&this.config.trainingMode!=='none';
  if(!active||!['collision','time limit'].includes(outcome)){
   this.trainer.resetCredit();this.setPhase('rest',this.config.restSeconds);return;
  }
  const credit=this.trainer.observe(this.time);
  if(outcome==='time limit'){this.currentRecording.training={credit,delivered:false,reason:'evaluation horizon reached'};this.setPhase('rest',this.config.restSeconds);return}
  const choice=this.config.trainingSeconds>0?this.trainer.choose(this.config.trainingMode):null;
  this.currentRecording.training={...choice,credit,delivered:false,reason:choice?'trial completed':'zero training duration'};
  if(!choice){this.setPhase('rest',this.config.restSeconds);return}
  this.setPhase('training',this.config.trainingSeconds);
  this.model.train(choice.pair,Math.round(this.config.trainingSeconds*1000));
  this.emit('feedback',{outcome,...choice,pattern:'paired training',channels:choice.pair,duration_ms:Math.round(this.config.trainingSeconds*1000),
   model_pulse_mV:20,repeat_hz:10,pair_interval_ms:5,units:'software training only; not physical stimulation settings'});
 }
 receive(counts,source='LIF spikes',networkTime=null,details={cell_counts:null,voltages_mV:null}){
  const channels=this.config.mode==='bridge'?8:6;
  if(!Array.isArray(counts)||counts.length!==channels||counts.some(n=>!Number.isInteger(n)||n<0||n>100))throw Error(`Expected ${channels} integer spike counts, 0–100`);
  this.latestResponse=this.emit('response',{counts,bin_ms:50,units:'one count per channel',origin:source,network_time_ms:networkTime,...details});
  this.history.push({t:this.time,counts});this.decode();
 }
 decode(){
  if(this.phase!=='play'||this.crashed){this.history=[];this.rate=0;return}
  const window=this.config.window/1000;this.history=this.history.filter(r=>this.time-r.t<window-1e-8);
  this.rate=this.history.reduce((s,r)=>s+(this.config.mode==='bridge'?r.counts.slice(2,6).reduce((a,b)=>a+b,0)/4:r.counts[1]),0)/window;
  if(this.config.mode!=='manual'&&this.rate>=this.config.threshold&&this.time-this.lastJump>.65)this.jump(this.config.mode==='bridge'?'external spikes':'LIF motor spikes');
 }
 refreshRecording(){
  if(!this.currentRecording)return;
  if(this.trialRecorded&&this.phase==='rest'&&this.phaseRemaining<1e-8){this.currentRecording.recording_complete=true;this.currentRecording.ended_at??=new Date().toISOString()}
  this.currentRecording.revision++;
  this.currentRecording.game_current={trial:this.trial,mode:this.config.mode,time_s:this.time,distance_px:this.distance,speed_px_s:this.currentSpeed,target_speed_px_s:this.targetSpeed,clears:this.clears,jumps:this.jumps,plasticity:this.config.plasticity,feedback:this.config.feedback,model_version:this.config.mode==='bridge'?null:MODEL_VERSION,feedback_protocol:this.config.mode==='neural'?PROTOCOL_VERSION:null,phase:this.phase,phase_remaining_s:this.phaseRemaining};
  const network=this.currentRecording.simulation?this.model.snapshot():null;
  this.currentRecording.training_state_end=this.config.mode==='neural'?this.trainer.snapshot():null;
  this.currentRecording.network_end=network;this.currentRecording.engine_state_end=this.engineState();
  if(this.currentRecording.result){
   const ending={phase_seconds:{...this.phaseTimes},weight_drift_mV:network?.weight_drift_mV??0,network_time_ms:network?.time_ms??null};
   Object.assign(this.currentRecording.result,ending);
   const trial=this.trials.find(t=>t.id===this.currentRecording.id);if(trial)Object.assign(trial,ending);
  }
 }
 exportRecordings(){this.refreshRecording();return structuredClone(this.recordings)}
 neuralBin(){return {counts:this.model.drainCounts(),cell_counts:this.model.drainCellCounts(),voltages_mV:this.model.neurons.map(n=>n.v)}}
 advanceNeurons(dt,rest=this.phase!=='play'){
  this.neuralRemainder+=dt*1000;const steps=Math.floor(this.neuralRemainder+1e-8);this.neuralRemainder-=steps;
  for(let i=0;i<steps;i++){
   this.model.advance(1,{rateHz:rest?0:this.modelRate,proprioHz:rest?0:this.modelProprio,gain:this.config.gain,plasticity:this.config.mode==='neural'&&this.config.plasticity,learningRate:this.config.learningRate});this.captureMs++;
   for(const pulse of this.model.drainPulses())this.emit('pulse',{...pulse,phase:this.phase});
   if(this.captureMs===50){
    this.captureMs=0;const capturedAt=this.time-(steps-i-1)/1000;
    const bin=this.neuralBin(),counts=bin.counts;
    if(rest)this.latestResponse=this.emit('response',{...bin,bin_ms:50,units:'one count per channel',origin:'LIF spikes',phase:this.phase,network_time_ms:this.model.timeMs});
    else this.pending.push({due:capturedAt+this.config.latency/1000,counts,details:{cell_counts:bin.cell_counts,voltages_mV:bin.voltages_mV},networkTime:this.model.timeMs});
   }
  }
 }
 settleTerminalFeedback(){
  if(this.config.mode==='bridge')return;
  const record=(bin,binMs,phase,networkTime=this.model.timeMs)=>{
   this.latestResponse=this.emit('response',{...bin,bin_ms:binMs,units:'one count per channel',origin:'LIF spikes',phase,network_time_ms:networkTime});
  };
  // Observe queued/partial bins without feeding terminal data back to the game decoder.
  for(const p of this.pending)record({counts:p.counts,...p.details},50,'terminal drain',p.networkTime);
  this.pending=[];
  if(this.captureMs>0)record(this.neuralBin(),this.captureMs,'partial bin');
  this.captureMs=0;
 }
 advancePhase(dt,autoRestart){
  const elapsed=Math.min(dt,this.phaseRemaining);
  if(elapsed>0){if(this.config.mode!=='bridge')this.advanceNeurons(elapsed,true);this.phaseTimes[this.phase]+=elapsed}
  this.phaseRemaining=Math.max(0,this.phaseRemaining-dt);
  if(this.phase==='rest')this.restRemaining=this.phaseRemaining;
  if(this.phaseRemaining>1e-8)return;
  if(this.phase==='training'){
   const selected=this.currentRecording.training;
   if(selected&&this.model.trainingLeft===0){selected.delivered=true;this.trainer.delivered(selected.index)}
   this.setPhase('rest',this.config.restSeconds);
  }
  if(this.phase==='rest'&&this.phaseRemaining<1e-8){this.settleTerminalFeedback();this.refreshRecording();this.currentRecording.recording_complete=true;this.currentRecording.ended_at??=new Date().toISOString();if(autoRestart&&!this.researchComplete)this.nextTrial()}
 }
 engineState(){return structuredClone({game_rng:this.rng,session_clock_s:this.clock,phase:this.phase,phase_remaining_s:this.phaseRemaining,game_time_s:this.time,
  distance_px:this.distance,speed_px_s:this.currentSpeed,target_speed_px_s:this.targetSpeed,y_px:this.y,vertical_velocity_px_s:this.vy,obstacles:this.obstacles,pending_responses:this.pending,decoder_history:this.history,
  last_stimulus_s:this.lastStim,last_jump_s:this.lastJump,sensory_rate_hz:this.modelRate,proprioceptive_rate_hz:this.modelProprio,neural_remainder_ms:this.neuralRemainder})}
 get researchComplete(){return this.researchSession.completed_trials>=this.researchSession.setup.trial_count&&this.phase==='rest'&&this.phaseRemaining<1e-8}
 startResearchSession(input,settings={}){
  if(Object.keys(settings).some(key=>!Object.hasOwn(defaults,key)))throw Error('Invalid session setting');
  const setup=validateResearchSetup(input),config={...this.config,...settings,seed:setup.initialization==='fresh'?setup.seed:this.config.seed};this.validate(config);
  if(this.time>0&&!this.trialRecorded)this.finishTrial('stopped');
  if(this.phaseRemaining>0)this.currentRecording.skipped_phase={phase:this.phase,remaining_s:this.phaseRemaining};
  const adapter=config.mode==='bridge'?structuredClone(this.researchSession.adapter):null;
  this.closeRecording();
  this.config=config;
  if(setup.initialization==='fresh'){
   // The old recording was finalized using its original mode and settings.
   this.currentRecording=null;this.reset();
  }else{this.trial++;this.resetGame()}
  this.trainer.resetCredit();
  this.currentRecording.training_state_start=this.config.mode==='neural'?this.trainer.snapshot():null;
  this.researchSession=createResearchSession(setup,this.config);this.researchSession.adapter=adapter;attachResearch(this.currentRecording,this.researchSession,this.config,this.model.seed);
 }
 sessionStep(dt){this.step(dt,true)}
 step(dt,autoRestart=false){
  if(!Number.isFinite(dt)||dt<=0||dt>.1)throw Error('Step must be >0 and <=100 ms');this.clock+=dt;if(this.phase!=='play'){this.advancePhase(dt,autoRestart);return}if(this.crashed)return;
  if(this.researchSession.setup.trial_limit_s!==null&&this.time>=this.researchSession.setup.trial_limit_s-1e-8){this.finishTrial('time limit');return}
  const change=this.targetSpeed-this.currentSpeed;
  this.currentSpeed+=Math.sign(change)*Math.min(Math.abs(change),this.config.speed*.05*dt);
  this.phaseTimes.play+=dt;this.time+=dt;this.distance+=this.currentSpeed*dt;this.vy-=1450*dt;this.y=Math.max(0,this.y+this.vy*dt);if(this.y===0)this.vy=0;
  for(const o of this.obstacles){
   o.x-=this.currentSpeed*dt;
   if(!o.cleared&&o.x+o.w<96){o.cleared=true;this.clears++;this.emit('outcome',{outcome:'clear',obstacle_id:o.id,speed_px_s:this.currentSpeed});if(this.config.difficultyRamp&&this.clears%10===0)this.emit('difficulty',{clears:this.clears,speed_px_s:this.currentSpeed,target_speed_px_s:this.targetSpeed})}
   if(o.x<128&&o.x+o.w>100&&this.y<o.h-4){this.crashed=true;this.emit('outcome',{outcome:'collision',obstacle_id:o.id});this.finishTrial('collision');return}
  }
  this.obstacles=this.obstacles.filter(o=>o.x>-100);
  const last=this.obstacles.at(-1);
  if(!last||last.x<1000){
   const gap=Math.round(550+this.random()*600),obstacle={id:++this.obstacleId,x:last?last.x+last.w+gap:1000+gap,w:22+Math.floor(this.random()*14),h:40+Math.floor(this.random()*12),cleared:false};
   this.obstacles.push(obstacle);this.emit('obstacle',{...obstacle,gap_px:gap,speed_px_s:this.currentSpeed});
  }
  if(this.time-this.lastStim>=.05-1e-8){
   this.lastStim=this.time;const intensity=Math.max(0,Math.min(1,(1-this.ttc/(this.config.horizon/1000))*this.config.stimulusGain));
   this.modelRate=0;this.modelProprio=0;
   if(this.config.sensory){
    const rate=80*intensity;this.modelRate=rate;this.modelProprio=0;
    this.latestStim=this.emit('stimulus',{kind:'sensory',channels:[0],ttc_ms:Number.isFinite(this.ttc)?Math.round(this.ttc*1000):null,
     normalized_intensity:+intensity.toFixed(3),pattern:'rate-code',rate_hz:rate,units:'model pulse rate; not physical stimulation'});
   }
  }
  if(this.config.mode!=='bridge')this.advanceNeurons(dt);
  while(this.pending.length&&this.pending[0].due<=this.time+1e-8){const p=this.pending.shift();this.receive(p.counts,'LIF spikes',p.networkTime,p.details)}
  this.decode();
 }
 export(){return {schema:'neurorunner.session.v3',performance:performanceRows(this.trials),recordings:this.exportRecordings(),simulation:this.config.mode!=='bridge',config:{...this.config},
  research_session:structuredClone(this.researchSession),summary:{phase:this.phase,phase_remaining_s:this.phaseRemaining,session_time_s:this.clock,rest_remaining_s:this.restRemaining,trial:this.trial,time_s:this.time,clears:this.clears,jumps:this.jumps,crashed:this.crashed},
  training:this.config.mode==='neural'?this.trainer.snapshot():null,network:this.config.mode==='bridge'?null:this.model.snapshot(),trials:this.trials.map(t=>({...t})),events:this.events}}
}
