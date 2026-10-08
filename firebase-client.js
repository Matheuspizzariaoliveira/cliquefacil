(function(){
  const c=window.firebaseConfig||{};
  const ready=c.apiKey&&c.projectId&&c.apiKey!=="COLE_SUA_API_KEY"&&c.projectId!=="SEU_PROJETO";
  window.CliqueFacilFirebase={ready:false,auth:null,db:null};
  if(!ready||!window.firebase)return;
  try{
    if(!firebase.apps.length)firebase.initializeApp(c);
    const auth=firebase.auth();
    const db=firebase.firestore();
    window.CliqueFacilFirebase={ready:true,auth,db};
    console.info("CliqueFácil: Firebase conectado.");
  }catch(error){console.error("CliqueFácil: erro ao inicializar Firebase.",error);}
})();
