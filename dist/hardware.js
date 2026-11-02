import {validateEndpoint} from './bridge.js';

function exactFields(data,fields){
 return data!==null&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).length===fields.length&&fields.every(key=>Object.hasOwn(data,key));
}

export function validateAdapterHealth(data){
 const fields=['schema','platform','source','adapter_version','channel_count','recording','stimulation_enabled','observed_at'];
 if(!exactFields(data,fields)||data.schema!=='neurorunner.adapter-health.v1')throw Error('Invalid adapter health schema');
 for(const key of ['platform','adapter_version'])if(typeof data[key]!=='string'||!data[key].trim()||data[key].length>256)throw Error('Invalid adapter health '+key);
 if(!['hardware','simulation'].includes(data.source)||!Number.isSafeInteger(data.channel_count)||data.channel_count<1||typeof data.recording!=='boolean'||typeof data.stimulation_enabled!=='boolean')throw Error('Invalid adapter-reported state');
 const observed=Date.parse(data.observed_at);
 if(typeof data.observed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.observed_at)||!Number.isFinite(observed)||new Date(observed).toISOString()!==data.observed_at)throw Error('Invalid adapter observed_at UTC timestamp');
 const age=Date.now()-observed;
 if(age>30000||age< -5000)throw Error('Adapter health timestamp is stale or ahead of this clock');
 return {...data};
}

export function deriveAdapterEndpoints(stepUrl){
 const step=validateEndpoint(stepUrl),url=new URL(step);
 if(!/\/step\/?$/.test(url.pathname)||url.search||url.hash)throw Error('Use an adapter /step URL without query or fragment');
 const base=url.pathname.replace(/step\/?$/,'');
 url.pathname=base+'health';const health=url.href;
 url.pathname=base+'stop';return {step,health,stop:url.href};
}

async function adapterRequest(url,method,validate,{fetchImpl=globalThis.fetch,timeoutMs=2000}={}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('timeoutMs must be between 1 and 10000');
 const controller=new AbortController(),started=performance.now();let timer;
 try{
  return await Promise.race([
   (async()=>{
    const response=await fetchImpl(url,{method,signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('Adapter HTTP '+response.status);
    const metadata=validate(await response.json());
    return {metadata,round_trip_ms:performance.now()-started,checked_at:new Date().toISOString()};
   })(),
   new Promise((resolve,reject)=>{timer=setTimeout(()=>{reject(Error('Adapter request timed out'));controller.abort()},timeoutMs)})
  ]);
 }finally{clearTimeout(timer)}
}

export function probeAdapter(stepUrl,options){
 return adapterRequest(deriveAdapterEndpoints(stepUrl).health,'GET',validateAdapterHealth,options);
}

// A caller must invoke this only after the operator explicitly requests a stop.
export function stopAdapter(stepUrl,options){
 return adapterRequest(deriveAdapterEndpoints(stepUrl).stop,'POST',data=>{
  if(!exactFields(data,['schema','stimulation_enabled'])||data.schema!=='neurorunner.adapter-stop.v1'||data.stimulation_enabled!==false)throw Error('Invalid adapter stop acknowledgement; stimulation state is unknown');
  return {...data};
 },options);
}
