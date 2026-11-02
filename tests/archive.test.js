import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openArchive,writeRecords,readRecords} from '../dist/archive.js';
test('record storage replaces checkpoints by trial ID and waits for transaction completion',async()=>{
 const rows=new Map();const db={transaction(){const tx={objectStore:()=>({put:r=>rows.set(r.id,structuredClone(r)),getAll:()=>({result:[...rows.values()]})})};queueMicrotask(()=>tx.oncomplete());return tx}};
 await writeRecords(db,[{id:'trial-a',complete:false}]);
 await writeRecords(db,[{id:'trial-a',complete:true},{id:'trial-b',complete:false}]);
 assert.deepEqual(await readRecords(db),[{id:'trial-a',complete:true},{id:'trial-b',complete:false}]);
});
test('storage unavailability and failed transactions reject rather than claim a save',async()=>{
 await assert.rejects(openArchive(undefined));
 const db={transaction(){const tx={error:Error('quota'),objectStore:()=>({put(){}})};queueMicrotask(()=>tx.onabort());return tx}};
 await assert.rejects(writeRecords(db,[{id:'x'}]),/quota/);
});
