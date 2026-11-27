// All URLs are isolated local emulator/test services. No real user data.
import assert from 'node:assert/strict';
import {startMedia} from '../../media/local.mjs';
const media=await startMedia();let n=0;
const root='http://127.0.0.1:8788',fire='http://127.0.0.1:8188/v1/projects/demo-wamda/databases/(default)/documents/';
async function check(name,fn){await fn();console.log('PASS',++n,name)}
async function account(email){const r=await fetch('http://127.0.0.1:9198/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-only-not-a-production-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Synthetic-test-only-123',returnSecureToken:true})});assert.equal(r.ok,true);return r.json()}
function req(token,body={base64:Buffer.from([255,216,255,217]).toString('base64')},origin='http://127.0.0.1:4319'){return fetch(root+'/upload',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})}
try{
 const a=await account('media-a@wamda.test'),b=await account('media-b@wamda.test');let image;
 await check('untrusted CORS origin rejected',async()=>assert.equal((await req(a.idToken,undefined,'https://outside.invalid')).status,403));
 await check('missing auth rejected',async()=>assert.equal((await req('')).status,400));
 await check('forged token rejected',async()=>assert.equal((await req('forged-token')).status,400));
 await check('non-JPEG payload rejected',async()=>assert.equal((await req(a.idToken,{base64:'aGVsbG8='})).status,400));
 await check('oversized image rejected',async()=>assert.equal((await req(a.idToken,{base64:Buffer.alloc(2_000_001,255).toString('base64')})).status,400));
 await check('local image upload and GET',async()=>{const r=await req(a.idToken);assert.equal(r.status,200);image=await r.json();const got=await fetch(image.url);assert.equal(got.status,200);assert.equal(got.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(new Uint8Array(await got.arrayBuffer()),new Uint8Array([255,216,255,217]))});
 await check('foreign owner delete rejected',async()=>{const r=await fetch(image.url,{method:'DELETE',headers:{Authorization:'Bearer '+b.idToken}});assert.equal(r.status,400);assert.equal((await fetch(image.url)).status,200)});
 await check('attached active image delete rejected',async()=>{const r=await fetch(fire+'uploads/'+image.publicId+'?updateMask.fieldPaths=postId',{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{postId:{stringValue:'media-http-post'}}})});assert.equal(r.ok,true);await fetch(fire+'posts/media-http-post',{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{authorId:{stringValue:a.localId},status:{stringValue:'published'}}})});assert.equal((await fetch(image.url,{method:'DELETE',headers:{Authorization:'Bearer '+a.idToken}})).status,400)});
 await check('tombstone permits image and registry deletion',async()=>{await fetch(fire+'posts/media-http-post?updateMask.fieldPaths=status',{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{status:{stringValue:'deleted'}}})});assert.equal((await fetch(image.url,{method:'DELETE',headers:{Authorization:'Bearer '+a.idToken}})).status,200);assert.equal((await fetch(image.url)).status,404);assert.equal((await fetch(fire+'uploads/'+image.publicId,{headers:{Authorization:'Bearer owner'}})).status,404)});
 await check('per-user local burst limit rejects sixth upload',async()=>{const images=[];for(let i=0;i<4;i++){const r=await req(a.idToken);assert.equal(r.status,200);images.push(await r.json())}assert.equal((await req(a.idToken)).status,429);for(const im of images)assert.equal((await fetch(im.url,{method:'DELETE',headers:{Authorization:'Bearer '+a.idToken}})).status,200)});
 await check('completed delete is idempotent for retry',async()=>assert.equal((await fetch(image.url,{method:'DELETE',headers:{Authorization:'Bearer '+a.idToken}})).status,200));
 console.log(`All ${n} local media HTTP checks passed.`);
}finally{await new Promise(r=>media.close(r))}
