import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAdapterHealth,deriveAdapterEndpoints,probeAdapter,stopAdapter} from '../dist/hardware.js';

const health=()=>({schema:'neurorunner.adapter-health.v1',platform:'Lab adapter',source:'hardware',adapter_version:'1.0',channel_count:32,recording:true,stimulation_enabled:false,observed_at:new Date().toISOString()});
const response=data=>({ok:true,status:200,json:async()=>data});

test('health validates only explicit, fresh adapter-reported fields',()=>{
 const data=health();assert.deepEqual(validateAdapterHealth(data),data);
 assert.equal(validateAdapterHealth({...data,source:'simulation'}).source,'simulation');
 for(const invalid of [null,[],{...data,extra:true},{...data,schema:'v2'},{...data,platform:''},{...data,adapter_version:1},{...data,source:'FinalSpark'},{...data,channel_count:0},{...data,channel_count:1.5},{...data,recording:'true'},{...data,stimulation_enabled:0},{...data,observed_at:'today'},{...data,observed_at:'2026-02-30T00:00:00.000Z'},{...data,observed_at:new Date(Date.now()-31000).toISOString()},{...data,observed_at:new Date(Date.now()+6000).toISOString()}])assert.throws(()=>validateAdapterHealth(invalid));
});

test('endpoint siblings preserve nested base paths and existing transport restrictions',()=>{
 assert.deepEqual(deriveAdapterEndpoints('https://example.com/api/v1/step/'),{step:'https://example.com/api/v1/step/',health:'https://example.com/api/v1/health',stop:'https://example.com/api/v1/stop'});
 assert.equal(deriveAdapterEndpoints('http://localhost:8080/step').health,'http://localhost:8080/health');
 for(const url of ['https://user:secret@example.com/step','http://example.com/step','https://example.com/not-step','https://example.com/step?token=secret','https://example.com/step#fragment'])assert.throws(()=>deriveAdapterEndpoints(url));
});

test('probe only reads health and reports metadata and measured timing',async()=>{
 const data=health();let calls=0;
 const result=await probeAdapter('https://example.com/v1/step',{fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://example.com/v1/health');assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);return response(data);
 }});
 assert.equal(calls,1);assert.deepEqual(result.metadata,data);assert.ok(result.round_trip_ms>=0);assert.ok(Number.isFinite(Date.parse(result.checked_at)));
});

test('probe fails on HTTP, bad JSON, bad schema, and stale metadata',async()=>{
 for(const fetchImpl of [async()=>({ok:false,status:503}),async()=>({ok:true,json:async()=>{throw Error('Invalid JSON')}}),async()=>response({}),async()=>response({...health(),observed_at:new Date(Date.now()-31000).toISOString()})])await assert.rejects(probeAdapter('https://example.com/step',{fetchImpl}));
});

test('timeout aborts fetch and bounds even an adapter that ignores abort or stalls JSON',async()=>{
 let signal;
 await assert.rejects(probeAdapter('https://example.com/step',{timeoutMs:5,fetchImpl:async(url,options)=>{signal=options.signal;return new Promise(()=>{})}}),/timed out/);
 assert.equal(signal.aborted,true);
 await assert.rejects(probeAdapter('https://example.com/step',{timeoutMs:5,fetchImpl:async()=>({ok:true,json:()=>new Promise(()=>{})})}),/timed out/);
 for(const timeoutMs of [0,-1,Infinity,10001,'2000'])await assert.rejects(probeAdapter('https://example.com/step',{timeoutMs,fetchImpl:async()=>response(health())}),/timeoutMs/);
});

test('stop requires explicit call and exact disabled acknowledgement; failure never confirms stop',async()=>{
 const data={schema:'neurorunner.adapter-stop.v1',stimulation_enabled:false};
 const result=await stopAdapter('https://example.com/v1/step',{fetchImpl:async(url,options)=>{
  assert.equal(url,'https://example.com/v1/stop');assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');return response(data);
 }});
 assert.deepEqual(result.metadata,data);assert.ok(Number.isFinite(Date.parse(result.checked_at)));
 for(const invalid of [{...data,stimulation_enabled:true},{schema:'unknown',stimulation_enabled:false},{...data,extra:true},null])await assert.rejects(stopAdapter('https://example.com/step',{fetchImpl:async()=>response(invalid)}),/stop acknowledgement/);
 await assert.rejects(stopAdapter('https://example.com/step',{fetchImpl:async()=>({ok:false,status:404})}),/HTTP 404/);
});
