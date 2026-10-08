const templates=[{id:"pizzaria",icon:"🍕",name:"Pizzaria / Restaurante",desc:"Cardápio, pedidos e informações."},{id:"barbearia",icon:"💈",name:"Barbearia",desc:"Serviços e agendamento."},{id:"salao",icon:"💇",name:"Salão de beleza",desc:"Serviços, profissionais e horários."},{id:"estetica",icon:"💅",name:"Estética / Manicure",desc:"Catálogo de serviços e agenda."},{id:"loja",icon:"🛍️",name:"Loja",desc:"Produtos, contato e pedidos."},{id:"autonomo",icon:"🧑‍💼",name:"Profissional autônomo",desc:"Serviços e contato."}];
let clients=[],items={},orders={},appointments={},view="dashboard",currentUser=null;
let realtimeUnsubscribers=[],realtimeSeen={orders:{},appointments:{}},realtimeInitialized={orders:{},appointments:{}};
const FB=()=>window.CliqueFacilFirebase||{};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const tname=id=>templates.find(t=>t.id===id)?.name||"Serviço";
const clientItems=id=>items[id]||[];
const initials=s=>String(s||'CF').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const slugify=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);

async function start(){
 if(!FB().ready){renderSetupError();return;}
 const requested=new URLSearchParams(location.search).get("site");
 if(requested){
  try{
   const c=await loadPublicSite(requested);
   if(c)renderPublic(c);
   else document.querySelector("#app").innerHTML=`<div class="auth-page"><div class="auth-card"><h1>Página não encontrada</h1><p class="muted">Esse link não existe ou a página está inativa.</p></div></div>`;
  }catch(error){
   console.error(error);
   document.querySelector("#app").innerHTML=`<div class="auth-page"><div class="auth-card"><h1>Não foi possível abrir a página</h1><p class="muted">Verifique as regras e os índices do Firestore.</p></div></div>`;
  }
  return;
 }
 FB().auth.onAuthStateChanged(async user=>{
  currentUser=user||null;
  if(!user){stopRealtimeListeners();renderLogin();return;}
  stopRealtimeListeners();
  try{await loadData();dashboard();startRealtimeListeners();}
  catch(error){console.error(error);alert("Não foi possível carregar os dados do Firebase. Verifique as regras do Firestore.");dashboard();}
 });
}
function renderSetupError(){document.querySelector("#app").innerHTML=`<div class="auth-page"><div class="auth-card"><div class="brand">Clique<span>Fácil</span></div><h1>Firebase não conectado</h1><p class="muted">Confira a configuração do Firebase e recarregue a página.</p></div></div>`;}
function renderLogin(message=""){document.querySelector("#app").innerHTML=`<div class="auth-page"><div class="auth-card"><div class="brand">Clique<span>Fácil</span></div><h1>Entrar no painel</h1><p class="muted">Acesse o administrador das páginas dos seus clientes.</p>${message?`<div class="auth-message">${esc(message)}</div>`:""}<form onsubmit="login(event)" class="auth-form"><label>E-mail<input type="email" name="email" required autocomplete="email"></label><label>Senha<input type="password" name="password" required autocomplete="current-password"></label><button class="btn primary">Entrar</button></form><button class="btn secondary auth-register" onclick="register()">Criar minha conta</button></div></div>`;}
async function login(e){e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await FB().auth.signInWithEmailAndPassword(data.email,data.password);}catch(error){renderLogin(firebaseAuthMessage(error));}}
async function register(){const email=prompt("Digite o e-mail que será usado no painel:");if(!email)return;const password=prompt("Crie uma senha com pelo menos 6 caracteres:");if(!password)return;try{await FB().auth.createUserWithEmailAndPassword(email.trim(),password);}catch(error){renderLogin(firebaseAuthMessage(error));}}
function firebaseAuthMessage(error){const code=error?.code||"";const map={"auth/invalid-email":"E-mail inválido.","auth/user-not-found":"E-mail ou senha incorretos.","auth/wrong-password":"E-mail ou senha incorretos.","auth/invalid-credential":"E-mail ou senha incorretos.","auth/email-already-in-use":"Esse e-mail já está cadastrado.","auth/weak-password":"A senha precisa ter pelo menos 6 caracteres.","auth/too-many-requests":"Muitas tentativas. Tente novamente mais tarde."};return map[code]||error?.message||"Não foi possível entrar.";}

