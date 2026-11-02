import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateResponse,validateEndpoint} from '../dist/bridge.js';
test('bridge accepts exactly eight bounded count values and matching id',()=>{assert.deepEqual(validateResponse({request_id:7,counts:[0,0,2,3,2,3,0,0]},7),[0,0,2,3,2,3,0,0])});
test('bridge rejects stale, mismatched and malformed response bins',()=>{for(const data of [{request_id:6,counts:Array(8).fill(1)},{request_id:7,counts:[1]},{request_id:7,counts:Array(8).fill(-1)},{request_id:7,counts:Array(8).fill(1.5)},{request_id:7,counts:Array(8).fill(101)},null])assert.throws(()=>validateResponse(data,7))});
test('endpoint validation requires HTTPS except loopback and rejects embedded credentials',()=>{assert.equal(validateEndpoint('http://localhost:8080/step'),'http://localhost:8080/step');assert.equal(validateEndpoint('https://example.com/step'),'https://example.com/step');for(const value of ['http://example.com','https://user:secret@example.com','javascript:alert(1)'])assert.throws(()=>validateEndpoint(value))});
