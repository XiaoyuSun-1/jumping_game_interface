import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SensoryCircuit} from '../dist/predictive-circuit.js';
import {posterior,freeEnergy} from './predictive-reference.js';

function fixture(seed=12,extra={}){
 const c=new SensoryCircuit({seed,features:2,causes:2,adaptationIncrement:0,...extra});
 const theta=[[.8,.3],[.2,.7]];
 for(const s of c.synapses)s.strength=-Math.log(s.rail==='on'?theta[s.feature][s.to]:1-theta[s.feature][s.to]);
 return c;
}

test('physical on/off synapses encode the stated generative model, including silence',()=>{
 const c=fixture(),q=posterior(c.snapshot(),[1,0]);
 assert.ok(Math.abs(q[0]-.64/.73)<1e-12);
 assert.ok(posterior(c.snapshot(),[0,1])[0]<.15);
 const F=freeEnergy(c.snapshot(),[1,0],q);
 assert.ok(Math.abs(F+Math.log(.365))<1e-12);
});

test('actual independent spike hazards approximate the posterior without a reference call',()=>{
 const c=fixture(),counts=[0,0],before=c.synapses.map(s=>s.strength);
 for(let i=0;i<6000;i++)counts[c.sample([1,0]).winner]++;
 const expected=posterior(c.snapshot(),[1,0]);
 assert.ok(Math.abs(counts[0]/6000-expected[0])<.025,JSON.stringify(counts));
 assert.deepEqual(c.synapses.map(s=>s.strength),before);
 assert.ok(c.timeMs>=12000,'common refractory inhibition takes neural time');
});

test('a postsynaptic event updates only its incoming physical synapses by the derived gradient',()=>{
 const c=fixture(),before=c.synapses.map(s=>s.strength),rate=.1;
 const event=c.sample([1,0],{learn:true,learningRate:rate});
 for(let i=0;i<c.synapses.length;i++){
  const s=c.synapses[i];
  if(s.to!==event.winner){assert.equal(s.strength,before[i]);continue}
  const oldTheta=s.rail==='on'?Math.exp(-before[i]):1-Math.exp(-before[i]);
  const logit=Math.log(oldTheta/(1-oldTheta));
  const next=1/(1+Math.exp(-(logit+rate*([1,0][s.feature]-oldTheta))));
  assert.ok(Math.abs(s.strength+Math.log(s.rail==='on'?next:1-next))<1e-12);
  assert.equal(s.sign,-1);assert.ok(s.strength>0);
 }
 assert.equal(event.type,'spike');assert.equal(c.neurons[event.winner].type,'E');
});

test('seeded circuits reproduce actual spike identities and times',()=>{
 const a=fixture(4),b=fixture(4);
 for(let i=0;i<100;i++)assert.deepEqual(a.sample([i%2,1],{learn:true}),b.sample([i%2,1],{learn:true}));
 assert.deepEqual(a.snapshot(),b.snapshot());
});

test('invalid inputs and invalid learning settings reject before mutation',()=>{
 const c=fixture(),before=c.snapshot();
 for(const input of [[],[1],[2,0],[NaN,0],[true,0]])assert.throws(()=>c.sample(input));
 assert.throws(()=>c.sample([1,,]),/binary/);
 assert.throws(()=>posterior(c.snapshot(),[1,,]),/observation/);
 assert.throws(()=>freeEnergy(c.snapshot(),[1,0],[1,,]),/belief/);
 assert.throws(()=>c.sample([1,0],{learningRate:NaN}));
 assert.throws(()=>c.sample([1,0],{learn:'yes'}));
 assert.deepEqual(c.snapshot(),before);
 for(const args of [{features:0},{causes:0},{seed:NaN},{adaptationIncrement:-1}])assert.throws(()=>new SensoryCircuit(args));
});

test('refractory inhibition, adaptation, snapshots and complete freezing are explicit',()=>{
 const c=new SensoryCircuit({seed:42,features:2,causes:2,adaptationIncrement:.1});
 const before=c.synapses.map(s=>s.strength);
 const first=c.sample([1,0]),firstAdapt=c.neurons[first.winner].adaptation;
 assert.equal(firstAdapt,.1);assert.equal(c.inhibitionLeftMs,2);
 assert.equal(c.tick(),null);assert.equal(c.tick(),null);
 assert.ok(c.neurons[first.winner].adaptation<firstAdapt);
 assert.deepEqual(c.synapses.map(s=>s.strength),before);
 const snap=c.snapshot();snap.synapses[0].strength=999;assert.notEqual(c.synapses[0].strength,999);
 assert.ok(c.neurons.every(n=>Number.isFinite(n.v)&&Number.isFinite(n.adaptation)));
});

test('finite shared inhibitory feedback changes timing without prescribing the winning cause',()=>{
 const c=fixture(12,{tonicDrive:3,inhibitionIncrement:1.5}),counts=[0,0];
 const first=c.sample([1,0]);counts[first.winner]++;
 assert.equal(c.commonInhibition,1.5);c.tick();assert.ok(c.commonInhibition>0&&c.commonInhibition<1.5);
 for(let i=1;i<6000;i++)counts[c.sample([1,0]).winner]++;
 const expected=posterior(c.snapshot(),[1,0]);
 assert.ok(Math.abs(counts[0]/6000-expected[0])<.025);
 assert.ok(c.snapshot().neurons.every(n=>Number.isFinite(n.v)));
});