async function loadData(){
 const snap=await FB().db.collection("clients").where("ownerId","==",currentUser.uid).get();
 clients=snap.docs.map(d=>({id:d.id,...d.data()}));items={};orders={};appointments={};
 await Promise.all(clients.map(async c=>{
  const base=FB().db.collection("clients").doc(c.id);
  const [is,os,aps]=await Promise.all([base.collection("items").get(),base.collection("orders").get(),base.collection("appointments").get()]);
  items[c.id]=is.docs.map(d=>({id:d.id,...d.data()}));
  orders[c.id]=os.docs.map(d=>({id:d.id,...d.data()}));
  appointments[c.id]=aps.docs.map(d=>({id:d.id,...d.data()}));
 }));
}
async function loadPublicSite(slug){
 const snap=await FB().db.collection("clients").where("slug","==",slug).where("active","==",true).limit(1).get();
 if(snap.empty)return null;
 const d=snap.docs[0],c={id:d.id,...d.data()};
 const itemSnap=await FB().db.collection("clients").doc(c.id).collection("items").where("active","==",true).get();
 items[c.id]=itemSnap.docs.map(x=>({id:x.id,...x.data()}));return c;
}
function shell(content){const email=currentUser?.email||'Conta';document.querySelector('#app').innerHTML=`<header class="topbar"><div class="brand"><div class="brand-mark">C</div>Clique<span>Fácil</span></div><div class="top-actions"><div class="user-pill"><div class="avatar">${initials(email)}</div><span>${esc(email)}</span></div><button class="btn secondary notification-toggle" onclick="enableNotifications()">🔔 Notificações</button><button class="btn secondary" onclick="preview()">Visualizar</button><button class="btn primary" onclick="newClient()">+ Nova página</button><button class="btn ghost" onclick="logout()">Sair</button></div></header><div class="layout"><aside class="sidebar"><div class="side-label">Menu principal</div><nav class="nav"><button class="${view==="dashboard"?"active":""}" onclick="dashboard()"><span class="nav-icon">▦</span>Visão geral</button><button class="${view==="clients"?"active":""}" onclick="clientsView()"><span class="nav-icon">◉</span>Clientes</button><button class="${view==="templates"?"active":""}" onclick="templatesView()"><span class="nav-icon">◇</span>Modelos</button><button class="${view==="orders"?"active":""}" onclick="ordersView()"><span class="nav-icon">🧾</span>Pedidos</button><button class="${view==="appointments"?"active":""}" onclick="appointmentsView()"><span class="nav-icon">📅</span>Agendamentos</button><button onclick="newClient()"><span class="nav-icon">＋</span>Criar página</button></nav><div class="side-help"><strong>Pronto para crescer?</strong><p>Crie uma página para cada cliente e mantenha tudo organizado em um único painel.</p></div></aside><main class="main">${content}</main></div>`;}
function stopRealtimeListeners(){
 realtimeUnsubscribers.forEach(unsubscribe=>{try{unsubscribe();}catch(error){console.warn(error);}});
 realtimeUnsubscribers=[];
 realtimeSeen={orders:{},appointments:{}};
 realtimeInitialized={orders:{},appointments:{}};
}
function showLiveToast(title,message){
 let host=document.getElementById("live-notices");
 if(!host){host=document.createElement("div");host.id="live-notices";host.className="live-notices";host.setAttribute("aria-live","polite");document.body.appendChild(host);}
 const toast=document.createElement("div");toast.className="live-toast";
 const strong=document.createElement("strong");strong.textContent=title;
 const body=document.createElement("span");body.textContent=message;
 toast.append(strong,body);host.appendChild(toast);
 window.setTimeout(()=>{toast.classList.add("leaving");window.setTimeout(()=>toast.remove(),250);},6000);
}
async function enableNotifications(){
 if(!("Notification" in window)){showLiveToast("Notificações indisponíveis","Este navegador não oferece notificações do sistema.");return;}
 try{
  const permission=Notification.permission==="default"?await Notification.requestPermission():Notification.permission;
  if(permission==="granted"){
   showLiveToast("Notificações ativadas","Você receberá avisos enquanto o painel estiver aberto.");
   const button=document.querySelector(".notification-toggle");if(button)button.textContent="🔔 Ativadas";
  }else showLiveToast("Permissão não concedida","Permita notificações nas configurações do navegador para receber avisos.");
 }catch(error){console.error(error);showLiveToast("Não foi possível ativar","Verifique as permissões do navegador.");}
}
function notifyNewRecord(kind,client,record){
 const isOrder=kind==="orders";
 const title=isOrder?"Novo pedido recebido":"Novo agendamento recebido";
 const detail=isOrder?((record.itemName||"Pedido")+" — "+client.name):((record.customerName||"Cliente")+" — "+client.name);
 showLiveToast(title,detail);
 if("Notification" in window && Notification.permission==="granted"){
  try{
   const notification=new Notification(title,{body:detail,tag:kind+"-"+record.id});
   notification.onclick=()=>{window.focus();if(isOrder)ordersView();else appointmentsView();notification.close();};
  }catch(error){console.warn("Notificação do navegador indisponível:",error);}
 }
}
function refreshLiveView(){
 if(view==="dashboard")dashboard();
 else if(view==="orders")ordersView();
 else if(view==="appointments")appointmentsView();
}
function startRealtimeListeners(){
 stopRealtimeListeners();
 for(const client of clients){
  for(const kind of ["orders","appointments"]){
   const path=FB().db.collection("clients").doc(client.id).collection(kind);
   const unsubscribe=path.onSnapshot(snapshot=>{
    const previous=realtimeSeen[kind][client.id]||new Set();
    const first=!realtimeInitialized[kind][client.id];
    const records=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    if(kind==="orders")orders[client.id]=records;else appointments[client.id]=records;
    if(!first){
     snapshot.docChanges().forEach(change=>{
      if(change.type==="added"&&!previous.has(change.doc.id)){
       notifyNewRecord(kind,client,{id:change.doc.id,...change.doc.data()});
      }
     });
    }
    realtimeSeen[kind][client.id]=new Set(records.map(record=>record.id));
    realtimeInitialized[kind][client.id]=true;
    refreshLiveView();
   },error=>console.error("CliqueFácil: erro na atualização em tempo real ("+kind+"):",error));
   realtimeUnsubscribers.push(unsubscribe);
  }
 }
}
async function logout(){await FB().auth.signOut();}
function dashboard(){view='dashboard';const active=clients.filter(c=>c.active).length,totalItems=Object.values(items).reduce((n,a)=>n+a.length,0),totalOrders=Object.values(orders).reduce((n,a)=>n+a.length,0),totalAppointments=Object.values(appointments).reduce((n,a)=>n+a.length,0);const recent=clients.slice(0,5);const recentHtml=recent.length?recent.map(c=>`<div class="client-row"><div class="client-main"><div class="client-avatar">${esc(initials(c.name))}</div><div><strong>${esc(c.name)}</strong><div class="small-muted">${esc(tname(c.template))} · ${clientItems(c.id).length} item(ns)</div></div></div><div class="client-actions"><span class="badge ${c.active?'on':'off'}"><i class="dot"></i>${c.active?'Ativa':'Inativa'}</span><button class="btn ghost" onclick="editClient('${c.id}')">Editar</button></div></div>`).join(''): `<div class="empty"><div class="empty-icon">＋</div><h3>Nenhuma página ainda</h3><p class="muted">Comece criando a primeira página do seu cliente.</p><button class="btn primary" onclick="newClient()">Criar primeira página</button></div>`;shell(`<section class="hero"><div><div class="eyebrow">Painel de controle</div><h1>Visão geral</h1><div class="muted">Gerencie sua operação digital de forma simples e profissional.</div></div><button class="btn primary" onclick="newClient()">+ Criar nova página</button></section><section class="cards"><div class="card stat-card"><div class="stat-icon">👥</div><div class="stat-label">Clientes</div><div class="stat">${clients.length}</div><div class="stat-sub">cadastros no painel</div></div><div class="card stat-card"><div class="stat-icon">✓</div><div class="stat-label">Páginas ativas</div><div class="stat">${active}</div><div class="stat-sub">${clients.length?Math.round(active/clients.length*100):0}% dos clientes</div></div><div class="card stat-card"><div class="stat-icon">◇</div><div class="stat-label">Modelos</div><div class="stat">${templates.length}</div><div class="stat-sub">segmentos disponíveis</div></div><div class="card stat-card"><div class="stat-icon">▤</div><div class="stat-label">Itens</div><div class="stat">${totalItems}</div><div class="stat-sub">produtos e serviços</div></div><div class="card stat-card"><div class="stat-icon">🧾</div><div class="stat-label">Pedidos</div><div class="stat">${totalOrders}</div><div class="stat-sub">solicitações registradas</div></div><div class="card stat-card"><div class="stat-icon">📅</div><div class="stat-label">Agendamentos</div><div class="stat">${totalAppointments}</div><div class="stat-sub">solicitações recebidas</div></div></section><div class="dashboard-grid"><section class="section-card"><div class="section-head"><h2>Páginas recentes</h2><button class="btn ghost" onclick="clientsView()">Ver todas</button></div><div class="section-body">${recentHtml}</div></section><section class="section-card"><div class="section-head"><h2>Ações rápidas</h2></div><div class="section-body"><div class="quick-grid"><button class="quick-card" onclick="newClient()"><div class="quick-icon">＋</div><div><strong>Criar página</strong><span>Comece um novo cliente</span></div></button><button class="quick-card" onclick="templatesView()"><div class="quick-icon">◇</div><div><strong>Explorar modelos</strong><span>Escolha um segmento</span></div></button><button class="quick-card" onclick="clientsView()"><div class="quick-icon">◉</div><div><strong>Gerenciar clientes</strong><span>Editar e visualizar páginas</span></div></button></div></div></section></div>`);}
function clientsView(){view="clients";const rows=clients.map(c=>`<tr><td><strong>${esc(c.name)}</strong><div class="small-muted">/${esc(c.slug||"")}</div></td><td>${tname(c.template)}</td><td><span class="badge ${c.active?"on":"off"}">${c.active?"Ativa":"Inativa"}</span></td><td>${clientItems(c.id).length}</td><td><button class="btn ghost" onclick="editClient('${c.id}')">Editar</button> <button class="btn secondary" onclick="manageItems('${c.id}')">Catálogo</button> <button class="btn primary" onclick="publicPage('${c.id}')">Abrir</button></td></tr>`).join("");shell(`<section class="hero"><div><h1>Clientes</h1><div class="muted">Cada cliente possui página, slug e catálogo próprios.</div></div><button class="btn primary" onclick="newClient()">+ Nova página</button></section>${clients.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Segmento</th><th>Status</th><th>Itens</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="card empty">Nenhum cliente cadastrado.</div>`}`);}
function templatesView(){view="templates";shell(`<section class="hero"><div><h1>Modelos</h1><div class="muted">Estruturas reutilizáveis por segmento.</div></div></section><div class="grid">${templates.map(t=>`<article class="template"><div class="template-icon">${t.icon}</div><h3>${t.name}</h3><p>${t.desc}</p><button class="btn secondary" onclick="newClient('${t.id}')">Usar modelo</button></article>`).join("")}</div>`);}
function newClient(template="pizzaria"){view="form";formView({template});}
function editClient(id){const c=clients.find(x=>x.id===id);if(c){view="form";formView(c);}}
function formView(data={}){const c={name:"",description:"",phone:"",instagram:"",address:"",hours:"",accent:"#5b5cf0",template:data.template||"pizzaria",active:true,buttonText:"Falar no WhatsApp",welcomeText:"Bem-vindo! Confira nossos produtos e serviços.",...data};shell(`<section class="hero"><div><div class="eyebrow">${data.id?"Editor de página":"Configuração inicial"}</div><h1>${data.id?"Editar página":"Nova página"}</h1><div class="muted">Personalize a experiência pública do seu cliente sem alterar código.</div></div><div class="hero-actions">${data.id?`<button class="btn secondary" type="button" onclick="publicPage('${c.id}')">Ver página</button>`:""}</div></section><form class="form" onsubmit="submitClient(event,'${c.id||""}')"><div class="form-section"><h3>Identidade do negócio</h3><p class="form-note">Essas informações aparecem no topo da página pública.</p><div class="form-grid"><div class="field"><label>Nome da empresa</label><input name="name" required value="${esc(c.name)}" placeholder="Ex.: Pizzaria Oliveira"></div><div class="field"><label>Segmento</label><select name="template">${templates.map(t=>`<option value="${t.id}" ${c.template===t.id?"selected":""}>${t.icon} ${t.name}</option>`).join("")}</select></div><div class="field full"><label>Descrição curta</label><textarea name="description" placeholder="Explique em poucas palavras o que sua empresa oferece.">${esc(c.description)}</textarea></div><div class="field full"><label>Mensagem de boas-vindas</label><input name="welcomeText" value="${esc(c.welcomeText)}" placeholder="Bem-vindo!"></div></div></div><div class="form-section"><h3>Contato e localização</h3><p class="form-note">Facilite o contato e ajude o cliente final a encontrar o negócio.</p><div class="form-grid"><div class="field"><label>WhatsApp</label><input name="phone" value="${esc(c.phone)}" placeholder="5512991119914"></div><div class="field"><label>Instagram</label><input name="instagram" value="${esc(c.instagram)}" placeholder="@empresa"></div><div class="field full"><label>Endereço</label><input name="address" value="${esc(c.address)}" placeholder="Rua, número, bairro, cidade - UF"></div><div class="field full"><label>Horário de funcionamento</label><input name="hours" value="${esc(c.hours)}" placeholder="Seg a Sex: 09h às 18h"></div></div></div><div class="form-section"><h3>Aparência e chamada para ação</h3><p class="form-note">A imagem/logo ficará para uma próxima etapa. Por enquanto, deixe a identidade visual preparada.</p><div class="form-grid"><div class="field"><label>Cor principal</label><input type="color" name="accent" value="${esc(c.accent)}"></div><div class="field"><label>Estilo da página</label><select name="layout"><option value="moderno" ${(c.layout||"moderno")==="moderno"?"selected":""}>Moderno — cartões</option><option value="elegante" ${c.layout==="elegante"?"selected":""}>Elegante — visual refinado</option><option value="compacto" ${c.layout==="compacto"?"selected":""}>Compacto — direto ao ponto</option></select></div><div class="field full"><label>Texto do botão principal</label><input name="buttonText" value="${esc(c.buttonText)}" placeholder="Falar no WhatsApp"></div></div></div><div class="actions"><button type="button" class="btn ghost" onclick="clientsView()">Cancelar</button><button type="submit" class="btn primary">${data.id?"Salvar alterações":"Criar página"}</button></div></form>`);}
function uniqueSlug(name,id){const base=slugify(name)||"pagina";let slug=base,n=2;const used=new Set(clients.filter(c=>c.id!==id).map(c=>String(c.slug||"").toLowerCase()).filter(Boolean));while(used.has(slug.toLowerCase()))slug=base+"-"+n++;return slug;}
async function submitClient(e,id){e.preventDefault();const button=e.target.querySelector('button[type="submit"]');if(button){button.disabled=true;button.textContent="Salvando...";}try{if(!currentUser)throw new Error("Usuário não autenticado.");const data=Object.fromEntries(new FormData(e.target));data.active=true;data.slug=uniqueSlug(data.name,id);data.updatedAt=firebase.firestore.FieldValue.serverTimestamp();if(id){await FB().db.collection("clients").doc(id).update(data);}else{data.ownerId=currentUser.uid;data.createdAt=firebase.firestore.FieldValue.serverTimestamp();const ref=await FB().db.collection("clients").add(data);items[ref.id]=[];}await loadData();startRealtimeListeners();clientsView();}catch(error){console.error("CliqueFácil: erro ao salvar página:",error);const detail=error?.code?"\nCódigo: "+error.code:"";alert("Não foi possível salvar a página."+detail+"\n\n"+(error?.message||"Tente novamente."));if(button){button.disabled=false;button.textContent="Salvar página";}}}
function manageItems(id){const c=clients.find(x=>x.id===id);if(!c)return;view="items";const list=clientItems(id);shell(`<section class="hero"><div><h1>Catálogo — ${esc(c.name)}</h1><div class="muted">${list.length} item(ns) • /${esc(c.slug)}</div></div><div><button class="btn ghost" onclick="clientsView()">Voltar</button> <button class="btn primary" onclick="itemForm('${id}')">+ Adicionar item</button></div></section>${list.length?`<div class="items-admin">${list.map(x=>`<article class="item-admin"><div><strong>${esc(x.name)}</strong><p>${esc(x.description||"")}</p><div class="item-admin-meta"><span class="price">${x.price?"R$ "+esc(x.price):"Preço sob consulta"}</span>${x.category?`<span class="category-chip">${esc(x.category)}</span>`:""}<span class="badge ${x.active!==false?"on":"off"}">${x.active!==false?"Disponível":"Indisponível"}</span></div></div><div><button class="btn ghost" onclick="itemForm('${id}','${x.id}')">Editar</button> <button class="btn danger" onclick="deleteItem('${id}','${x.id}')">Excluir</button></div></article>`).join("")}</div>`:`<div class="card empty"><h3>Catálogo vazio</h3><p class="muted">Adicione o primeiro produto ou serviço.</p><button class="btn primary" onclick="itemForm('${id}')">Adicionar item</button></div>`}`);}
function itemForm(clientId,itemId){const old=clientItems(clientId).find(x=>x.id===itemId)||{name:"",description:"",price:"",category:"",active:true};const c=clients.find(x=>x.id===clientId);shell(`<section class="hero"><div><h1>${itemId?"Editar item":"Novo item"}</h1><div class="muted">Catálogo de ${esc(c?.name||"cliente")}</div></div></section><form class="form" onsubmit="submitItem(event,'${clientId}','${itemId||""}')"><div class="form-grid"><div class="field"><label>Nome</label><input name="name" required value="${esc(old.name)}" placeholder="Ex.: Pizza Calabresa"></div><div class="field"><label>Preço</label><input name="price" value="${esc(old.price)}" placeholder="39,90"></div><div class="field"><label>Categoria</label><input name="category" value="${esc(old.category)}" placeholder="Pizzas"></div><div class="field full"><label>Descrição</label><textarea name="description" placeholder="Detalhes do produto ou serviço">${esc(old.description)}</textarea></div><div class="field full"><label class="check-field"><input type="checkbox" name="active" value="true" ${old.active!==false?"checked":""}> Item disponível para aparecer na página pública</label></div></div><div class="actions"><button type="button" class="btn ghost" onclick="manageItems('${clientId}')">Cancelar</button><button class="btn primary">Salvar item</button></div></form>`);}
async function submitItem(e,clientId,itemId){e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.active=e.target.elements.active.checked;data.updatedAt=firebase.firestore.FieldValue.serverTimestamp();try{const ref=FB().db.collection("clients").doc(clientId).collection("items");if(itemId)await ref.doc(itemId).update(data);else{data.createdAt=firebase.firestore.FieldValue.serverTimestamp();await ref.add(data);}await loadData();manageItems(clientId);}catch(error){console.error(error);alert("Não foi possível salvar o item.");}}
async function deleteItem(clientId,itemId){if(!confirm("Excluir este item?"))return;try{await FB().db.collection("clients").doc(clientId).collection("items").doc(itemId).delete();await loadData();manageItems(clientId);}catch(error){console.error(error);alert("Não foi possível excluir o item.");}}
function publicUrl(c){return location.href.split("?")[0]+"?site="+encodeURIComponent(c.slug);}
function publicPage(id){const c=clients.find(x=>x.id===id);if(c)renderPublic(c);}
function preview(){if(clients[0])renderPublic(clients[0]);else alert("Crie uma página primeiro.");}
function renderPublic(c){
 document.body.style.setProperty("--accent",c.accent||"#5b5cf0");
 const list=clientItems(c.id).filter(x=>x.active!==false),wa=String(c.phone||"").replace(/\D/g,"");
 const isShop=c.template==="pizzaria"||c.template==="loja";
 const content=list.length?list.map(x=>{
  const message=encodeURIComponent(`Olá! Tenho interesse em ${x.name}${x.price?" (R$ "+x.price+")":""}.`);
  return `<article class="item"><div class="item-public-info">${x.category?`<span class="category-chip">${esc(x.category)}</span>`:""}<strong>${esc(x.name)}</strong>${x.description?`<small>${esc(x.description)}</small>`:""}<span class="item-public-price">${x.price?"R$ "+esc(x.price):"Preço sob consulta"}</span></div>${wa?`<a class="btn secondary item-order" href="https://wa.me/${wa}?text=${message}" target="_blank" rel="noopener" onclick="registerPublicOrder('${c.id}','${x.id}')">${isShop?"Pedir":"Consultar"}</a>`:""}</article>`;
 }).join(""):`<div class="empty-inline">Nenhum item disponível no momento.</div>`;
 const back=currentUser?`<button class="btn public-back" onclick="dashboard()">← Painel</button>`:"";
 const booking=!isShop?`<section class="card appointment-card"><h2>Solicitar agendamento</h2><p class="muted">Preencha os dados para enviar sua solicitação.</p><form class="booking-form" data-hours="${esc(c.hours||"")}" onsubmit="submitPublicAppointment(event,'${c.id}')"><label>Seu nome<input name="customerName" required maxlength="100" placeholder="Nome completo"></label><label>Serviço<select name="service" required><option value="">Selecione um serviço</option>${list.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("")}</select></label><div class="booking-row"><label>Data<input type="date" name="date" required min="${new Date().toLocaleDateString("en-CA")}" onchange="loadAvailableTimes(event,'${c.id}')"></label><label>Horário disponível<select name="time" required disabled><option value="">Escolha primeiro a data</option></select></label></div><label>Seu WhatsApp<input name="customerPhone" required maxlength="30" placeholder="DDD + número"></label><label>Observações (opcional)<textarea name="notes" maxlength="500" placeholder="Alguma preferência?"></textarea></label><button class="btn primary" type="submit">Solicitar agendamento</button><p class="booking-feedback" aria-live="polite"></p></form></section>`:"";
 document.querySelector("#app").innerHTML=`<div class="public public-${esc(c.layout||"moderno")}"><header class="public-head">${back}<div class="public-icon">${templates.find(t=>t.id===c.template)?.icon||"⭐"}</div><h1>${esc(c.name)}</h1>${c.description?`<p>${esc(c.description)}</p>`:""}${c.welcomeText?`<p class="welcome-text">${esc(c.welcomeText)}</p>`:""}</header><main class="public-content"><div class="card"><h2>Informações</h2><p>📍 ${esc(c.address||"Endereço não informado")}</p><p>🕒 ${esc(c.hours||"Horário não informado")}</p>${c.phone?`<p>📱 ${esc(c.phone)}</p>`:""}${c.instagram?`<p>📸 ${esc(c.instagram)}</p>`:""}</div><div class="card" style="margin-top:16px"><h2>${isShop?"Cardápio / Produtos":"Serviços"}</h2><div class="items">${content}</div>${wa?`<a class="btn primary public-cta" href="https://wa.me/${wa}" target="_blank" rel="noopener">${esc(c.buttonText||"Falar no WhatsApp")}</a>`:""}</div>${booking}<div class="public-link"><span>Link desta página</span><code>?site=${esc(c.slug)}</code>${currentUser?`<button class="btn ghost" onclick="copyLink('${c.id}')">Copiar</button>`:""}</div></main></div>`;
}
async function registerPublicOrder(clientId,itemId){
 try{
  const item=clientItems(clientId).find(x=>x.id===itemId);
  if(!item)return;
  await FB().db.collection("clients").doc(clientId).collection("orders").add({
   itemId:item.id,itemName:item.name,price:String(item.price||""),quantity:1,status:"novo",
   source:"pagina-publica",createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
 }catch(error){console.error("Não foi possível registrar o pedido:",error);}
}
function getBusinessTimeSlots(hoursText){
 const matches=[...String(hoursText||"").matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?)?\b/gi)];
 let start=9*60,end=18*60;
 if(matches.length>=2){
  const toMinutes=m=>Number(m[1])*60+Number(m[2]||m[3]||0);
  const first=toMinutes(matches[0]),last=toMinutes(matches[1]);
  if(last>first){start=first;end=last;}
 }
 const slots=[];
 for(let minutes=start;minutes<end;minutes+=30){
  const h=String(Math.floor(minutes/60)).padStart(2,"0");
  const m=String(minutes%60).padStart(2,"0");
  slots.push(h+":"+m);
 }
 return slots;
}
async function loadAvailableTimes(e,clientId){
 const form=e.target.form,date=e.target.value,select=form.elements.time,feedback=form.querySelector(".booking-feedback");
 select.disabled=true;
 select.innerHTML='<option value="">Carregando horários...</option>';
 if(!date){select.innerHTML='<option value="">Escolha primeiro a data</option>';return;}
 try{
  const snap=await FB().db.collection("clients").doc(clientId).collection("slots").where("date","==",date).get();
  const booked=new Set(snap.docs.map(doc=>doc.data().time));
  const slots=getBusinessTimeSlots(form.dataset.hours).filter(time=>!booked.has(time));
  if(!slots.length){
   select.innerHTML='<option value="">Não há horários disponíveis nesta data</option>';
   if(feedback)feedback.textContent="Todos os horários desse dia estão ocupados. Escolha outra data.";
   return;
  }
  select.innerHTML='<option value="">Selecione um horário</option>'+slots.map(time=>'<option value="'+time+'">'+time+'</option>').join("");
  select.disabled=false;
  if(feedback)feedback.textContent="";
 }catch(error){
  console.error("Não foi possível carregar os horários:",error);
  select.innerHTML='<option value="">Indisponível no momento</option>';
  if(feedback)feedback.textContent="Não foi possível consultar os horários. Verifique a configuração do Firestore ou tente novamente.";
 }
}
async function submitPublicAppointment(e,clientId){
 e.preventDefault();
 const form=e.target,button=form.querySelector('button[type="submit"]'),feedback=form.querySelector(".booking-feedback");
 const data=Object.fromEntries(new FormData(form));
 if(data.date<new Date().toLocaleDateString("en-CA")){feedback.textContent="Escolha uma data de hoje ou futura.";return;}
 if(!data.time){feedback.textContent="Selecione um horário disponível.";return;}
 button.disabled=true;button.textContent="Reservando...";
 try{
  const clientRef=FB().db.collection("clients").doc(clientId);
  const slotId=data.date+"_"+data.time.replace(":","-");
  const slotRef=clientRef.collection("slots").doc(slotId);
  const appointmentRef=clientRef.collection("appointments").doc();
  await FB().db.runTransaction(async transaction=>{
   const slot=await transaction.get(slotRef);
   if(slot.exists)throw new Error("SLOT_TAKEN");
   transaction.set(slotRef,{date:data.date,time:data.time,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
   transaction.set(appointmentRef,{
    customerName:data.customerName.trim(),service:data.service,date:data.date,time:data.time,
    customerPhone:data.customerPhone.trim(),notes:(data.notes||"").trim(),status:"novo",
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
   });
  });
  feedback.textContent="Horário reservado! A empresa entrará em contato para confirmar o atendimento.";
  form.reset();
  form.elements.time.disabled=true;
  form.elements.time.innerHTML='<option value="">Escolha primeiro a data</option>';
 }catch(error){
  console.error(error);
  if(error.message==="SLOT_TAKEN"){
   feedback.textContent="Esse horário acabou de ser reservado. Escolha outro horário.";
   await loadAvailableTimes({target:form.elements.date},clientId);
  }else feedback.textContent="Não foi possível reservar. Verifique as regras do Firestore ou fale pelo WhatsApp.";
 }finally{button.disabled=false;button.textContent="Solicitar agendamento";}
}
function orderStatusLabel(status){return ({novo:"Novo",confirmado:"Confirmado",preparando:"Em andamento",concluido:"Concluído",cancelado:"Cancelado"})[status]||"Novo";}
function appointmentStatusLabel(status){return ({novo:"Novo",confirmado:"Confirmado",concluido:"Concluído",cancelado:"Cancelado"})[status]||"Novo";}
function ordersView(){
 view="orders";
 const rows=clients.flatMap(c=>(orders[c.id]||[]).map(o=>({...o,clientName:c.name,clientId:c.id}))).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 const content=rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente da página</th><th>Valor</th><th>Data</th><th>Status</th></tr></thead><tbody>${rows.map(o=>`<tr><td><strong>${esc(o.itemName||"Pedido")}</strong><div class="small-muted">Qtd.: ${Number(o.quantity)||1}</div></td><td>${esc(o.clientName)}</td><td>${o.price?"R$ "+esc(o.price):"Consultar"}</td><td>${esc(formatDate(o.createdAt))}</td><td><select class="status-select" aria-label="Status do pedido" onchange="updateRecordStatus('${o.clientId}','orders','${o.id}',this.value)">${["novo","confirmado","preparando","concluido","cancelado"].map(v=>`<option value="${v}" ${(o.status||"novo")===v?"selected":""}>${orderStatusLabel(v)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`:`<div class="card empty"><h3>Nenhum pedido registrado</h3><p class="muted">Quando alguém clicar em Pedir em um produto da página pública, a solicitação aparecerá aqui.</p></div>`;
 shell(`<section class="hero"><div><h1>Pedidos</h1><div class="muted">Acompanhe pedidos de todas as páginas em um só lugar.</div></div><button class="btn secondary" onclick="loadAndRefresh()">Atualizar</button></section><div class="record-summary"><strong>${rows.length}</strong><span>pedido(s) registrados</span></div>${content}`);
}
function appointmentsView(){
 view="appointments";
 const rows=clients.flatMap(c=>(appointments[c.id]||[]).map(a=>({...a,clientName:c.name,clientId:c.id}))).sort((a,b)=>(String(a.date||"")+String(a.time||"")).localeCompare(String(b.date||"")+String(b.time||"")));
 const content=rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Solicitante</th><th>Negócio</th><th>Serviço</th><th>Data e hora</th><th>Contato</th><th>Status</th></tr></thead><tbody>${rows.map(a=>`<tr><td><strong>${esc(a.customerName||"Cliente")}</strong>${a.notes?`<div class="small-muted">${esc(a.notes)}</div>`:""}</td><td>${esc(a.clientName)}</td><td>${esc(a.service||"—")}</td><td>${esc(a.date||"—")} ${esc(a.time||"")}</td><td>${esc(a.customerPhone||"—")}</td><td><select class="status-select" aria-label="Status do agendamento" onchange="updateRecordStatus('${a.clientId}','appointments','${a.id}',this.value)">${["novo","confirmado","concluido","cancelado"].map(v=>`<option value="${v}" ${(a.status||"novo")===v?"selected":""}>${appointmentStatusLabel(v)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`:`<div class="card empty"><h3>Nenhum agendamento recebido</h3><p class="muted">As solicitações feitas na página pública aparecerão aqui.</p></div>`;
 shell(`<section class="hero"><div><h1>Agendamentos</h1><div class="muted">Consulte datas, serviços e contatos e atualize o status.</div></div><button class="btn secondary" onclick="loadAndRefresh()">Atualizar</button></section><div class="record-summary"><strong>${rows.length}</strong><span>agendamento(s) recebido(s)</span></div>${content}`);
}
function formatDate(timestamp){if(!timestamp?.toDate)return "—";return timestamp.toDate().toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}
async function updateRecordStatus(clientId,collection,id,status){
 try{
  const clientRef=FB().db.collection("clients").doc(clientId);
  const recordRef=clientRef.collection(collection).doc(id);
  const timestamp=firebase.firestore.FieldValue.serverTimestamp();
  if(collection==="appointments"&&status==="cancelado"){
   const record=(appointments[clientId]||[]).find(x=>x.id===id);
   await FB().db.runTransaction(async transaction=>{
    transaction.update(recordRef,{status,updatedAt:timestamp});
    if(record?.date&&record?.time){
     const slotRef=clientRef.collection("slots").doc(record.date+"_"+record.time.replace(":","-"));
     transaction.delete(slotRef);
    }
   });
  }else await recordRef.update({status,updatedAt:timestamp});
  if(collection==="orders")orders[clientId]=(orders[clientId]||[]).map(x=>x.id===id?{...x,status}:x);
  else appointments[clientId]=(appointments[clientId]||[]).map(x=>x.id===id?{...x,status}:x);
 }catch(error){console.error(error);alert("Não foi possível atualizar o status. Verifique as regras do Firestore.");}
}
async function loadAndRefresh(){try{await loadData();if(view==="orders")ordersView();else appointmentsView();}catch(error){console.error(error);alert("Não foi possível atualizar os registros.");}}
function copyLink(id){const c=clients.find(x=>x.id===id);if(c&&navigator.clipboard)navigator.clipboard.writeText(publicUrl(c)).then(()=>alert("Link copiado!"));}
function openRequestedSite(){const slug=new URLSearchParams(location.search).get("site");if(!slug)return false;loadPublicSite(slug).then(c=>{if(c)renderPublic(c);else document.querySelector("#app").innerHTML=`<div class="auth-page"><div class="auth-card"><h1>Página não encontrada</h1><p class="muted">Esse link não existe ou a página está inativa.</p></div></div>`;}).catch(error=>{console.error(error);document.querySelector("#app").innerHTML=`<div class="auth-page"><div class="auth-card"><h1>Não foi possível abrir a página</h1><p class="muted">Verifique as regras do Firestore.</p></div></div>`;});return true;}
start();
