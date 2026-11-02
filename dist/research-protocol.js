export const researchSetupKey='neurorunner.research-setup.v1';
export function validateResearchSetup(input={}){
 const text=(key,max)=>{const value=input[key]??'';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error(`Invalid ${key}`);return value.trim()};
 const setup={experiment_id:text('experiment_id',80)||null,condition:text('condition',80)||null,preparation_id:text('preparation_id',80)||null,notes:text('notes',5000),
  trial_count:input.trial_count??10,trial_limit_s:Object.hasOwn(input,'trial_limit_s')?input.trial_limit_s:null,initialization:input.initialization??'continue',seed:input.seed??42};
 if(!Number.isInteger(setup.trial_count)||setup.trial_count<1||setup.trial_count>1000||(setup.trial_limit_s!==null&&(!Number.isFinite(setup.trial_limit_s)||setup.trial_limit_s<1||setup.trial_limit_s>600))||
  !['continue','fresh'].includes(setup.initialization)||!Number.isInteger(setup.seed)||setup.seed<1||setup.seed>999999)throw Error('Invalid research protocol');
 return setup;
}
export function createResearchSession(setup={},configuration={}){
 return {schema:'neurorunner.research-session.v1',id:crypto.randomUUID(),started_at:new Date().toISOString(),setup:validateResearchSetup(setup),
  configuration:structuredClone(configuration),completed_trials:0,created_trials:0,adapter:null};
}
export function attachResearch(record,session,configuration,networkSeed){
 const setup=session.setup;
 record.research={schema:'neurorunner.research.v1',interface_version:'research-workspace-v1',experiment_id:setup.experiment_id,session_id:session.id,
  session_started_at:session.started_at,session_trial_index:++session.created_trials,condition:setup.condition,preparation_id:setup.preparation_id,notes:setup.notes,
  protocol:{trial_count:setup.trial_count,trial_limit_s:setup.trial_limit_s,initialization:setup.initialization,requested_seed:setup.seed,network_seed:networkSeed,
   intended_settings:structuredClone(session.configuration),actual_settings:structuredClone(configuration)},adapter:structuredClone(session.adapter)};
}
export function csvTable(rows,keys){
 const quote=value=>{let text=String(value??'');if(typeof value==='string'&&/^\s*[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
 return [keys,...rows.map(row=>keys.map(key=>row[key]))].map(row=>row.map(quote).join(',')).join('\r\n');
}
