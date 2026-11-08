import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as experiment from '../scripts/learning-experiment.mjs';
test('no-training control preserves weights and scores on identical evaluation courses',()=>{
 const result=experiment.runCondition({seed:17,mode:'none',trials:3,evaluationTrials:3,maxSeconds:2});
 assert.equal(result.weight_before,result.weight_after);assert.deepEqual(result.before,result.after);assert.equal(result.training.completed_trials,3);
 assert.equal(result.before.trials.length,3);assert.ok(result.before.trials.every(t=>Number.isFinite(t.seconds)&&Number.isInteger(t.clears)));
});
test('adaptive experiments are deterministic and evaluations cannot change learned weights',()=>{
 const options={seed:12,mode:'adaptive',trials:4,evaluationTrials:2,maxSeconds:5};
 const a=experiment.runCondition(options),b=experiment.runCondition(options);
 assert.deepEqual(a,b);assert.equal(a.training.completed_trials,4);const collisions=a.training.pattern_counts.reduce((x,y)=>x+y,0);assert.ok(collisions>0&&collisions<=4,'reward can allow later trials to reach the cap without collision training');assert.equal(a.after.weights_changed,false);
 assert.throws(()=>experiment.runCondition({...options,trials:0}));
});
