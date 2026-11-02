// Offline mathematical reference only; never import this into a neural controller.
export function logJoint(snapshot,input){
 if(!Array.isArray(input)||input.length!==snapshot.features||[...input].some(x=>x!==0&&x!==1))throw Error('Invalid reference observation');
 const values=snapshot.neurons.map(n=>n.priorBias);
 for(const s of snapshot.synapses)values[s.to]-=s.strength*(s.rail==='on'?input[s.feature]:1-input[s.feature]);
 return values;
}
export function posterior(snapshot,input){
 const log=logJoint(snapshot,input),max=Math.max(...log),weights=log.map(x=>Math.exp(x-max)),sum=weights.reduce((a,b)=>a+b,0);
 return weights.map(x=>x/sum);
}
export function freeEnergy(snapshot,input,q){
 if(!Array.isArray(q)||q.length!==snapshot.causes||[...q].some(x=>!Number.isFinite(x)||x<0)||Math.abs(q.reduce((a,b)=>a+b,0)-1)>1e-8)throw Error('Invalid reference belief');
 const log=logJoint(snapshot,input);return q.reduce((sum,p,k)=>sum+(p?p*(Math.log(p)-log[k]):0),0);
}
export function logEvidence(snapshot,input){
 const log=logJoint(snapshot,input),max=Math.max(...log);return max+Math.log(log.reduce((sum,x)=>sum+Math.exp(x-max),0));
}
