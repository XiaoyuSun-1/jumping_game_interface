import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TemporalCircuit} from '../dist/predictive-temporal.js';

function fixture(){
 const c=new TemporalCircuit({seed:12,features:1,causes:2,adaptationIncrement:0});
 for(const s of c.synapses){const theta=s.to===0?.9:.1;s.strength=-Math.log(s.rail==='on'?theta:1-theta)}
 const B=[[.8,.2],[.2,.8]];
 for(const s of c.transitionSynapses)s.strength=-Math.log(B[s.to][s.from]);
 c.memoryCounts=[7,3];c.memoryPrior=0;return c;
}

test('physical edge spikes sample temporal responsibility rather than a naive outer product',()=>{
 const c=fixture(),counts=[[0,0],[0,0]],expected=[[.504/.596,.054/.596],[.014/.596,.024/.596]];
 for(let i=0;i<10000;i++){const e=c.sampleTransition([1],{action:0});counts[e.to][e.from]++}
 for(let k=0;k<2;k++)for(let j=0;j<2;j++)assert.ok(Math.abs(counts[k][j]/10000-expected[k][j])<.02,JSON.stringify(counts));
 assert.ok(Math.abs(counts[0][0]/10000-(.64/.73)*.7)>.1);
});

test('transition learning follows the sampled logit gradient and preserves column normalization',()=>{
 const c=fixture(),old=c.transitionSynapses.map(s=>({...s}));
 const e=c.sampleTransition([1],{action:0,learn:true,learningRate:.1});
 const column=old.filter(s=>s.action===0&&s.from===e.from);
 const raw=column.map(s=>-s.strength+.1*((s.to===e.to?1:0)-Math.exp(-s.strength)));
 const logZ=Math.log(raw.reduce((sum,x)=>sum+Math.exp(x),0));
 for(let i=0;i<c.transitionSynapses.length;i++){
  const s=c.transitionSynapses[i];
  if(s.action!==0||s.from!==e.from)assert.equal(s.strength,old[i].strength);
  else assert.ok(Math.abs(s.strength-(-raw[s.to]+logZ))<1e-12);
  assert.equal(s.sign,-1);assert.ok(s.strength>0);
 }
 for(const from of [0,1])assert.ok(Math.abs(c.transitionSynapses.filter(s=>s.action===0&&s.from===from).reduce((sum,s)=>sum+Math.exp(-s.strength),0)-1)<1e-12);
});

test('previous belief is retained while inferring an observation, then replaced by actual spike counts',()=>{
 const c=fixture(),old=[...c.memoryCounts];c.sampleTransition([1],{action:0});assert.deepEqual(c.memoryCounts,old);
 const relaySpikes=c.relays.reduce((sum,r)=>sum+r.spikes,0);
 const result=c.observe([1],{action:0,inferenceSpikes:16});
 assert.equal(c.relays.reduce((sum,r)=>sum+r.spikes,0)-relaySpikes,1,'one observation must not be injected once per internal inference sample');
 assert.equal(result.events.length,16);assert.equal(c.memoryCounts.reduce((a,b)=>a+b),16);
 assert.equal(c.memoryCounts[0],result.events.filter(e=>e.to===0).length);
 const state=c.snapshot();
 assert.throws(()=>c.observe([1]),/executed action/);
 assert.throws(()=>c.sampleTransition([1]),/executed action/);
 assert.throws(()=>c.observe([1],{action:2}));assert.throws(()=>c.observe([1],{inferenceSpikes:0}));
 assert.deepEqual(c.snapshot(),state);
});

test('a finite normalization compartment relaxes after local synaptic changes instead of rescaling them instantly',()=>{
 const c=new TemporalCircuit({seed:12,features:1,causes:2,normalizationTauMs:5});
 const before=c.transitionSynapses.map(s=>s.strength),event=c.sampleTransition([1],{action:0,learn:true,learningRate:.1});
 const pool=c.columnNormalization.find(p=>p.action===0&&p.from===event.from);
 assert.equal(pool.current,0);
 const column=c.transitionSynapses.filter(s=>s.action===0&&s.from===event.from);
 assert.ok(Math.abs(column.reduce((sum,s)=>sum+Math.exp(-s.strength),0)-1)>1e-4);
 const changed=c.transitionSynapses.map(s=>s.strength);
 for(let i=0;i<100;i++)c.edgeTick(0);
 assert.deepEqual(c.transitionSynapses.map(s=>s.strength),changed,'normalization current must not rewrite learned synapses');
 assert.ok(Math.abs(column.reduce((sum,s)=>sum+Math.exp(-s.strength-pool.current),0)-1)<1e-8);
 assert.notDeepEqual(changed,before);
});
