import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {startCloudinary} from '../../media/cloudinary-local.mjs';
const dir=mkdtempSync(tmpdir()+'/wamda-adapter-'),realFetch=globalThis.fetch;
writeFileSync(dir+'/credential','cloudinary://synthetic-key:synthetic-secret@synthetic',{mode:0o600});
let uploaded=0,registered=0;
globalThis.fetch=async(url,opts={})=>{
 if(url.includes('/image/upload')){uploaded++;assert.equal(opts.body.get('moderation'),'aws_rek');return Response.json({moderation:[{kind:'aws_rek',status:'approved'}],public_id:opts.body.get('public_id'),resource_type:'image',format:'jpg',bytes:4,width:10,height:10,secure_url:'https://res.cloudinary.com/synthetic/image/upload/fixture.jpg'})}
 if(url.includes('accounts:lookup'))return Response.json({users:[{localId:'fixture',emailVerified:true}]});
 if(url.includes('/uploads/')&&opts.method==='PATCH'){registered++;return Response.json({})}
 if(url.startsWith('http://127.0.0.1:8188/')||url.startsWith('http://127.0.0.1:9198/'))return Response.json({});
 throw Error('UNEXPECTED_TARGET');
};
let server;
try{
 const opts={credentialPath:dir+'/credential',stateDir:dir+'/state',port:8794};
 server=await startCloudinary(opts);
 const send=(origin='http://127.0.0.1:4319')=>realFetch('http://127.0.0.1:8794/upload',{method:'POST',headers:{Connection:'close',Origin:origin,Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({base64:Buffer.from([255,216,255,217]).toString('base64')})});
 assert.equal((await send('https://outside.test')).status,403);assert.equal(uploaded,0);console.log('PASS loopback adapter wrong origin blocked');
 const r=await send();assert.equal(r.status,201);assert.equal(uploaded,1);assert.equal(registered,1);console.log('PASS safe synthetic response registered through core');
 assert.equal((await send()).status,429);assert.equal(uploaded,1);console.log('PASS second attempt stopped before provider');
 await new Promise(resolve=>server.close(resolve));server=await startCloudinary(opts);
 assert.equal((await send()).status,429);assert.equal(uploaded,1);console.log('PASS durable one-attempt cap survives restart');
 console.log('4 adapter checks passed. Mock external services only, no quota used.');
}finally{if(server)await new Promise(resolve=>server.close(resolve));globalThis.fetch=realFetch;rmSync(dir,{recursive:true,force:true})}
