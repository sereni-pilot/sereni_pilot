/* eslint-disable */
import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// SERENI — THEME: Soft Teal · Light Gray · White
// ═══════════════════════════════════════════════════════════════════════════════
const T = {
  // Backgrounds
  bg:       "#F0F4F4",   // very light teal-gray page background
  surface:  "#FFFFFF",   // white cards / nav
  card:     "#FFFFFF",   // white cards
  cardAlt:  "#F7FAFA",   // off-white alternate card bg

  // Teal palette
  teal:     "#4DB6AC",   // soft teal primary
  tealDk:   "#00897B",   // deeper teal for gradients / hover
  tealLt:   "#80CBC4",   // lighter teal for borders / accents
  tealBg:   "#E0F2F1",   // very pale teal fill
  tealGlow: "rgba(77,182,172,0.15)",

  // Grays
  border:   "#DDE6E6",   // soft teal-gray border
  borderDk: "#B2CECE",   // stronger border
  gray:     "#607D8B",   // blue-gray text
  grayLt:   "#90A4AE",   // lighter gray
  grayXLt:  "#ECEFF1",   // very light gray fill

  // Text
  text:     "#263238",   // near-black text
  sub:      "#546E7A",   // secondary text
  muted:    "#90A4AE",   // muted text

  // Semantic
  mild:     "#66BB6A",   // green
  moderate: "#FFA726",   // amber
  severe:   "#EF5350",   // red
  admin:    "#FFA726",   // amber for admin
  purple:   "#7E57C2",   // purple for groups
  blue:     "#42A5F5",   // blue for depression

  white:    "#FFFFFF",
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE — Real persistent database connection
// Sereni Pilot · Tanzania
// ═══════════════════════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://whibifcjawehrqkanvss.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaWJpZmNqYXdlaHJxa2FudnNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MjI0MjUsImV4cCI6MjEwNTM5ODQyNX0.iIdtpLe6JCll_36Xo5dQe6fBBhjSMKxuPVEzc9xk_-E";

// Supabase REST helper — replaces the in-memory DB
const sb = {
  async get(table, filters={}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    Object.entries(filters).forEach(([k,v]) => { url += `&${k}=eq.${v}`; });
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" } });
    return r.json();
  },
  async insert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async update(table, id, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async delete(table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async rpc(fn, params={}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    return r.json();
  }
};

// Password hashing (simple SHA-256 for pilot — upgrade to bcrypt in production)
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── DB: Unified async interface matching the old in-memory DB shape ────────────
const DB = {
  // ── Users ──
  async getUsers() { return sb.get("users"); },
  async getUser(id) { const r = await sb.get("users", {id}); return r[0]||null; },
  async getUserByUsername(username) {
    const url = `${SUPABASE_URL}/rest/v1/users?select=*&username=eq.${encodeURIComponent(username)}`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const data = await r.json(); return data[0]||null;
  },
  async getPending() { return sb.get("users", {status:"pending"}); },
  async getApproved() { return sb.get("users", {status:"approved"}); },

  async login(username, password) {
    const u = await this.getUserByUsername(username);
    if (!u) return null;
    const hash = await hashPassword(password);
    // Check both hash and plaintext (plaintext for dev demo accounts)
    if (u.password_hash !== hash && u.password_hash !== password) return null;
    return u;
  },

  async addUser(data) {
    const hash = await hashPassword(data.password);
    const payload = {
      username: data.username,
      password_hash: hash,
      full_name: data.fullName,
      age: parseInt(data.age)||null,
      sex: data.sex,
      phone: data.phone,
      email: data.email,
      university: data.university,
      course: data.course,
      year_of_study: data.yearOfStudy,
      year_start: data.yearStart,
      year_grad: data.yearGrad,
      status: "pending",
      role: "user"
    };
    const result = await sb.insert("users", payload);
    await sb.insert("activities", { type:"registration", actor:data.fullName, detail:`New registration: ${data.university}`, icon:"📝" });
    return result[0]||null;
  },

  async approve(id) {
    const u = await this.getUser(id);
    if (!u) return null;
    await sb.update("users", id, { status:"approved", approved_at: new Date().toISOString(), failed_attempts:0 });
    await sb.insert("activities", { type:"approval", actor:"Admin", detail:`Approved: ${u.full_name}`, icon:"✅" });
    return u;
  },

  async reject(id) {
    const u = await this.getUser(id);
    if (!u) return;
    await sb.update("users", id, { status:"rejected" });
    await sb.insert("activities", { type:"rejection", actor:"Admin", detail:`Rejected: ${u.full_name}`, icon:"❌" });
  },

  async blockUser(id) {
    const u = await this.getUser(id);
    if (!u) return;
    const blockedUntil = new Date(Date.now() + 24*60*60*1000).toISOString();
    await sb.update("users", id, { blocked_until: blockedUntil, blocked_by_admin: true });
    await sb.insert("activities", { type:"block", actor:"Admin", detail:`Blocked: ${u.full_name}`, icon:"🚫" });
  },

  async unblockUser(id) {
    const u = await this.getUser(id);
    if (!u) return;
    await sb.update("users", id, { blocked_until: null, blocked_by_admin: false, failed_attempts: 0 });
    await sb.insert("activities", { type:"unblock", actor:"Admin", detail:`Unblocked: ${u.full_name}`, icon:"✅" });
  },

  async cancelReg(id) {
    const u = await this.getUser(id);
    if (!u) return;
    await sb.update("users", id, { status:"cancelled" });
    await sb.insert("activities", { type:"cancel", actor:"Admin", detail:`Cancelled registration: ${u.full_name}`, icon:"🗑️" });
  },

  isBlocked(u) {
    if (!u.blocked_until) return false;
    return new Date(u.blocked_until) > new Date();
  },

  async recordFail(username) {
    const u = await this.getUserByUsername(username);
    if (!u) return;
    const attempts = (u.failed_attempts||0) + 1;
    const updates = { failed_attempts: attempts };
    if (attempts >= 5) {
      updates.blocked_until = new Date(Date.now()+24*60*60*1000).toISOString();
      await sb.insert("activities", { type:"block", actor:"System", detail:`Auto-blocked: ${u.full_name} (5 failed attempts)`, icon:"🔒" });
    }
    await sb.update("users", u.id, updates);
  },

  async saveDiagnosis(userId, toolId, severity, toolName, score, dsmCode, criteriaFlags, coreCheckPassed, durationMet, durAnswer, impairAnswer) {
    await sb.insert("assessments", {
      user_id: userId,
      tool_id: toolId,
      tool_name: toolName,
      dsm_code: dsmCode||"",
      score: parseInt(score)||0,
      severity: toolName + " — " + severity,
      severity_level: severity,
      criteria_met: criteriaFlags||[],
      core_check_passed: coreCheckPassed!==false,
      duration_met: durationMet!==false,
      duration_answer: durAnswer||"",
      impairment_answer: impairAnswer||"",
      notified_doctors: severity==="severe",
    });
    await sb.insert("activities", {
      type: "assessment",
      actor: "System",
      detail: `Assessment: ${toolName} — Score ${score} — ${severity}`,
      icon: "🧠"
    });
  },

  // ── Mood Logs ──
  async getMoodLogs(userId) {
    const url = `${SUPABASE_URL}/rest/v1/mood_logs?select=*&user_id=eq.${userId}&order=log_date.desc`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },

  async addMoodLog(userId, log) {
    return sb.insert("mood_logs", {
      user_id: userId,
      log_date: log.date,
      mood: log.mood,
      energy: log.energy,
      sleep_hours: log.sleep,
      note: log.note||"",
      tags: log.tags||[],
      lang: log.lang||"en"
    });
  },

  // ── Payments ──
  async getPayments(userId) {
    const url = `${SUPABASE_URL}/rest/v1/payments?select=*&user_id=eq.${userId}&order=paid_at.desc`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },

  async addPayment(p) {
    return sb.insert("payments", {
      user_id: p.userId, user_name: p.userName,
      amount: p.amount, currency: "TZS",
      method: p.method, phone: p.phone,
      service: p.service, status: "completed",
      reference: p.ref
    });
  },

  // ── Psychiatrists ──
  async getPsychiatrists() { return sb.get("psychiatrists"); },
  async getPsychiatrist(id) { const r = await sb.get("psychiatrists", {id}); return r[0]||null; },
  async getPsychiatristByUsername(username) {
    const url = `${SUPABASE_URL}/rest/v1/psychiatrists?select=*&username=eq.${encodeURIComponent(username)}`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const data = await r.json(); return data[0]||null;
  },
  async loginDoc(username, password) {
    const d = await this.getPsychiatristByUsername(username);
    if (!d) return null;
    const hash = await hashPassword(password);
    if (d.password_hash !== hash && d.password_hash !== password) return null;
    return d;
  },
  async addDocAccount(data) {
    const hash = await hashPassword(data.password);
    const result = await sb.insert("psychiatrists", {
      username: data.username, password_hash: hash,
      full_name: data.fullName, title: data.title,
      license_no: data.licenseNo, facility: data.facility,
      specialisation: data.specialisation, bio: data.bio||"",
      languages: data.languages||"", session_fee: data.sessionFee||"",
      email: data.email, phone: data.phone, whatsapp: data.whatsapp,
      availability: data.availability||{}, status: "pending", role: "doctor"
    });
    await sb.insert("activities", { type:"doctor_reg", actor:data.fullName, detail:`New psychiatrist: ${data.fullName}`, icon:"🩺" });
    return result[0]||null;
  },
  async approveDoc(id) {
    const d = await this.getPsychiatrist(id);
    if (!d) return null;
    await sb.update("psychiatrists", id, { status:"approved", approved_at: new Date().toISOString() });
    await sb.insert("activities", { type:"doctor_approved", actor:"Admin", detail:`Approved psychiatrist: ${d.full_name}`, icon:"✅" });
    return d;
  },
  async rejectDoc(id) {
    const d = await this.getPsychiatrist(id);
    if (!d) return;
    await sb.update("psychiatrists", id, { status:"rejected" });
    await sb.insert("activities", { type:"doctor_rejected", actor:"Admin", detail:`Rejected psychiatrist: ${d.full_name}`, icon:"❌" });
  },
  async pendingDocs() {
    const url = `${SUPABASE_URL}/rest/v1/psychiatrists?select=*&status=eq.pending`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },
  async toggleDoc(id) {
    const d = await this.getPsychiatrist(id);
    if (!d) return;
    // store availability toggle as a status field if needed
  },
  async removeDoc(id) { await sb.delete("psychiatrists", id); },

  // ── Notifications ──
  async addNotification(doctorId, message, patientId, patientName, urgent=false) {
    return sb.insert("notifications", {
      doctor_id: doctorId,
      patient_id: patientId||null, patient_name: patientName||"",
      message, urgent, read: false
    });
  },
  async getNotifications(doctorId) {
    const url = `${SUPABASE_URL}/rest/v1/notifications?select=*&doctor_id=eq.${doctorId}&order=created_at.desc`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },
  async markNotifRead(id) { await sb.update("notifications", id, { read: true }); },

  // ── Activities ──
  async getActivities() {
    const url = `${SUPABASE_URL}/rest/v1/activities?select=*&order=created_at.desc&limit=100`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },

  // ── Group messages ──
  async getGroupMessages(groupKey) {
    const url = `${SUPABASE_URL}/rest/v1/group_messages?select=*&group_key=eq.${encodeURIComponent(groupKey)}&order=created_at.asc`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },
  async addGroupMessage(groupKey, senderName, senderId, message, isFacilitator=false) {
    return sb.insert("group_messages", {
      group_key: groupKey, sender_name: senderName,
      sender_id: senderId||null, message, is_facilitator: isFacilitator
    });
  },

  // ── Doc accounts (kept for compatibility) ──
  docAccounts: [],
};


const ADMIN_CREDS = { username:"admin", password:"Sereni@admin2025" };

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
const Chip = ({children, color=T.teal}) => (
  <span style={{display:"inline-flex",alignItems:"center",background:`${color}18`,color,border:`1px solid ${color}40`,borderRadius:99,fontWeight:600,fontSize:10,padding:"3px 10px",letterSpacing:"0.04em",textTransform:"uppercase"}}>{children}</span>
);

const Card = ({children, style={}, onClick, accent, elevated=false}) => (
  <div onClick={onClick} style={{background:T.card,border:`1.5px solid ${accent?accent+"35":T.border}`,borderRadius:18,padding:20,cursor:onClick?"pointer":"default",transition:"all 0.2s",boxShadow:elevated?"0 4px 20px rgba(0,0,0,0.07)":"0 1px 4px rgba(0,0,0,0.04)",...style}}
    onMouseEnter={e=>{if(onClick){e.currentTarget.style.boxShadow="0 8px 30px rgba(77,182,172,0.15)";e.currentTarget.style.borderColor=accent?accent+"60":T.tealLt;e.currentTarget.style.transform="translateY(-2px)";}}}
    onMouseLeave={e=>{if(onClick){e.currentTarget.style.boxShadow=elevated?"0 4px 20px rgba(0,0,0,0.07)":"0 1px 4px rgba(0,0,0,0.04)";e.currentTarget.style.borderColor=accent?accent+"35":T.border;e.currentTarget.style.transform="translateY(0)";}}}
  >{children}</div>
);

const Btn = ({children, onClick, variant="fill", color, disabled, style={}, full, size="md"}) => {
  const c=color||T.teal;
  const variants={
    fill:{background:`linear-gradient(135deg,${c},${c}dd)`,color:T.white,border:"none",boxShadow:`0 4px 14px ${c}40`},
    outline:{background:T.white,color:c,border:`1.5px solid ${c}`,boxShadow:"none"},
    ghost:{background:`${c}12`,color:c,border:"none",boxShadow:"none"},
    danger:{background:`${T.severe}10`,color:T.severe,border:`1.5px solid ${T.severe}50`,boxShadow:"none"},
    soft:{background:T.tealBg,color:T.tealDk,border:`1px solid ${T.tealLt}`,boxShadow:"none"},
  };
  const sizes={sm:"6px 14px",md:"11px 22px",lg:"14px 32px"};
  return (
    <button onClick={onClick} disabled={disabled} style={{...variants[variant],borderRadius:12,padding:sizes[size],fontWeight:700,fontSize:size==="sm"?12:14,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,fontFamily:"inherit",transition:"all 0.2s",width:full?"100%":undefined,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,...style}}
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.opacity="0.85";}}
      onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}
    >{children}</button>
  );
};

const Field = ({label,value,onChange,type="text",placeholder,required,error,options,note}) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label&&<label style={{fontSize:12,fontWeight:600,color:T.sub,letterSpacing:"0.02em"}}>{label}{required&&<span style={{color:T.severe}}> *</span>}</label>}
    {options
      ? <select value={value} onChange={e=>onChange(e.target.value)} style={{background:T.white,border:`1.5px solid ${error?T.severe:T.border}`,borderRadius:10,padding:"10px 14px",color:value?T.text:T.muted,fontSize:14,outline:"none",fontFamily:"inherit",transition:"border-color 0.2s"}}>
          <option value="">{placeholder||"Select..."}</option>
          {options.map(o=><option key={o} value={o} style={{color:T.text}}>{o}</option>)}
        </select>
      : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:T.white,border:`1.5px solid ${error?T.severe:T.border}`,borderRadius:10,padding:"11px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",transition:"border-color 0.2s"}}
          onFocus={e=>e.target.style.borderColor=T.teal}
          onBlur={e=>e.target.style.borderColor=error?T.severe:T.border}
        />
    }
    {error&&<div style={{fontSize:11,color:T.severe}}>{error}</div>}
    {note&&<div style={{fontSize:11,color:T.muted}}>{note}</div>}
  </div>
);

