import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {inside,safeNoteName,promptFor} from '../core.mjs';
test('note names cannot escape the vault',()=>{for(const title of ['../../secret','C:\\Windows\\secret','<script>','á é 😀','']){const name=safeNoteName(title);assert.ok(!/[\\/:.<>]/.test(name));assert.ok(name.length>0);}assert.equal(safeNoteName('Mi día'),'Mi dia');});
test('downloads reject traversal and sibling prefix',()=>{const root=path.resolve('vault');assert.ok(inside(root,path.join(root,'note.md')));assert.ok(!inside(root,path.resolve(root,'..','secret')));assert.ok(!inside(root,root+'-other/file'));});
test('mode limits and evidence instructions are present',()=>{const base={text:'crea una nota',history:[],notes:'contenido'};assert.match(promptFor({...base,mode:'chat'}),/No ejecutes tareas/);assert.match(promptFor({...base,mode:'task'}),/SOLO en este directorio/);assert.match(promptFor({...base,mode:'task'}),/No inventes ejecuciones/);});
