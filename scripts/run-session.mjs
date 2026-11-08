import {parseArgs} from 'node:util';
import {open} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';
import {Engine} from '../dist/engine.js';

const {values}=parseArgs({options:{trials:{type:'string',default:'10'},seed:{type:'string',default:'42'},experiment:{type:'string',default:''},output:{type:'string'},'max-seconds':{type:'string'}}});
if(!values.output)throw Error('Specify a new output path with --output results.jsonl');
const e=new Engine({seed:Number(values.seed)});
e.startResearchSession({experiment_id:values.experiment,trial_count:Number(values.trials),initialization:'fresh',seed:Number(values.seed),trial_limit_s:values['max-seconds']===undefined?60:Number(values['max-seconds'])});
// Exclusive creation protects earlier experiment data from accidental overwrite.
const file=await open(values.output,'wx');let interrupted=false,lastWritten=null;
const stop=()=>{interrupted=true};process.on('SIGINT',stop);process.on('SIGTERM',stop);
const write=async record=>{await file.writeFile(JSON.stringify(record)+'\n');lastWritten=record.id};
try{
 for(let i=0;!interrupted&&!e.researchComplete;i++){
  const previous=e.currentRecording;e.sessionStep(1/120);
  if(previous!==e.currentRecording)await write(previous);
  if(i%120===119)await setImmediate();
 }
 if(interrupted){
  if(e.phaseRemaining>0)e.currentRecording.skipped_phase={phase:e.phase,remaining_s:e.phaseRemaining};
  if(!e.trialRecorded&&e.time>0)e.finishTrial('stopped');e.setPhase('rest',0);
 }
 e.refreshRecording();if(e.currentRecording.id!==lastWritten&&e.currentRecording.events.length)await write(e.currentRecording);
 await file.sync();
 console.log(JSON.stringify({session_id:e.researchSession.id,completed_trials:e.researchSession.completed_trials,interrupted,output:values.output}));
}finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);await file.close()}
if(interrupted)process.exitCode=130;