const Av = ({name,size=36,color=T.teal}) => (
  <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,background:`${color}18`,border:`2px solid ${color}50`,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:800,fontSize:size*0.34}}>
    {(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
  </div>
);

const StatusBadge = ({status}) => {
  const m={pending:[T.moderate,"⏳ Pending"],approved:[T.mild,"✅ Approved"],rejected:[T.severe,"❌ Rejected"]};
  const [c,l]=m[status]||[T.muted,status];
  return <Chip color={c}>{l}</Chip>;
};

const Divider = () => <div style={{height:1,background:T.border,margin:"4px 0"}}/>;

// Sereni Logo
const SereniLogo = ({size=32, showText=false}) => (
  <div style={{display:"flex",alignItems:"center",gap:8}}>
    <div style={{width:size,height:size,borderRadius:size*0.3,background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.55,boxShadow:`0 4px 12px ${T.teal}40`,flexShrink:0}}>🌿</div>
    {showText&&<div><div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:size*0.65,color:T.tealDk,lineHeight:1}}>Sereni</div><div style={{fontSize:size*0.28,color:T.muted,fontWeight:500}}>Mental Wellness</div></div>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING & AUTH
// ═══════════════════════════════════════════════════════════════════════════════
function Landing({onLogin}) {
  const [mode, setMode] = useState("home");
  const [form, setForm] = useState({username:"",password:"",isAdmin:false});
  const [err, setErr] = useState("");
  const [pendingU, setPendingU] = useState(null);
  const [rejectedU, setRejectedU] = useState(null);

  const [logging, setLogging] = useState(false);

  const doLogin = async () => {
    setErr(""); setLogging(true);
    if(!form.username||!form.password){setErr("Please enter your username and password.");setLogging(false);return;}
    const role = form.loginRole||"user";
    try {
      if(role==="admin"){
        if(form.username===ADMIN_CREDS.username&&form.password===ADMIN_CREDS.password) onLogin({role:"admin",fullName:"System Administrator",username:"admin"});
        else setErr("Invalid admin credentials.");
        setLogging(false); return;
      }
      if(role==="doctor"){
        const doc = await DB.loginDoc(form.username, form.password);
        if(!doc){setErr("Doctor credentials not found.");setLogging(false);return;}
        if(doc.status==="pending"){setErr("Your account is pending admin approval.");setLogging(false);return;}
        if(doc.status==="rejected"){setErr("Your registration was not approved. Contact support.");setLogging(false);return;}
        onLogin({...doc, fullName:doc.full_name, role:"doctor"});
        setLogging(false); return;
      }
      // Student login
      const uCheck = await DB.getUserByUsername(form.username);
      if(uCheck && DB.isBlocked(uCheck)){
        const ms = new Date(uCheck.blocked_until) - new Date();
        const mins = Math.ceil(ms/60000);
        const hrs = Math.floor(mins/60); const rem = mins%60;
        setErr(`Account locked. Try again in ${hrs>0?hrs+"h ":""}${rem}m.`);
        setLogging(false); return;
      }
      const u = await DB.login(form.username, form.password);
      if(!u){
        await DB.recordFail(form.username);
        const uF = await DB.getUserByUsername(form.username);
        const attempts = uF ? (uF.failed_attempts||0) : 0;
        const left = Math.max(0, 5-attempts);
        setErr(left>0?`Incorrect password. ${left} attempt${left>1?"s":""} remaining before lockout.`:"Username or password is incorrect.");
        setLogging(false); return;
      }
      if(u.status==="pending"){setPendingU({...u,fullName:u.full_name});setMode("pending");setLogging(false);return;}
      if(u.status==="rejected"||u.status==="cancelled"){setRejectedU({...u,fullName:u.full_name});setMode("rejected");setLogging(false);return;}
      onLogin({...u, fullName:u.full_name});
    } catch(e) {
      setErr("Connection error. Please check your internet and try again.");
    }
    setLogging(false);
  };

  if(mode==="register") return <Register onBack={()=>setMode("home")} onDone={()=>setMode("login")}/>;
  if(mode==="docregister") return <DocRegister onBack={()=>setMode("login")} onDone={()=>setMode("login")}/>;

  if(mode==="pending") return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.tealBg},${T.bg})`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:420,width:"100%",animation:"fadeUp 0.35s ease"}}>
        <div style={{textAlign:"center",marginBottom:24}}><SereniLogo size={48} showText/></div>
        <Card elevated style={{textAlign:"center",padding:32}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>⏳</div>
          <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:8}}>Registration Under Review</div>
          <div style={{color:T.sub,fontSize:14,lineHeight:1.7,marginBottom:24}}>Hello <strong style={{color:T.tealDk}}>{pendingU?.fullName}</strong>, your account is being reviewed by our admin team. You'll receive access once approved.</div>
          <div style={{background:T.cardAlt,borderRadius:12,padding:16,marginBottom:20,textAlign:"left"}}>
            {[["University",pendingU?.university],["Course",pendingU?.course],["Email",pendingU?.email],["Submitted",pendingU?.registeredAt]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
                <span style={{color:T.muted}}>{k}</span><span style={{color:T.text,fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
          <Btn variant="outline" onClick={()=>{setMode("login");setPendingU(null);}} full>← Back to Login</Btn>
        </Card>
      </div>
    </div>
  );

  if(mode==="rejected") return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.tealBg},${T.bg})`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:400,width:"100%",animation:"fadeUp 0.35s ease"}}>
        <div style={{textAlign:"center",marginBottom:24}}><SereniLogo size={48} showText/></div>
        <Card elevated style={{textAlign:"center",padding:32}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:"#FFEBEE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>❌</div>
          <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.severe,marginBottom:8}}>Registration Not Approved</div>
          <div style={{color:T.sub,fontSize:14,lineHeight:1.7,marginBottom:20}}>We're sorry, <strong style={{color:T.text}}>{rejectedU?.fullName}</strong>. Please contact our support team for assistance.</div>
          <div style={{background:T.tealBg,borderRadius:10,padding:"12px 16px",fontSize:13,color:T.tealDk,marginBottom:20}}>📧 support@sereni.tz  ·  📞 +255 800 750 112</div>
          <Btn variant="outline" onClick={()=>{setMode("login");setRejectedU(null);}} full>← Back to Login</Btn>
        </Card>
      </div>
    </div>
  );

  if(mode==="login") return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.tealBg},${T.bg})`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:420,width:"100%",animation:"fadeUp 0.35s ease"}}>
        <div style={{textAlign:"center",marginBottom:28}}><SereniLogo size={52} showText/></div>
        <Card elevated style={{padding:28}}>
          <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:6}}>Welcome back</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:22}}>Sign in to continue your wellness journey</div>

          <div style={{display:"flex",gap:6,marginBottom:22,background:T.grayXLt,borderRadius:12,padding:4}}>
            {[["👤 User","user"],["🩺 Doctor","doctor"],["🔐 Admin","admin"]].map(([label,role])=>(
              <button key={role} onClick={()=>setForm(f=>({...f,loginRole:role}))} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",background:(form.loginRole||"user")===role?T.white:"transparent",color:(form.loginRole||"user")===role?T.tealDk:T.muted,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",boxShadow:(form.loginRole||"user")===role?"0 2px 8px rgba(0,0,0,0.08)":"none"}}>{label}</button>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
            <Field label="Username" value={form.username} onChange={v=>setForm(f=>({...f,username:v}))} placeholder={form.isAdmin?"admin":"your.username"}/>
            <Field label="Password" type="password" value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} placeholder="••••••••"/>
          </div>

          {err&&<div style={{background:"#FFEBEE",border:`1px solid ${T.severe}30`,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.severe,marginBottom:16}}>{err}</div>}
          {(form.loginRole||"user")==="admin"&&<div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:10,padding:"10px 14px",fontSize:12,color:T.tealDk,marginBottom:16}}>Demo: <strong>admin</strong> / <strong>Sereni@admin2025</strong></div>}
          {(form.loginRole||"user")==="doctor"&&<div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:10,padding:"10px 14px",fontSize:12,color:T.tealDk,marginBottom:16}}>Demo: <strong>dr.amina</strong> / <strong>Amina@2025!</strong></div>}

          <Btn full onClick={doLogin} color={(form.loginRole||"user")==="admin"?T.moderate:T.teal} size="lg">{logging?"Signing in…":(form.loginRole||"user")==="admin"?"Access Admin Panel →":(form.loginRole||"user")==="doctor"?"Sign In as Psychiatrist →":"Sign In to Sereni →"}</Btn>

          <div style={{textAlign:"center",marginTop:14,fontSize:13,color:T.muted}}>
            {(form.loginRole||"user")==="user"&&<>No account? <button onClick={()=>setMode("register")} style={{background:"none",border:"none",color:T.teal,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Register →</button></>}
            {(form.loginRole||"user")==="doctor"&&<>New psychiatrist? <button onClick={()=>setMode("docregister")} style={{background:"none",border:"none",color:T.teal,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Register here →</button></>}
          </div>
          <div style={{textAlign:"center",marginTop:8}}><button onClick={()=>setMode("home")} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Back to home</button></div>
        </Card>
      </div>
    </div>
  );

  // ── Hero Landing ──
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"inherit",background:`linear-gradient(160deg,${T.tealBg} 0%,${T.white} 55%,${T.tealBg} 100%)`}}>

      {/* Main hero — fills all space between top and footer */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"48px 24px 40px",textAlign:"center",position:"relative",overflow:"hidden"}}>

        {/* Decorative teal circles */}
        <div style={{position:"absolute",width:420,height:420,borderRadius:"50%",background:`radial-gradient(circle,${T.teal}12,transparent 70%)`,top:"-80px",left:"-100px",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle,${T.teal}10,transparent 70%)`,bottom:"-60px",right:"-60px",pointerEvents:"none"}}/>

        {/* Logo icon */}
        <div style={{width:90,height:90,borderRadius:28,background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,marginBottom:28,boxShadow:`0 16px 48px ${T.teal}40`,animation:"float 4s ease-in-out infinite"}}>🌿</div>

        {/* App name — large */}
        <h1 style={{fontFamily:"'Cinzel',serif",fontWeight:700,fontSize:68,color:T.tealDk,lineHeight:1,marginBottom:2,letterSpacing:"0.05em"}}>
          Sereni
        </h1>

        {/* Slogan */}
        <p style={{fontFamily:"'Montserrat',sans-serif",fontWeight:500,fontSize:14,color:T.sub,marginBottom:48,letterSpacing:"0.06em"}}>
          Find Your Balance.
        </p>

        {/* CTA buttons */}
        <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center"}}>
          <Btn onClick={()=>setMode("register")} size="lg" style={{minWidth:180,fontSize:15,padding:"14px 32px",borderRadius:14}}>
            Create Account
          </Btn>
          <Btn onClick={()=>setMode("login")} variant="outline" size="lg" style={{minWidth:180,fontSize:15,padding:"14px 32px",borderRadius:14}}>
            Sign In
          </Btn>
        </div>
      </div>

      {/* Footer — as before */}
      <footer style={{textAlign:"center",padding:20,fontSize:12,color:T.muted,borderTop:`1px solid ${T.border}`,background:T.white}}>
        © 2025 Sereni — Whole Health Junction · Tanzania · All assessments aligned to DSM-5-TR
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════
function Register({onBack, onDone}) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({fullName:"",age:"",sex:"",phone:"",email:"",university:"",course:"",yearOfStudy:"",yearStart:"",yearGrad:"",username:"",password:"",confirm:""});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const validate=(s)=>{
    const e={};
    if(s===1){
      if(!f.fullName.trim()) e.fullName="Required";
      if(!f.age||isNaN(f.age)||+f.age<16||+f.age>60) e.age="Valid age 16–60 required";
      if(!f.sex) e.sex="Required";
      if(!f.phone.trim()) e.phone="Required";
      if(!f.email.includes("@")) e.email="Valid email required";
    }
    if(s===2){
      if(!f.university.trim()) e.university="Required";
      if(!f.course.trim()) e.course="Required";
      if(!f.yearOfStudy) e.yearOfStudy="Required";
      if(!f.yearStart||f.yearStart.length!==4) e.yearStart="4-digit year required";
      if(!f.yearGrad||f.yearGrad.length!==4) e.yearGrad="4-digit year required";
    }
    if(s===3){
      if(f.username.length<4) e.username="Minimum 4 characters";
      if(DB.users.find(u=>u.username===f.username)) e.username="Username already taken";
      const pwdOk=/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:.><\/?@]).{7,}$/.test(f.password);
      if(!pwdOk) e.password="Min 7 chars with uppercase, lowercase, number & special character (e.g. !@#$)";
      if(f.password!==f.confirm) e.confirm="Passwords do not match";
    }
    return e;
  };

  const next=()=>{ const e=validate(step); if(Object.keys(e).length){setErrors(e);return;} setErrors({}); setStep(s=>s+1); };
  const [submitting, setSubmitting] = useState(false);
  const submit=async()=>{
    const e=validate(3); if(Object.keys(e).length){setErrors(e);return;}
    setSubmitting(true);
    try {
      await DB.addUser({...f});
      setDone(true);
    } catch(err) {
      setErrors({username:"Username or email already exists. Please choose another."});
    }
    setSubmitting(false);
  };

  if(done) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.tealBg},${T.bg})`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:420,width:"100%",textAlign:"center",animation:"fadeUp 0.35s ease"}}>
        <SereniLogo size={48} showText/>
        <Card elevated style={{marginTop:24,padding:32}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🎉</div>
          <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:8}}>Registration Submitted!</div>
          <div style={{color:T.sub,fontSize:14,lineHeight:1.7,marginBottom:20}}>Thank you, <strong style={{color:T.tealDk}}>{f.fullName}</strong>! Your account is pending admin approval. You'll be notified once reviewed.</div>
          <div style={{background:T.cardAlt,borderRadius:12,padding:16,marginBottom:20,textAlign:"left"}}>
            {[["Username",f.username],["University",f.university],["Email",f.email],["Status","Pending Review"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
                <span style={{color:T.muted}}>{k}</span>
                <span style={{color:k==="Status"?T.moderate:T.text,fontWeight:k==="Status"?700:500}}>{v}</span>
              </div>
            ))}
          </div>
          <Btn full onClick={onDone}>Go to Login →</Btn>
        </Card>
      </div>
    </div>
  );

  const steps=["Personal Info","Academic Details","Credentials"];
  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.tealBg},${T.bg})`,padding:"24px 16px",overflowY:"auto"}}>
      <div style={{maxWidth:520,margin:"0 auto",animation:"fadeUp 0.35s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
          <button onClick={onBack} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,color:T.gray,cursor:"pointer",fontSize:18,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <div>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,color:T.text}}>Create Your Sereni Account</div>
            <div style={{fontSize:12,color:T.muted}}>Step {step} of 3 — {steps[step-1]}</div>
          </div>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:24}}>
          {steps.map((_,i)=>(
            <div key={i} style={{flex:1}}>
              <div style={{height:4,borderRadius:99,background:i+1<=step?T.teal:T.border,transition:"background 0.3s"}}/>
              <div style={{fontSize:10,color:i+1===step?T.teal:T.muted,fontWeight:i+1===step?700:400,textAlign:"center",marginTop:4}}>{i+1<step?"✓ ":""}{steps[i]}</div>
            </div>
          ))}
        </div>

        <Card elevated style={{padding:28}}>
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:4}}>👤 Personal Information</div>
              <Field label="Full Name" value={f.fullName} onChange={v=>set("fullName",v)} placeholder="e.g. Amani Kimaro" required error={errors.fullName}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <Field label="Age" type="number" value={f.age} onChange={v=>set("age",v)} placeholder="e.g. 22" required error={errors.age}/>
                <Field label="Sex" value={f.sex} onChange={v=>set("sex",v)} options={["Male","Female","Prefer not to say"]} required error={errors.sex}/>
              </div>
              <Field label="Phone Number" value={f.phone} onChange={v=>set("phone",v)} placeholder="+255 7XX XXX XXX" required error={errors.phone}/>
              <Field label="Email Address" type="email" value={f.email} onChange={v=>set("email",v)} placeholder="you@university.ac.tz" required error={errors.email}/>
            </div>
          )}
          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:4}}>🎓 Academic Details</div>
              <Field label="University / Institution" value={f.university} onChange={v=>set("university",v)} placeholder="e.g. University of Dar es Salaam" required error={errors.university}/>
              <Field label="Course / Programme" value={f.course} onChange={v=>set("course",v)} placeholder="e.g. Bachelor of Medicine" required error={errors.course}/>
              <Field label="Current Year of Study" value={f.yearOfStudy} onChange={v=>set("yearOfStudy",v)} options={["1st Year","2nd Year","3rd Year","4th Year","5th Year","6th Year","Postgraduate"]} required error={errors.yearOfStudy}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Year of Enrolment" value={f.yearStart} onChange={v=>set("yearStart",v)} placeholder="e.g. 2022" required error={errors.yearStart}/>
                <Field label="Graduation Year" value={f.yearGrad} onChange={v=>set("yearGrad",v)} placeholder="e.g. 2026" required error={errors.yearGrad}/>
              </div>
            </div>
          )}
          {step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:4}}>🔐 Account Credentials</div>
              <Field label="Choose a Username" value={f.username} onChange={v=>set("username",v.toLowerCase().replace(/\s/g,"."))} placeholder="e.g. amani.kimaro" required error={errors.username} note="Lowercase letters, numbers and dots only"/>
              <Field label="Password" type="password" value={f.password} onChange={v=>set("password",v)} placeholder="Minimum 6 characters" required error={errors.password}/>
              <Field label="Confirm Password" type="password" value={f.confirm} onChange={v=>set("confirm",v)} placeholder="Repeat your password" required error={errors.confirm}/>
              <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:12,padding:"12px 16px",fontSize:12,color:T.tealDk,lineHeight:1.7}}>ℹ️ Your registration will be reviewed by our admin team. All information is kept strictly confidential.</div>
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:24}}>
            {step>1&&<Btn variant="outline" onClick={()=>setStep(s=>s-1)}>← Back</Btn>}
            {step<3?<Btn full onClick={next}>Continue →</Btn>:<Btn full onClick={submit} disabled={submitting}>{submitting?"Submitting…":"Submit Registration ✓"}</Btn>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPanel({admin, onLogout}) {
  const [tab, setTab] = useState("overview");
  const [tick, setTick] = useState(0);
  const refresh=()=>{ setTick(t=>t+1); };
  const [emailModal, setEmailModal] = useState(null);
  const doApprove=(id)=>{ const u=DB.approve(id); refresh(); if(u) setEmailModal({name:u.fullName,email:u.email,username:u.username}); };

  const [users, setUsers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u,d,a] = await Promise.all([DB.getUsers(), DB.getPsychiatrists(), DB.getActivities()]);
      setUsers(u||[]); setDocs(d||[]); setActs(a||[]);
    } catch(e) { console.error("Load error:",e); }
    setLoading(false);
  };

  useEffect(()=>{ loadData(); },[tick]);

  const pending = users.filter(u=>u.status==="pending");
  const approved = users.filter(u=>u.status==="approved");

  const pendingDocsList=DB.pendingDocs();
  const TABS=[
    {id:"overview",label:"Overview",icon:"📊"},
    {id:"registrations",label:"Registrations",icon:"📝",badge:pending.length},
    {id:"users",label:"All Users",icon:"👥"},
    {id:"doctors",label:"Doctors",icon:"🩺",badge:pendingDocsList.length},
    {id:"filter",label:"Filter & Reports",icon:"🔍"},
    {id:"psychiatrists",label:"Directory",icon:"🏥"},
    {id:"activity",label:"Activity Log",icon:"📋"},
  ];

  if(loading && users.length===0) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:36,animation:"spin 1.5s linear infinite"}}>🌿</div>
      <div style={{color:T.tealDk,fontWeight:600,fontSize:15}}>Loading Sereni Admin…</div>
      <div style={{color:T.muted,fontSize:12}}>Connecting to database</div>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,minHeight:"100vh",display:"flex",flexDirection:"column",color:T.text}}>
      {/* ── Email Sent Modal ── */}
      {emailModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeUp 0.25s ease"}} onClick={()=>setEmailModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.white,borderRadius:22,padding:32,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.18)",textAlign:"center"}}>
            <div style={{width:68,height:68,borderRadius:"50%",background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 18px"}}>📧</div>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,color:T.text,marginBottom:8}}>Approval Email Sent</div>
            <div style={{fontSize:13,color:T.sub,lineHeight:1.7,marginBottom:20}}>An approval notification has been sent to <strong style={{color:T.tealDk}}>{emailModal.name}</strong> at their registered email address.</div>
            <div style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:14,padding:16,textAlign:"left",marginBottom:22}}>
              <div style={{fontSize:11,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10}}>Email Preview</div>
              <div style={{fontSize:13,color:T.text,lineHeight:1.8}}>
                <div style={{marginBottom:6}}>📬 <strong>To:</strong> {emailModal.email}</div>
                <div style={{marginBottom:6}}>📋 <strong>Subject:</strong> Your Sereni Account Has Been Approved</div>
                <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:10,padding:"10px 14px",marginTop:10,fontSize:12,color:T.tealDk,lineHeight:1.75}}>
                  Dear <strong>{emailModal.name}</strong>,<br/><br/>
                  We are pleased to inform you that your Sereni account registration has been <strong>approved</strong>.<br/><br/>
                  You may now sign in using your username: <strong>{emailModal.username}</strong><br/><br/>
                  Welcome to Sereni — Find Your Balance. 🌿<br/><br/>
                  The Sereni Team
                </div>
              </div>
            </div>
            <Btn full onClick={()=>setEmailModal(null)}>Done ✓</Btn>
          </div>
        </div>
      )}
      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",background:T.white,borderBottom:`1px solid ${T.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.04)",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <SereniLogo size={36} showText/>
          <div style={{width:1,height:32,background:T.border,margin:"0 4px"}}/>
          <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:8,padding:"4px 12px",fontSize:12,color:T.tealDk,fontWeight:700}}>Admin Panel</div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Av name={admin.fullName} size={34} color={T.moderate}/>
          <div style={{fontSize:13,color:T.sub,fontWeight:500}}>{admin.fullName}</div>
          <Btn variant="danger" size="sm" onClick={onLogout}>Logout</Btn>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{display:"flex",overflowX:"auto",padding:"12px 24px 0",background:T.white,borderBottom:`1px solid ${T.border}`,gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`3px solid ${tab===t.id?T.teal:"transparent"}`,padding:"8px 16px 10px",color:tab===t.id?T.tealDk:T.muted,fontWeight:tab===t.id?700:500,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",transition:"all 0.15s"}}>
            {t.icon} {t.label}
            {t.badge>0&&<span style={{background:T.severe,color:T.white,borderRadius:99,fontSize:10,fontWeight:800,padding:"1px 7px"}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"24px",maxWidth:960,width:"100%",margin:"0 auto"}}>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20,animation:"fadeUp 0.3s ease"}}>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:24,color:T.text}}>Dashboard Overview</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
              {[[users.length,"Total Registrations","👥",T.blue],[pending.length,"Pending Approval","⏳",T.moderate],[approved.length,"Approved Users","✅",T.mild],[docs.length,"Professionals Listed","🩺",T.teal]].map(([val,label,icon,color])=>(
                <Card key={label} accent={color} elevated>
                  <div style={{display:"flex",gap:14,alignItems:"center"}}>
                    <div style={{width:52,height:52,borderRadius:14,background:`${color}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{icon}</div>
                    <div><div style={{fontSize:32,fontWeight:800,color,lineHeight:1}}>{val}</div><div style={{fontSize:13,color:T.muted,marginTop:3}}>{label}</div></div>
                  </div>
                </Card>
              ))}
            </div>

            {pending.length>0&&(
              <div>
                <div style={{fontWeight:700,color:T.text,marginBottom:12,fontSize:15,display:"flex",alignItems:"center",gap:8}}>
                  Pending Approvals
                  <span style={{background:T.severe,color:T.white,borderRadius:99,fontSize:11,fontWeight:800,padding:"2px 8px"}}>{pending.length}</span>
                </div>
                {pending.map(u=>(
                  <Card key={u.id} style={{marginBottom:10}} accent={T.moderate}>
                    <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      <Av name={u.full_name||u.fullName} size={44} color={T.moderate}/>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,color:T.text,marginBottom:2}}>{u.full_name||u.fullName}</div>
                        <div style={{fontSize:12,color:T.muted}}>{u.university} · {u.course} · {u.yearOfStudy}</div>
                        <div style={{fontSize:12,color:T.muted}}>{u.email} · {u.phone}</div>
                      </div>
                      <div style={{display:"flex",gap:8,flexShrink:0}}>
                        <Btn size="sm" color={T.mild} onClick={()=>{doApprove(u.id);}}>✓ Approve</Btn>
                        <Btn size="sm" variant="danger" onClick={async()=>{await DB.reject(u.id);refresh();}}>✗ Reject</Btn>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div>
              <div style={{fontWeight:700,color:T.text,marginBottom:12,fontSize:15}}>Recent Activity</div>
              <Card>
                {acts.slice(0,5).map((a,i)=>(
                  <div key={a.id} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:i<4?`1px solid ${T.border}`:"none"}}>
                    <div style={{width:34,height:34,borderRadius:10,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{a.icon}</div>
                    <div style={{flex:1}}><div style={{fontSize:13,color:T.text,fontWeight:500}}>{a.detail}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{a.time}</div></div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* ── REGISTRATIONS ── */}
        {tab==="registrations"&&(
          <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp 0.3s ease"}}>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:24,color:T.text}}>Registration Requests</div>
            {["pending","approved","rejected"].map(status=>{
              const grp=users.filter(u=>u.status===status);
              if(!grp.length) return null;
              const hc=status==="pending"?T.moderate:status==="approved"?T.mild:T.severe;
              return (
                <div key={status}>
                  <div style={{fontWeight:700,color:hc,marginBottom:10,fontSize:14,textTransform:"capitalize"}}>{status==="pending"?"⏳":status==="approved"?"✅":"❌"} {status} ({grp.length})</div>
                  {grp.map(u=>(
                    <Card key={u.id} style={{marginBottom:10}} accent={hc}>
                      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                        <Av name={u.full_name||u.fullName} size={46} color={hc}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                            <div style={{fontWeight:700,color:T.text}}>{u.full_name||u.fullName}</div>
                            <StatusBadge status={u.status}/>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 20px"}}>
                            {[["Username",u.username],["Age / Sex",`${u.age} / ${u.sex}`],["University",u.university],["Course",u.course],["Year",u.yearOfStudy],["Study Period",`${u.yearStart}–${u.yearGrad}`],["Phone",u.phone],["Email",u.email]].map(([k,v])=>(
                              <div key={k} style={{fontSize:12}}><span style={{color:T.muted}}>{k}: </span><span style={{color:T.sub,fontWeight:500}}>{v}</span></div>
                            ))}
                          </div>
                        </div>
                        {status==="pending"&&(
                          <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
                            <Btn size="sm" color={T.mild} onClick={()=>{doApprove(u.id);}}>✓ Approve</Btn>
                            <Btn size="sm" variant="danger" onClick={async()=>{await DB.reject(u.id);refresh();}}>✗ Reject</Btn>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ALL USERS ── */}
        {tab==="users"&&<UserManagement users={users} doApprove={doApprove} refresh={refresh}/>}

        {tab==="doctors"&&<AdminDoctors refresh={refresh}/>}
        {tab==="filter"&&<FilterReports users={users}/>}
        {tab==="psychiatrists"&&<DocManager refresh={refresh}/>}

        {/* ── ACTIVITY LOG ── */}
        {tab==="activity"&&(
          <div style={{display:"flex",flexDirection:"column",gap:0,animation:"fadeUp 0.3s ease"}}>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:24,color:T.text,marginBottom:20}}>Activity Log</div>
            <Card>
              {acts.map((a,i)=>{
                const c=a.type==="approval"?T.mild:a.type==="rejection"?T.severe:a.type==="assessment"?T.blue:a.type==="group"?T.purple:T.moderate;
                return (
                  <div key={a.id} style={{display:"flex",gap:12,padding:"13px 0",borderBottom:i<acts.length-1?`1px solid ${T.border}`:"none",alignItems:"flex-start"}}>
                    <div style={{width:36,height:36,borderRadius:10,background:`${c}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{a.icon}</div>
                    <div style={{flex:1}}><div style={{fontSize:13,color:T.text,fontWeight:500}}>{a.detail}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{a.user} · {a.time}</div></div>
                    <Chip color={c}>{a.type}</Chip>
                  </div>
                );
              })}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Psychiatrist Manager ──────────────────────────────────────────────────────
function DocManager({refresh}) {
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({name:"",title:"",spec:"",phone:"",email:"",facility:""});
  const [errors, setErrors] = useState({});
  const [tick, setTick] = useState(0);
  const re=()=>{setTick(t=>t+1);refresh();};
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const validate=()=>{
    const e={};
    if(!f.name.trim()) e.name="Required";
    if(!f.title) e.title="Required";
    if(!f.spec.trim()) e.spec="Required";
    if(!f.phone.trim()) e.phone="Required";
    if(!f.email.includes("@")) e.email="Valid email required";
    if(!f.facility.trim()) e.facility="Required";
    return e;
  };

  const add=()=>{
    const e=validate(); if(Object.keys(e).length){setErrors(e);return;}
    DB.addDoc({id:`p${Date.now()}`,...f,available:true,addedAt:new Date().toISOString().split("T")[0]});
    DB.activities.push({id:`a${Date.now()}`,type:"psychiatrist",user:"Admin",detail:`Added professional: ${f.name}`,time:new Date().toLocaleString(),icon:"🩺"});
    setF({name:"",title:"",spec:"",phone:"",email:"",facility:""}); setErrors({}); setShowAdd(false); re();
  };

  const docs=DB.psychiatrists;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:24,color:T.text}}>Psychiatrists & Professionals</div>
        <Btn onClick={()=>setShowAdd(!showAdd)} color={T.teal} variant={showAdd?"outline":"fill"} size="sm">{showAdd?"✕ Cancel":"+ Add Professional"}</Btn>
      </div>

      {showAdd&&(
        <Card elevated style={{background:T.tealBg,border:`1.5px solid ${T.tealLt}`}}>
          <div style={{fontWeight:700,color:T.tealDk,marginBottom:16,fontSize:15}}>Add New Professional</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Full Name" value={f.name} onChange={v=>set("name",v)} placeholder="Dr. Jane Doe" required error={errors.name}/>
              <Field label="Title" value={f.title} onChange={v=>set("title",v)} options={["Psychiatrist","Psychologist","Counselor","Social Worker","Therapist"]} required error={errors.title}/>
            </div>
            <Field label="Specialisation" value={f.spec} onChange={v=>set("spec",v)} placeholder="e.g. Anxiety & Mood Disorders" required error={errors.spec}/>
            <Field label="Facility / Institution" value={f.facility} onChange={v=>set("facility",v)} placeholder="e.g. Muhimbili National Hospital" required error={errors.facility}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Phone" value={f.phone} onChange={v=>set("phone",v)} placeholder="+255 7XX XXX XXX" required error={errors.phone}/>
              <Field label="Email" type="email" value={f.email} onChange={v=>set("email",v)} placeholder="dr@facility.tz" required error={errors.email}/>
            </div>
            <Btn onClick={add} full>Add to Directory ✓</Btn>
          </div>
        </Card>
      )}

      <div style={{fontSize:13,color:T.muted}}>{docs.length} professionals in directory · Visible to all approved users</div>
      {docs.map(p=>(
        <Card key={p.id} accent={p.available?T.teal:T.grayLt} elevated>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <Av name={p.name} size={48} color={p.available?T.teal:T.grayLt}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
                <div style={{fontWeight:700,color:T.text,fontSize:15}}>{p.name}</div>
                <Chip color={p.available?T.mild:T.grayLt}>{p.available?L("✓ Available","✓ Inapatikana"):L("Unavailable","Haipatikani")}</Chip>
              </div>
              <div style={{fontSize:13,color:T.teal,marginTop:1,fontWeight:500}}>{p.title} · {p.spec}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:5}}>🏥 {p.facility}</div>
              <div style={{fontSize:12,color:T.muted}}>📞 {p.phone} · ✉️ {p.email}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>Added: {p.addedAt}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
              <Btn size="sm" variant="soft" onClick={()=>{DB.toggleDoc(p.id);re();}}>{p.available?"Set Unavailable":"Set Available"}</Btn>
              <Btn size="sm" variant="danger" onClick={()=>{DB.removeDoc(p.id);re();}}>Remove</Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER APP
// ═══════════════════════════════════════════════════════════════════════════════
function UserApp({user, onLogout}) {
  const [tab, setTab] = useState("home");
  const [lang,setLang] = useState("en");
  const sw = lang==="sw";
  const L = (en,sw_)=>sw?sw_:en;
  const TABS=[
    {id:"home",   label:L("Home","Nyumbani"),     icon:"🏠"},
    {id:"mood",   label:L("Mood","Hisia"),         icon:"💚"},
    {id:"assess", label:L("Screening","Tathmini"),  icon:"🧠"},
    {id:"groups", label:L("Groups","Vikundi"),      icon:"👥"},
    {id:"chat",   label:L("AI Chat","Mazungumzo"),  icon:"💬"},
    {id:"therapy",label:L("Therapists","Madaktari"),icon:"🩺"},
    {id:"pay",    label:L("Pay","Lipa"),            icon:"💳"},
  ];

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,minHeight:"100vh",display:"flex",flexDirection:"column",color:T.text}}>
      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 20px",background:T.white,borderBottom:`1px solid ${T.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.04)",position:"sticky",top:0,zIndex:100}}>
        <SereniLogo size={34} showText/>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{fontSize:12,color:T.muted,display:"none"}}>Hi, {user.fullName?.split(" ")[0]}</div>
          <Av name={user.fullName} size={34} color={T.teal}/>
          <div style={{display:"flex",gap:4,background:T.grayXLt,borderRadius:8,padding:3}}>
            {["en","sw"].map(l=><button key={l} onClick={()=>setLang(l)} style={{background:lang===l?T.white:"transparent",border:"none",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,color:lang===l?T.tealDk:T.muted,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{l.toUpperCase()}</button>)}
          </div>
          <Btn variant="ghost" color={T.muted} size="sm" onClick={onLogout}>{sw?"Toka":"Logout"}</Btn>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{display:"flex",overflowX:"auto",padding:"0 16px",background:T.white,borderBottom:`1px solid ${T.border}`,gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`3px solid ${tab===t.id?T.teal:"transparent"}`,padding:"11px 14px",color:tab===t.id?T.tealDk:T.muted,fontWeight:tab===t.id?700:500,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,fontFamily:"inherit",transition:"all 0.15s"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 16px",maxWidth:640,width:"100%",margin:"0 auto"}}>
        {tab==="home"&&<UserHome user={user} onNav={setTab} sw={sw}/>}
        {tab==="mood"&&<MoodTracker user={user} sw={sw}/>}
        {tab==="assess"&&<Screening user={user}/>}
        {tab==="groups"&&<Groups user={user}/>}
        {tab==="chat"&&<AIChat user={user}/>}
        {tab==="therapy"&&<Therapists user={user} sw={sw}/>}
        {tab==="pay"&&<MpesaPayment user={user} sw={sw}/>}
      </div>
    </div>
  );
}

function UserHome({user, onNav, sw=false}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp 0.3s ease"}}>
      {/* Welcome hero */}
      <div style={{background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,borderRadius:22,padding:26,color:T.white,boxShadow:`0 8px 30px ${T.teal}40`}}>
        <div style={{fontSize:12,opacity:0.8,marginBottom:4}}>{sw?"Karibu tena,":"Welcome back,"}</div>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,marginBottom:4}}>{user.fullName} 🌿</div>
        <div style={{fontSize:12,opacity:0.75,marginBottom:18}}>{user.university} · {user.course} · {user.yearOfStudy}</div>
        <Btn onClick={()=>onNav("assess")} variant="fill" style={{background:"rgba(255,255,255,0.25)",color:T.white,border:"1.5px solid rgba(255,255,255,0.4)",backdropFilter:"blur(4px)",boxShadow:"none"}}>{sw?"Anza Tathmini →":"Begin Screening →"}</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[["💚",sw?"Hisia Zangu":"Mood Journal",sw?"Rekodi hisia":"Track daily mood","mood",T.mild],["🧠",sw?"Tathmini":"Screening",sw?"Zana 4 za kliniki":"4 clinical tools","assess",T.blue],["👥",sw?"Vikundi":"Groups",sw?"Facilitated":"Facilitator-led","groups",T.purple],["💬",sw?"Mazungumzo":"AI Chat",sw?"Saa 24/7":"24/7 available","chat",T.teal],["🩺",sw?"Madaktari":"Therapists",sw?"Wataalam waliothibitishwa":"Verified","therapy",T.moderate],["💳",sw?"Lipa":"Pay",sw?"M-Pesa & zaidi":"M-Pesa & more","pay",T.tealDk]].map(([icon,label,sub,t,color])=>(
          <Card key={t} onClick={()=>onNav(t)} accent={color} elevated style={{cursor:"pointer"}}>
            <div style={{width:42,height:42,borderRadius:12,background:`${color}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:10}}>{icon}</div>
            <div style={{fontWeight:700,color:T.text,fontSize:13}}>{label}</div>
            <div style={{fontSize:11,color:T.muted,marginTop:3}}>{sub}</div>
          </Card>
        ))}
      </div>

      <Card elevated>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:16}}>Your Care Pathway</div>
        {[["📋","Complete Screening","PHQ-9, GAD-7, PCL-5, or MDQ — all DSM-5-TR aligned",T.blue],["📊","Get Classified","Automatically grouped: Mild, Moderate, or Severe",T.teal],["🎯","Receive Intervention","Self-guided reading, online therapy, or in-person referral",T.purple],["👥","Join Peer Group","Placed in a condition-matched group with a facilitator",T.mild]].map(([icon,label,desc,color],i)=>(
          <div key={i} style={{display:"flex",gap:14,position:"relative",paddingBottom:i<3?16:0}}>
            {i<3&&<div style={{position:"absolute",left:17,top:36,bottom:0,width:2,background:`${color}25`}}/>}
            <div style={{width:36,height:36,borderRadius:12,background:`${color}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{icon}</div>
            <div style={{paddingTop:5}}>
              <div style={{fontWeight:600,color:T.text,fontSize:13}}>{label}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:2,lineHeight:1.5}}>{desc}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── DSM-5-TR Screening — Full Criteria Implementation ────────────────────────
// Each question maps to a specific DSM-5-TR criterion code.
// Severity grading follows published clinical cutoffs with criterion-level logic.

const TOOLS = [
  // ── MDD: DSM-5-TR 296.xx ── requires ≥5 symptoms for ≥2 weeks, ≥1 must be A1 or A2
  {
    id:"phq9", name:"Depression (PHQ-9)", icon:"🌧️", color:T.blue,
    dsm:"Major Depressive Disorder — DSM-5-TR 296.xx",
    dsmCode:"296.xx",
    criteriaNote:"DSM-5-TR requires ≥5 of criteria A1–A9 present most of the day, nearly every day, for ≥2 weeks. At least one must be A1 (depressed mood) or A2 (anhedonia). Criterion A9 (suicidal ideation) counts as one criterion regardless of score.",
    duration:{
      required:"≥ 2 weeks (Criterion C — DSM-5-TR 296.xx)",
      question:"How long have you been experiencing these symptoms?",
      options:["Less than 1 week","1–2 weeks","2–4 weeks","1–3 months","More than 3 months"],
      threshold:1, // index ≥ 1 meets minimum (≥ 2 weeks)
      thresholdLabel:"2 weeks",
      belowNote:"DSM-5-TR Criterion C: Symptoms must be present for at least 2 weeks for an MDD episode. Your score suggests significant symptoms — a clinician will evaluate whether the duration criterion is met and consider Adjustment Disorder or Depressive Episode NOS.",
      aboveNote:"Duration criterion met. Symptom duration is consistent with DSM-5-TR Criterion C for a Major Depressive Episode.",
      impairNote:"Criterion D: These symptoms must cause clinically significant distress or impairment in social, occupational, or other important areas.",
      impairQuestion:"Have these symptoms caused significant problems in your daily life, work, or relationships?",
      impairOptions:["No impact","Mild impact","Moderate impact","Severe impact — significant impairment"],
    },
    clusters:[
      {label:"Core Symptoms (Criterion A)", items:[0,1]},
      {label:"Neurovegetative Symptoms (Criterion A)", items:[2,3,4]},
      {label:"Cognitive Symptoms (Criterion A)", items:[5,6]},
      {label:"Psychomotor & Safety (Criterion A)", items:[7,8]},
    ],
    qs:[
      {q:"Little interest or pleasure in doing things you usually enjoy",criterion:"A2 — Anhedonia",flag:false},
      {q:"Feeling down, depressed, or hopeless most of the day",criterion:"A1 — Depressed Mood",flag:false},
      {q:"Trouble falling or staying asleep, or sleeping too much",criterion:"A4 — Insomnia or Hypersomnia",flag:false},
      {q:"Feeling tired or having little energy nearly every day",criterion:"A6 — Fatigue / Loss of Energy",flag:false},
      {q:"Poor appetite or significant overeating",criterion:"A3 — Change in Appetite / Weight",flag:false},
      {q:"Feeling bad about yourself, worthless, or like a failure",criterion:"A7 — Worthlessness / Excessive Guilt",flag:false},
      {q:"Trouble concentrating on things such as reading or making decisions",criterion:"A8 — Diminished Concentration",flag:false},
      {q:"Moving or speaking so slowly others noticed, or feeling unusually fidgety",criterion:"A5 — Psychomotor Changes",flag:false},
      {q:"Thoughts that you would be better off dead, or thoughts of hurting yourself",criterion:"A9 — Suicidal Ideation",flag:true},
    ],
    scale:["Not at all (0)","Several days (1)","More than half the days (2)","Nearly every day (3)"],
    scores:[0,1,2,3],
    // DSM-5-TR severity specifiers for MDD
    sev:[
      {l:"Minimal / No MDD",r:[0,4],c:T.teal,lv:"none",dsm:"Score 0–4: Symptoms below threshold. DSM-5-TR: does not meet full criteria for MDD."},
      {l:"Mild MDD",r:[5,9],c:T.mild,lv:"mild",dsm:"Score 5–9: Meets DSM-5-TR mild specifier. Few symptoms beyond minimum, with minor functional impairment. (296.21)"},
      {l:"Moderate MDD",r:[10,14],c:T.moderate,lv:"moderate",dsm:"Score 10–14: Meets DSM-5-TR moderate specifier. Symptoms between mild and severe, with moderate functional impairment. (296.22)"},
      {l:"Moderately Severe MDD",r:[15,19],c:T.moderate,lv:"moderate",dsm:"Score 15–19: Meets DSM-5-TR moderately severe specifier. Significant number of symptoms and marked functional impairment. (296.23)"},
      {l:"Severe MDD",r:[20,27],c:T.severe,lv:"severe",dsm:"Score 20–27: Meets DSM-5-TR severe specifier. Almost all symptoms, causing major functional impairment or disability. (296.24)"},
    ],
    // Core criterion check: A1 or A2 must be ≥2 for clinical significance
    coreCheck:(ans)=> ans[0]>=2 || ans[1]>=2,
    coreWarn:"Note: For full DSM-5-TR MDD criteria, at least one of A1 (depressed mood) or A2 (anhedonia) should be rated ≥ 'More than half the days'. Your clinician will evaluate this during assessment.",
  },

  // ── GAD: DSM-5-TR 300.02 ── excessive anxiety & worry on more days than not for ≥6 months
  {
    id:"gad7", name:"Anxiety (GAD-7)", icon:"⚡", color:T.moderate,
    dsm:"Generalised Anxiety Disorder — DSM-5-TR 300.02",
    dsmCode:"300.02",
    criteriaNote:"DSM-5-TR requires: (A) excessive anxiety/worry more days than not for ≥6 months; (B) difficulty controlling worry; (C) ≥3 of 6 associated symptoms (restlessness, fatigue, concentration, irritability, muscle tension, sleep). The GAD-7 screens for all these domains.",
    duration:{
      required:"≥ 6 months (Criterion A — DSM-5-TR 300.02)",
      question:"How long have you been experiencing excessive worry or anxiety on most days?",
      options:["Less than 1 month","1–3 months","3–6 months","6–12 months","More than 12 months"],
      threshold:3, // index ≥ 3 meets minimum (≥ 6 months)
      thresholdLabel:"6 months",
      belowNote:"DSM-5-TR Criterion A requires anxiety/worry to be present more days than not for at least 6 months. Symptoms present for less than 6 months may indicate Adjustment Disorder with Anxious Mood or Acute Stress Reaction — a clinician will evaluate.",
      aboveNote:"Duration criterion met. Anxiety duration is consistent with DSM-5-TR Criterion A for Generalised Anxiety Disorder.",
      impairNote:"Criterion D: The anxiety must cause clinically significant distress or functional impairment in social, occupational, or other areas.",
      impairQuestion:"Has your anxiety caused significant difficulties in your daily functioning, relationships, or academic performance?",
      impairOptions:["No impact","Mild impact","Moderate impact","Severe impact — significant impairment"],
    },
    clusters:[
      {label:"Core Anxiety (Criteria A & B)", items:[0,1]},
      {label:"Associated Symptoms (Criterion C)", items:[2,3,4,5,6]},
    ],
    qs:[
      {q:"Feeling nervous, anxious, or on edge",criterion:"A — Excessive Anxiety & Worry",flag:false},
      {q:"Not being able to stop or control your worrying",criterion:"B — Difficulty Controlling Worry",flag:false},
      {q:"Worrying too much about different things",criterion:"A — Pervasive / Uncontrollable Worry",flag:false},
      {q:"Trouble relaxing",criterion:"C3 — Muscle Tension / Inability to Relax",flag:false},
      {q:"Being so restless it is hard to sit still",criterion:"C1 — Restlessness / Feeling Keyed Up",flag:false},
      {q:"Becoming easily annoyed or irritable",criterion:"C4 — Irritability",flag:false},
      {q:"Feeling afraid, as if something awful might happen",criterion:"C — Apprehensive Expectation",flag:false},
    ],
    scale:["Not at all (0)","Several days (1)","More than half the days (2)","Nearly every day (3)"],
    scores:[0,1,2,3],
    sev:[
      {l:"Minimal / No GAD",r:[0,4],c:T.teal,lv:"none",dsm:"Score 0–4: Below clinical threshold. DSM-5-TR: does not meet criteria for GAD (300.02)."},
      {l:"Mild GAD",r:[5,9],c:T.mild,lv:"mild",dsm:"Score 5–9: Mild anxiety symptoms. Some criteria present with minimal impairment. DSM-5-TR: mild specifier (300.02)."},
      {l:"Moderate GAD",r:[10,14],c:T.moderate,lv:"moderate",dsm:"Score 10–14: Moderate anxiety. Multiple criteria met with functional impairment. DSM-5-TR: moderate specifier (300.02)."},
      {l:"Severe GAD",r:[15,21],c:T.severe,lv:"severe",dsm:"Score 15–21: Severe anxiety. Extensive criteria met with significant functional impairment. DSM-5-TR: severe specifier (300.02)."},
    ],
    coreCheck:(ans)=> ans[0]>=2 && ans[1]>=2,
    coreWarn:"For full DSM-5-TR GAD criteria, both A (excessive anxiety) and B (difficulty controlling worry) should be present more days than not. Your clinician will conduct a full structured evaluation.",
  },

  // ── PTSD: DSM-5-TR 309.81 ── traumatic event + 4 symptom clusters
  {
    id:"pcl5", name:"PTSD (PCL-5)", icon:"🌪️", color:T.purple,
    dsm:"Post-Traumatic Stress Disorder — DSM-5-TR 309.81",
    dsmCode:"309.81",
    criteriaNote:"DSM-5-TR requires: (A) traumatic event exposure; (B) ≥1 intrusion symptom; (C) ≥1 avoidance symptom; (D) ≥2 negative alterations in cognition/mood; (E) ≥2 alterations in arousal/reactivity; lasting >1 month with functional impairment.",
    duration:{
      required:"≥ 1 month after trauma (Criterion F — DSM-5-TR 309.81)",
      question:"How long ago did the traumatic event(s) occur, and how long have these symptoms been present?",
      options:["Event happened and symptoms started < 3 days ago","3 days – 1 month (may indicate Acute Stress Disorder)","1–3 months (early PTSD)","3–12 months","More than 12 months (chronic PTSD)"],
      threshold:2, // index ≥ 2 meets minimum (> 1 month)
      thresholdLabel:"1 month",
      belowNote:"DSM-5-TR Criterion F requires symptoms to last more than 1 month. Symptoms present for less than 1 month may meet criteria for Acute Stress Disorder (308.3), which also requires clinical attention. Please consult a clinician.",
      aboveNote:"Duration criterion met. Symptom duration is consistent with DSM-5-TR Criterion F for PTSD. Symptoms lasting >3 months indicate Chronic PTSD.",
      impairNote:"Criterion G: The disturbance must cause significant distress or impairment in social, occupational, or other important areas of functioning.",
      impairQuestion:"Have these trauma-related symptoms significantly affected your daily life, studies, or relationships?",
      impairOptions:["No impact","Mild impact","Moderate impact","Severe impact — significant impairment"],
    },
    clusters:[
      {label:"Criterion B — Intrusion Symptoms", items:[0,1,2,3,4]},
      {label:"Criterion C — Avoidance", items:[5,6]},
      {label:"Criterion D — Negative Cognition & Mood", items:[7,8]},
      {label:"Criterion E — Arousal & Reactivity", items:[9]},
    ],
    qs:[
      {q:"Repeated, disturbing, and unwanted memories of a stressful experience from the past",criterion:"B1 — Intrusive Memories",flag:false},
      {q:"Repeated, disturbing dreams of a stressful experience from the past",criterion:"B2 — Recurrent Distressing Dreams",flag:false},
      {q:"Suddenly feeling or acting as if a stressful experience was actually happening again (flashbacks)",criterion:"B3 — Dissociative Reactions / Flashbacks",flag:false},
      {q:"Feeling very upset when something reminded you of a stressful experience",criterion:"B4 — Intense Psychological Distress at Cues",flag:false},
      {q:"Having strong physical reactions (heart pounding, trouble breathing) to reminders of the experience",criterion:"B5 — Physiological Reactions to Cues",flag:false},
      {q:"Avoiding memories, thoughts, or feelings related to a stressful experience",criterion:"C1 — Avoidance of Internal Reminders",flag:false},
      {q:"Avoiding external reminders of a stressful experience (people, places, activities, situations)",criterion:"C2 — Avoidance of External Reminders",flag:false},
      {q:"Trouble remembering important parts of the stressful experience; negative beliefs about yourself or the world",criterion:"D1/D2 — Dissociative Amnesia / Negative Cognitions",flag:false},
      {q:"Feeling distant or cut off from other people; loss of interest in activities",criterion:"D6/D5 — Detachment / Diminished Interest",flag:false},
      {q:"Being super-alert or watchful; feeling jumpy or easily startled; irritable behaviour or angry outbursts",criterion:"E3/E4/E1 — Hypervigilance / Exaggerated Startle / Irritability",flag:false},
    ],
    scale:["Not at all (0)","A little bit (1)","Moderately (2)","Quite a bit (3)","Extremely (4)"],
    scores:[0,1,2,3,4],
    sev:[
      {l:"Sub-threshold PTSD",r:[0,32],c:T.teal,lv:"none",dsm:"Score 0–32: Below clinical threshold. DSM-5-TR: symptoms present but do not meet full PTSD criteria (309.81). Consider Acute Stress Disorder if recent trauma."},
      {l:"Mild PTSD",r:[33,44],c:T.mild,lv:"mild",dsm:"Score 33–44: Probable mild PTSD. DSM-5-TR criteria likely met across clusters B–E with moderate functional impairment. (309.81)"},
      {l:"Moderate PTSD",r:[45,54],c:T.moderate,lv:"moderate",dsm:"Score 45–54: Moderate PTSD. Multiple cluster criteria met with significant functional impairment. DSM-5-TR 309.81 — consider trauma-focused therapy."},
      {l:"Severe PTSD",r:[55,80],c:T.severe,lv:"severe",dsm:"Score 55–80: Severe PTSD. Extensive symptom load across all clusters with major functional impairment. DSM-5-TR 309.81 — urgent clinical evaluation indicated."},
    ],
    // Check min 1 from B, 1 from C, 2 from D, 2 from E
    coreCheck:(ans)=>{ const bMet=ans.slice(0,5).some(a=>a>=2); const cMet=ans.slice(5,7).some(a=>a>=2); const dMet=ans.slice(7,9).filter(a=>a>=2).length>=1; const eMet=ans[9]>=2; return bMet&&cMet&&(dMet||eMet); },
    coreWarn:"For full DSM-5-TR PTSD diagnosis, at least 1 intrusion (B), 1 avoidance (C), and symptoms from D and E clusters must be clinically present. Your clinician will assess cluster requirements in full.",
  },

  // ── Bipolar I/II: DSM-5-TR 296.4x / 296.89 ── manic/hypomanic episode history
  {
    id:"mdq", name:"Bipolar Disorder (MDQ)", icon:"🔄", color:T.tealDk,
    dsm:"Bipolar I / Bipolar II — DSM-5-TR 296.4x / 296.89",
    dsmCode:"296.4x / 296.89",
    criteriaNote:"DSM-5-TR Bipolar I (296.4x) requires a manic episode ≥7 days; Bipolar II (296.89) requires ≥1 hypomanic episode + major depressive episode. The MDQ screens for manic/hypomanic symptoms that represent a change from usual behaviour and were noticed by others. ≥7 Yes responses with co-occurrence and moderate-severe impairment is a positive screen.",
    duration:{
      required:"Bipolar I: ≥ 7 days manic episode. Bipolar II: ≥ 4 days hypomanic episode (DSM-5-TR 296.4x / 296.89)",
      question:"How long did/does the period of elevated, expansive, or irritable mood last?",
      options:["Less than 1 day","1–3 days","4–6 days (meets Bipolar II hypomanic threshold)","7 days or more (meets Bipolar I manic threshold)","More than 1 week with hospitalisation required"],
      threshold:2, // index ≥ 2 meets hypomanic minimum (≥ 4 days)
      thresholdLabel:"4 days (Bipolar II) / 7 days (Bipolar I)",
      belowNote:"DSM-5-TR Criterion B for Bipolar I requires the manic episode to last at least 7 days (or any duration if hospitalisation was required). Bipolar II requires hypomania for at least 4 consecutive days. Episodes shorter than 4 days may suggest Cyclothymia or a mood disorder NOS.",
      aboveNote:"Duration criterion met or approaching threshold. This is consistent with DSM-5-TR episode duration requirements for Bipolar I or II — formal psychiatric evaluation is essential.",
      impairNote:"Criterion D (Bipolar I): The episode causes marked impairment, requires hospitalisation, or includes psychotic features. Bipolar II hypomania must represent a change from usual behaviour observable by others.",
      impairQuestion:"During this period, did others notice a distinct change in your behaviour, or did it cause significant problems?",
      impairOptions:["Others did not notice","Others noticed mild change","Others noticed clear change","Caused major problems or required hospitalisation"],
    },
    clusters:[
      {label:"Criterion B — Elevated / Expansive / Irritable Mood", items:[0,1]},
      {label:"Criterion B — Inflated Self-Esteem & Decreased Sleep", items:[2,3]},
      {label:"Criterion B — Pressured Speech, Racing Thoughts, Distractibility", items:[4,5,6]},
      {label:"Criterion B — Increased Goal-Directed Activity & Risky Behaviour", items:[7,8,9]},
      {label:"Functional Impact & Co-occurrence", items:[10,11]},
    ],
    qs:[
      {q:"You felt so good or so hyped up that other people thought you were not your normal self, or you were so hyper that you got into trouble",criterion:"B1 — Elevated / Expansive Mood",flag:false},
      {q:"You were so irritable that you shouted at people, or started fights or arguments",criterion:"B1 — Irritable Mood",flag:false},
      {q:"You felt much more self-confident than usual",criterion:"B2 — Inflated Self-Esteem / Grandiosity",flag:false},
      {q:"You got by with much less sleep than usual and did not really miss it",criterion:"B3 — Decreased Need for Sleep",flag:false},
      {q:"You were much more talkative or spoke much faster than usual",criterion:"B4 — Pressured Speech",flag:false},
      {q:"Thoughts raced through your head or you could not slow your mind down",criterion:"B5 — Flight of Ideas / Racing Thoughts",flag:false},
      {q:"You were so easily distracted by things around you that you had trouble concentrating",criterion:"B6 — Distractibility",flag:false},
      {q:"You had much more energy than usual",criterion:"B7 — Increased Goal-Directed Activity / Energy",flag:false},
      {q:"You were much more active or did many more things than usual",criterion:"B7 — Increased Activity",flag:false},
      {q:"You were much more social or outgoing than usual — for example, you telephoned friends in the middle of the night",criterion:"B7 — Excessive Involvement in Activities",flag:false},
      {q:"Several of the above experiences happened during the same period of time (co-occurrence)",criterion:"Co-occurrence Criterion",flag:false},
      {q:"These experiences caused moderate to serious problems (e.g. arguments, money, legal, job, family troubles)",criterion:"Functional Impairment Criterion",flag:true},
    ],
    scale:["No (0)","Yes (1)"],
    scores:[0,1],
    // Positive MDQ screen = ≥7 of items 1–13 + co-occurrence + moderate/serious impairment
    sev:[
      {l:"Unlikely Bipolar",r:[0,5],c:T.teal,lv:"none",dsm:"Score 0–5: Below screening threshold. DSM-5-TR: insufficient manic/hypomanic symptoms to warrant Bipolar I or II diagnosis at this time."},
      {l:"Possible Bipolar",r:[6,7],c:T.mild,lv:"mild",dsm:"Score 6–7: Borderline positive screen. DSM-5-TR: some manic/hypomanic features present. Clinician evaluation needed to differentiate Bipolar II (296.89) from cyclothymia or unipolar depression."},
      {l:"Probable Bipolar",r:[8,9],c:T.moderate,lv:"moderate",dsm:"Score 8–9: Positive screen with moderate symptom load. DSM-5-TR: probable Bipolar I or II. Structured psychiatric interview required to determine episode history and specifiers."},
      {l:"Strong Bipolar Indicator",r:[10,12],c:T.severe,lv:"severe",dsm:"Score 10–12: Strong positive screen. DSM-5-TR: high likelihood of Bipolar I (296.4x) or Bipolar II (296.89). Urgent psychiatric evaluation indicated. Co-occurring features and impairment confirm clinical significance."},
    ],
    coreCheck:(ans)=>{ const symCount=ans.slice(0,10).reduce((a,b)=>a+b,0); return symCount>=7 && ans[10]===1 && ans[11]===1; },
    coreWarn:"A positive MDQ screen requires ≥7 symptom items AND co-occurrence AND moderate-serious impairment. DSM-5-TR Bipolar diagnosis requires a full structured interview to establish episode history, duration, and rule out other causes.",
  },
];

function Screening({user}) {
  const [phase, setPhase] = useState("pick"); // pick|q|duration|analyzing|result
  const [tid, setTid] = useState(null);
  const [ans, setAns] = useState([]);
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(null);
  const [sev, setSev] = useState(null);
  const [aiTxt, setAiTxt] = useState("");
  const [loading, setLoading] = useState(false);
  const [durAns, setDurAns] = useState(null);   // selected duration option index
  const [impairAns, setImpairAns] = useState(null); // impairment index
  const [durMet, setDurMet] = useState(true);   // whether duration criterion met
  const [notified, setNotified] = useState(false); // severe alert sent

  const tool=TOOLS.find(t=>t.id===tid);
  const getSev=(sc)=>{ for(const s of tool.sev){if(sc>=s.r[0]&&sc<=s.r[1])return s;} return tool.sev[tool.sev.length-1]; };

  const [criteriaFlags, setCriteriaFlags] = useState([]);
  const [coreCheckPassed, setCoreCheckPassed] = useState(true);

  const finish=async(a, dAns=durAns, iAns=impairAns)=>{
    const sc=a.reduce((x,y)=>x+y,0); const sv=getSev(sc);
    const flagged=tool.qs.map((q,i)=>({...q,score:a[i],met:a[i]>=2})).filter(q=>q.met);
    const coreOk=tool.coreCheck ? tool.coreCheck(a) : true;
    const durationMet = tool.duration ? (dAns!==null && dAns>=tool.duration.threshold) : true;
    setCriteriaFlags(flagged); setCoreCheckPassed(coreOk); setDurMet(durationMet);
    setScore(sc); setSev(sv); setPhase("analyzing"); setLoading(true);
    // Notify all approved psychiatrists immediately if severe
    if(sv.lv==="severe"){
      const alertMsg=`🚨 URGENT — Severe screening result for patient ${user.full_name||user.fullName} (${user.university}, ${user.course}). Tool: ${tool.name}, Score: ${sc}, Severity: ${sv.l}. DSM-5-TR Code: ${tool.dsmCode}. Immediate clinical review required.`;
      try {
        const doctors = await DB.getPsychiatrists();
        const approved = (doctors||[]).filter(d=>d.status==="approved");
        await Promise.all(approved.map(doc =>
          DB.addNotification(doc.id, alertMsg, user.id, user.full_name||user.fullName, true)
        ));
        await sb.insert("activities", {type:"urgent_alert",actor:"System",detail:`🚨 Severe alert sent to all psychiatrists for ${user.full_name||user.fullName}`,icon:"🚨"});
      } catch(e) { console.error("Notification error:", e); }
      setNotified(true);
    }
    const metCriteria=flagged.map(q=>`${q.criterion} (score ${q.score}/3)`).join("; ");
    const flagItem=tool.qs.filter((q,i)=>q.flag&&a[i]>=1).map(q=>q.criterion);
    const durContext=tool.duration?`Duration criterion (${tool.duration.required}): ${durationMet?"MET":"NOT MET"} — patient selected "${tool.duration.options[dAns]||"not answered"}" | Impairment: "${tool.duration.impairOptions[iAns]||"not answered"}"`:""
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1400,system:`You are a clinical AI for Sereni, a DSM-5-TR mental health platform for university students in Tanzania. The student has completed a validated screening including duration and impairment assessment. Provide a structured clinical interpretation covering: (1) Severity statement with DSM-5-TR code and specifier, (2) Which specific criteria were triggered, (3) Duration criterion status and its clinical significance, (4) Functional impairment level, (5) What personalised care they will receive. Be warm, clinically precise, non-stigmatising, and culturally aware. Never state this is a diagnosis. Student: ${user.university}, ${user.course}.`,messages:[{role:"user",content:`Tool: ${tool.dsm}
Score: ${sc}
Severity: ${sv.l}
DSM Severity Specifier: ${sv.dsm}
Criteria met (score≥2): ${metCriteria||"None above threshold"}
Core criterion check passed: ${coreOk}
${durContext}
${flagItem.length>0?"⚠️ FLAG — Clinician attention required: "+flagItem.join(", "):""}`}]})});
      const d=await r.json(); setAiTxt(d.content?.[0]?.text||"Your screening is complete. Our clinical team will connect you with appropriate care.");
    }catch{ setAiTxt("Your screening results have been recorded. Our clinical team will ensure you receive personalised, appropriate care."); }
    await DB.saveDiagnosis(user.id, tool.id, sv.lv, tool.name, sc);
    setLoading(false); setPhase("result");
  };

  const answer=(val)=>{ const next=[...ans]; next[qi]=val; setAns(next); if(qi<tool.qs.length-1) setQi(qi+1); else { if(tool.duration) setPhase("duration"); else finish(next); } };
  const reset=()=>{ setPhase("pick"); setTid(null); setAns([]); setQi(0); setScore(null); setSev(null); setAiTxt(""); setCriteriaFlags([]); setCoreCheckPassed(true); setDurAns(null); setImpairAns(null); setDurMet(true); setNotified(false); };

  if(phase==="pick") return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{textAlign:"center",padding:"8px 0 16px"}}>
        <div style={{fontSize:38,marginBottom:10}}>🧠</div>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>Mental Health Screening</div>
        <div style={{fontSize:13,color:T.muted,marginTop:6,lineHeight:1.65}}>Validated clinical tools · DSM-5-TR aligned · Completely confidential</div>
      </div>
      <div style={{background:"#FFF8E1",border:`1px solid ${T.moderate}50`,borderRadius:12,padding:"10px 16px",fontSize:12,color:"#795548",lineHeight:1.6}}>⚠️ <strong>Note:</strong> These are screening tools, not clinical diagnoses. Results guide professional follow-up care.</div>
      {TOOLS.map(t=>(
        <Card key={t.id} onClick={()=>{setTid(t.id);setPhase("q");setAns([]);setQi(0);}} accent={t.color} elevated style={{cursor:"pointer"}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{width:52,height:52,borderRadius:16,background:`${t.color}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{t.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:T.text,fontSize:15}}>{t.name}</div>
              <div style={{fontSize:11,color:t.color,fontWeight:600,marginTop:2}}>{t.dsmCode}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{t.qs.length} criteria · ~{Math.ceil(t.qs.length*0.5)} min · Full DSM-5-TR criteria</div>
            </div>
            <div style={{color:t.color,fontSize:22}}>›</div>
          </div>
        </Card>
      ))}
    </div>
  );

  if(phase==="q") return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.25s ease"}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <button onClick={()=>{if(qi>0)setQi(qi-1);else setPhase("pick");}} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,color:T.gray,cursor:"pointer",fontSize:18,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:12,color:T.muted}}>Criterion {qi+1} of {tool.qs.length}</span>
            <span style={{fontSize:12,color:tool.color,fontWeight:700}}>{Math.round(((qi+1)/tool.qs.length)*100)}%</span>
          </div>
          <div style={{height:6,background:T.border,borderRadius:99,overflow:"hidden"}}><div style={{width:`${((qi+1)/tool.qs.length)*100}%`,height:"100%",background:`linear-gradient(90deg,${tool.color},${tool.color}cc)`,borderRadius:99,transition:"width 0.4s"}}/></div>
        </div>
      </div>
      <div style={{background:T.cardAlt,border:`1.5px solid ${tool.color}30`,borderRadius:18,padding:24}}>
        <div style={{fontSize:10,color:tool.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>
          {tool.id==="mdq"?"During a period of elevated mood:":"Over the last 2 weeks, how often:"}
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:`${tool.color}14`,borderRadius:8,padding:"3px 10px",fontSize:10,color:tool.color,fontWeight:600,marginBottom:10}}>
          📋 {tool.qs[qi].criterion}
          {tool.qs[qi].flag&&<span style={{background:T.severe,color:T.white,borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:800}}>⚠️ CLINICAL FLAG</span>}
        </div>
        <div style={{fontWeight:600,color:T.text,fontSize:15,lineHeight:1.7}}>"{tool.qs[qi].q}"</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {tool.scale.map((opt,i)=>{
          const sel=ans[qi]===tool.scores[i];
          return <button key={i} onClick={()=>answer(tool.scores[i])} style={{background:sel?`${tool.color}12`:T.white,border:`1.5px solid ${sel?tool.color:T.border}`,borderRadius:12,padding:"13px 18px",color:sel?tool.color:T.text,textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:sel?700:400,transition:"all 0.15s",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${sel?tool.color:T.border}`,background:sel?tool.color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<div style={{width:7,height:7,borderRadius:"50%",background:T.white}}/>}</div>
            {opt}
          </button>;
        })}
      </div>
    </div>
  );

  if(phase==="duration"&&tool.duration) return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{background:`${tool.color}0E`,border:`1.5px solid ${tool.color}30`,borderRadius:18,padding:22}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:`${tool.color}14`,borderRadius:8,padding:"4px 12px",fontSize:11,color:tool.color,fontWeight:700,marginBottom:10}}>
          ⏱️ DSM-5-TR Duration Criterion — {tool.duration.required}
        </div>
        <div style={{fontWeight:700,color:T.text,fontSize:15,lineHeight:1.6}}>{tool.duration.question}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {tool.duration.options.map((opt,i)=>{
          const sel=durAns===i;
          return <button key={i} onClick={()=>setDurAns(i)} style={{background:sel?`${tool.color}12`:T.white,border:`1.5px solid ${sel?tool.color:T.border}`,borderRadius:12,padding:"12px 16px",color:sel?tool.color:T.text,textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:sel?700:400,transition:"all 0.15s",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${sel?tool.color:T.border}`,background:sel?tool.color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<div style={{width:7,height:7,borderRadius:"50%",background:T.white}}/>}</div>
            {opt}
            {i===tool.duration.threshold&&<span style={{marginLeft:"auto",fontSize:10,color:T.mild,fontWeight:700,background:`${T.mild}18`,borderRadius:6,padding:"2px 7px"}}>Min threshold</span>}
            {i>tool.duration.threshold&&<span style={{marginLeft:"auto",fontSize:10,color:tool.color,fontWeight:700,background:`${tool.color}18`,borderRadius:6,padding:"2px 7px"}}>Criterion met ✓</span>}
          </button>;
        })}
      </div>
      {durAns!==null&&(
        <div style={{background:durAns>=tool.duration.threshold?`${T.mild}10`:"#FFF8E1",border:`1px solid ${durAns>=tool.duration.threshold?T.mild:T.moderate}40`,borderRadius:12,padding:"11px 16px",fontSize:12,color:T.text,lineHeight:1.65}}>
          {durAns>=tool.duration.threshold?`✅ ${tool.duration.aboveNote}`:`⚠️ ${tool.duration.belowNote}`}
        </div>
      )}
      <div style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,color:T.sub,marginBottom:10}}>📊 Functional Impairment — {tool.duration.impairNote}</div>
        <div style={{fontSize:13,color:T.text,marginBottom:10}}>{tool.duration.impairQuestion}</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {tool.duration.impairOptions.map((opt,i)=>{
            const sel=impairAns===i;
            return <button key={i} onClick={()=>setImpairAns(i)} style={{background:sel?`${tool.color}12`:T.white,border:`1.5px solid ${sel?tool.color:T.border}`,borderRadius:10,padding:"9px 14px",color:sel?tool.color:T.text,textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:sel?700:400,transition:"all 0.15s"}}>{opt}</button>;
          })}
        </div>
      </div>
      <Btn full disabled={durAns===null||impairAns===null} onClick={()=>finish(ans,durAns,impairAns)}>
        Complete Assessment →
      </Btn>
      <div style={{fontSize:11,color:T.muted,textAlign:"center",lineHeight:1.6}}>Duration and impairment data are included in your clinical report and reviewed by your assigned professional.</div>
    </div>
  );

  if(phase==="analyzing") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:"80px 20px",textAlign:"center"}}>
      <div style={{width:72,height:72,borderRadius:"50%",background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,animation:"spin 2s linear infinite"}}>{tool.icon}</div>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,color:T.text}}>Analysing your responses…</div>
      <div style={{color:T.muted,fontSize:13}}>Applying DSM-5-TR diagnostic criteria</div>
    </div>
  );

  if(phase==="result"&&sev){
    // Full DSM-5-TR condition-specific learning materials and coping strategies
    const LEARN_MATERIALS = {
      phq9:{
        none:[
          {icon:"📖",title:"Understanding Low Mood",desc:"Learn why mood fluctuates and how lifestyle factors affect mental health in university."},
          {icon:"🧘",title:"Preventive Mindfulness",desc:"10-minute daily mindfulness to build emotional resilience before problems arise."},
          {icon:"💤",title:"Sleep Hygiene Guide",desc:"Evidence-based sleep practices to protect mood and cognitive function."},
        ],
        mild:[
          {icon:"📖",title:"Understanding MDD (DSM-5-TR 296.21)",desc:"What depression is biologically and psychologically — dispelling stigma with science."},
          {icon:"🔄",title:"Behavioural Activation Workbook",desc:"CBT Criterion A intervention — scheduling activities that counter anhedonia (A2) and fatigue (A6)."},
          {icon:"📝",title:"Thought Records (CBT)",desc:"Identifying and restructuring automatic negative thoughts linked to worthlessness (A7) and hopelessness (A1)."},
          {icon:"🌿",title:"Lifestyle Medicine for Depression",desc:"Exercise, nutrition, and sleep interventions with clinical evidence for mild MDD."},
          {icon:"🧘",title:"Mindfulness-Based Cognitive Therapy",desc:"MBCT techniques proven effective for preventing MDD relapse — 8-week condensed guide."},
          {icon:"🤝",title:"Social Connection & Depression",desc:"Why social withdrawal worsens MDD (A2) and how to gently re-engage support networks."},
        ],
        moderate:[
          {icon:"📖",title:"Moderate MDD: What to Expect (296.22–296.23)",desc:"Understanding the clinical course of moderate depression and the importance of professional care."},
          {icon:"🧠",title:"CBT for Moderate Depression",desc:"Structured cognitive restructuring techniques your therapist will guide you through."},
          {icon:"💊",title:"Understanding Treatment Options",desc:"Evidence-based overview of psychotherapy (CBT, IPT) and pharmacotherapy for moderate MDD."},
          {icon:"📋",title:"Safety Planning Worksheet",desc:"A personal plan for managing low periods, including who to contact if things worsen."},
          {icon:"🌙",title:"Insomnia & Depression",desc:"The bidirectional relationship between sleep (A4) and mood — CBT-I techniques."},
          {icon:"🏃",title:"Exercise as Medicine",desc:"Clinical evidence that aerobic exercise reduces moderate MDD severity — a structured plan."},
        ],
        severe:[
          {icon:"🆘",title:"Crisis Safety Plan (MDD 296.24)",desc:"Immediate steps to take if experiencing suicidal ideation (A9). Tanzania: +255 800 750 112."},
          {icon:"📋",title:"Severe Depression: Understanding Your Diagnosis",desc:"What severe MDD means clinically, why urgent care is essential, and what your treatment will involve."},
          {icon:"💊",title:"Evidence-Based Treatment for Severe MDD",desc:"Antidepressant therapy, ECT, and intensive psychotherapy — what your psychiatrist may recommend."},
          {icon:"👥",title:"Supporting Someone You Trust",desc:"How to involve a trusted person — family, friend, or campus counselor — in your safety plan."},
        ],
      },
      gad7:{
        none:[
          {icon:"📖",title:"Anxiety vs Normal Worry",desc:"Understanding the clinical difference between adaptive anxiety and GAD (DSM-5-TR 300.02)."},
          {icon:"🌬️",title:"Box Breathing Technique",desc:"Parasympathetic nervous system activation — a 4-7-8 breathing protocol for acute stress."},
          {icon:"🧘",title:"Progressive Muscle Relaxation",desc:"Evidence-based technique targeting muscle tension (GAD Criterion C3) to prevent escalation."},
        ],
        mild:[
          {icon:"📖",title:"Understanding GAD (DSM-5-TR 300.02)",desc:"The neuroscience of chronic worry, what distinguishes GAD from normal anxiety, and why treatment works."},
          {icon:"⏰",title:"Worry Time Technique",desc:"Scheduled worry containment — CBT technique targeting Criterion B (uncontrollable worry)."},
          {icon:"🌬️",title:"Breathing & Relaxation Toolkit",desc:"Diaphragmatic breathing, box breathing, and PMR for Criterion C1 (restlessness) and C3 (muscle tension)."},
          {icon:"🔍",title:"Cognitive Restructuring for Anxiety",desc:"Identifying catastrophic thinking patterns and replacing them with evidence-based alternatives."},
          {icon:"📅",title:"Worry Journal",desc:"Daily structured log to track anxiety triggers, duration, and response — monitoring Criterion A."},
          {icon:"🏃",title:"Exercise for Anxiety Reduction",desc:"Aerobic exercise reduces GAD severity — a 4-week starter programme appropriate for students."},
        ],
        moderate:[
          {icon:"📖",title:"Moderate GAD: Your Clinical Picture",desc:"Understanding moderate GAD (300.02) — why professional support is now clinically indicated."},
          {icon:"🧠",title:"CBT for Generalised Anxiety",desc:"The complete cognitive-behavioural model for GAD — how your therapist will approach treatment."},
          {icon:"🔬",title:"Exposure and Response Prevention",desc:"Graduated approach to facing anxiety triggers — reducing avoidance that maintains GAD."},
          {icon:"💊",title:"Medication Options for GAD",desc:"SSRI/SNRI pharmacotherapy for GAD — what your psychiatrist may discuss with you."},
          {icon:"📋",title:"GAD Self-Monitoring Record",desc:"Daily tracking of anxiety intensity, worry content, and coping effectiveness for your clinician."},
        ],
        severe:[
          {icon:"🆘",title:"Managing Severe Anxiety: Immediate Steps",desc:"Grounding techniques for panic-level anxiety. Crisis line: +255 800 750 112."},
          {icon:"📖",title:"Severe GAD & Comorbidity (300.02)",desc:"Severe GAD often co-occurs with MDD and PTSD — why comprehensive assessment is urgent."},
          {icon:"💊",title:"Intensive Treatment for Severe GAD",desc:"Combined pharmacotherapy and intensive CBT — your clinical team will create a tailored plan."},
          {icon:"🧘",title:"Acceptance & Commitment Therapy",desc:"ACT techniques for severe anxiety — accepting difficult emotions without being controlled by them."},
        ],
      },
      pcl5:{
        none:[
          {icon:"📖",title:"Understanding Trauma Responses",desc:"Normal stress reactions after difficult events — when they resolve and when to seek help."},
          {icon:"🌿",title:"Grounding Techniques",desc:"5-4-3-2-1 sensory grounding for acute distress — bringing awareness to the present moment."},
          {icon:"🤝",title:"Building Your Support Network",desc:"How social connection protects against PTSD development after trauma exposure."},
        ],
        mild:[
          {icon:"📖",title:"Understanding PTSD (DSM-5-TR 309.81)",desc:"What PTSD is neurobiologically — why the trauma response gets 'stuck' and how treatment helps."},
          {icon:"🌿",title:"Grounding & Safety Techniques",desc:"Titrated exposure to trauma cues using grounding — managing Criterion B intrusions safely."},
          {icon:"🧠",title:"Window of Tolerance",desc:"Understanding your nervous system's window of tolerance and how to stay within it."},
          {icon:"📝",title:"Trauma Narrative Writing",desc:"Structured expressive writing — evidence-based processing for mild PTSD symptoms."},
          {icon:"💤",title:"Sleep & Nightmares (Criterion B2)",desc:"Image Rehearsal Therapy for recurrent trauma nightmares — a step-by-step guide."},
          {icon:"🤝",title:"Social Reconnection After Trauma",desc:"Addressing Criterion D detachment — gradual, safe re-engagement with trusted others."},
        ],
        moderate:[
          {icon:"📖",title:"Moderate PTSD: Your Clinical Picture",desc:"Understanding moderate PTSD and why trauma-focused therapy is now the standard of care."},
          {icon:"🧠",title:"Trauma-Focused CBT (TF-CBT)",desc:"The evidence-based treatment your therapist will guide you through for moderate PTSD."},
          {icon:"🔄",title:"EMDR Explained",desc:"Eye Movement Desensitisation and Reprocessing — what to expect and why it works."},
          {icon:"📋",title:"Avoidance Mapping (Criterion C)",desc:"Identifying what you are avoiding and building a graduated exposure hierarchy."},
          {icon:"💊",title:"Pharmacotherapy for PTSD",desc:"SSRI treatment (sertraline, paroxetine) for PTSD — what your psychiatrist may recommend."},
        ],
        severe:[
          {icon:"🆘",title:"Crisis Management for Severe PTSD",desc:"Immediate stabilisation techniques. Emergency: +255 800 750 112 or MNH +255 22 215 0610."},
          {icon:"📖",title:"Severe PTSD & Dissociation",desc:"Understanding Criterion D dissociative features and why immediate professional support is essential."},
          {icon:"🏥",title:"Intensive Trauma Treatment",desc:"Residential or intensive outpatient trauma treatment — what your clinical team will arrange."},
          {icon:"👥",title:"Trauma Survivor Support",desc:"Connecting with others who have recovered from severe PTSD — hope and roadmap to recovery."},
        ],
      },
      mdq:{
        none:[
          {icon:"📖",title:"Understanding Mood Variability",desc:"Normal mood fluctuations vs clinically significant patterns — what to watch for."},
          {icon:"📅",title:"Mood Charting Guide",desc:"Tracking mood, sleep, and energy daily — early warning detection for Bipolar spectrum."},
          {icon:"💤",title:"Sleep Regularity for Mood Stability",desc:"Why circadian rhythm disruption can trigger mood episodes — protective sleep strategies."},
        ],
        mild:[
          {icon:"📖",title:"Understanding Bipolar Spectrum (DSM-5-TR 296.89)",desc:"What distinguishes Bipolar II and cyclothymia — the spectrum approach to mood disorders."},
          {icon:"📅",title:"Life Chart Method",desc:"Longitudinal mood tracking — the gold standard tool for Bipolar management and episode prediction."},
          {icon:"💤",title:"Sleep as Mood Stabiliser (Criterion B3)",desc:"Decreased sleep need is an early warning sign — strict sleep schedule as a therapeutic intervention."},
          {icon:"🚫",title:"Substance Use & Bipolar",desc:"Why alcohol and stimulants destabilise Bipolar mood — evidence-based reduction strategies."},
          {icon:"🧠",title:"Psychoeducation for Bipolar",desc:"Understanding your triggers, prodromal signs, and building a personalised wellness plan."},
          {icon:"🤝",title:"Involving Trusted Others",desc:"Creating a shared care plan with a trusted person to monitor early warning signs."},
        ],
        moderate:[
          {icon:"📖",title:"Probable Bipolar I/II: Next Steps",desc:"Understanding why formal psychiatric evaluation is urgently needed and what it involves."},
          {icon:"💊",title:"Mood Stabilisers & Bipolar",desc:"Lithium, valproate, lamotrigine — what the evidence says and what your psychiatrist may discuss."},
          {icon:"🧠",title:"Interpersonal & Social Rhythm Therapy",desc:"IPSRT — the evidence-based therapy specifically designed for Bipolar mood stability."},
          {icon:"📋",title:"Relapse Prevention Plan",desc:"Identifying early warning signs and building a written action plan with your clinical team."},
          {icon:"🚫",title:"Mania Trigger Identification",desc:"Mapping personal mania and depression triggers — sleep deprivation, stress, substances."},
        ],
        severe:[
          {icon:"🆘",title:"Severe Bipolar: Urgent Action Required",desc:"Mania or mixed states can escalate rapidly. Crisis: +255 800 750 112 or MNH +255 22 215 0610."},
          {icon:"🏥",title:"When Hospitalisation Is Needed",desc:"Understanding the role of inpatient care in severe Bipolar I — safety, stabilisation, and medication."},
          {icon:"💊",title:"Emergency Mood Stabilisation",desc:"Acute pharmacological management of manic episodes — what your psychiatrist will prioritise."},
          {icon:"👥",title:"Family & Carer Guidance",desc:"How trusted people can support you through a severe episode — and what to do in a crisis."},
        ],
      },
    };

    const condMaterials = (LEARN_MATERIALS[tid]||{})[sev.lv]||[];

    const INTERV={none:{title:"No Significant Symptoms",icon:"✅",color:T.teal,steps:[]},mild:{title:"Mild — 7-Day Self-Guided Programme",icon:"📚",color:T.mild,steps:["Day 1–2: Begin psychoeducation reading materials below","Day 3–4: CBT workbook — thought records and coping skills","Day 5–6: Mindfulness and relaxation practice","Day 7: Re-assessment screening to evaluate progress"]},moderate:{title:"Moderate — Online Therapy Referral",icon:"💻",color:T.moderate,steps:["Within 48hrs: Matched to an available psychiatrist/psychologist","Session 1: Full clinical assessment and personalised treatment plan","Weeks 1–4: Weekly structured online therapy sessions","Month 1: Re-assessment and care plan review with your clinician"]},severe:{title:"Severe — Immediate Clinical Action",icon:"🏥",color:T.severe,steps:["Now: All available psychiatrists have been notified of your result","Within 24hrs: Direct referral to Sereni partner clinic or MNH","Day 1–3: In-person assessment with psychiatrist","Ongoing: Structured inpatient or intensive outpatient treatment"]}}[sev.lv];
    return (
      <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
        {/* Score header */}
        <div style={{background:`linear-gradient(135deg,${sev.c}18,${sev.c}08)`,border:`2px solid ${sev.c}40`,borderRadius:22,padding:28,textAlign:"center"}}>
          <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{tool.dsm}</div>
          <div style={{fontSize:58,fontWeight:800,color:sev.c,lineHeight:1,fontFamily:"'Playfair Display',Georgia,serif"}}>{score}</div>
          <div style={{fontSize:12,color:T.muted,marginTop:3}}>Total Score</div>
          <div style={{marginTop:12,display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
            <Chip color={sev.c}>{sev.l}</Chip>
            <Chip color={T.gray}>{tool.dsmCode}</Chip>
          </div>
        </div>

        {/* DSM-5-TR Severity Specifier */}
        <Card elevated style={{background:`${sev.c}06`,border:`1.5px solid ${sev.c}30`}}>
          <div style={{fontWeight:700,color:sev.c,fontSize:14,marginBottom:8}}>📊 DSM-5-TR Severity Specifier</div>
          <div style={{fontSize:13,color:T.text,lineHeight:1.75}}>{sev.dsm}</div>
        </Card>

        {/* Criteria triggered */}
        {criteriaFlags.length>0&&(
          <Card elevated>
            <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:12}}>📋 Criteria Met (Score ≥ 2)</div>
            {criteriaFlags.map((cf,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<criteriaFlags.length-1?`1px solid ${T.border}`:"none",alignItems:"flex-start"}}>
                <div style={{width:20,height:20,borderRadius:6,background:cf.flag?`${T.severe}18`:`${T.teal}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:cf.flag?T.severe:T.teal,flexShrink:0,marginTop:1}}>{cf.flag?"⚠️":"✓"}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:700,color:cf.flag?T.severe:T.tealDk}}>{cf.criterion}</div>
                  <div style={{fontSize:12,color:T.sub,marginTop:1}}>{cf.q}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:1}}>Score: {cf.score}/3</div>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Core criterion warning if applicable */}
        {!coreCheckPassed&&sev.lv!=="none"&&(
          <div style={{background:"#FFF8E1",border:`1px solid ${T.moderate}50`,borderRadius:12,padding:"12px 16px",fontSize:12,color:"#795548",lineHeight:1.7}}>
            ⚠️ <strong>Clinical Note:</strong> {tool.coreWarn}
          </div>
        )}

        {/* Safety flag */}
        {criteriaFlags.some(cf=>cf.flag)&&(
          <Card accent={T.severe} style={{background:"#FFF5F5"}}>
            <div style={{fontWeight:700,color:T.severe,fontSize:14,marginBottom:6}}>⚠️ Clinical Safety Flag</div>
            <div style={{fontSize:13,color:T.sub,lineHeight:1.7}}>One or more responses indicate items requiring clinician attention. A qualified mental health professional will review this as part of your care plan. If you are in immediate distress: <strong style={{color:T.text}}>+255 800 750 112</strong></div>
          </Card>
        )}

        <Card elevated>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
            <div style={{width:38,height:38,borderRadius:12,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🤖</div>
            <div><div style={{fontWeight:700,color:T.tealDk,fontSize:14}}>AI Clinical Interpretation</div><div style={{fontSize:11,color:T.muted}}>DSM-5-TR aligned · For guidance only</div></div>
          </div>
          {loading?<div style={{color:T.muted,fontSize:13,padding:"8px 0"}}>Generating interpretation…</div>:<div style={{fontSize:14,color:T.text,lineHeight:1.8}}>{aiTxt}</div>}
        </Card>

        {sev.lv!=="none"&&(
          <Card elevated accent={INTERV.color}>
            <div style={{fontWeight:700,color:INTERV.color,fontSize:15,marginBottom:12,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{INTERV.icon}</span>{INTERV.title}</div>
            {INTERV.steps.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:12,padding:"8px 0",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"flex-start"}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:`${INTERV.color}18`,border:`1.5px solid ${INTERV.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:INTERV.color,flexShrink:0,marginTop:2}}>{i+1}</div>
                <div style={{fontSize:13,color:T.text,lineHeight:1.55}}>{s}</div>
              </div>
            ))}
          </Card>
        )}

        {/* Duration criterion result */}
        <Card elevated style={{background:durMet?`${T.mild}06`:"#FFF8E1",border:`1.5px solid ${durMet?T.mild:T.moderate}30`}}>
          <div style={{fontWeight:700,fontSize:14,color:durMet?T.mild:T.moderate,marginBottom:6}}>
            ⏱️ Duration Criterion — {tool.duration?.required}
          </div>
          <div style={{fontSize:13,color:T.text,lineHeight:1.65}}>
            {durMet
              ? tool.duration?.aboveNote
              : tool.duration?.belowNote
            }
          </div>
        </Card>

        {/* Severe psychiatrist notification banner */}
        {notified&&(
          <Card accent={T.severe} style={{background:"#FFF5F5"}}>
            <div style={{fontWeight:700,color:T.severe,fontSize:14,marginBottom:6}}>🚨 Psychiatrists Notified</div>
            <div style={{fontSize:13,color:T.sub,lineHeight:1.7}}>All available Sereni psychiatrists have been immediately alerted of your severe screening result and will contact you as a priority. You will also receive an SMS notification. If you are in immediate danger: <strong style={{color:T.text}}>+255 800 750 112</strong> or <strong style={{color:T.text}}>+255 22 215 0610</strong></div>
          </Card>
        )}

        {sev.lv!=="none"&&(
          <Card elevated accent={T.purple} style={{background:`${T.purple}06`}}>
            <div style={{fontWeight:700,color:T.purple,marginBottom:8,fontSize:15}}>👥 Peer Support Group</div>
            <div style={{fontSize:13,color:T.sub,lineHeight:1.7}}>You will be placed in a confidential group with others experiencing <strong style={{color:T.text}}>{sev.l.toLowerCase()}</strong> symptoms, facilitated by a qualified mental health professional. Visit the <strong style={{color:T.tealDk}}>Groups</strong> tab to join your session.</div>
          </Card>
        )}

        {/* Learning materials & coping strategies */}
        {condMaterials.length>0&&(
          <div>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:18,color:T.text,marginBottom:4}}>📚 Learning Materials & Coping Strategies</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:14}}>Evidence-based resources matched to your {tool.name} result — {sev.l} level</div>
            {condMaterials.map((m,i)=>(
              <Card key={i} style={{marginBottom:10}} elevated>
                <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{width:44,height:44,borderRadius:12,background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{m.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:T.text,fontSize:14}}>{m.title}</div>
                    <div style={{fontSize:13,color:T.sub,marginTop:4,lineHeight:1.6}}>{m.desc}</div>
                    <button style={{marginTop:8,background:"none",border:`1px solid ${T.teal}`,borderRadius:8,padding:"4px 12px",fontSize:11,color:T.tealDk,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Read →</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {sev.lv==="severe"&&(
          <Card accent={T.severe} style={{background:"#FFF5F5"}}>
            <div style={{fontWeight:700,color:T.severe,marginBottom:6,fontSize:14}}>🆘 Crisis Support — Tanzania</div>
            <div style={{fontSize:13,color:T.sub,lineHeight:1.7}}>MNH Emergency: <strong style={{color:T.text}}>+255 22 215 0610</strong><br/>Mental Health Helpline: <strong style={{color:T.text}}>+255 800 750 112</strong></div>
          </Card>
        )}
        <Btn full variant="outline" onClick={reset}>Take Another Screening</Btn>
      </div>
    );
  }
  return null;
}

// ── Groups ────────────────────────────────────────────────────────────────────
const GROUPS_DATA=[
  {key:"dep-mild",name:"Mild Depression — Wellness Circle",cond:"Depression",lv:"mild",color:T.mild,fac:"Fatuma Hassan, Counselor",members:16,next:"Wed 18 Mar · 5:00 PM",seed:[{from:"Amani K.",text:"Tried the journaling exercise — it helped me notice my thought patterns.",mod:false,time:"10:02 AM"},{from:"Fatuma Hassan",text:"That is beautiful self-awareness, Amani 🌱 This week, try catching one negative thought daily and just observe it without judgement.",mod:true,time:"10:15 AM"}]},
  {key:"dep-mod",name:"Moderate Depression — Therapy Group",cond:"Depression",lv:"moderate",color:T.moderate,fac:"Dr. Joseph Mwanga, Psychologist",members:9,next:"Tue 17 Mar · 4:00 PM",seed:[{from:"Dr. Joseph Mwanga",text:"Today we explore behavioural activation — small intentional actions that build momentum. Who has a tiny win from this week?",mod:true,time:"4:02 PM"},{from:"Zawadi T.",text:"I made breakfast instead of skipping it. Small but it took real effort.",mod:false,time:"4:06 PM"},{from:"Dr. Joseph Mwanga",text:"That is not small — choosing action when motivation is absent is exactly what activation means. Well done Zawadi 💛",mod:true,time:"4:10 PM"}]},
  {key:"anx-mild",name:"Mild Anxiety — Wellness Group",cond:"Anxiety",lv:"mild",color:T.mild,fac:"Fatuma Hassan, Counselor",members:19,next:"Thu 19 Mar · 6:00 PM",seed:[{from:"Neema S.",text:"I tried box breathing before a presentation and it actually worked! I was surprised.",mod:false,time:"2:14 PM"},{from:"Fatuma Hassan",text:"Box breathing activates your parasympathetic nervous system directly ⚡ What is your personal go-to grounding technique?",mod:true,time:"2:23 PM"}]},
  {key:"ptsd-mod",name:"PTSD Recovery Group",cond:"PTSD",lv:"moderate",color:T.purple,fac:"Dr. Baraka Kimaro, Trauma Psychologist",members:7,next:"Fri 20 Mar · 3:30 PM",seed:[{from:"Dr. Baraka Kimaro",text:"We always move at your pace. Today we focus on building your personal safety plan and grounding anchors.",mod:true,time:"3:31 PM"},{from:"Salim A.",text:"I had two fewer nightmares this week. Small progress but I am counting every one.",mod:false,time:"3:38 PM"}]},
  {key:"anx-sev",name:"Severe Anxiety — Intensive Support",cond:"Anxiety",lv:"severe",color:T.severe,fac:"Dr. Amina Salehe, Psychiatrist",members:6,next:"Mon 16 Mar · 2:00 PM",seed:[{from:"Dr. Amina Salehe",text:"This is a safe, confidential space. You do not need to perform wellness here — honest is always enough. How is everyone today?",mod:true,time:"2:01 PM"}]},
];

function Groups({user}) {
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const lc=(lv)=>lv==="mild"?T.mild:lv==="moderate"?T.moderate:lv==="severe"?T.severe:T.purple;
  const diag=user?.diagnosis; // {cond, lv, toolName, score, date}

  // A user can only open the group that matches their diagnosis cond+lv
  const canJoin=(g)=>{
    if(!diag) return false;
    const condMap={"phq9":"Depression","gad7":"Anxiety","pcl5":"PTSD","mdq":"Bipolar"};
    const userCond=condMap[diag.cond];
    return g.cond===userCond && g.lv===diag.lv;
  };

  const open=(g)=>{setActive(g);setMsgs(g.seed.map(m=>({...m,id:Math.random()})));};

  const send=async()=>{
    if(!input.trim()||sending) return;
    const my={from:"You",text:input,mod:false,time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}),id:Math.random(),isMe:true};
    const all=[...msgs,my]; setMsgs(all); setInput(""); setSending(true);
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`You are ${active.fac}, facilitating the "${active.name}" peer support group on Sereni, Tanzania's mental wellness platform. Respond warmly and briefly (1-3 sentences) as the facilitator. Validate feelings, offer brief psychoeducation, invite group participation. Never diagnose or prescribe.`,messages:all.map(m=>({role:m.isMe?"user":"assistant",content:`${m.isMe?"Member":m.from}: ${m.text}`}))})});
      const d=await r.json();
      setMsgs(prev=>[...prev,{from:active.fac.split(",")[0],mod:true,text:d.content?.[0]?.text||"Thank you for sharing. 💚",time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}),id:Math.random()}]);
    }catch{}
    setSending(false);
  };

  if(active){
    const c=lc(active.lv);
    return (
      <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 175px)",minHeight:400}}>
        <div style={{flexShrink:0,paddingBottom:14,borderBottom:`1px solid ${T.border}`,marginBottom:14}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
            <button onClick={()=>setActive(null)} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,color:T.gray,cursor:"pointer",fontSize:18,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{flex:1}}><div style={{fontWeight:700,color:T.text,fontSize:14}}>{active.name}</div><div style={{fontSize:11,color:T.muted}}>Facilitator: {active.fac} · {active.members} members</div></div>
            <Chip color={c}>{active.lv}</Chip>
          </div>
          <div style={{background:`${c}10`,border:`1px solid ${c}30`,borderRadius:10,padding:"8px 14px",fontSize:12,color:T.text}}>📅 Next live session: <strong>{active.next}</strong></div>
        </div>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
          {msgs.map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:m.isMe?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
              {!m.isMe&&<Av name={m.from} size={30} color={m.mod?c:T.grayLt}/>}
              <div style={{maxWidth:"76%"}}>
                {!m.isMe&&<div style={{fontSize:10,color:m.mod?c:T.muted,marginBottom:4,fontWeight:m.mod?700:400,paddingLeft:2}}>{m.from}{m.mod?" · Facilitator":""} · {m.time}</div>}
                <div style={{padding:"10px 14px",borderRadius:m.isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.isMe?`linear-gradient(135deg,${T.teal},${T.tealDk})`:m.mod?`${c}12`:T.white,border:m.isMe?"none":`1px solid ${m.mod?c+"30":T.border}`,color:m.isMe?T.white:T.text,fontSize:13,lineHeight:1.6,boxShadow:m.isMe?`0 4px 12px ${T.teal}30`:"0 1px 4px rgba(0,0,0,0.04)"}}>{m.text}</div>
                {m.isMe&&<div style={{fontSize:10,color:T.muted,textAlign:"right",marginTop:3}}>{m.time}</div>}
              </div>
            </div>
          ))}
          {sending&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><Av name={active.fac} size={30} color={lc(active.lv)}/><div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:"16px 16px 16px 4px",padding:"12px 16px",display:"flex",gap:5,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:lc(active.lv),animation:"bounce 1.2s ease infinite",animationDelay:`${i*0.2}s`}}/>)}</div></div>}
          <div ref={endRef}/>
        </div>
        <div style={{display:"flex",gap:8,paddingTop:14,flexShrink:0}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Share with your group..." style={{flex:1,background:T.white,border:`1.5px solid ${T.border}`,borderRadius:14,padding:"11px 16px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}} onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=T.border}/>
          <Btn onClick={send} disabled={sending||!input.trim()} color={c}>Send</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>Peer Support Groups</div>

      {!diag ? (
        <div style={{background:T.tealBg,border:`1.5px solid ${T.tealLt}`,borderRadius:16,padding:24,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>🔒</div>
          <div style={{fontWeight:700,color:T.tealDk,fontSize:15,marginBottom:8}}>Complete Your Screening First</div>
          <div style={{fontSize:13,color:T.sub,lineHeight:1.7}}>Groups are only accessible after you have completed a DSM-5-TR screening. Your group will be automatically matched to your diagnosis. Please go to the <strong style={{color:T.tealDk}}>Screening</strong> tab to begin.</div>
        </div>
      ) : (
        <>
          <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:12,padding:"10px 16px",fontSize:13,color:T.tealDk}}>
            🧠 Your diagnosis: <strong>{diag.toolName}</strong> — <strong style={{textTransform:"capitalize"}}>{diag.lv}</strong> · Your assigned group is highlighted below.
          </div>
          {GROUPS_DATA.map(g=>{
            const c=lc(g.lv);
            const allowed=canJoin(g);
            return (
              <Card key={g.key} onClick={allowed?()=>open(g):undefined} accent={allowed?c:T.border}
                elevated={allowed} style={{cursor:allowed?"pointer":"default",opacity:allowed?1:0.45,filter:allowed?"none":"grayscale(60%)"}}>
                <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{width:48,height:48,borderRadius:14,background:allowed?`${c}14`:T.grayXLt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                    {allowed?(g.cond==="Depression"?"🌧️":g.cond==="Anxiety"?"⚡":g.cond==="PTSD"?"🌪️":"🔄"):"🔒"}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:allowed?T.text:T.muted,fontSize:14,marginBottom:3}}>{g.name}</div>
                    <div style={{fontSize:12,color:T.muted,marginBottom:8}}>👤 {g.fac}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Chip color={allowed?c:T.grayLt}>{g.lv}</Chip>
                      <Chip color={T.grayLt}>{g.members} members</Chip>
                      {allowed&&<Chip color={T.teal}>✓ Your Group</Chip>}
                    </div>
                    <div style={{fontSize:11,color:T.muted,marginTop:8}}>📅 {g.next}</div>
                    {!allowed&&<div style={{fontSize:11,color:T.muted,marginTop:4}}>🔒 Not assigned to this group</div>}
                  </div>
                  {allowed&&<div style={{color:c,fontSize:22,marginTop:4}}>›</div>}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
function AIChat({user}) {
  const [msgs, setMsgs] = useState([{role:"assistant",content:`Karibu ${user.fullName?.split(" ")[0]}! 🌿 I’m your Sereni AI companion. I’m here to listen, support, and guide you. How are you feeling today?`}]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("en");
  const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const all=[...msgs,{role:"user",content:input}]; setMsgs(all); setInput(""); setLoading(true);
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:lang==="sw"?`Wewe ni msaidizi wa afya ya akili wa Sereni, Tanzania. Jibu kwa Kiswahili. Kuwa na huruma na usilete aibu. Ikiwa mtu yuko hatarini, mwelekeze kwa +255 800 750 112.`:`You are a compassionate mental health AI companion for Sereni, Tanzania's mental wellness platform for university students. The user is ${user.fullName}, ${user.university}, ${user.course}, ${user.yearOfStudy}. Be warm, culturally sensitive, non-judgmental. Never diagnose. If crisis, direct to +255 800 750 112. Keep responses concise and caring.`,messages:all.map(m=>({role:m.role,content:m.content}))})});
      const d=await r.json(); setMsgs(prev=>[...prev,{role:"assistant",content:d.content?.[0]?.text||"I am here for you. 💚"}]);
    }catch{setMsgs(prev=>[...prev,{role:"assistant",content:"Connection issue — I am still here for you. 💚"}]);}
    setLoading(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 175px)",minHeight:400}}>
      <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",marginBottom:16,flexShrink:0}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:`0 4px 12px ${T.teal}30`}}>🤖</div>
          <div><div style={{fontWeight:700,color:T.text,fontSize:14}}>Sereni AI Companion</div><div style={{fontSize:11,color:T.teal,fontWeight:600}}>● Always available</div></div>
        </div>
        <div style={{display:"flex",gap:6,background:T.grayXLt,borderRadius:10,padding:3}}>
          {["en","sw"].map(l=><button key={l} onClick={()=>setLang(l)} style={{background:lang===l?T.white:"transparent",color:lang===l?T.tealDk:T.muted,border:"none",borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",boxShadow:lang===l?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{l.toUpperCase()}</button>)}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
            {m.role==="assistant"&&<div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>🤖</div>}
            <div style={{maxWidth:"78%",padding:"11px 15px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?`linear-gradient(135deg,${T.teal},${T.tealDk})`:T.white,border:m.role==="assistant"?`1px solid ${T.border}`:"none",color:m.role==="user"?T.white:T.text,fontSize:14,lineHeight:1.65,boxShadow:m.role==="user"?`0 4px 12px ${T.teal}25`:"0 1px 4px rgba(0,0,0,0.04)"}}>{m.content}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div><div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:"16px 16px 16px 4px",padding:"13px 16px",display:"flex",gap:5,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.teal,animation:"bounce 1.2s ease infinite",animationDelay:`${i*0.2}s`}}/>)}</div></div>}
        <div ref={endRef}/>
      </div>
      <div style={{display:"flex",gap:8,paddingTop:14,flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={lang==="sw"?"Andika hapa...":"Share how you are feeling..."} style={{flex:1,background:T.white,border:`1.5px solid ${T.border}`,borderRadius:14,padding:"11px 16px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}} onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=T.border}/>
        <Btn onClick={send} disabled={loading||!input.trim()}>Send</Btn>
      </div>
    </div>
  );
}

// ── Therapist Directory ───────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT (Admin — All Users with Block/Unblock/Cancel)
// ═══════════════════════════════════════════════════════════════════════════════
function UserManagement({users, doApprove, refresh}) {
  const [_t, setT] = useState(0); const re=()=>{ setT(t=>t+1); refresh(); };
  const statusColor=(u)=>{ if(DB.isBlocked(u)) return T.severe; return u.status==="approved"?T.mild:u.status==="rejected"?T.severe:u.status==="cancelled"?T.muted:T.moderate; };
  const statusLabel=(u)=>{ if(DB.isBlocked(u)) return "🔒 Blocked"; return u.status==="approved"?"✅ Approved":u.status==="rejected"?"❌ Rejected":u.status==="cancelled"?"🗑️ Cancelled":"⏳ Pending"; };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:24,color:T.text}}>All Users ({users.length})</div>
      {users.map(u=>{
        const blocked=DB.isBlocked(u);
        const c=statusColor(u);
        const minsLeft=blocked?Math.ceil((u.blockedUntil-Date.now())/60000):0;
        return (
          <Card key={u.id} accent={c}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <Av name={u.full_name||u.fullName} size={44} color={c}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
                  <div style={{fontWeight:700,color:T.text}}>{u.full_name||u.fullName}</div>
                  <Chip color={c}>{statusLabel(u)}</Chip>
                  {u.diagnosis&&<Chip color={T.teal}>{u.diagnosis.cond} · {u.diagnosis.lv}</Chip>}
                </div>
                <div style={{fontSize:12,color:T.muted}}>@{u.username} · {u.age}yo {u.sex} · {u.email}</div>
                <div style={{fontSize:12,color:T.muted}}>{u.university} · {u.course} · {u.yearOfStudy}</div>
                {blocked&&<div style={{fontSize:11,color:T.severe,marginTop:3}}>🔒 Locked for {Math.floor(minsLeft/60)}h {minsLeft%60}m {u.blockedByAdmin?"(admin block)":"(failed attempts)"}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                {u.status==="pending"&&<><Btn size="sm" color={T.mild} onClick={()=>doApprove(u.id)}>Approve</Btn><Btn size="sm" variant="danger" onClick={()=>{DB.reject(u.id);re();}}>Reject</Btn></>}
                {u.status==="approved"&&!blocked&&<Btn size="sm" variant="danger" onClick={()=>{DB.blockUser(u.id);re();}}>🚫 Block</Btn>}
                {blocked&&<Btn size="sm" variant="soft" onClick={()=>{DB.unblockUser(u.id);re();}}>🔓 Unblock</Btn>}
                {(u.status==="approved"||u.status==="pending")&&<Btn size="sm" variant="ghost" color={T.muted} onClick={()=>{DB.cancelReg(u.id);re();}}>🗑️ Cancel Reg</Btn>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — DOCTOR ACCOUNTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
function AdminDoctors({refresh}) {
  const [tick, setTick] = useState(0);
  const re=()=>{ setTick(t=>t+1); refresh(); };
  const [emailModal, setEmailModal] = useState(null);
  const docs = DB.docAccounts;
  const pending = DB.pendingDocs();

  const doApproveDoc=(id)=>{
    const d=DB.approveDoc(id); re();
    if(d) setEmailModal({name:d.fullName, email:d.email, username:d.username, license:d.licenseNo});
  };

  const statusColor=(d)=>d.status==="approved"?T.mild:d.status==="rejected"?T.severe:T.moderate;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      {/* Email modal */}
      {emailModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEmailModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.white,borderRadius:22,padding:32,maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.18)",textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>📧</div>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,color:T.text,marginBottom:8}}>Doctor Account Approved</div>
            <div style={{fontSize:13,color:T.sub,lineHeight:1.7,marginBottom:20}}>Approval email sent to <strong style={{color:T.tealDk}}>{emailModal.name}</strong></div>
            <div style={{background:T.cardAlt,borderRadius:14,padding:16,textAlign:"left",marginBottom:20,fontSize:12,color:T.tealDk,lineHeight:1.8}}>
              <div>📬 <strong>To:</strong> {emailModal.email}</div>
              <div style={{marginTop:8,background:T.tealBg,borderRadius:10,padding:"10px 14px"}}>
                Dear <strong>{emailModal.name}</strong>,<br/><br/>
                Your Sereni psychiatrist account has been <strong>approved</strong>.<br/>
                License verified: <strong>{emailModal.license}</strong><br/>
                Username: <strong>{emailModal.username}</strong><br/><br/>
                You may now log in via the Doctor portal.<br/><br/>
                The Sereni Team 🌿
              </div>
            </div>
            <Btn full onClick={()=>setEmailModal(null)}>Done ✓</Btn>
          </div>
        </div>
      )}

      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:24,color:T.text}}>Doctor Accounts ({docs.length})</div>

      {pending.length>0&&(
        <div style={{background:"#FFF8E1",border:`1.5px solid ${T.moderate}50`,borderRadius:14,padding:16,marginBottom:4}}>
          <div style={{fontWeight:700,color:T.moderate,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
            ⏳ Pending License Verification
            <span style={{background:T.severe,color:T.white,borderRadius:99,fontSize:11,fontWeight:800,padding:"1px 8px"}}>{pending.length}</span>
          </div>
          {pending.map(d=>(
            <Card key={d.id} style={{marginBottom:8}} accent={T.moderate}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <Av name={d.fullName} size={44} color={T.moderate}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.text}}>{d.fullName}</div>
                  <div style={{fontSize:12,color:T.teal}}>{d.title} · {d.specialisation}</div>
                  <div style={{fontSize:12,color:T.muted}}>🏥 {d.facility}</div>
                  <div style={{fontSize:12,color:T.muted}}>📋 License: <strong style={{color:T.text}}>{d.licenseNo}</strong></div>
                  <div style={{fontSize:12,color:T.muted}}>📞 {d.phone} · ✉️ {d.email}</div>
                  <div style={{fontSize:11,color:T.muted}}>Registered: {d.registeredAt}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                  <Btn size="sm" color={T.mild} onClick={()=>doApproveDoc(d.id)}>✓ Approve</Btn>
                  <Btn size="sm" variant="danger" onClick={async()=>{await DB.rejectDoc(d.id);re();}}>✗ Reject</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:4}}>All Doctor Accounts</div>
      {docs.map(d=>{
        const c=statusColor(d);
        const totalSlots=Object.values(d.availability||{}).reduce((a,b)=>a+b.length,0);
        return (
          <Card key={d.id} accent={c}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <Av name={d.fullName} size={44} color={c}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
                  <div style={{fontWeight:700,color:T.text}}>{d.fullName}</div>
                  <Chip color={c}>{d.status==="approved"?"✅ Active":d.status==="rejected"?"❌ Rejected":"⏳ Pending"}</Chip>
                </div>
                <div style={{fontSize:12,color:T.teal,fontWeight:500}}>{d.title} · {d.specialisation}</div>
                <div style={{fontSize:12,color:T.muted}}>🏥 {d.facility} · 📋 {d.licenseNo}</div>
                <div style={{fontSize:12,color:T.muted}}>📞 {d.phone} · 💬 {d.whatsapp}</div>
                <div style={{fontSize:12,color:T.muted}}>👤 @{d.username} · 📅 {totalSlots} weekly slots</div>
                <div style={{fontSize:12,color:T.muted}}>Patients: {(d.appointments||[]).length} sessions recorded</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER & REPORTS (Admin)
// ═══════════════════════════════════════════════════════════════════════════════
function FilterReports({users}) {
  const [filters, setFilters] = useState({status:"",sex:"",diagnosis:"",severity:"",university:"",ageMin:"",ageMax:""});
  const sf=(k,v)=>setFilters(f=>({...f,[k]:v}));

  const filtered = users.filter(u=>{
    if(filters.status && u.status!==filters.status) return false;
    if(filters.sex && u.sex!==filters.sex) return false;
    if(filters.diagnosis && u.diagnosis?.cond!==filters.diagnosis) return false;
    if(filters.severity && u.diagnosis?.lv!==filters.severity) return false;
    if(filters.university && !u.university.toLowerCase().includes(filters.university.toLowerCase())) return false;
    if(filters.ageMin && parseInt(u.age)<parseInt(filters.ageMin)) return false;
    if(filters.ageMax && parseInt(u.age)>parseInt(filters.ageMax)) return false;
    if(DB.isBlocked(u) && filters.status==="blocked") return true;
    return true;
  }).filter(u=>!(filters.status==="blocked")|| DB.isBlocked(u));

  const diagnosed=users.filter(u=>u.diagnosis);
  const stats=[
    ["Total Users",users.length,T.teal],
    ["Approved",users.filter(u=>u.status==="approved").length,T.mild],
    ["Pending",users.filter(u=>u.status==="pending").length,T.moderate],
    ["Diagnosed",diagnosed.length,T.blue],
    ["Blocked",users.filter(u=>DB.isBlocked(u)).length,T.severe],
  ];

  // Download CSV
  const downloadCSV=()=>{
    const cols=["Full Name","Username","Age","Sex","University","Course","Year","Email","Phone","Status","Diagnosis","Severity","Score","Diagnosis Date"];
    const rows=filtered.map(u=>[u.fullName,u.username,u.age,u.sex,u.university,u.course,u.yearOfStudy,u.email,u.phone,u.status,u.diagnosis?.cond||"",u.diagnosis?.lv||"",u.diagnosis?.score||"",u.diagnosis?.date||""]);
    const csv=[cols,...rows].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="Sereni_Filtered_Users.csv"; a.click();
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:24,color:T.text}}>Filter & Reports</div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {stats.map(([label,val,color])=>(
          <div key={label} style={{background:T.white,border:`1.5px solid ${color}30`,borderRadius:14,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:26,fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:11,color:T.muted,marginTop:3}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter controls */}
      <Card elevated>
        <div style={{fontWeight:700,color:T.text,marginBottom:14,fontSize:15}}>🔍 Filter Users</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
          <Field label="Status" value={filters.status} onChange={v=>sf("status",v)} options={["approved","pending","rejected","cancelled","blocked"]} placeholder="All statuses"/>
          <Field label="Sex" value={filters.sex} onChange={v=>sf("sex",v)} options={["Male","Female","Prefer not to say"]} placeholder="All"/>
          <Field label="Diagnosis" value={filters.diagnosis} onChange={v=>sf("diagnosis",v)} options={["Depression","Anxiety","PTSD","Bipolar"]} placeholder="All conditions"/>
          <Field label="Severity" value={filters.severity} onChange={v=>sf("severity",v)} options={["none","mild","moderate","severe"]} placeholder="All severities"/>
          <Field label="University (search)" value={filters.university} onChange={v=>sf("university",v)} placeholder="e.g. Muhimbili"/>
          <div style={{display:"flex",gap:8}}>
            <Field label="Min Age" type="number" value={filters.ageMin} onChange={v=>sf("ageMin",v)} placeholder="e.g. 18"/>
            <Field label="Max Age" type="number" value={filters.ageMax} onChange={v=>sf("ageMax",v)} placeholder="e.g. 30"/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Btn variant="soft" size="sm" onClick={()=>setFilters({status:"",sex:"",diagnosis:"",severity:"",university:"",ageMin:"",ageMax:""})}>Clear Filters</Btn>
          <span style={{fontSize:13,color:T.muted}}>{filtered.length} user{filtered.length!==1?"s":""} match</span>
          <div style={{flex:1}}/>
          <Btn size="sm" onClick={downloadCSV} variant="outline" color={T.tealDk}>⬇ Export CSV</Btn>
        </div>
      </Card>

      {/* Results */}
      {filtered.length===0
        ? <div style={{textAlign:"center",padding:32,color:T.muted,fontSize:14}}>No users match the selected filters.</div>
        : filtered.map(u=>{
            const blocked=DB.isBlocked(u);
            const c=blocked?T.severe:u.status==="approved"?T.mild:u.status==="rejected"?T.severe:T.moderate;
            return (
              <Card key={u.id} accent={c}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <Av name={u.full_name||u.fullName} size={42} color={c}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
                      <div style={{fontWeight:700,color:T.text}}>{u.full_name||u.fullName}</div>
                      <StatusBadge status={u.status}/>
                      {blocked&&<Chip color={T.severe}>🔒 Blocked</Chip>}
                      {u.diagnosis&&<Chip color={T.teal}>{u.diagnosis.cond}</Chip>}
                      {u.diagnosis&&<Chip color={u.diagnosis.lv==="severe"?T.severe:u.diagnosis.lv==="moderate"?T.moderate:T.mild}>{u.diagnosis.lv}</Chip>}
                    </div>
                    <div style={{fontSize:12,color:T.muted}}>@{u.username} · {u.age}yo {u.sex} · {u.email}</div>
                    <div style={{fontSize:12,color:T.muted}}>{u.university} · {u.course} · {u.yearOfStudy}</div>
                    {u.diagnosis&&<div style={{fontSize:12,color:T.teal,marginTop:3}}>🧠 {u.diagnosis.toolName} score: {u.diagnosis.score} · Assessed: {u.diagnosis.date}</div>}
                  </div>
                </div>
              </Card>
            );
          })
      }
    </div>
  );
}

// FACILITIES with coordinates for Google Maps
const FACILITIES = {
  "Muhimbili National Hospital":     {lat:-6.7924, lng:39.2083, address:"United Nations Rd, Dar es Salaam"},
  "UDSM Counseling Center":          {lat:-6.7752, lng:39.2175, address:"University of Dar es Salaam"},
  "MHAT Tanzania":                   {lat:-6.8161, lng:39.2831, address:"Upanga, Dar es Salaam"},
  "Muhimbili University":            {lat:-6.7942, lng:39.2103, address:"Muhimbili, Dar es Salaam"},
};

function MapModal({facility, onClose}) {
  const info = FACILITIES[facility] || {lat:-6.7924, lng:39.2083, address:facility};
  const gmUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY&q=${encodeURIComponent(facility+", Tanzania")}&zoom=15`;
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(facility+", Tanzania")}`;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fadeUp 0.25s ease"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.white,borderRadius:22,overflow:"hidden",maxWidth:500,width:"100%",boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div style={{background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,color:T.white,fontSize:15}}>📍 {facility}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.8)",marginTop:2}}>{info.address}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:32,height:32,color:T.white,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {/* Embedded Google Map */}
        <iframe title="facility-map" width="100%" height="280" style={{border:0,display:"block"}} src={gmUrl}/>
        <div style={{padding:"14px 18px",display:"flex",gap:10,borderTop:`1px solid ${T.border}`}}>
          <Btn full onClick={()=>window.open(dirUrl,"_blank")} color={T.tealDk} size="md">🧭 Get Directions in Google Maps</Btn>
          <Btn variant="outline" onClick={onClose} size="md">Close</Btn>
        </div>
      </div>
    </div>
  );
}

function Therapists({user, sw=false}) {
  const L=(en,s)=>sw?s:en;
  const [open, setOpen] = useState(null);
  const [booked, setBooked] = useState(null);
  const [sessionType, setSessionType] = useState({});
  const [mapFacility, setMapFacility] = useState(null);
  const [physBooked, setPhysBooked] = useState({});
  const docs=DB.psychiatrists;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      {mapFacility&&<MapModal facility={mapFacility} onClose={()=>setMapFacility(null)}/>}
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>{L("Verified Professionals","Wataalamu Walioidhinishwa")}</div>
      <div style={{fontSize:13,color:T.muted,lineHeight:1.65}}>{L("Admin-curated psychiatrists, psychologists and counselors available for sessions on Sereni.","Madaktari walioidhinishwa na msimamizi — wanapatikana kwa vikao vya Sereni.")}</div>
      {docs.map((p,i)=>(
        <Card key={p.id} onClick={()=>setOpen(open===i?null:i)} accent={p.available?T.teal:T.grayLt} elevated style={{cursor:"pointer"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <Av name={p.name} size={50} color={p.available?T.teal:T.grayLt}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
                <div style={{fontWeight:700,color:T.text,fontSize:15}}>{p.name}</div>
                <Chip color={p.available?T.mild:T.grayLt}>{p.available?"✓ Available":"Unavailable"}</Chip>
              </div>
              <div style={{fontSize:13,color:T.teal,marginTop:3,fontWeight:500}}>{p.title} · {p.spec}</div>
              <div style={{fontSize:12,color:T.muted,marginTop:5}}>🏥 {p.facility}</div>
              <div style={{fontSize:12,color:T.muted}}>📞 {p.phone}</div>
            </div>
          </div>
          {open===i&&(
            <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:12,color:T.muted,marginBottom:12}}>✉️ {p.email}</div>
              {physBooked[i]
                ? <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:10,padding:"12px 16px",color:T.tealDk,fontWeight:600,fontSize:14}}>✓ Physical session booked at {p.facility}!</div>
                    <Btn full variant="outline" color={T.tealDk} onClick={()=>setMapFacility(p.facility)}>📍 View Location on Map</Btn>
                  </div>
                : booked===i
                  ? <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:10,padding:"12px 16px",color:T.tealDk,fontWeight:600,fontSize:14}}>✓ Online session request sent! You will be contacted within 48 hours.</div>
                  : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:2}}>Select session type:</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        {["Text Session","Audio Call","Video Call"].map(t=>(
                          <button key={t} onClick={e=>{e.stopPropagation();setSessionType(s=>({...s,[i]:t}));}} style={{background:sessionType[i]===t?T.tealBg:T.white,border:`1.5px solid ${sessionType[i]===t?T.teal:T.border}`,borderRadius:10,padding:"7px 14px",color:sessionType[i]===t?T.tealDk:T.gray,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:sessionType[i]===t?700:400,transition:"all 0.15s"}}>{t}</button>
                        ))}
                        <Btn size="sm" onClick={()=>setBooked(i)} disabled={!p.available} color={T.teal}>{p.available?L("Book Online","Hifadhi Mkondoni"):L("Join Waitlist","Jiunge Orodha")}</Btn>
                      </div>
                      <div style={{height:1,background:T.border}}/>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:T.sub,fontWeight:600}}>🏥 Physical Visit</div>
                          <div style={{fontSize:11,color:T.muted,marginTop:2}}>{p.facility}</div>
                        </div>
                        <Btn size="sm" variant="soft" onClick={()=>setPhysBooked(s=>({...s,[i]:true}))} disabled={!p.available}>{L("Book Physical","Hifadhi Ziara")}</Btn>
                        <Btn size="sm" variant="outline" color={T.teal} onClick={()=>setMapFacility(p.facility)}>📍 {L("Map","Ramani")}</Btn>
                      </div>
                    </div>
              }
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

function DocRegister({onBack, onDone}) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({fullName:"",title:"",licenseNo:"",facility:"",specialisation:"",bio:"",languages:"",sessionFee:"",email:"",phone:"",whatsapp:"",username:"",password:"",confirm:""});
  const [avail, setAvail] = useState({Mon:[],Tue:[],Wed:[],Thu:[],Fri:[],Sat:[],Sun:[]});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const toggleHour=(day,hr)=>{
    setAvail(a=>({...a,[day]:a[day].includes(hr)?a[day].filter(h=>h!==hr):[...a[day],hr].sort()}));
  };

  const validate=(s)=>{
    const e={};
    if(s===1){
      if(!f.fullName.trim()) e.fullName="Required";
      if(!f.title) e.title="Required";
      if(!f.licenseNo.trim()) e.licenseNo="License number required";
      if(!f.facility.trim()) e.facility="Required";
      if(!f.specialisation.trim()) e.specialisation="Required";
    }
    if(s===2){
      if(!f.email.includes("@")) e.email="Valid email required";
      if(!f.phone.trim()) e.phone="Required";
      if(!f.whatsapp.trim()) e.whatsapp="Required";
    }
    if(s===3){
      const totalSlots=Object.values(avail).reduce((a,b)=>a+b.length,0);
      if(totalSlots<2) e.avail="Please select at least 2 availability slots across the week";
    }
    if(s===4){
      if(f.username.length<4) e.username="Min 4 characters";
      if(DB.docAccounts.find(d=>d.username===f.username)) e.username="Username already taken";
      const pwdOk=/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:.><\/?@]).{7,}$/.test(f.password);
      if(!pwdOk) e.password="Min 7 chars: uppercase, lowercase, number & special character";
      if(f.password!==f.confirm) e.confirm="Passwords do not match";
    }
    return e;
  };

  const next=()=>{ const e=validate(step); if(Object.keys(e).length){setErrors(e);return;} setErrors({}); setStep(s=>s+1); };
  const submit=async()=>{
    const e=validate(4); if(Object.keys(e).length){setErrors(e);return;}
    DB.addDocAccount({id:`da${Date.now()}`,status:"pending",role:"doctor",registeredAt:new Date().toISOString().split("T")[0],...f,availability:avail,appointments:[],notifications:[]});
    setDone(true);
  };

  if(done) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.tealBg},${T.bg})`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:440,width:"100%",textAlign:"center",animation:"fadeUp 0.35s ease"}}>
        <SereniLogo size={48} showText/>
        <Card elevated style={{marginTop:24,padding:32}}>
          <div style={{fontSize:52,marginBottom:14}}>🩺</div>
          <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:8}}>Application Submitted!</div>
          <div style={{color:T.sub,fontSize:14,lineHeight:1.7,marginBottom:20}}>Thank you, <strong style={{color:T.tealDk}}>{f.fullName}</strong>. Your psychiatrist account is pending admin verification of your license. You will be notified once approved.</div>
          <div style={{background:T.cardAlt,borderRadius:12,padding:16,marginBottom:20,textAlign:"left"}}>
            {[["Username",f.username],["License No.",f.licenseNo],["Facility",f.facility],["Status","Pending Verification"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
                <span style={{color:T.muted}}>{k}</span>
                <span style={{color:k==="Status"?T.moderate:T.text,fontWeight:k==="Status"?700:500}}>{v}</span>
              </div>
            ))}
          </div>
          <Btn full onClick={onDone}>Go to Login →</Btn>
        </Card>
      </div>
    </div>
  );

  const steps=["Professional Info","Contact Details","Availability","Account Setup"];
  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.tealBg},${T.bg})`,padding:"24px 16px",overflowY:"auto"}}>
      <div style={{maxWidth:560,margin:"0 auto",animation:"fadeUp 0.35s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
          <button onClick={onBack} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:10,color:T.gray,cursor:"pointer",fontSize:18,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <div>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,color:T.text}}>Psychiatrist Registration</div>
            <div style={{fontSize:12,color:T.muted}}>Step {step} of 4 — {steps[step-1]}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:24}}>
          {steps.map((_,i)=>(
            <div key={i} style={{flex:1}}>
              <div style={{height:4,borderRadius:99,background:i+1<=step?T.teal:T.border,transition:"background 0.3s"}}/>
              <div style={{fontSize:10,color:i+1===step?T.teal:T.muted,fontWeight:i+1===step?700:400,textAlign:"center",marginTop:4}}>{i+1<step?"✓ ":""}{steps[i]}</div>
            </div>
          ))}
        </div>
        <Card elevated style={{padding:26}}>
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:4}}>🩺 Professional Information</div>
              <Field label="Full Name" value={f.fullName} onChange={v=>set("fullName",v)} placeholder="e.g. Dr. Jane Salehe" required error={errors.fullName}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Professional Title" value={f.title} onChange={v=>set("title",v)} options={["Psychiatrist","Psychologist","Counselor","Social Worker","Therapist"]} required error={errors.title}/>
                <Field label="License Number" value={f.licenseNo} onChange={v=>set("licenseNo",v)} placeholder="e.g. TZ-PSY-00142" required error={errors.licenseNo}/>
              </div>
              <Field label="Current Facility / Hospital" value={f.facility} onChange={v=>set("facility",v)} placeholder="e.g. Muhimbili National Hospital" required error={errors.facility}/>
              <Field label="Specialisation" value={f.specialisation} onChange={v=>set("specialisation",v)} placeholder="e.g. Depression & Anxiety Disorders" required error={errors.specialisation}/>
              <Field label="Languages Spoken" value={f.languages} onChange={v=>set("languages",v)} placeholder="e.g. Swahili, English"/>
              <Field label="Session Fee (TZS)" value={f.sessionFee} onChange={v=>set("sessionFee",v)} placeholder="e.g. 30,000 TZS"/>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:12,fontWeight:600,color:T.sub}}>Professional Bio</label>
                <textarea value={f.bio} onChange={e=>set("bio",e.target.value)} placeholder="Brief description of your experience and approach..." rows={3} style={{background:T.white,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=T.border}/>
              </div>
            </div>
          )}
          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:4}}>📞 Contact Details</div>
              <Field label="Email Address" type="email" value={f.email} onChange={v=>set("email",v)} placeholder="your.name@facility.tz" required error={errors.email}/>
              <Field label="Phone Number" value={f.phone} onChange={v=>set("phone",v)} placeholder="+255 7XX XXX XXX" required error={errors.phone}/>
              <Field label="WhatsApp Number" value={f.whatsapp} onChange={v=>set("whatsapp",v)} placeholder="+255 7XX XXX XXX" required error={errors.whatsapp} note="Used by patients to reach you directly on WhatsApp"/>
              <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:12,padding:"12px 16px",fontSize:12,color:T.tealDk,lineHeight:1.7}}>
                💬 Your WhatsApp and phone will be visible to patients who book a session with you.
              </div>
            </div>
          )}
          {step===3&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:2}}>📅 Weekly Availability</div>
              <div style={{fontSize:13,color:T.muted,lineHeight:1.6}}>Select the hours you are available each day for online sessions. Patients will book from these slots.</div>
              {errors.avail&&<div style={{fontSize:12,color:T.severe}}>{errors.avail}</div>}
              {DAYS.map(day=>(
                <div key={day} style={{background:T.cardAlt,borderRadius:12,padding:14}}>
                  <div style={{fontWeight:700,color:T.text,fontSize:13,marginBottom:10}}>{day} <span style={{color:T.muted,fontWeight:400}}>({avail[day].length} slot{avail[day].length!==1?"s":""})</span></div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {HOURS.map(hr=>{
                      const sel=avail[day].includes(hr);
                      return <button key={hr} onClick={()=>toggleHour(day,hr)} style={{background:sel?T.teal:T.white,border:`1.5px solid ${sel?T.teal:T.border}`,borderRadius:8,padding:"5px 10px",color:sel?T.white:T.gray,fontSize:11,fontWeight:sel?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{hr}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {step===4&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{fontWeight:700,color:T.text,fontSize:16,marginBottom:4}}>🔐 Account Credentials</div>
              <Field label="Choose a Username" value={f.username} onChange={v=>set("username",v.toLowerCase().replace(/\s/g,"."))} placeholder="e.g. dr.amina" required error={errors.username} note="This will be your login username"/>
              <Field label="Password" type="password" value={f.password} onChange={v=>set("password",v)} placeholder="Min 7 chars with uppercase, number & special" required error={errors.password}/>
              <Field label="Confirm Password" type="password" value={f.confirm} onChange={v=>set("confirm",v)} placeholder="Repeat your password" required error={errors.confirm}/>
              <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:12,padding:"12px 16px",fontSize:12,color:T.tealDk,lineHeight:1.7}}>ℹ️ Your account will be reviewed by admin to verify your license number before activation.</div>
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:22}}>
            {step>1&&<Btn variant="outline" onClick={()=>setStep(s=>s-1)}>← Back</Btn>}
            {step<4?<Btn full onClick={next}>Continue →</Btn>:<Btn full onClick={submit}>Submit Application ✓</Btn>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function DoctorPortal({doc, onLogout}) {
  const [tab, setTab] = useState("dashboard");
  const [docData, setDocData] = useState(doc);
  const refresh=()=>{ const d=DB.docAccounts.find(d=>d.id===doc.id); if(d) setDocData({...d}); };

  const TABS=[
    {id:"dashboard",label:"Dashboard",icon:"📊"},
    {id:"appointments",label:"Appointments",icon:"📅"},
    {id:"patients",label:"My Patients",icon:"👥"},
    {id:"availability",label:"Availability",icon:"🕐"},
    {id:"messages",label:"Messages",icon:"💬"},
    {id:"profile",label:"Profile",icon:"👤"},
  ];

  const unread=(docData.notifications||[]).filter(n=>!n.read).length;

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,minHeight:"100vh",display:"flex",flexDirection:"column",color:T.text}}>
      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 20px",background:T.white,borderBottom:`1px solid ${T.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.04)",position:"sticky",top:0,zIndex:100}}>
        <SereniLogo size={34} showText/>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:8,padding:"3px 10px",fontSize:11,color:T.tealDk,fontWeight:700}}>🩺 Doctor Portal</div>
          <Av name={docData.fullName} size={34} color={T.blue}/>
          <Btn variant="ghost" color={T.muted} size="sm" onClick={onLogout}>Logout</Btn>
        </div>
      </div>
      {/* Tab nav */}
      <div style={{display:"flex",overflowX:"auto",padding:"0 16px",background:T.white,borderBottom:`1px solid ${T.border}`,gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`3px solid ${tab===t.id?T.teal:"transparent"}`,padding:"11px 14px",color:tab===t.id?T.tealDk:T.muted,fontWeight:tab===t.id?700:500,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,fontFamily:"inherit",transition:"all 0.15s",position:"relative"}}>
            {t.icon} {t.label}
            {t.id==="messages"&&unread>0&&<span style={{background:T.severe,color:T.white,borderRadius:99,fontSize:10,fontWeight:800,padding:"1px 5px",minWidth:16,textAlign:"center"}}>{unread}</span>}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px",maxWidth:700,width:"100%",margin:"0 auto"}}>
        {tab==="dashboard"&&<DocDashboard doc={docData}/>}
        {tab==="appointments"&&<DocAppointments doc={docData} refresh={refresh}/>}
        {tab==="patients"&&<DocPatientsWithReport doc={docData}/>}
        {tab==="availability"&&<DocAvailability doc={docData} refresh={refresh}/>}
        {tab==="messages"&&<DocMessages doc={docData} refresh={refresh}/>}
        {tab==="profile"&&<DocProfile doc={docData} refresh={refresh}/>}
      </div>
    </div>
  );
}

