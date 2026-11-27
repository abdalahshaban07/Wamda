import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHandler,sign} from '../../worker/core.mjs';
let n=0;async function check(name,fn){await fn();console.log('PASS',++n,name)}
const registry=new Map();let uploads=0,deletes=0;let verified=true,gate=true,failRegistry=false,badImage=false,moderationStatus='approved';
const env={ALLOWED_ORIGIN:'https://wamda.test',CLOUDINARY_CLOUD:'synthetic',CLOUDINARY_KEY:'test-key',CLOUDINARY_SECRET:'synthetic-not-a-secret',FIREBASE_WEB_KEY:'test-key',GATE:{take:async()=>gate},REGISTRY:{put:async(id,x)=>{if(failRegistry)throw Error();registry.set(id,x)},get:async id=>registry.get(id),remove:async id=>registry.delete(id),postDeleted:async()=>false}};
const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
const handle=createHandler({now:()=>1_800_000_000_000,uuid:()=> 'fixture-id',fetcher:async(url,opts)=>{
 if(url.startsWith('https://identitytoolkit.googleapis.com/'))return json({users:[{localId:'test-user',emailVerified:verified}]});
 if(url.endsWith('/image/upload')){uploads++;assert.equal(opts.body.get('overwrite'),'false');assert.equal(opts.body.get('public_id'),'wamda/fixture-id');assert.equal(opts.body.get('signature'),await sign({moderation:'aws_rek',overwrite:'false',public_id:'wamda/fixture-id',timestamp:1800000000},env.CLOUDINARY_SECRET));return json({moderation:moderationStatus===null?undefined:[{kind:'aws_rek',status:moderationStatus}],public_id:'wamda/fixture-id',resource_type:'image',format:'jpg',bytes:4,width:badImage?9000:100,height:100,secure_url:'https://res.cloudinary.com/synthetic/image/upload/wamda/fixture-id.jpg'})}
 if(url.endsWith('/image/destroy')){deletes++;assert.equal(opts.body.get('invalidate'),'true');return json({result:'ok'})}throw Error('Unexpected network target');
}});
function request(path='/upload',method='POST',body=new Uint8Array([255,216,255,217]),headers={}){return new Request('https://api.wamda.test'+path,{method,headers:{Origin:env.ALLOWED_ORIGIN,Authorization:'Bearer synthetic-token','Content-Type':'image/jpeg',...headers},...(method==='DELETE'?{}:{body})})}
await check('SHA256 parameter order matches independent implementation',async()=>assert.equal(await sign({timestamp:123,public_id:'a'},'synthetic'),createHash('sha256').update('public_id=a&timestamp=123synthetic').digest('hex')));
await check('missing origin denied',async()=>assert.equal((await handle(request('/upload','POST',undefined,{Origin:''}),env)).status,403));
await check('missing durable adapters fail closed',async()=>assert.equal((await handle(request(),{...env,GATE:null})).status,503));
await check('missing bearer denied',async()=>assert.equal((await handle(request('/upload','POST',undefined,{Authorization:''}),env)).status,401));
await check('unverified account denied before upload',async()=>{verified=false;assert.equal((await handle(request(),env)).status,403);verified=true;assert.equal(uploads,0)});
await check('quota failure rejects',async()=>{gate=false;assert.equal((await handle(request(),env)).status,429);gate=true});
await check('spoofed image content rejected',async()=>assert.equal((await handle(request('/upload','POST',new Uint8Array([1,2,3,4])),env)).status,415));
await check('oversized request rejected',async()=>assert.equal((await handle(request('/upload','POST',new Uint8Array(2_000_001)),env)).status,413));
await check('image sent through server-owned parameters and registered',async()=>{const r=await handle(request(),env);assert.equal(r.status,201);assert.equal(registry.get('fixture-id').ownerId,'test-user');assert.equal((await r.json()).publicId,'fixture-id')});
await check('live-post image cannot be deleted',async()=>{registry.get('fixture-id').postId='post';assert.equal((await handle(request('/image/fixture-id','DELETE'),env)).status,409)});
await check('another owner cannot delete image',async()=>{registry.get('fixture-id').ownerId='other';assert.equal((await handle(request('/image/fixture-id','DELETE'),env)).status,404)});
await check('orphan image may be deleted by owner',async()=>{registry.set('fixture-id',{ownerId:'test-user',postId:'',providerId:'wamda/fixture-id'});assert.equal((await handle(request('/image/fixture-id','DELETE'),env)).status,200);assert.equal(registry.size,0)});
await check('registry failure cleans provider asset',async()=>{const before=deletes;failRegistry=true;assert.equal((await handle(request(),env)).status,503);assert.equal(deletes,before+1);failRegistry=false});
await check('provider dimensions rechecked',async()=>{const before=deletes;badImage=true;assert.equal((await handle(request(),env)).status,502);assert.equal(deletes,before+1);badImage=false});


for(const status of ['pending','rejected',null])await check('moderation '+status+' never released and cleaned',async()=>{moderationStatus=status;const before=deletes;const r=await handle(request(),env);assert.equal(r.status,422);assert.equal((await r.json()).error,'IMAGE_NOT_APPROVED');assert.equal(deletes,before+1)});
moderationStatus='approved';

console.log(`All ${n} media-core checks passed. Synthetic provider responses only; no external requests.`);
