import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driveTarget} from '../worker/service.mjs';
test('Drive API の送信先制限',()=>{
 assert.equal(driveTarget('https://www.googleapis.com/drive/v3/files?q=test','GET').hostname,'www.googleapis.com');
 assert.throws(()=>driveTarget('https://example.org/drive/v3/files','GET'));
 assert.throws(()=>driveTarget('https://www.googleapis.com/drive/v3/files/x','DELETE'));
 assert.throws(()=>driveTarget('https://www.googleapis.com/oauth2/v1/tokeninfo','GET'));
});
