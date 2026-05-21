import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, setDoc
} from "firebase/firestore";

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
const STATUS_CYCLE = ["لم يتم الدفع","تم الدفع","تم التحويل"];
const STATUS_STYLE = {
  "تم الدفع":    {cls:"paid",        icon:"✓",label:"تم الدفع"},
  "لم يتم الدفع":{cls:"unpaid",      icon:"○",label:"لم يتم الدفع"},
  "تم التحويل": {cls:"transferred",  icon:"↗",label:"تم التحويل"},
};
const toMonthKey     = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const currentKey     = toMonthKey(new Date());
const getClientMonth = c=>c.month||(c.createdAt?.toDate?toMonthKey(c.createdAt.toDate()):currentKey);
const PER_PAGE = 5;

const TOP_TABS   = [{id:"private",label:"🔒 خاص"},{id:"korean",label:"🌸 كوريان"},{id:"makeup",label:"💄 مكياج وعطور"}];
const PRIV_SUBS  = [{id:"private_korean",label:"🌸 كوريان",cat:"korean"},{id:"private_makeup",label:"💄 مكياج وعطور",cat:"makeup"}];
const CAT_OPTS   = [{id:"korean",label:"🌸 كوريان"},{id:"makeup",label:"💄 مكياج وعطور"}];

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ mode, client, defaultCat, onClose, onSave, onDelete, saving }) {
  const [cat,    setCat]    = useState(client?.category || defaultCat || "korean");
  const [name,   setName]   = useState(client?.name   || "");
  const [status, setStatus] = useState(client?.status || "لم يتم الدفع");
  const [items,  setItems]  = useState(
    client?.items?.map((i,idx)=>({...i,uid:idx,qty:i.qty??1}))||[{uid:0,product:"",qty:1,price:""}]
  );
  const [shake,setShake]=useState(false);
  const overlayRef=useRef(); const uidRef=useRef(100);
  const isEdit=mode==="edit";
  const addItem=()=>setItems(p=>[...p,{uid:uidRef.current++,product:"",qty:1,price:""}]);
  const removeItem=uid=>{if(items.length>1)setItems(p=>p.filter(i=>i.uid!==uid));};
  const updItem=(uid,f,v)=>setItems(p=>p.map(i=>i.uid===uid?{...i,[f]:v}:i));
  const lineTotal=item=>(parseFloat(item.price)||0)*(parseInt(item.qty)||1);
  const total=items.reduce((s,i)=>s+lineTotal(i),0);
  const handleSave=()=>{
    if(!name.trim()||items.some(i=>!i.product.trim()||i.price==="")){
      setShake(true);setTimeout(()=>setShake(false),500);return;
    }
    onSave({name:name.trim(),status,category:cat,
      items:items.map(({product,qty,price})=>({product,qty:parseInt(qty)||1,price:parseFloat(price)||0}))});
  };
  return (
    <div ref={overlayRef} onClick={e=>e.target===overlayRef.current&&onClose()}
      style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(30,10,0,.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}60%{transform:translateX(8px)}}
        .mbox{animation:slideUp .3s cubic-bezier(.16,1,.3,1) forwards;background:#fff;border-radius:20px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(80,30,0,.3);direction:rtl;font-family:'Cairo',sans-serif}
        .mbox.shake{animation:shake .4s ease}
        .mhdr{background:linear-gradient(135deg,#5C2D0E,#8B4E2A);padding:22px 28px 18px;border-radius:20px 20px 0 0;position:sticky;top:0;z-index:2}
        .mtitle{font-size:17px;font-weight:900;color:#F0D9C8}.msub{font-size:12px;color:#C9956E;margin-top:3px}
        .mbody{padding:22px 28px}
        .flbl{font-size:11px;font-weight:700;color:#9A7C4F;letter-spacing:1.5px;margin-bottom:7px}
        .finp{width:100%;padding:11px 13px;border:1.5px solid #E8DDD3;border-radius:10px;font-family:'Cairo',sans-serif;font-size:14px;color:#2C1A0E;background:#FDF8F4;outline:none;transition:border-color .2s,box-shadow .2s;direction:rtl}
        .finp:focus{border-color:#C9956E;box-shadow:0 0 0 3px rgba(201,149,110,.15)}
        .cat-sel{display:flex;gap:8px;margin-bottom:18px}
        .cat-opt{flex:1;padding:11px 8px;border-radius:10px;border:1.5px solid #E8DDD3;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;background:#FDF8F4;color:#9A7C4F;text-align:center}
        .cat-opt.sel{background:linear-gradient(135deg,#8B4E2A,#5C2D0E);color:#fff;border-color:#5C2D0E}
        .stoggle{display:flex;gap:8px}
        .sbtn{flex:1;padding:10px 6px;border-radius:10px;border:1.5px solid #E8DDD3;font-family:'Cairo',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;background:#FDF8F4;color:#9A7C4F}
        .sbtn.ap{background:#D4EDDA;border-color:#276749;color:#276749}
        .sbtn.au{background:#F5F0E8;border-color:#9A7C4F;color:#9A7C4F}
        .sbtn.at{background:#DBEAFE;border-color:#1A56A0;color:#1A56A0}
        .col-hdrs{display:grid;grid-template-columns:1fr 64px 90px 32px;gap:6px;margin-bottom:5px}
        .col-h{font-size:10px;font-weight:700;color:#B09080;text-align:center}
        .irow-m{display:grid;grid-template-columns:1fr 64px 90px 32px;gap:6px;align-items:center;margin-bottom:6px}
        .lt{font-size:11px;color:#8B4E2A;font-weight:700;background:#FDF0E8;border-radius:8px;padding:3px 8px;margin:-2px 0 8px 38px;display:inline-block}
        .rmbtn{width:32px;height:32px;border-radius:8px;border:none;background:#FDF0E8;color:#C9956E;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
        .rmbtn:hover{background:#F5D9C0;color:#8B4E2A}.rmbtn:disabled{opacity:.3;cursor:default}
        .addbtn{width:100%;padding:10px;border-radius:10px;border:1.5px dashed #C9956E;background:transparent;color:#C9956E;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;margin-top:6px}
        .addbtn:hover{background:#FDF5EF}
        .totbar{background:linear-gradient(135deg,#F5EDE3,#EDD9C4);border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
        .mfooter{padding:16px 28px 22px;display:flex;gap:10px;border-top:1px solid #F0E8E0}
        .bsave{flex:1;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#8B4E2A,#5C2D0E);color:#F0D9C8;font-family:'Cairo',sans-serif;font-size:15px;font-weight:900;cursor:pointer;transition:all .2s}
        .bsave:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}.bsave:disabled{opacity:.6;cursor:wait}
        .bcancel{padding:13px 18px;border-radius:12px;border:1.5px solid #E8DDD3;background:#FDF8F4;color:#9A7C4F;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s}
        .bcancel:hover{border-color:#C9956E;color:#8B4E2A}
        .bdel{padding:13px 14px;border-radius:12px;border:1.5px solid #FFD0CC;background:#FFF5F4;color:#CC3322;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s}
        .bdel:hover{background:#FFEBE8;border-color:#CC3322}
        .mbox::-webkit-scrollbar{width:4px}.mbox::-webkit-scrollbar-thumb{background:#E8DDD3;border-radius:2px}
      `}</style>
      <div className={`mbox ${shake?"shake":""}`}>
        <div className="mhdr">
          <div className="mtitle">{isEdit?`✏️  تعديل — ${client.name}`:"➕  إضافة عميل جديد"}</div>
          <div className="msub">{isEdit?"عدّل البيانات ثم اضغط حفظ":"اختار القسم وأدخل بيانات العميل"}</div>
        </div>
        <div className="mbody">
          {/* Category picker */}
          <div style={{marginBottom:18}}>
            <div className="flbl">القسم</div>
            <div className="cat-sel">
              {CAT_OPTS.map(o=>(
                <button key={o.id} className={`cat-opt ${cat===o.id?"sel":""}`} onClick={()=>setCat(o.id)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <div className="flbl">العميل</div>
            <input className="finp" placeholder="اسم العميل..." value={name} onChange={e=>setName(e.target.value)}/>
          </div>
          <div style={{marginBottom:18}}>
            <div className="flbl">حالة الدفع</div>
            <div className="stoggle">
              <button className={`sbtn ${status==="تم الدفع"?"ap":""}`} onClick={()=>setStatus("تم الدفع")}>✓  تم الدفع</button>
              <button className={`sbtn ${status==="لم يتم الدفع"?"au":""}`} onClick={()=>setStatus("لم يتم الدفع")}>○  لم يتم الدفع</button>
              <button className={`sbtn ${status==="تم التحويل"?"at":""}`} onClick={()=>setStatus("تم التحويل")}>↗  تم التحويل</button>
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <div className="flbl">المنتجات والأسعار</div>
            <div className="col-hdrs">
              <div className="col-h" style={{textAlign:"right"}}>المنتج</div>
              <div className="col-h">الكمية</div>
              <div className="col-h">سعر الوحدة</div>
              <div></div>
            </div>
            {items.map((item,idx)=>(
              <div key={item.uid}>
                <div className="irow-m">
                  <input className="finp" placeholder={`المنتج ${idx+1}`} value={item.product}
                    onChange={e=>updItem(item.uid,"product",e.target.value)} style={{padding:"10px 11px"}}/>
                  <input className="finp" placeholder="١" type="number" min="1" value={item.qty}
                    onChange={e=>updItem(item.uid,"qty",e.target.value)} style={{padding:"10px 8px",textAlign:"center"}}/>
                  <input className="finp" placeholder="السعر" type="number" min="0" value={item.price}
                    onChange={e=>updItem(item.uid,"price",e.target.value)} style={{padding:"10px 11px",textAlign:"center"}}/>
                  <button className="rmbtn" onClick={()=>removeItem(item.uid)} disabled={items.length===1}>✕</button>
                </div>
                {(parseInt(item.qty)||1)>1&&item.price!==""&&(
                  <div style={{textAlign:"left",marginBottom:4}}>
                    <span className="lt">{item.qty} × {parseFloat(item.price).toLocaleString()} = {lineTotal(item).toLocaleString()} ج</span>
                  </div>
                )}
              </div>
            ))}
            <button className="addbtn" onClick={addItem}>+ إضافة منتج</button>
          </div>
          <div className="totbar">
            <div style={{fontSize:13,fontWeight:700,color:"#8B4E2A"}}>الإجمالي</div>
            <div style={{fontSize:22,fontWeight:900,color:"#5C2D0E"}}>
              <span style={{fontSize:13,color:"#C9956E",marginLeft:4}}>ج</span>{total.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="mfooter">
          {isEdit&&<button className="bdel" onClick={()=>onDelete(client.id)}>🗑</button>}
          <button className="bcancel" onClick={onClose}>إلغاء</button>
          <button className="bsave" onClick={handleSave} disabled={saving}>
            {saving?"جاري الحفظ...":isEdit?"💾  حفظ التعديلات":"✓  إضافة العميل"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [clients,     setClients]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState(null);
  const [modal,       setModal]       = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);
  const [mainTab,     setMainTab]     = useState("private");
  const [subTab,      setSubTab]      = useState("private_korean");
  const [selYear,     setSelYear]     = useState(new Date().getFullYear());
  const [selMonthNum, setSelMonthNum] = useState(new Date().getMonth()+1);
  const [baseCost,    setBaseCost]    = useState("");
  const [editingBase, setEditingBase] = useState(false);
  const [page,        setPage]        = useState(1);

  const selectedMonth = `${selYear}-${String(selMonthNum).padStart(2,"0")}`;
  const monthLabel    = `${MONTHS_AR[selMonthNum-1]} ${selYear}`;

  // Which real data category to show
  const isPrivate    = mainTab==="private";
  const privSub      = PRIV_SUBS.find(s=>s.id===subTab);
  const dataCategory = isPrivate ? privSub.cat : mainTab;
  const settingsKey  = `${subTab}_${selectedMonth}`;  // unique per sub-tab even if cat same

  // Default category for new client modal
  const defaultNewCat = isPrivate ? privSub.cat : mainTab;

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  useEffect(()=>{
    const q=query(collection(db,"clients"),orderBy("createdAt","asc"));
    return onSnapshot(q,snap=>{setClients(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},
      err=>{console.error(err);setLoading(false);});
  },[]);

  useEffect(()=>{
    setBaseCost("");setEditingBase(false);
    if(!isPrivate)return;
    return onSnapshot(doc(db,"settings",settingsKey),snap=>{
      setBaseCost(snap.exists()?(snap.data().baseCost??""):"");
    });
  },[settingsKey,isPrivate]);

  useEffect(()=>{setPage(1);setExpanded(null);},[mainTab,subTab,selectedMonth]);

  const saveBaseCost=async val=>{
    const num=parseFloat(val)||0;
    setBaseCost(num);setEditingBase(false);
    await setDoc(doc(db,"settings",settingsKey),{baseCost:num});
  };

  const handleSave=async data=>{
    setSaving(true);
    try{
      if(modal.mode==="add"){
        await addDoc(collection(db,"clients"),{...data,month:selectedMonth,createdAt:serverTimestamp()});
        showToast(`✓  تمت إضافة ${data.name} بنجاح`);
      }else{
        await updateDoc(doc(db,"clients",modal.client.id),data);
        showToast(`✓  تم تحديث بيانات ${data.name}`);
      }
      setModal(null);
    }catch{showToast("حدث خطأ، حاول تاني","error");}
    setSaving(false);
  };

  const handleDelete=async id=>{
    const name=clients.find(c=>c.id===id)?.name;
    setSaving(true);
    try{await deleteDoc(doc(db,"clients",id));setModal(null);showToast(`🗑  تم حذف ${name}`,"delete");}
    catch{showToast("حدث خطأ في الحذف","error");}
    setSaving(false);
  };

  const handleStatusToggle=async client=>{
    const idx=STATUS_CYCLE.indexOf(client.status??"لم يتم الدفع");
    await updateDoc(doc(db,"clients",client.id),{status:STATUS_CYCLE[(idx+1)%STATUS_CYCLE.length]});
  };

  const itemTotal  =item=>(item.price||0)*(item.qty||1);
  const clientTotal=c=>(c.items||[]).reduce((s,i)=>s+itemTotal(i),0);

  const catClients = clients.filter(c=>(c.category||"makeup")===dataCategory&&getClientMonth(c)===selectedMonth);
  const grandTotal = catClients.reduce((s,c)=>s+clientTotal(c),0);
  const collected  = catClients.filter(c=>c.status==="تم الدفع"||c.status==="تم التحويل").reduce((s,c)=>s+clientTotal(c),0);
  const pending    = catClients.filter(c=>c.status==="لم يتم الدفع").reduce((s,c)=>s+clientTotal(c),0);
  const baseCostNum= parseFloat(baseCost)||0;
  const profit     = isPrivate&&baseCostNum>0?grandTotal-baseCostNum:null;
  const profitPos  = profit!==null&&profit>=0;

  const totalPages = Math.max(1,Math.ceil(catClients.length/PER_PAGE));
  const pageClients= catClients.slice((page-1)*PER_PAGE,page*PER_PAGE);

  const currentSubLabel = isPrivate?privSub.label:(TOP_TABS.find(t=>t.id===mainTab)?.label||"");

  return (
    <div dir="rtl" style={{minHeight:"100vh",background:"#FDF8F4",fontFamily:"'Cairo',sans-serif",color:"#2C1A0E"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .topbar{background:linear-gradient(135deg,#5C2D0E 0%,#8B4E2A 60%,#C9956E 100%);padding:22px 32px 16px;position:relative;overflow:hidden}
        .topbar::after{content:'✶';position:absolute;font-size:160px;color:rgba(255,255,255,.04);bottom:-30px;left:10px;line-height:1}
        .badge{display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#F0D9C8;font-size:10px;font-weight:700;letter-spacing:3px;padding:4px 12px;border-radius:30px;margin-bottom:7px}
        .ptitle{font-size:23px;font-weight:900;color:#fff}
        .live-dot{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#B8F0C8;font-size:11px;font-weight:700;padding:4px 11px;border-radius:20px;margin-top:7px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .dot{width:7px;height:7px;border-radius:50%;background:#4ADE80;animation:pulse 1.5s infinite}
        .btn-add{display:inline-flex;align-items:center;gap:7px;background:#fff;color:#5C2D0E;padding:9px 18px;border-radius:12px;border:none;font-family:'Cairo',sans-serif;font-size:14px;font-weight:900;cursor:pointer;transition:all .2s;box-shadow:0 2px 12px rgba(0,0,0,.15);margin-top:10px}
        .btn-add:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.2)}

        /* Tabs */
        .top-tabs{display:flex;background:#fff;border-bottom:2px solid #E8DDD3}
        .top-tab{flex:1;padding:13px 16px;border:none;background:transparent;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;color:#B09080;cursor:pointer;transition:all .2s;border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap}
        .top-tab.active{color:#5C2D0E;border-bottom-color:#8B4E2A;background:#FDF8F4}
        .top-tab:hover:not(.active){color:#8B4E2A;background:#FDF5EF}
        .sub-tabs{display:flex;background:#FDF5EF;border-bottom:1px solid #E8DDD3;padding:0 20px;gap:6px}
        .sub-tab{padding:9px 20px;border:none;background:transparent;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;color:#B09080;cursor:pointer;transition:all .2s;border-bottom:3px solid transparent;margin-bottom:-1px;border-radius:8px 8px 0 0}
        .sub-tab.active{color:#5C2D0E;border-bottom-color:#C9956E;background:#fff}
        .sub-tab:hover:not(.active){background:#FDF0E8;color:#8B4E2A}

        /* Month */
        .month-bar{background:#fff;border-bottom:1px solid #E8DDD3;padding:10px 18px}
        .month-yr{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:8px}
        .yr-btn{width:28px;height:28px;border:1.5px solid #E8DDD3;background:#FDF8F4;color:#8B4E2A;border-radius:8px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .yr-btn:hover{background:#F5EDE3;border-color:#C9956E}
        .yr-lbl{font-size:14px;font-weight:900;color:#5C2D0E;min-width:52px;text-align:center}
        .months-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
        .mcrd{padding:6px 4px;border:1.5px solid #E8DDD3;background:#FDF8F4;color:#9A7C4F;font-family:'Cairo',sans-serif;font-size:11px;font-weight:700;border-radius:9px;cursor:pointer;transition:all .2s;text-align:center}
        .mcrd:hover{border-color:#C9956E;color:#8B4E2A;background:#FDF0E8}
        .mcrd.active{background:linear-gradient(135deg,#8B4E2A,#5C2D0E);color:#fff;border-color:#5C2D0E;box-shadow:0 2px 8px rgba(92,45,14,.25)}

        /* Stats */
        .stats-row{display:grid;background:#fff;border-bottom:1px solid #E8DDD3}
        .stat-box{padding:14px 16px;border-left:1px solid #E8DDD3;transition:background .2s;min-width:0}
        .stat-box:last-child{border-left:none}
        .stat-box:hover{background:#FDF5EF}
        .slbl{font-size:10px;color:#B09080;font-weight:700;letter-spacing:.5px;margin-bottom:4px;white-space:nowrap}
        .sval{font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .base-inp{font-size:16px;font-weight:900;color:#5C2D0E;background:transparent;border:none;border-bottom:2px dashed #C9956E;outline:none;font-family:'Cairo',sans-serif;width:100%;direction:ltr}

        /* Private summary cards */
        .priv-summary{padding:24px 32px;max-width:980px;margin:0 auto}
        .priv-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}
        .priv-card{background:#fff;border:1.5px solid #E8DDD3;border-radius:16px;padding:20px;text-align:center;transition:all .2s}
        .priv-card:hover{border-color:#C9956E;box-shadow:0 4px 16px rgba(180,110,60,.1)}
        .priv-card-lbl{font-size:11px;color:#B09080;font-weight:700;letter-spacing:1px;margin-bottom:8px}
        .priv-card-val{font-size:26px;font-weight:900}
        .profit-card{background:linear-gradient(135deg,#5C2D0E,#8B4E2A);border-color:#5C2D0E!important}
        .profit-card .priv-card-lbl{color:rgba(255,255,255,.7)}
        .profit-card .priv-card-val{color:#fff}
        .cost-box{background:#fff;border:1.5px solid #E8DDD3;border-radius:16px;padding:18px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}
        .cost-box:hover{border-color:#C9956E}
        .cost-inp{font-size:20px;font-weight:900;color:#5C2D0E;background:transparent;border:none;border-bottom:2px dashed #C9956E;outline:none;font-family:'Cairo',sans-serif;width:140px;direction:ltr;text-align:left}

        /* Cards */
        .main{padding:22px 32px;max-width:980px;margin:0 auto}
        .shead{font-size:11px;font-weight:700;color:#B09080;letter-spacing:1.5px;margin-bottom:14px;display:flex;align-items:center;gap:10px}
        .shead::before{content:'';width:3px;height:14px;background:linear-gradient(180deg,#C9956E,#8B4E2A);border-radius:2px}
        .ccard{background:#fff;border:1.5px solid #E8DDD3;border-radius:14px;margin-bottom:10px;overflow:hidden;transition:box-shadow .2s,border-color .2s}
        .ccard:hover{box-shadow:0 4px 20px rgba(180,110,60,.1);border-color:#C9956E}
        .chdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;user-select:none}
        .cleft{display:flex;align-items:center;gap:12px}
        .avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#F0D9C8,#C9956E);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;flex-shrink:0}
        .cname{font-size:15px;font-weight:700;color:#2C1A0E}
        .icnt{font-size:11px;color:#B09080;margin-top:1px}
        .cright{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        .ctotal{font-size:16px;font-weight:900;color:#8B4E2A}
        .spill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;border:none;font-family:'Cairo',sans-serif;white-space:nowrap}
        .paid{background:#D4EDDA;color:#276749}.unpaid{background:#F5F0E8;color:#9A7C4F}.transferred{background:#DBEAFE;color:#1A56A0}
        .paid:hover{background:#B8E0C4}.unpaid:hover{background:#EDE0CC}.transferred:hover{background:#BFDBFE}
        .ebtn{width:30px;height:30px;border-radius:8px;border:1.5px solid #E8DDD3;background:#FDF8F4;color:#C9956E;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .2s;flex-shrink:0}
        .ebtn:hover{background:#F5EDE3;border-color:#C9956E;color:#8B4E2A}
        .chev{font-size:10px;color:#C9956E;transition:transform .25s;flex-shrink:0}
        .chev.open{transform:rotate(90deg)}
        .ibody{border-top:1px solid #F0E8E0;background:#FDF8F4}
        .irow-d{display:flex;justify-content:space-between;align-items:center;padding:9px 18px 9px 50px;border-bottom:1px solid #F0E8E0;font-size:13px;color:#5A3A24}
        .irow-d:last-child{border-bottom:none}
        .idot{width:5px;height:5px;border-radius:50%;background:#C9956E;display:inline-block;margin-left:8px;flex-shrink:0}
        .qty-badge{background:#F5EDE3;color:#8B4E2A;font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;margin-left:6px}
        .sum-card{background:linear-gradient(135deg,#5C2D0E,#8B4E2A);border-radius:14px;padding:16px 20px;margin-top:14px}

        /* Pagination */
        .pagination{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:16px}
        .pg-btn{min-width:34px;height:34px;border-radius:9px;border:1.5px solid #E8DDD3;background:#fff;color:#8B4E2A;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;padding:0 10px}
        .pg-btn:hover:not(:disabled){background:#F5EDE3;border-color:#C9956E}
        .pg-btn:disabled{opacity:.35;cursor:default}
        .pg-btn.cur{background:linear-gradient(135deg,#8B4E2A,#5C2D0E);color:#fff;border-color:#5C2D0E}

        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;z-index:2000;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;box-shadow:0 8px 30px rgba(0,0,0,.2);animation:toastIn .3s ease forwards;white-space:nowrap}
        .toast.success{background:#5C2D0E;color:#F0D9C8}.toast.delete,.toast.error{background:#CC3322;color:#fff}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:40px;height:40px;border:3px solid #E8DDD3;border-top-color:#C9956E;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}
        @media(max-width:700px){
          .stats-row{grid-template-columns:repeat(2,1fr)!important}
          .priv-cards{grid-template-columns:repeat(2,1fr)}
          .main,.priv-summary{padding:14px}.topbar{padding:16px 14px}
          .months-grid{grid-template-columns:repeat(4,1fr)}
          .sub-tabs{padding:0 10px}
        }
      `}</style>

      {/* Header */}
      <div className="topbar">
        <div className="badge">{monthLabel}</div>
        <div className="ptitle">💄 سجل المبيعات</div>
        <div className="live-dot"><span className="dot"/>مباشر — يتحدث تلقائيًا</div>
        <div><button className="btn-add" onClick={()=>setModal({mode:"add"})}>
          <span style={{fontSize:18,lineHeight:1}}>+</span> إضافة عميل جديد
        </button></div>
      </div>

      {/* Top Tabs */}
      <div className="top-tabs">
        {TOP_TABS.map(t=>(
          <button key={t.id} className={`top-tab ${mainTab===t.id?"active":""}`}
            onClick={()=>{setMainTab(t.id);setExpanded(null);}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub Tabs (Private) */}
      {isPrivate&&(
        <div className="sub-tabs">
          {PRIV_SUBS.map(s=>(
            <button key={s.id} className={`sub-tab ${subTab===s.id?"active":""}`}
              onClick={()=>{setSubTab(s.id);setExpanded(null);}}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Month Selector */}
      <div className="month-bar">
        <div className="month-yr">
          <button className="yr-btn" onClick={()=>setSelYear(y=>y-1)}>›</button>
          <div className="yr-lbl">{selYear}</div>
          <button className="yr-btn" onClick={()=>setSelYear(y=>y+1)}>‹</button>
        </div>
        <div className="months-grid">
          {MONTHS_AR.map((m,i)=>(
            <button key={i} className={`mcrd ${selMonthNum===i+1?"active":""}`}
              onClick={()=>setSelMonthNum(i+1)}>{m}</button>
          ))}
        </div>
      </div>

      {/* ── PRIVATE VIEW: stats + cost/profit only, no client names ── */}
      {isPrivate&&(
        <div className="priv-summary">
          <div style={{fontSize:13,fontWeight:700,color:"#B09080",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:3,height:14,background:"linear-gradient(180deg,#C9956E,#8B4E2A)",borderRadius:2,display:"inline-block"}}></span>
            ملخص {currentSubLabel} — {monthLabel}
          </div>

          {/* Stats cards */}
          <div className="priv-cards">
            <div className="priv-card">
              <div className="priv-card-lbl">إجمالي المبيعات</div>
              <div className="priv-card-val" style={{color:"#8B4E2A"}}>{grandTotal.toLocaleString()} <span style={{fontSize:14}}>ج</span></div>
            </div>
            <div className="priv-card">
              <div className="priv-card-lbl">تم التحصيل</div>
              <div className="priv-card-val" style={{color:"#276749"}}>{collected.toLocaleString()} <span style={{fontSize:14}}>ج</span></div>
            </div>
            <div className="priv-card">
              <div className="priv-card-lbl">غير محصّل</div>
              <div className="priv-card-val" style={{color:"#9A7C4F"}}>{pending.toLocaleString()} <span style={{fontSize:14}}>ج</span></div>
            </div>
            <div className="priv-card">
              <div className="priv-card-lbl">عدد العملاء</div>
              <div className="priv-card-val" style={{color:"#2C1A0E"}}>{catClients.length}</div>
            </div>
            <div className="priv-card" style={{cursor:"pointer"}} onClick={()=>!editingBase&&setEditingBase(true)}>
              <div className="priv-card-lbl">تكلفة البضاعة ✎</div>
              {editingBase?(
                <input className="cost-inp" type="number" autoFocus value={baseCost}
                  onChange={e=>setBaseCost(e.target.value)}
                  onBlur={()=>saveBaseCost(baseCost)}
                  onKeyDown={e=>e.key==="Enter"&&saveBaseCost(baseCost)}
                  onClick={e=>e.stopPropagation()}/>
              ):(
                <div className="priv-card-val" style={{color:"#5C2D0E"}}>{baseCostNum>0?baseCostNum.toLocaleString():"—"} <span style={{fontSize:14}}>ج</span></div>
              )}
            </div>
            <div className={`priv-card ${profit!==null?"profit-card":""}`}>
              <div className="priv-card-lbl">الربح = مبيعات − تكلفة</div>
              {profit!==null?(
                <div className="priv-card-val" style={{color:profitPos?"#86EFAC":"#FCA5A5"}}>
                  {profitPos?"▲":"▼"} {Math.abs(profit).toLocaleString()} <span style={{fontSize:14}}>ج</span>
                </div>
              ):(
                <div className="priv-card-val" style={{color:"rgba(255,255,255,.4)",fontSize:16}}>أدخل تكلفة البضاعة</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REGULAR TABS: stats bar + client cards ── */}
      {!isPrivate&&(<>
        <div className="stats-row" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
          <div className="stat-box">
            <div className="slbl">إجمالي المبيعات</div>
            <div className="sval" style={{color:"#8B4E2A"}}>{grandTotal.toLocaleString()} ج</div>
          </div>
          <div className="stat-box">
            <div className="slbl">تم التحصيل</div>
            <div className="sval" style={{color:"#276749"}}>{collected.toLocaleString()} ج</div>
          </div>
          <div className="stat-box">
            <div className="slbl">غير محصّل</div>
            <div className="sval" style={{color:"#9A7C4F"}}>{pending.toLocaleString()} ج</div>
          </div>
          <div className="stat-box">
            <div className="slbl">عدد العملاء</div>
            <div className="sval" style={{color:"#2C1A0E"}}>{catClients.length}</div>
          </div>
        </div>

        <div className="main">
          <div className="shead">{currentSubLabel} — {monthLabel}</div>
          {loading&&<div style={{textAlign:"center",padding:"60px"}}><div className="spinner"/></div>}
          {!loading&&catClients.length===0&&(
            <div style={{textAlign:"center",padding:"60px",color:"#C9956E",fontSize:15}}>
              لا يوجد عملاء في هذا الشهر — اضغط "إضافة عميل جديد" 💄
            </div>
          )}
          {pageClients.map(client=>{
            const total=clientTotal(client); const isOpen=expanded===client.id;
            const st=STATUS_STYLE[client.status]||STATUS_STYLE["لم يتم الدفع"];
            return (
              <div className="ccard" key={client.id}>
                <div className="chdr" onClick={()=>setExpanded(isOpen?null:client.id)}>
                  <div className="cleft">
                    <div className="avatar">{(client.name||"?")[0]}</div>
                    <div>
                      <div className="cname">{client.name}</div>
                      <div className="icnt">{(client.items||[]).length} منتجات</div>
                    </div>
                  </div>
                  <div className="cright" onClick={e=>e.stopPropagation()}>
                    <button className={`spill ${st.cls}`} onClick={()=>handleStatusToggle(client)}>
                      {st.icon}  {st.label}
                    </button>
                    <div className="ctotal">{total.toLocaleString()} ج</div>
                    <button className="ebtn" onClick={()=>setModal({mode:"edit",client})}>✏️</button>
                    <span className={`chev ${isOpen?"open":""}`}>▶</span>
                  </div>
                </div>
                {isOpen&&(
                  <div className="ibody">
                    {(client.items||[]).map((item,j)=>{
                      const qty=item.qty||1; const line=item.price*qty;
                      return (
                        <div className="irow-d" key={j}>
                          <div style={{display:"flex",alignItems:"center"}}>
                            <span className="idot"/>
                            {qty>1&&<span className="qty-badge">×{qty}</span>}
                            {item.product}
                          </div>
                          <div style={{fontWeight:700,color:"#8B4E2A",whiteSpace:"nowrap"}}>
                            {qty>1?`${qty} × ${item.price.toLocaleString()} = ${line.toLocaleString()}`:item.price.toLocaleString()} ج
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {totalPages>1&&(
            <div className="pagination">
              <button className="pg-btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>›</button>
              {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                <button key={p} className={`pg-btn ${p===page?"cur":""}`} onClick={()=>setPage(p)}>{p}</button>
              ))}
              <button className="pg-btn" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>‹</button>
            </div>
          )}

          {!loading&&catClients.length>0&&(
            <div className="sum-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#F0D9C8"}}>💰  إجمالي {monthLabel} — {currentSubLabel}</div>
                <div style={{fontSize:24,fontWeight:900,color:"#fff"}}>{grandTotal.toLocaleString()} ج</div>
              </div>
            </div>
          )}
        </div>
      </>)}

      {modal&&(
        <Modal mode={modal.mode} client={modal.client} defaultCat={defaultNewCat}
          onClose={()=>setModal(null)} onSave={handleSave} onDelete={handleDelete} saving={saving}/>
      )}
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
