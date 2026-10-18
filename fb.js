import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,setDoc,deleteDoc,onSnapshot,writeBatch} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCV5TEo0eWABOkcWq-1jIxNXn1lOxYDL7I",
  authDomain: "hamanien.firebaseapp.com",
  projectId: "hamanien",
  storageBucket: "hamanien.firebasestorage.app",
  messagingSenderId: "455031288382",
  appId: "1:455031288382:web:99c6b1a7893d3b6c5bd76f"
};

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
const $=id=>document.getElementById(id);

function adapter(uid){
  const base=["users",uid];
  return {
    collection(name){return {onSnapshot(next,err){
      return onSnapshot(collection(db,...base,name),snap=>next({docs:snap.docs.map(d=>({id:d.id,data:()=>d.data()}))}),err)}}},
    doc(path){const [c,id]=path.split("/");const ref=doc(db,...base,c,id);
      return {set:d=>setDoc(ref,d),delete:()=>deleteDoc(ref)}},
    async setMany(list){
      for(let i=0;i<list.length;i+=400){
        const b=writeBatch(db);
        list.slice(i,i+400).forEach(p=>{const [c,id]=p[0].split("/");b.set(doc(db,...base,c,id),p[1])});
        await b.commit()}}
  }}

const MSG={"auth/invalid-credential":"E-mail ou mot de passe incorrect.","auth/wrong-password":"E-mail ou mot de passe incorrect.","auth/user-not-found":"E-mail ou mot de passe incorrect.","auth/invalid-email":"Adresse e-mail non valide.","auth/too-many-requests":"Trop d'essais. Patientez quelques minutes.","auth/network-request-failed":"Pas de connexion réseau."};
const show=(id)=>{["boot","login","shell"].forEach(x=>$(x).hidden=(x!==id))};

onAuthStateChanged(auth,user=>{
  if(user){show("shell");window.HSApp.start(adapter(user.uid),{email:user.email,logout:()=>signOut(auth)})}
  else{show("login")}
});
$("lf").addEventListener("submit",async e=>{
  e.preventDefault();$("lf_err").textContent="";$("lf_btn").disabled=true;
  try{await signInWithEmailAndPassword(auth,$("lf_mail").value.trim(),$("lf_pass").value)}
  catch(err){$("lf_err").textContent=MSG[err.code]||"Connexion impossible ("+(err.code||"erreur")+")."}
  $("lf_btn").disabled=false});
$("lf_reset").addEventListener("click",async()=>{
  const m=$("lf_mail").value.trim();if(!m){$("lf_err").textContent="Saisissez d'abord votre e-mail.";return}
  try{await sendPasswordResetEmail(auth,m);$("lf_err").textContent="E-mail de réinitialisation envoyé."}catch(err){$("lf_err").textContent=MSG[err.code]||"Envoi impossible."}});
