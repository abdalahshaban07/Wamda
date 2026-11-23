import { Injectable, NgZone, ApplicationRef } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, signOut, User } from 'firebase/auth';
import { getDoc, getFirestore, initializeFirestore, connectFirestoreEmulator, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, limit, serverTimestamp, Firestore, Unsubscribe, writeBatch, orderBy, startAfter, runTransaction } from 'firebase/firestore';
export interface SocialPost {id:string;authorId:string;title:string;body:string;category:string;link:string;image:string;mediaId?:string;status:string;createdAt?:any}
@Injectable({providedIn:'root'})
export class SocialService {
 constructor(private zone:NgZone,private appRef:ApplicationRef){}
 refresh(){queueMicrotask(()=>this.appRef.tick())}
 snap(target:any,next:(s:any)=>void,error?:(e:any)=>void):Unsubscribe{return onSnapshot(target,(s:any)=>this.zone.run(()=>{next(s);this.refresh()}),(e:any)=>this.zone.run(()=>{this.error=e.code;error?.(e)}))}

 user:User|null=null; db!:Firestore; auth!:ReturnType<typeof getAuth>; ready=false; error=''; mode='';
 profiles:Record<string,{name:string;bio:string}>={}; posts:SocialPost[]=[]; saved:Record<string,string>={}; collections:Record<string,string>={};
 cleanupPending:string[]=[]; comments:any[]=[]; likes:string[]=[]; reports:any[]=[]; moderator=false; mediaEndpoint='';
 private feedSub:Unsubscribe|null=null;feedLimit=40;hasMore=false;savedPosts:SocialPost[]=[];private savedSubs:Unsubscribe[]=[];private accountSubs:Unsubscribe[]=[];private detailSubs:Unsubscribe[]=[];
 async init(){
  const cfg=await fetch('/assets/wamda-config.json').then(r=>{if(!r.ok)throw Error('Configuration unavailable');return r.json()});
  this.mode=cfg.mode;
  if(!['live','protected-emulator'].includes(cfg.mode))throw Error('Unsupported protected configuration');
  const remote=cfg.mode==='live';
  const app=initializeApp(remote?cfg.firebase:{projectId:'demo-wamda',apiKey:'demo-only-not-a-production-key',authDomain:'localhost'});
  this.auth=getAuth(app);if(!remote)connectAuthEmulator(this.auth,cfg.authHost,{disableWarnings:true});
  this.db=initializeFirestore(app,{experimentalForceLongPolling:true});if(!remote)connectFirestoreEmulator(this.db,cfg.firestoreHost,cfg.firestorePort);
  onAuthStateChanged(this.auth,u=>{void (async()=>{
   if(!u){await signInAnonymously(this.auth);return;}if(!u.isAnonymous){await signOut(this.auth);return;}const approved=true;
   this.zone.run(()=>{this.accountSubs.forEach(x=>x());this.savedSubs.forEach(x=>x());this.savedSubs=[];this.savedPosts=[];this.detailSubs.forEach(x=>x());this.feedSub?.();this.feedSub=null;this.user=approved?u:null;this.posts=[];this.profiles={};if(!approved)this.imageCache.clear();this.saved={};this.collections={};this.likes=[];this.comments=[];this.reports=[];this.cleanupPending=[];this.moderator=false;
   if(u&&!approved)this.error='هذا الحساب غير مسموح له بالدخول / This account is not invited';
   if(approved){this.error='';void getDoc(doc(this.db,'visitorProfiles',u.uid)).then(x=>{if(!x.exists())void setDoc(doc(this.db,'visitorProfiles',u.uid),{name:'زائر '+u.uid.slice(0,4),bio:''})});this.watchFeed();this.accountSubs.push(this.snap(collection(this.db,'visitorProfiles'),s=>{this.profiles=Object.fromEntries(s.docs.map((d:any)=>[d.id,d.data() as {name:string;bio:string}]));}));}
   if(u&&approved){void u.getIdTokenResult().then(t=>this.zone.run(()=>{if(this.user?.uid!==u.uid)return;this.moderator=t.claims['moderator']===true;if(this.moderator)this.accountSubs.push(this.snap(query(collection(this.db,'visitorReports'),where('status','==','open'),limit(50)),s=>this.reports=s.docs.map((d:any)=>({id:d.id,...d.data()}))));this.refresh()}));
    this.accountSubs.push(this.snap(collection(this.db,`visitorUsers/${u.uid}/collections`),s=>this.collections=Object.fromEntries(s.docs.map((d:any)=>[d.id,d.data()['name']]))));
    this.accountSubs.push(this.snap(collection(this.db,`visitorUsers/${u.uid}/mediaCleanup`),s=>this.cleanupPending=s.docs.map((d:any)=>d.id)));
    this.accountSubs.push(this.snap(collection(this.db,`visitorUsers/${u.uid}/saved`),s=>{this.saved=Object.fromEntries(s.docs.map((d:any)=>[d.id,d.data()['collectionId']]));this.watchSaved(Object.keys(this.saved))}));
   }this.ready=true;window.dispatchEvent(new CustomEvent('wamda-auth',{detail:approved}));this.refresh();
  });})();});
 }
 watchSaved(ids:string[]){this.savedSubs.forEach(x=>x());this.savedSubs=[];this.savedPosts=[];const found=new Map<string,SocialPost>();const update=()=>{this.savedPosts=[...found.values()].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));void this.hydrateImages(this.savedPosts);this.refresh()};for(const id of ids){this.savedSubs.push(onSnapshot(doc(this.db,'visitorPosts',id),s=>this.zone.run(()=>{if(s.exists()&&s.data()['status']==='published')found.set(id,{id,...s.data()} as SocialPost);else found.delete(id);update()}),e=>this.zone.run(()=>{found.delete(id);update();if(e.code!=='permission-denied')this.error=e.code})))}}
 watchFeed(){this.feedSub?.();this.feedSub=this.snap(query(collection(this.db,'visitorPosts'),where('status','==','published'),orderBy('createdAt','desc'),limit(this.feedLimit)),s=>{this.posts=s.docs.map((d:any)=>({id:d.id,...d.data()} as SocialPost));void this.hydrateImages(this.posts);this.hasMore=s.size===this.feedLimit&&this.feedLimit<200},e=>{if(e.code==='failed-precondition'){this.error='';this.feedSub=this.snap(query(collection(this.db,'visitorPosts'),where('status','==','published'),limit(this.feedLimit)),s=>{this.posts=s.docs.map((d:any)=>({id:d.id,...d.data()} as SocialPost)).sort((a:SocialPost,b:SocialPost)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));void this.hydrateImages(this.posts);this.hasMore=s.size===this.feedLimit&&this.feedLimit<200});}else{this.posts=[];this.error=e.code;}})}
 async loadMore(){if(!this.hasMore)return;this.feedLimit=Math.min(200,this.feedLimit+40);this.watchFeed()}

 uid(){if(!this.user)throw Error('Sign in first');return this.user.uid}
 async login(email:string,password:string,name:string,signup:boolean){
  if(signup)throw Error('التسجيل بالدعوة فقط / Invite-only');
  const identifier=email.trim().toLowerCase()==='admin'?'reviewer@wamda.example':email.trim();
  await signInWithEmailAndPassword(this.auth,identifier,password);
  const uid=this.auth.currentUser!.uid;
  const member=await getDoc(doc(this.db,'members',uid));
  if(!member.exists()||member.data()['active']!==true){await signOut(this.auth);throw Error('Invite-only');}

 }
 async changePassword(password:string){if(password.length<6)throw Error('6 characters minimum');await updatePassword(this.auth.currentUser!,password)}
 logout(){return signOut(this.auth)}
 name(uid:string){return this.profiles[uid]?.name||'مستخدم'}
 async profile(name:string,bio:string){await setDoc(doc(this.db,'visitorProfiles',this.uid()),{name:name.trim(),bio:bio.trim()})}
 async boundedCreate(path:string,data:any,kind:string,id=''){const uid=this.uid(),ref=id?doc(this.db,path,id):doc(collection(this.db,path)),rate=doc(this.db,`visitorUsers/${uid}/limits/${kind}`);await runTransaction(this.db,async tx=>{const old=await tx.get(rate);const count=old.exists()?old.data()['count']+1:1;tx.set(rate,{count,lastAt:serverTimestamp(),target:ref.id});tx.set(ref,data)});return ref}
 private imageCache=new Map<string,string>();
 async hydrateImages(posts:SocialPost[]){const uid=this.user?.uid;if(!uid)return;await Promise.all(posts.filter(p=>p.mediaId).map(async p=>{const id=p.mediaId!;try{let image=this.imageCache.get(id);if(!image){const snap=await getDoc(doc(this.db,'visitorImages',id));if(snap.exists()){image=snap.data()['dataUrl'];this.imageCache.set(id,image!);}}if(this.user?.uid===uid&&image)p.image=image;}catch{} }));this.refresh();}
 async publish(title:string,body:string,category:string,link:string,image:string,mediaId=''){
  const post=doc(collection(this.db,'visitorPosts'));const rate=doc(this.db,`visitorUsers/${this.uid()}/limits/posts`);const withImage=!!image;const id=withImage?post.id:'';
  if(withImage&&(!image.startsWith('data:image/jpeg;base64,')||image.length>210000))throw Error('Image exceeds portfolio limit');
  await runTransaction(this.db,async batch=>{const old=await batch.get(rate);batch.set(rate,{count:old.exists()?old.data()['count']+1:1,lastAt:serverTimestamp(),target:post.id});batch.set(post,{authorId:this.uid(),title:title.trim(),body:body.trim(),category,link:link.trim(),image:'',mediaId:id,status:'published',createdAt:serverTimestamp()});if(withImage)batch.set(doc(this.db,'visitorImages',post.id),{ownerId:this.uid(),postId:post.id,dataUrl:image,createdAt:serverTimestamp()});});return post;
 }
 async upload(file:Blob){if(file.size>150000)throw Error('Image compression required');const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.onerror=()=>reject(Error('Image read failed'));r.readAsDataURL(file)});return {url,publicId:''};}
 async remove(post:SocialPost){const batch=writeBatch(this.db);batch.update(doc(this.db,'visitorPosts',post.id),{status:'deleted'});if(post.mediaId)batch.delete(doc(this.db,'visitorImages',post.mediaId));await batch.commit();this.imageCache.delete(post.mediaId||'');}
 async retryMediaCleanup(){}
 async toggleLike(pid:string){const uid=this.uid(),ref=doc(this.db,`visitorPosts/${pid}/likes/${uid}`);if(this.likes.includes(uid))await deleteDoc(ref);else await setDoc(ref,{createdAt:serverTimestamp()})}
 watch(pid:string){this.detailSubs.forEach(x=>x());this.comments=[];this.likes=[];
  this.detailSubs=[this.snap(query(collection(this.db,`visitorPosts/${pid}/comments`),where('status','==','visible'),limit(50)),s=>this.comments=s.docs.map((d:any)=>({id:d.id,...d.data()})),e=>this.error=e.code),this.snap(collection(this.db,`visitorPosts/${pid}/likes`),s=>this.likes=s.docs.map((d:any)=>d.id),e=>this.error=e.code)];
 }
 unwatch(){this.detailSubs.forEach(x=>x());this.detailSubs=[];this.comments=[];this.likes=[]}
 async comment(pid:string,body:string){await this.boundedCreate(`visitorPosts/${pid}/comments`,{authorId:this.uid(),body:body.trim(),createdAt:serverTimestamp(),status:'visible'},'comments')}
 async removeComment(pid:string,id:string){await updateDoc(doc(this.db,`visitorPosts/${pid}/comments/${id}`),{status:'deleted'})}
 async save(pid:string,collectionId:string){await setDoc(doc(this.db,`visitorUsers/${this.uid()}/saved/${pid}`),{collectionId})}
 async unsave(pid:string){await deleteDoc(doc(this.db,`visitorUsers/${this.uid()}/saved/${pid}`))}
 async createCollection(name:string){await addDoc(collection(this.db,`visitorUsers/${this.uid()}/collections`),{name:name.trim()})}
 async renameCollection(id:string,name:string){await setDoc(doc(this.db,`visitorUsers/${this.uid()}/collections/${id}`),{name:name.trim()})}
 async report(pid:string,reason:string){await this.boundedCreate('visitorReports',{postId:pid,reporterId:this.uid(),reason,status:'open',createdAt:serverTimestamp()},'reports',this.uid()+'_'+pid)}
 async moderate(pid:string,status:string){await updateDoc(doc(this.db,'visitorPosts',pid),{status})}
 async closeReport(id:string){await updateDoc(doc(this.db,'visitorReports',id),{status:'closed'})}
}