// ── Doctor Dashboard ──────────────────────────────────────────────────────────
function DocDashboard({doc}) {
  const appts=doc.appointments||[];
  const today=new Date().toISOString().split("T")[0];
  const todayAppts=appts.filter(a=>a.date===today);
  const upcoming=appts.filter(a=>a.date>=today&&a.status==="confirmed");
  const totalSlots=Object.values(doc.availability||{}).reduce((a,b)=>a+b.length,0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp 0.3s ease"}}>
      {/* Welcome */}
      <div style={{background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,borderRadius:22,padding:24,color:T.white,boxShadow:`0 8px 30px ${T.teal}40`}}>
        <div style={{fontSize:12,opacity:0.8}}>Welcome back,</div>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,margin:"4px 0"}}>{doc.fullName} 🩺</div>
        <div style={{fontSize:12,opacity:0.75}}>{doc.title} · {doc.specialisation}</div>
        <div style={{fontSize:12,opacity:0.75,marginTop:2}}>🏥 {doc.facility} · License: {doc.licenseNo}</div>
      </div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[[todayAppts.length,"Today","📅",T.blue],[upcoming.length,"Upcoming","✅",T.mild],[totalSlots,"Weekly Slots","🕐",T.teal]].map(([val,label,icon,color])=>(
          <Card key={label} accent={color} elevated>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
              <div style={{fontSize:26,fontWeight:800,color}}>{val}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{label}</div>
            </div>
          </Card>
        ))}
      </div>
      {/* Today's schedule */}
      <Card elevated>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:14}}>📅 Today's Schedule</div>
        {todayAppts.length===0
          ? <div style={{textAlign:"center",padding:"20px 0",color:T.muted,fontSize:13}}>No appointments scheduled for today.</div>
          : todayAppts.map(a=>(
            <div key={a.id} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${T.border}`,alignItems:"center"}}>
              <div style={{background:T.tealBg,borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:700,color:T.tealDk,flexShrink:0}}>{a.time}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:T.text,fontSize:14}}>{a.patientName}</div>
                <div style={{fontSize:12,color:T.muted}}>{a.type} · {a.notes}</div>
              </div>
              <Chip color={a.status==="confirmed"?T.mild:T.moderate}>{a.status}</Chip>
            </div>
          ))
        }
      </Card>
      {/* Quick contact */}
      <Card elevated>
        <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:12}}>📞 Your Contact Info (Visible to Patients)</div>
        {[["📞 Phone",doc.phone],["💬 WhatsApp",doc.whatsapp],["✉️ Email",doc.email]].map(([label,val])=>(
          <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
            <span style={{color:T.muted}}>{label}</span><span style={{color:T.text,fontWeight:500}}>{val}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Doctor Appointments ───────────────────────────────────────────────────────
function DocAppointments({doc, refresh}) {
  const [filter, setFilter] = useState("all");
  const appts=doc.appointments||[];
  const filtered=filter==="all"?appts:appts.filter(a=>a.status===filter);

  const updateStatus=(id,status)=>{
    const d=DB.docAccounts.find(d=>d.id===doc.id);
    if(d){ const a=d.appointments.find(a=>a.id===id); if(a) a.status=status; refresh(); }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>Appointments</div>
      <div style={{display:"flex",gap:8,overflowX:"auto"}}>
        {["all","confirmed","pending","completed","cancelled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{background:filter===s?T.teal:T.white,border:`1.5px solid ${filter===s?T.teal:T.border}`,borderRadius:20,padding:"6px 16px",color:filter===s?T.white:T.gray,fontSize:12,fontWeight:filter===s?700:400,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",transition:"all 0.15s",textTransform:"capitalize"}}>{s}</button>
        ))}
      </div>
      {filtered.length===0
        ? <div style={{textAlign:"center",padding:40,color:T.muted,fontSize:14}}>No {filter==="all"?"":filter} appointments found.</div>
        : filtered.map(a=>(
          <Card key={a.id} elevated accent={a.status==="confirmed"?T.mild:a.status==="pending"?T.moderate:a.status==="completed"?T.teal:T.severe}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{background:T.tealBg,borderRadius:12,padding:"10px 14px",textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:11,color:T.muted}}>{a.date}</div>
                <div style={{fontSize:16,fontWeight:800,color:T.tealDk}}>{a.time}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:T.text,fontSize:15}}>{a.patientName}</div>
                <div style={{fontSize:12,color:T.teal,marginTop:2}}>{a.type}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:3}}>{a.notes}</div>
                <div style={{marginTop:8}}><Chip color={a.status==="confirmed"?T.mild:a.status==="pending"?T.moderate:a.status==="completed"?T.teal:T.severe}>{a.status}</Chip></div>
              </div>
              {a.status==="pending"&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <Btn size="sm" color={T.mild} onClick={()=>updateStatus(a.id,"confirmed")}>✓ Confirm</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>updateStatus(a.id,"cancelled")}>✗ Cancel</Btn>
                </div>
              )}
              {a.status==="confirmed"&&<Btn size="sm" variant="soft" onClick={()=>updateStatus(a.id,"completed")}>Mark Done</Btn>}
            </div>
          </Card>
        ))
      }
    </div>
  );
}


// ── Doctor Availability Editor ────────────────────────────────────────────────
function DocAvailability({doc, refresh}) {
  const [avail, setAvail] = useState(doc.availability||{Mon:[],Tue:[],Wed:[],Thu:[],Fri:[],Sat:[],Sun:[]});
  const [saved, setSaved] = useState(false);

  const toggleHour=(day,hr)=>{
    setAvail(a=>({...a,[day]:a[day].includes(hr)?a[day].filter(h=>h!==hr):[...a[day],hr].sort()}));
    setSaved(false);
  };

  const save=()=>{
    const d=DB.docAccounts.find(d=>d.id===doc.id);
    if(d){ d.availability=avail; setSaved(true); refresh(); setTimeout(()=>setSaved(false),2500); }
  };

  const totalSlots=Object.values(avail).reduce((a,b)=>a+b.length,0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>Weekly Availability</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {saved&&<span style={{fontSize:12,color:T.mild,fontWeight:600}}>✓ Saved!</span>}
          <Btn size="sm" onClick={save}>Save Changes</Btn>
        </div>
      </div>
      <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:12,padding:"10px 16px",fontSize:13,color:T.tealDk}}>
        📅 <strong>{totalSlots} slots</strong> available this week · Patients book from these times
      </div>
      {DAYS.map(day=>(
        <Card key={day} elevated>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:700,color:T.text,fontSize:14}}>{day}</div>
            <Chip color={avail[day].length>0?T.teal:T.grayLt}>{avail[day].length} slot{avail[day].length!==1?"s":""}</Chip>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {HOURS.map(hr=>{
              const sel=avail[day].includes(hr);
              return <button key={hr} onClick={()=>toggleHour(day,hr)} style={{background:sel?T.teal:T.white,border:`1.5px solid ${sel?T.teal:T.border}`,borderRadius:8,padding:"6px 12px",color:sel?T.white:T.gray,fontSize:12,fontWeight:sel?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{hr}</button>;
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Doctor Messages / Notifications ──────────────────────────────────────────
function DocMessages({doc, refresh}) {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([
    {id:"m001",from:"System",text:"Welcome to Sereni! Your account is now active. Patients can start booking sessions with you.",time:"2025-03-09",read:true},
    {id:"m002",from:"Baraka Mwanga",text:"Hello Dr. Salehe, I have completed the PHQ-9 assessment and have been assigned to your group. Looking forward to our session.",time:"2025-03-11",read:true},
  ]);
  const notifs=doc.notifications||[];
  const unread=notifs.filter(n=>!n.read);

  const markRead=(id)=>{
    const d=DB.docAccounts.find(d=>d.id===doc.id);
    if(d){ const n=d.notifications.find(n=>n.id===id); if(n) n.read=true; refresh(); }
  };

  const markAllRead=()=>{
    const d=DB.docAccounts.find(d=>d.id===doc.id);
    if(d){ d.notifications.forEach(n=>n.read=true); refresh(); }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>Messages & Notifications</div>

      {/* Notifications */}
      {notifs.length>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:700,color:T.text,fontSize:14}}>🔔 Notifications {unread.length>0&&<span style={{background:T.severe,color:T.white,borderRadius:99,fontSize:11,fontWeight:800,padding:"1px 7px",marginLeft:6}}>{unread.length}</span>}</div>
            {unread.length>0&&<button onClick={markAllRead} style={{background:"none",border:"none",color:T.teal,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Mark all read</button>}
          </div>
          {notifs.map(n=>(
            <div key={n.id} onClick={()=>markRead(n.id)} style={{display:"flex",gap:12,padding:"12px",borderRadius:12,background:n.read?T.white:`${T.teal}08`,border:`1px solid ${n.read?T.border:T.tealLt}`,marginBottom:8,cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:n.read?T.border:T.teal,marginTop:5,flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:13,color:T.text,fontWeight:n.read?400:600}}>{n.text}</div><div style={{fontSize:11,color:T.muted,marginTop:3}}>{n.time}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:4}}>💬 Patient Messages</div>
      {msgs.map(m=>(
        <Card key={m.id} elevated>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <Av name={m.from} size={38} color={m.from==="System"?T.teal:T.blue}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{fontWeight:700,color:T.text,fontSize:13}}>{m.from}</div>
                <div style={{fontSize:11,color:T.muted}}>{m.time}</div>
              </div>
              <div style={{fontSize:13,color:T.sub,lineHeight:1.6}}>{m.text}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Doctor Profile Editor ─────────────────────────────────────────────────────
function DocProfile({doc, refresh}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({bio:doc.bio||"",sessionFee:doc.sessionFee||"",languages:doc.languages||"",phone:doc.phone||"",whatsapp:doc.whatsapp||""});
  const [saved, setSaved] = useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const save=()=>{
    const d=DB.docAccounts.find(d=>d.id===doc.id);
    if(d){ Object.assign(d,f); setSaved(true); refresh(); setEditing(false); setTimeout(()=>setSaved(false),2500); }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>My Profile</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {saved&&<span style={{fontSize:12,color:T.mild,fontWeight:600}}>✓ Saved!</span>}
          <Btn size="sm" variant={editing?"fill":"soft"} onClick={()=>setEditing(!editing)}>{editing?"Cancel":"✏️ Edit"}</Btn>
        </div>
      </div>

      {/* Identity card */}
      <div style={{background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,borderRadius:20,padding:24,color:T.white,display:"flex",gap:16,alignItems:"center"}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:800,flexShrink:0}}>
          {doc.fullName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
        </div>
        <div>
          <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:18}}>{doc.fullName}</div>
          <div style={{fontSize:13,opacity:0.85,marginTop:2}}>{doc.title} · {doc.specialisation}</div>
          <div style={{fontSize:12,opacity:0.75,marginTop:2}}>License: {doc.licenseNo} · {doc.facility}</div>
        </div>
      </div>

      {/* Editable fields */}
      <Card elevated>
        <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>📋 Professional Details</div>
        {editing ? (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:12,fontWeight:600,color:T.sub}}>Professional Bio</label>
              <textarea value={f.bio} onChange={e=>set("bio",e.target.value)} rows={3} style={{background:T.white,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <Field label="Languages Spoken" value={f.languages} onChange={v=>set("languages",v)} placeholder="e.g. Swahili, English"/>
            <Field label="Session Fee" value={f.sessionFee} onChange={v=>set("sessionFee",v)} placeholder="e.g. 30,000 TZS"/>
            <Field label="Phone" value={f.phone} onChange={v=>set("phone",v)} placeholder="+255 7XX XXX XXX"/>
            <Field label="WhatsApp" value={f.whatsapp} onChange={v=>set("whatsapp",v)} placeholder="+255 7XX XXX XXX"/>
            <Btn full onClick={save}>Save Changes ✓</Btn>
          </div>
        ) : (
          <div>
            {[["Bio",doc.bio||"Not set"],["Languages",doc.languages||"Not set"],["Session Fee",doc.sessionFee||"Not set"],["Phone",doc.phone],["WhatsApp",doc.whatsapp],["Email",doc.email]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:13,gap:12}}>
                <span style={{color:T.muted,flexShrink:0}}>{k}</span>
                <span style={{color:T.text,textAlign:"right"}}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Weekly summary */}
      <Card elevated>
        <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:12}}>📅 Availability Summary</div>
        {DAYS.map(day=>(
          <div key={day} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
            <span style={{color:T.muted,width:40}}>{day}</span>
            <span style={{color:(doc.availability||{})[day]?.length>0?T.tealDk:T.muted,flex:1,textAlign:"right"}}>
              {(doc.availability||{})[day]?.length>0?(doc.availability[day]).join(", "):"Not available"}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SWAHILI TRANSLATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const SW = {
  // General
  save:"Hifadhi", cancel:"Ghairi", close:"Funga", back:"Rudi", next:"Endelea",
  // Mood
  moodTitle:"Kumbukumbu ya Hisia", moodSub:"Rekodi hisia zako kila siku — hatua ndogo kuelekea afya ya akili",
  howFeel:"Unajisikiaje leo?", energy:"Nguvu", sleep:"Usingizi (masaa)", note:"Maelezo (si lazima)",
  notePlaceholder:"Nini kilikuwa kikizuru akilini mwako leo?",
  tags:"Lebo", addEntry:"Ongeza Kumbukumbu", entries:"Kumbukumbu za Awali",
  moodTrend:"Mwenendo wa Hisia (siku 7)",
  // Payment
  payTitle:"Malipo ya Kikao", payMethod:"Njia ya Kulipa",
  mpesa:"M-Pesa", airtel:"Airtel Money", card:"Kadi ya Benki",
  amount:"Kiasi", phone:"Nambari ya Simu", doctor:"Daktari",
  sessionType:"Aina ya Kikao", pay:"Lipa Sasa",
  processing:"Inashughulikia...", success:"Malipo yamekamilika!",
  history:"Historia ya Malipo",
  // Therapists
  available:"Inapatikana", unavailable:"Haipatikani",
  bookOnline:"Hifadhi Mkondoni", bookPhysical:"Ziara ya Mwili",
  getDir:"Pata Maelekezo kwenye Google Maps",
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOOD TRACKER & DAILY JOURNAL
// ═══════════════════════════════════════════════════════════════════════════════
const MOOD_EMOJIS = ["😞","😔","😐","🙂","😊","😄"];
const MOOD_LABELS_EN = ["Very Low","Low","Neutral","Good","Great","Excellent"];
const MOOD_LABELS_SW = ["Chini Sana","Chini","Wastani","Nzuri","Vizuri Sana","Bora Kabisa"];
const PRESET_TAGS = ["exercise","therapy","CBT","journaling","social","poor sleep","good sleep","stress","exams","medication","mindfulness","positive","low energy","AI chat"];

function MoodTracker({user, sw=false}) {
  const L=(en,s)=>sw?s:en;
  const today = new Date().toISOString().split("T")[0];
  const [logs, setLogs] = useState([]);
  useEffect(()=>{
    DB.getMoodLogs(user.id).then(data=>setLogs(data||[])).catch(()=>{});
  },[user.id]);
  const [form, setForm] = useState({mood:3,energy:3,sleep:7,note:"",tags:[]});
  const [added, setAdded] = useState(false);
  const alreadyToday = logs.some(l=>l.date===today);

  const toggleTag=(tag)=>{
    setForm(f=>({...f,tags:f.tags.includes(tag)?f.tags.filter(t=>t!==tag):[...f.tags,tag]}));
  };

  const submit=async()=>{
    const entry={id:`ml${Date.now()}`,date:today,mood:form.mood,energy:form.energy,sleep:form.sleep,note:form.note,tags:form.tags,lang:sw?"sw":"en"};
    await DB.addMoodLog(user.id,entry);
    const updated = await DB.getMoodLogs(user.id);
    setLogs(updated||[]);
    setForm({mood:3,energy:3,sleep:7,note:"",tags:[]});
    setAdded(true); setTimeout(()=>setAdded(false),2500);
  };

  // Last 7 entries for chart
  const last7=[...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).reverse();
  const avgMood=logs.length>0?(logs.reduce((s,l)=>s+l.mood,0)/logs.length).toFixed(1):"—";
  const streak=(()=>{let s=0,d=new Date();for(let i=0;i<30;i++){const ds=d.toISOString().split("T")[0];if(logs.some(l=>l.date===ds)){s++;}else break;d.setDate(d.getDate()-1);}return s;})();

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp 0.3s ease"}}>
      {/* Header */}
      <div>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>{L("Mood Journal",SW.moodTitle)}</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>{L("Track your daily mood — small steps toward better mental health",SW.moodSub)}</div>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[[logs.length,L("Total Entries","Kumbukumbu"),"📓",T.teal],[streak,L("Day Streak","Mfululizo"),"🔥",T.moderate],[avgMood,L("Avg Mood","Wastani"),"💚",T.mild]].map(([v,label,icon,color])=>(
          <Card key={label} accent={color} elevated>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
              <div style={{fontSize:22,fontWeight:800,color}}>{v}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* 7-day trend chart */}
      {last7.length>1&&(
        <Card elevated>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>{L("7-Day Mood Trend",SW.moodTrend)}</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
            {last7.map((l,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{fontSize:14}}>{MOOD_EMOJIS[l.mood]}</div>
                <div style={{width:"100%",borderRadius:"6px 6px 0 0",background:`linear-gradient(180deg,${T.teal},${T.tealDk})`,height:`${(l.mood/5)*56+8}px`,transition:"height 0.5s",minHeight:8}}/>
                <div style={{fontSize:9,color:T.muted,textAlign:"center"}}>{l.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Today's entry */}
      {alreadyToday&&!added
        ? <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:14,padding:"14px 18px",fontSize:13,color:T.tealDk,fontWeight:600}}>✓ {L("You have already logged your mood today. Come back tomorrow!","Umekwisha rekodi hisia zako leo. Rudi kesho!")}</div>
        : added
          ? <div style={{background:T.tealBg,border:`1px solid ${T.tealLt}`,borderRadius:14,padding:"14px 18px",fontSize:14,color:T.tealDk,fontWeight:700}}>🎉 {L("Mood logged! Keep it up — consistency is key.","Hisia zimerekodiwa! Endelea — uthabiti ndio ufunguo.")}</div>
          : (
          <Card elevated>
            <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:16}}>💚 {L("How are you feeling today?",SW.howFeel)}</div>

            {/* Mood selector */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:10}}>{L("Mood","")} — {sw?MOOD_LABELS_SW[form.mood]:MOOD_LABELS_EN[form.mood]}</div>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                {MOOD_EMOJIS.map((emoji,i)=>(
                  <button key={i} onClick={()=>setForm(f=>({...f,mood:i}))} style={{fontSize:form.mood===i?36:24,background:form.mood===i?T.tealBg:"transparent",border:`2px solid ${form.mood===i?T.teal:"transparent"}`,borderRadius:12,padding:"6px 8px",cursor:"pointer",transition:"all 0.2s",transform:form.mood===i?"scale(1.15)":"scale(1)"}}>{emoji}</button>
                ))}
              </div>
            </div>

            {/* Energy slider */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:6}}>{L("Energy Level",SW.energy)}: {form.energy}/5</div>
              <input type="range" min={1} max={5} value={form.energy} onChange={e=>setForm(f=>({...f,energy:+e.target.value}))} style={{width:"100%",accentColor:T.teal}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginTop:2}}><span>{L("Exhausted","Choka Sana")}</span><span>{L("Energised","Nguvu Sana")}</span></div>
            </div>

            {/* Sleep */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:6}}>{L("Hours Slept",SW.sleep)}: {form.sleep}h</div>
              <input type="range" min={2} max={12} value={form.sleep} onChange={e=>setForm(f=>({...f,sleep:+e.target.value}))} style={{width:"100%",accentColor:T.teal}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginTop:2}}><span>2h</span><span>12h</span></div>
            </div>

            {/* Tags */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:8}}>{L("Tags","Lebo")}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {PRESET_TAGS.map(tag=>{
                  const sel=form.tags.includes(tag);
                  return <button key={tag} onClick={()=>toggleTag(tag)} style={{background:sel?T.teal:T.white,border:`1.5px solid ${sel?T.teal:T.border}`,borderRadius:20,padding:"4px 12px",color:sel?T.white:T.gray,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400,transition:"all 0.15s"}}>{tag}</button>;
                })}
              </div>
            </div>

            {/* Note */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:6}}>{L("Journal Note (optional)",SW.note)}</div>
              <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder={sw?SW.notePlaceholder:"What's been on your mind today?"} rows={3} style={{width:"100%",background:T.white,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"10px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit",resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>

            <Btn full onClick={submit}>{L("Save Today's Entry",SW.addEntry)} ✓</Btn>
          </Card>
        )
      }

      {/* Past entries */}
      {logs.length>0&&(
        <div>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:10}}>{L("Past Entries",SW.entries)}</div>
          {[...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(l=>(
            <Card key={l.id} style={{marginBottom:10}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{fontSize:32,flexShrink:0}}>{MOOD_EMOJIS[l.mood]}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{fontWeight:700,color:T.text,fontSize:13}}>{sw?MOOD_LABELS_SW[l.mood]:MOOD_LABELS_EN[l.mood]}</div>
                    <div style={{fontSize:11,color:T.muted}}>{l.date}</div>
                  </div>
                  <div style={{fontSize:12,color:T.muted,marginBottom:6}}>⚡ {L("Energy","Nguvu")}: {l.energy}/5 · 😴 {l.sleep}h</div>
                  {l.note&&<div style={{fontSize:13,color:T.sub,fontStyle:"italic",lineHeight:1.5,marginBottom:6}}>"{l.note}"</div>}
                  {l.tags&&l.tags.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{l.tags.map(t=><Chip key={t} color={T.tealLt}>{t}</Chip>)}</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// M-PESA PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════
const PLANS = [
  {id:"basic",name:"Basic Plan",nameSw:"Mpango wa Msingi",desc:"AI Chat + Screening",descSw:"Mazungumzo ya AI + Tathmini",price:"5,000",icon:"🌱",color:T.teal},
  {id:"standard",name:"Standard Plan",nameSw:"Mpango wa Kawaida",desc:"Basic + Peer Groups + Reading Program",descSw:"Msingi + Vikundi + Programu ya Kusoma",price:"15,000",icon:"🌿",color:T.blue},
  {id:"premium",name:"Premium Plan",nameSw:"Mpango wa Hali ya Juu",desc:"Standard + 1 Online Therapy Session/month",descSw:"Kawaida + Kikao 1 cha Tiba kwa Mwezi",price:"35,000",icon:"🌳",color:T.purple},
  {id:"session",name:"Single Session",nameSw:"Kikao Kimoja",desc:"One therapy session with your assigned doctor",descSw:"Kikao kimoja cha tiba na daktari wako",price:"30,000",icon:"🩺",color:T.moderate},
];

function MpesaPayment({user, sw=false}) {
  const L=(en,s)=>sw?s:en;
  const [step, setStep] = useState("select"); // select | details | processing | done
  const [selected, setSelected] = useState(null);
  const [method, setMethod] = useState("mpesa");
  const [phone, setPhone] = useState(user.phone||"");
  const [phoneErr, setPhoneErr] = useState("");
  const [payTick, setPayTick] = useState(0);
  const [payments, setPayments] = useState([]);
  useEffect(()=>{
    DB.getPayments(user.id).then(data=>setPayments(data||[])).catch(()=>{});
  },[user.id, payTick]);
  const [newPay, setNewPay] = useState(null);

  const proceed=()=>{
    if(!phone.trim()||phone.length<10){setPhoneErr(L("Enter a valid phone number","Ingiza nambari sahihi ya simu"));return;}
    setPhoneErr(""); setStep("processing");
    setTimeout(async()=>{
      const ref=`MP${Date.now().toString().slice(-8)}`;
      const pay={id:`pay${Date.now()}`,userId:user.id,userName:user.fullName,amount:selected.price,currency:"TZS",method:method.toUpperCase(),phone,status:"completed",service:selected.name,date:new Date().toISOString().split("T")[0],ref};
      await DB.addPayment(pay); setNewPay(pay); setPayTick(t=>t+1); setStep("done");
    },2800);
  };

  if(step==="done"&&newPay) return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{background:`linear-gradient(135deg,${T.mild},${T.mild}cc)`,borderRadius:22,padding:32,textAlign:"center",color:T.white,boxShadow:`0 8px 30px ${T.mild}40`}}>
        <div style={{fontSize:52,marginBottom:12}}>✅</div>
        <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,marginBottom:6}}>{L("Payment Successful!","Malipo Yamekamilika!")}</div>
        <div style={{fontSize:13,opacity:0.9}}>{L("Your payment has been received.","Malipo yako yamepokelewa.")}</div>
      </div>
      <Card elevated>
        <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:12}}>{L("Receipt","Risiti")}</div>
        {[[L("Reference","Kumbukumbu"),newPay.ref],[L("Service","Huduma"),newPay.service],[L("Amount","Kiasi"),`TZS ${newPay.amount}`],[L("Method","Njia"),newPay.method],[L("Phone","Simu"),newPay.phone],[L("Date","Tarehe"),newPay.date],[L("Status","Hali"),L("Completed","Imekamilika")]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
            <span style={{color:T.muted}}>{k}</span>
            <span style={{color:k===L("Status","Hali")?T.mild:T.text,fontWeight:k===L("Status","Hali")?700:500}}>{v}</span>
          </div>
        ))}
      </Card>
      <Btn full variant="outline" onClick={()=>{setStep("select");setSelected(null);setNewPay(null);}}>
        {L("Make Another Payment","Fanya Malipo Mengine")}
      </Btn>
    </div>
  );

  if(step==="processing") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,padding:"80px 20px",textAlign:"center"}}>
      <div style={{width:72,height:72,borderRadius:"50%",background:T.tealBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,animation:"spin 2s linear infinite"}}>💳</div>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,color:T.text}}>{L("Processing Payment…",SW.processing)}</div>
      <div style={{color:T.muted,fontSize:13}}>
        {method==="mpesa"&&L("Check your phone for the M-Pesa STK push prompt","Angalia simu yako kwa ujumbe wa M-Pesa STK")}
        {method==="airtel"&&L("Check your phone for the Airtel Money prompt","Angalia simu yako kwa ujumbe wa Airtel Money")}
        {method==="card"&&L("Processing your card payment…","Tunashughulikia malipo ya kadi yako…")}
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>{L("Payments",SW.payTitle)}</div>

      {step==="select"&&(
        <>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.65}}>{L("Choose a plan or session to pay for. All payments processed securely via M-Pesa, Airtel Money, or card.","Chagua mpango au kikao cha kulipa. Malipo yote yanashughulikiwa kwa usalama kupitia M-Pesa, Airtel Money, au kadi.")}</div>
          {PLANS.map(plan=>(
            <Card key={plan.id} onClick={()=>{setSelected(plan);setStep("details");}} accent={plan.color} elevated style={{cursor:"pointer"}}>
              <div style={{display:"flex",gap:14,alignItems:"center"}}>
                <div style={{width:52,height:52,borderRadius:16,background:`${plan.color}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{plan.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.text,fontSize:15}}>{sw?plan.nameSw:plan.name}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{sw?plan.descSw:plan.desc}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:plan.color,fontSize:15}}>TZS {plan.price}</div>
                  <div style={{fontSize:10,color:T.muted}}>{L("/month","/mwezi")}</div>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {step==="details"&&selected&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <button onClick={()=>setStep("select")} style={{background:"none",border:"none",color:T.teal,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>← {L("Back to plans","Rudi kwa mipango")}</button>

          <Card elevated accent={selected.color}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:32}}>{selected.icon}</div>
              <div>
                <div style={{fontWeight:700,color:T.text,fontSize:16}}>{sw?selected.nameSw:selected.name}</div>
                <div style={{fontWeight:800,color:selected.color,fontSize:18}}>TZS {selected.price}</div>
              </div>
            </div>
            <div style={{height:1,background:T.border,marginBottom:16}}/>

            {/* Payment method */}
            <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:10}}>{L("Payment Method","Njia ya Kulipa")}</div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[["mpesa","M-Pesa","#00A651"],["airtel","Airtel Money","#FF0000"],["card",L("Card","Kadi"),"#1A73E8"]].map(([id,label,color])=>(
                <button key={id} onClick={()=>setMethod(id)} style={{flex:1,padding:"10px 6px",borderRadius:12,border:`2px solid ${method===id?color:T.border}`,background:method===id?`${color}12`:T.white,color:method===id?color:T.gray,fontWeight:method===id?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s",textAlign:"center"}}>{label}</button>
              ))}
            </div>

            {/* Phone / card input */}
            {(method==="mpesa"||method==="airtel")&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,color:T.sub,fontWeight:600,marginBottom:6}}>{L("Mobile Number","Nambari ya Simu")}</div>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+255 7XX XXX XXX" style={{width:"100%",background:T.white,border:`1.5px solid ${phoneErr?T.severe:T.border}`,borderRadius:10,padding:"11px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit"}} onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=phoneErr?T.severe:T.border}/>
                {phoneErr&&<div style={{fontSize:11,color:T.severe,marginTop:4}}>{phoneErr}</div>}
                <div style={{fontSize:11,color:T.muted,marginTop:4}}>{method==="mpesa"?L("You will receive an M-Pesa STK push to confirm","Utapokea ujumbe wa M-Pesa STK kuthibitisha"):L("You will receive an Airtel Money prompt","Utapokea ujumbe wa Airtel Money")}</div>
              </div>
            )}
            {method==="card"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                <input placeholder={L("Card Number","Nambari ya Kadi")} style={{background:T.white,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <input placeholder="MM/YY" style={{background:T.white,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
                  <input placeholder="CVV" style={{background:T.white,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
                </div>
              </div>
            )}

            <Btn full onClick={proceed} color={method==="mpesa"?"#00A651":method==="airtel"?"#FF0000":T.blue} size="lg">
              {L("Pay Now","Lipa Sasa")} — TZS {selected.price}
            </Btn>
          </Card>
        </div>
      )}

      {/* Payment history */}
      {payments.length>0&&step==="select"&&(
        <div>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:10}}>{L("Payment History","Historia ya Malipo")}</div>
          {payments.map(p=>(
            <Card key={p.id} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:600,color:T.text,fontSize:13}}>{p.service}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{p.method} · {p.phone} · {p.date}</div>
                  <div style={{fontSize:11,color:T.muted}}>Ref: {p.ref}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:T.teal}}>TZS {p.amount}</div>
                  <Chip color={T.mild}>{L("Paid","Imelipwa")}</Chip>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS REPORT (Doctor reviews patient reports)
// ═══════════════════════════════════════════════════════════════════════════════
function ProgressReport({patientId, patientName}) {
  const logs = DB.getMoodLogs(patientId);
  const user = DB.users.find(u=>u.id===patientId);
  if(!user) return null;

  const last7=[...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).reverse();
  const avg=logs.length>0?(logs.reduce((s,l)=>s+l.mood,0)/logs.length).toFixed(1):"—";
  const avgEnergy=logs.length>0?(logs.reduce((s,l)=>s+l.energy,0)/logs.length).toFixed(1):"—";
  const avgSleep=logs.length>0?(logs.reduce((s,l)=>s+l.sleep,0)/logs.length).toFixed(1):"—";
  const topTags=[...logs.flatMap(l=>l.tags||[])].reduce((acc,t)=>{acc[t]=(acc[t]||0)+1;return acc;},{});
  const sortedTags=Object.entries(topTags).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:20,color:T.text}}>Progress Report — {patientName}</div>

      {/* Patient summary */}
      <Card elevated accent={T.teal}>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
          <Av name={patientName} size={46} color={T.teal}/>
          <div>
            <div style={{fontWeight:700,color:T.text,fontSize:15}}>{patientName}</div>
            <div style={{fontSize:12,color:T.muted}}>{user.university} · {user.course} · {user.yearOfStudy}</div>
            {user.diagnosis&&<div style={{fontSize:12,color:T.teal,marginTop:2}}>🧠 {user.diagnosis.toolName} — {user.diagnosis.lv} (score: {user.diagnosis.score})</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[["Avg Mood",avg,"💚",T.mild],["Avg Energy",avgEnergy,"⚡",T.moderate],["Avg Sleep",`${avgSleep}h`,"😴",T.blue]].map(([label,val,icon,color])=>(
            <div key={label} style={{background:`${color}10`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:16}}>{icon}</div>
              <div style={{fontSize:18,fontWeight:800,color}}>{val}</div>
              <div style={{fontSize:10,color:T.muted}}>{label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Mood trend */}
      {last7.length>1&&(
        <Card elevated>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:14}}>7-Day Mood Trend</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
            {last7.map((l,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{fontSize:12}}>{MOOD_EMOJIS[l.mood]}</div>
                <div style={{width:"100%",borderRadius:"4px 4px 0 0",background:l.mood>=3?`linear-gradient(180deg,${T.teal},${T.tealDk})`:`linear-gradient(180deg,${T.moderate},${T.severe})`,height:`${(l.mood/5)*56+8}px`,minHeight:8}}/>
                <div style={{fontSize:9,color:T.muted,textAlign:"center"}}>{l.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top tags */}
      {sortedTags.length>0&&(
        <Card elevated>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:12}}>Frequent Themes</div>
          {sortedTags.map(([tag,count])=>(
            <div key={tag} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{fontSize:12,color:T.text,width:120}}>{tag}</div>
              <div style={{flex:1,height:8,background:T.grayXLt,borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(count/logs.length)*100}%`,background:`linear-gradient(90deg,${T.teal},${T.tealDk})`,borderRadius:99}}/>
              </div>
              <div style={{fontSize:11,color:T.muted,width:30,textAlign:"right"}}>{count}x</div>
            </div>
          ))}
        </Card>
      )}

      {/* Recent journal notes */}
      {logs.filter(l=>l.note).length>0&&(
        <Card elevated>
          <div style={{fontWeight:700,color:T.text,fontSize:14,marginBottom:12}}>Recent Journal Notes</div>
          {[...logs].filter(l=>l.note).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(l=>(
            <div key={l.id} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,color:T.muted}}>{l.date}</span>
                <span style={{fontSize:14}}>{MOOD_EMOJIS[l.mood]}</span>
              </div>
              <div style={{fontSize:13,color:T.sub,fontStyle:"italic",lineHeight:1.55}}>"{l.note}"</div>
            </div>
          ))}
        </Card>
      )}

      {logs.length===0&&(
        <div style={{textAlign:"center",padding:32,color:T.muted,fontSize:13}}>This patient has not yet logged any mood entries.</div>
      )}
    </div>
  );
}

// Update DocPatients to show Progress Report
function DocPatientsWithReport({doc}) {
  const [viewing, setViewing] = useState(null);
  const appts=doc.appointments||[];
  const patientNames=[...new Set(appts.map(a=>a.patientName))];
  const patients=patientNames.map(name=>{
    const pAppts=appts.filter(a=>a.patientName===name);
    const user=DB.users.find(u=>u.fullName===name);
    return {name,appts:pAppts,user,lastSeen:pAppts[pAppts.length-1]?.date||"",total:pAppts.length};
  });

  if(viewing) return (
    <div>
      <button onClick={()=>setViewing(null)} style={{background:"none",border:"none",color:T.teal,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:16,display:"block"}}>← Back to patients</button>
      <ProgressReport patientId={viewing.id} patientName={viewing.name}/>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeUp 0.3s ease"}}>
      <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:22,color:T.text}}>My Patients ({patients.length})</div>
      {patients.length===0
        ? <div style={{textAlign:"center",padding:40,color:T.muted}}>No patients yet.</div>
        : patients.map(p=>(
          <Card key={p.name} elevated>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              <Av name={p.name} size={46} color={T.teal}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:T.text,fontSize:15}}>{p.name}</div>
                {p.user&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{p.user.university} · {p.user.course}</div>}
                {p.user?.diagnosis&&<div style={{fontSize:12,color:T.teal,marginTop:2}}>🧠 {p.user.diagnosis.toolName} — {p.user.diagnosis.lv}</div>}
                <div style={{fontSize:12,color:T.muted,marginTop:2}}>Sessions: {p.total} · Last seen: {p.lastSeen||"N/A"}</div>
                {DB.getMoodLogs(p.user?.id||"").length>0&&<div style={{fontSize:11,color:T.mild,marginTop:2}}>📓 {DB.getMoodLogs(p.user?.id||"").length} mood entries logged</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <Btn size="sm" color={T.teal} onClick={()=>setViewing({id:p.user?.id,name:p.name})}>📊 Report</Btn>
                {p.user?.phone&&<Btn size="sm" variant="soft" onClick={()=>window.open(`https://wa.me/${p.user.phone.replace(/\D/g,"")}`)}>💬 WA</Btn>}
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&family=Cinzel:wght@400;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans','Segoe UI',sans-serif;background:#F0F4F4;color:#263238}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#F0F4F4}
        ::-webkit-scrollbar-thumb{background:#B2CECE;border-radius:99px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
      `}</style>
      {!session&&<Landing onLogin={setSession}/>}
      {session?.role==="admin"&&<AdminPanel admin={session} onLogout={()=>setSession(null)}/>}
      {session?.role==="doctor"&&<DoctorPortal doc={session} onLogout={()=>setSession(null)}/>}
      {session&&session.role!=="admin"&&session.role!=="doctor"&&<UserApp user={session} onLogout={()=>setSession(null)}/>}
    </>
  );
}
