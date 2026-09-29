const SUPABASE_URL="https://voimbsxptlzcbzguocsb.supabase.co";
const SUPABASE_KEY="sb_publishable_ku6M7W_rkjTVJ5yQkphbbg_tGojdmte";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const fmtDate=d=>new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(d+"T12:00:00"));
const shiftLabel=s=>s==="manha"?"Manhã":"Tarde";

async function boot(){
 const {data:{session}}=await db.auth.getSession();
 toggle(session);
 db.auth.onAuthStateChange((_e,s)=>toggle(s));
}
function toggle(session){
 $("login").classList.toggle("hidden",!!session);
 $("app").classList.toggle("hidden",!session);
 if(session) load();
}
$("loginBtn").onclick=async()=>{
 $("loginMsg").textContent="";
 const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
 if(error)$("loginMsg").textContent="E-mail ou senha inválidos.";
};
$("logoutBtn").onclick=()=>db.auth.signOut();
$("newClientBtn").onclick=()=>{$("modal").classList.remove("hidden");$("iDate").value=new Date().toISOString().slice(0,10)};
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("refreshBtn").onclick=load;

async function load(){
 const today=new Date().toISOString().slice(0,10);
 const {data:inst=[]}=await db.from("installations").select("*,clients(name,phone,plan,status)").order("installation_date",{ascending:true});
 const {data:clients=[]}=await db.from("clients").select("*").order("created_at",{ascending:false}).limit(12);
 const {data:tasks=[]}=await db.from("tasks").select("*,clients(name)").eq("completed",false).order("due_date",{ascending:true}).limit(10);
 const {data:post=[]}=await db.from("clients").select("id,name,phone").eq("status","pos_venda");
 $("todayCount").textContent=inst.filter(x=>x.installation_date===today).length;
 $("upcomingCount").textContent=inst.filter(x=>x.installation_date>=today&&x.status!=="instalado"&&x.status!=="nao_instalado").length;
 $("pendingCount").textContent=clients.filter(x=>x.status==="com_pendencia"||x.status==="precisa_confirmar").length;
 $("postCount").textContent=post.length;
 renderInstallations(inst.filter(x=>x.installation_date>=today).slice(0,8));
 renderClients(clients);
 renderAttention(tasks,clients);
}
function renderInstallations(rows){
 $("installations").classList.toggle("empty",!rows.length);
 $("installations").innerHTML=rows.length?rows.map(x=>`<div class="item"><div><strong>${x.clients?.name||"Cliente"}</strong><div class="muted">${fmtDate(x.installation_date)} · ${shiftLabel(x.shift)} · ${x.clients?.plan||"Plano não informado"}</div></div><span class="badge ${x.status==="nao_instalado"?"danger":x.status==="instalado"?"success":""}">${statusLabel(x.status)}</span></div>`).join(""):"Nenhuma instalação cadastrada.";
}
function renderClients(rows){
 $("clients").classList.toggle("empty",!rows.length);
 $("clients").innerHTML=rows.length?rows.map(x=>`<div class="item"><div><strong>${escapeHtml(x.name)}</strong><div class="muted">${escapeHtml(x.phone||"Sem telefone")} · ${escapeHtml(x.plan||"Plano não informado")}</div></div><span class="badge">${statusLabel(x.status)}</span></div>`).join(""):"Nenhum cliente cadastrado.";
}
function renderAttention(tasks,clients){
 const items=[...tasks.map(t=>({title:t.clients?.name||"Cliente",text:t.title+" · "+fmtDate(t.due_date),kind:"task"})),...clients.filter(c=>["precisa_confirmar","com_pendencia"].includes(c.status)).slice(0,5).map(c=>({title:c.name,text:statusLabel(c.status),kind:"pending"}))];
 $("attention").classList.toggle("empty",!items.length);
 $("attention").innerHTML=items.length?items.slice(0,8).map(x=>`<div class="item"><div><strong>${escapeHtml(x.title)}</strong><div class="muted">${escapeHtml(x.text)}</div></div><span class="badge ${x.kind==="pending"?"warning":""}">Atenção</span></div>`).join(""):"Tudo em dia por enquanto.";
}
function statusLabel(s){return ({venda_realizada:"Venda realizada",aguardando_instalacao:"Aguardando instalação",precisa_confirmar:"Precisa confirmar",com_pendencia:"Com pendência",instalacao_hoje:"Instalação hoje",instalado:"Instalado",nao_instalado:"Não instalado",pos_venda:"Pós-venda",concluido:"Concluído",agendada:"Agendada",confirmada:"Confirmada",tecnico_a_caminho:"Técnico a caminho",em_instalacao:"Em instalação",reagendada:"Reagendada"})[s]||s}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}

$("saveClientBtn").onclick=async()=>{
 const name=$("cName").value.trim(), date=$("iDate").value;
 if(!name||!date){$("formMsg").textContent="Preencha o nome e a data da instalação.";return}
 $("formMsg").textContent="Salvando...";
 const {data:client,error:e1}=await db.from("clients").insert({name,phone:$("cPhone").value.trim(),plan:$("cPlan").value.trim(),plan_value:$("cValue").value||null,address:$("cAddress").value.trim(),notes:$("cNotes").value.trim(),status:"aguardando_instalacao"}).select().single();
 if(e1){$("formMsg").textContent=e1.message;return}
 const {error:e2}=await db.from("installations").insert({client_id:client.id,installation_date:date,shift:$("iShift").value,status:"agendada"});
 const {error:e3}=await db.from("checklists").insert({client_id:client.id,address_confirmed:$("ckAddress").checked,installation_schedule_confirmed:$("ckSchedule").checked,person_available:$("ckPerson").checked,condominium_access:$("ckCondo").checked});
 const tomorrow=new Date(date+"T12:00:00");tomorrow.setDate(tomorrow.getDate()-1);
 await db.from("tasks").insert({client_id:client.id,task_type:"confirmar_instalacao",due_date:tomorrow.toISOString().slice(0,10),title:"Confirmar instalação com o cliente"});
 if(e2||e3){$("formMsg").textContent=(e2||e3).message;return}
 $("modal").classList.add("hidden");
 ["cName","cPhone","cPlan","cValue","cAddress","cNotes"].forEach(id=>$(id).value="");
 ["ckAddress","ckSchedule","ckPerson","ckCondo"].forEach(id=>$(id).checked=false);
 load();
};
boot();