import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,collection,query,where,getDocs,serverTimestamp,deleteDoc,writeBatch} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-wamda',firestore:{rules:readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8188}});
const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore(),guest=env.unauthenticatedContext().firestore(),mod=env.authenticatedContext('moderator',{moderator:true}).firestore();
let n=0;async function ok(name,p){await p;n++;console.log('PASS',n,name)}
const post={authorId:'alice',title:'A real idea',body:'Two test accounts share this.',category:'design',link:'',image:'',mediaId:'',status:'published',createdAt:serverTimestamp()};
async function create(db,path,data,kind){await new Promise(r=>setTimeout(r,1100));const rate=doc(db,`users/${data.authorId||data.reporterId}/limits/${kind}`),old=await getDoc(rate),batch=writeBatch(db);batch.set(rate,{count:old.exists()?old.data().count+1:1,lastAt:serverTimestamp(),target:path.split('/').at(-1)});batch.set(doc(db,path),data);return batch.commit()}
try{
await ok('profile self create',assertSucceeds(setDoc(doc(a,'profiles/alice'),{name:'Alice',bio:'Designer'})));
await ok('profile spoof denied',assertFails(setDoc(doc(b,'profiles/alice'),{name:'Bob',bio:''})));
await ok('profile no email or privilege fields',assertFails(setDoc(doc(a,'profiles/alice'),{name:'Alice',bio:'',moderator:true})));
await ok('publish own post',assertSucceeds(create(a,'posts/p1',post,'posts')));
await ok('direct post bypass without counter denied',assertFails(setDoc(doc(a,'posts/bypass'),post)));
await ok('rate counter cannot be reset',assertFails(setDoc(doc(a,'users/alice/limits/posts'),{count:1,lastAt:serverTimestamp(),target:'bypass'})));
await ok('foreign user cannot read rate data',assertFails(getDoc(doc(b,'users/alice/limits/posts'))));
await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'users/alice/limits/posts'),{lastAt:new Date(Date.now()+60_000)}));
let burst=writeBatch(a);burst.set(doc(a,'users/alice/limits/posts'),{count:2,lastAt:serverTimestamp(),target:'burst'});burst.set(doc(a,'posts/burst'),post);await ok('atomic post burst during cooldown denied',assertFails(burst.commit()));
await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'users/alice/limits/posts'),{lastAt:new Date(0)}));
await ok('guest reads published',assertSucceeds(getDoc(doc(guest,'posts/p1'))));
await ok('guest cannot publish',assertFails(setDoc(doc(guest,'posts/p2'),post)));
await ok('author spoof denied',assertFails(setDoc(doc(b,'posts/p2'),post)));
await ok('unverified image URL denied',assertFails(setDoc(doc(a,'posts/p2'),{...post,image:'https://outside.invalid/a.jpg'})));
await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'uploads/image1'),{ownerId:'alice',url:'http://127.0.0.1:8788/image/image1',postId:''}));
const im={...post,image:'http://127.0.0.1:8788/image/image1',mediaId:'image1'};
await ok('image without atomic ownership claim denied',assertFails(setDoc(doc(a,'posts/imagepost'),im)));
await new Promise(r=>setTimeout(r,1100));let claim=writeBatch(a);claim.set(doc(a,'users/alice/limits/posts'),{count:2,lastAt:serverTimestamp(),target:'imagepost'});claim.set(doc(a,'posts/imagepost'),im);claim.update(doc(a,'uploads/image1'),{postId:'imagepost'});await ok('owned image atomic claim accepted',assertSucceeds(claim.commit()));
claim=writeBatch(a);claim.set(doc(a,'posts/imagereuse'),im);claim.update(doc(a,'uploads/image1'),{postId:'imagereuse'});await ok('same image cannot be reused in another post',assertFails(claim.commit()));
await ok('another user cannot claim uploaded image',assertFails(setDoc(doc(b,'posts/stolenimage'),{...im,authorId:'bob'})));
await env.withSecurityRulesDisabled(async c=>deleteDoc(doc(c.firestore(),'uploads/image1')));
await ok('deleted media registration cannot be reused',assertFails(setDoc(doc(a,'posts/goneimage'),im)));
await ok('unsafe external link denied',assertFails(setDoc(doc(a,'posts/p2'),{...post,link:'javascript:alert(1)'})));
await ok('private collection self',assertSucceeds(setDoc(doc(a,'users/alice/collections/c1'),{name:'Private'})));
await ok('private collection cross-user read denied',assertFails(getDoc(doc(b,'users/alice/collections/c1'))));
await ok('private save self',assertSucceeds(setDoc(doc(a,'users/alice/saved/p1'),{collectionId:'c1'})));
await ok('private save guest read denied',assertFails(getDoc(doc(guest,'users/alice/saved/p1'))));
await ok('private save cross-user write denied',assertFails(setDoc(doc(b,'users/alice/saved/p1'),{collectionId:'hacked'})));
await ok('like own uid',assertSucceeds(setDoc(doc(b,'posts/p1/likes/bob'),{createdAt:serverTimestamp()})));
await ok('duplicate like update denied',assertFails(setDoc(doc(b,'posts/p1/likes/bob'),{createdAt:serverTimestamp()})));
await ok('like identity spoof denied',assertFails(setDoc(doc(b,'posts/p1/likes/alice'),{createdAt:serverTimestamp()})));
await ok('comment own identity',assertSucceeds(create(b,'posts/p1/comments/c1',{authorId:'bob',body:'Useful.',status:'visible',createdAt:serverTimestamp()},'comments')));
await ok('comment owner deletes',assertSucceeds(updateDoc(doc(b,'posts/p1/comments/c1'),{status:'deleted'})));
await ok('report created privately',assertSucceeds(create(b,'reports/bob_p1',{reporterId:'bob',postId:'p1',reason:'spam',status:'open',createdAt:serverTimestamp()},'reports')));
await ok('duplicate report cannot be created again',assertFails(setDoc(doc(b,'reports/bob_p1'),{reporterId:'bob',postId:'p1',reason:'spam',status:'open',createdAt:serverTimestamp()})));
await ok('report unreadable to author',assertFails(getDoc(doc(a,'reports/bob_p1'))));
await ok('reports readable to moderator',assertSucceeds(getDocs(collection(mod,'reports'))));
await ok('ordinary user cannot hide another post',assertFails(updateDoc(doc(b,'posts/p1'),{status:'hidden'})));
await ok('moderator hides',assertSucceeds(updateDoc(doc(mod,'posts/p1'),{status:'hidden'})));
await ok('hidden post unreadable to guest',assertFails(getDoc(doc(guest,'posts/p1'))));
await ok('hidden post author can inspect',assertSucceeds(getDoc(doc(a,'posts/p1'))));
await ok('moderator closes report',assertSucceeds(updateDoc(doc(mod,'reports/bob_p1'),{status:'closed'})));
await ok('owner soft delete',assertSucceeds(updateDoc(doc(a,'posts/p1'),{status:'deleted'})));
await ok('deleted post cannot be restored by author',assertFails(updateDoc(doc(a,'posts/p1'),{status:'published'})));
await ok('cleanup cannot claim arbitrary post media',assertFails(setDoc(doc(a,'users/alice/mediaCleanup/foreign'),{postId:'p1',createdAt:serverTimestamp()})));
await ok('cleanup cross-user read denied',assertFails(getDocs(collection(b,'users/alice/mediaCleanup'))));
await ok('hard delete denied',assertFails(deleteDoc(doc(a,'posts/p1'))));
console.log(`All ${n} rules tests passed`)
}finally{await env.cleanup()}
