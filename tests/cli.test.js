import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const exec=promisify(execFile);

test('portable runner writes complete per-trial records and refuses to overwrite results',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'neurorunner-')),path=join(directory,'results.jsonl');
 const args=['scripts/run-session.mjs','--trials','2','--experiment','cli-test','--max-seconds','1','--output',path];
 try{
  await exec(process.execPath,args);
  const text=await readFile(path,'utf8'),rows=text.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.research.experiment_id==='cli-test'&&r.recording_complete));
  assert.ok(rows.every(r=>r.network_start.synapses.length&&r.network_end.synapses.length));
  await assert.rejects(exec(process.execPath,args));assert.equal(await readFile(path,'utf8'),text);
 }finally{await unlink(path).catch(()=>{});await rmdir(directory)}
});
