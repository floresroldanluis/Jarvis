import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {UpdateChecker,newerVersion,repositoryName} from '../updates.mjs';
test('stable numeric versions and repository validation',()=>{assert.equal(newerVersion('v1.10.0','1.9.9'),true);assert.equal(newerVersion('v1.0.0-beta','1.0.0'),false);assert.equal(newerVersion('1.0.0','1.0.0'),false);assert.throws(()=>repositoryName('https://evil.test/a'));assert.throws(()=>repositoryName('../bad/repo'));});
test('release links must belong to configured repository and errors clear stale updates',async()=>{const data=await mkdtemp(path.join(os.tmpdir(),'jarvis-update-'));let bad=false;const checker=new UpdateChecker({data,version:'1.0.0',fetcher:async()=>({ok:true,json:async()=>({tag_name:'v2.0.0',html_url:bad?'https://evil.test/':'https://github.com/example/jarvis/releases/tag/v2.0.0'})})});try{await checker.configure('example/jarvis');assert.equal(checker.status.available,true);bad=true;await checker.check();assert.equal(checker.status.available,false);assert.equal(checker.status.url,null);}finally{await rm(data,{recursive:true,force:true});}});
