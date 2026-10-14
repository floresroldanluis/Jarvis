import test from 'node:test';
import assert from 'node:assert/strict';
import {privateAddress,validToken} from '../mobile.mjs';
test('mobile bridge accepts private network ranges only',()=>{for(const ip of ['127.0.0.1','192.168.1.20','10.0.0.2','172.16.1.1','::ffff:192.168.1.2','100.64.0.1'])assert.equal(privateAddress(ip),true,ip);for(const ip of ['8.8.8.8','172.32.0.1','100.128.0.1','203.0.113.1',''])assert.equal(privateAddress(ip),false,ip);});
test('mobile commands require exact bearer token',()=>{assert.equal(validToken('Bearer abc','abc'),true);for(const token of [undefined,'abc','Bearer ab','Bearer abcd'])assert.equal(validToken(token,'abc'),false);});
