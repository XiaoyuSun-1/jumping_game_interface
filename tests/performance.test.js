import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performanceRows,recordingPerformance} from '../dist/performance.js';
import {Engine} from '../dist/engine.js';
test('performance uses measured distance and completed-trial rolling averages',()=>{
 const rows=performanceRows([{trial:1,time_s:2,distance_px:600,clears:0,jumps:1},{trial:2,time_s:4,distance_px:900,clears:2,jumps:3},{trial:3,time_s:1,clears:0,jumps:0,complete:false}]);
 assert.equal(rows[0].distance_m,20);assert.equal(rows[1].rolling_5_clears,1);
 assert.equal(rows[2].rolling_5_seconds,3);assert.equal(rows[2].distance_m,null);
});
test('trial results and exported recordings share actual game metrics',()=>{
 const e=new Engine({threshold:200});while(!e.crashed)e.step(1/120);
 const exported=e.export();assert.equal(exported.performance[0].distance_m,e.distance/30);
 const rows=recordingPerformance(exported.recordings);assert.equal(rows[0].seconds,e.time);
 assert.equal(rows[0].clears,e.clears);assert.equal(rows[0].jumps,e.jumps);
});
