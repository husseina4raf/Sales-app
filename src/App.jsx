import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy
} from "firebase/firestore";

const SEED_DATA = [
  { name: "أميرة",  items: [{ product:"سبلاش (×2)", price:200 },{ product:"روج (×2)", price:100 },{ product:"سبلاش صغير", price:40 }], status:"تم الدفع" },
  { name: "نورهان", items: [{ product:"سبلاش كبير", price:100 },{ product:"روج (×2)", price:140 },{ product:"روج", price:50 }], status:"تم الدفع" },
  { name: "جيجي",  items: [{ product:"سبلاش صغير", price:40 }], status:"لم يتم الدفع" },
  { name: "رنا",   items: [{ product:"سبلاش", price:100 },{ product:"كحل أزرق", price:40 },{ product:"روج", price:50 },{ product:"ايلاينر", price:80 },{ product:"روج", price:40 }], status:"لم يتم الدفع" },
  { name: "انجي",  items: [{ product:"سبلاش (×2)", price:200 },{ product:"روج", price:50 }], status:"تم الدفع" },
  { name: "هاجر",  items: [{ product:"سيرم", price:800 },{ product:"كريم عين", price:350 }], status:"لم يتم الدفع" },
  { name: "هند",   items: [{ product:"كريم عين", price:350 },{ product:"سبلاش", price:100 },{ product:"زبده كاكاو", price:90 },{ product:"روج", price:40 }], status:"لم يتم الدفع" },
];

// ── Modal ────────────────────────────────────────────────────────────
function Modal({ mode, client, onClose, onSave, onDelete, saving }) {
  const [name, setName]     = useState(client?.name || "");
  const [status, setStatus] = useState(client?.status || "لم يتم الدفع");
  const [items, setItems]   = useState(
    client?.items?.map((i,idx) => ({ ...i, uid: idx })) ||
    [{ uid: 0, product: "", price: "" }]
  );
  const [shake, setShake] = useState(false);
  const overlayRef = useRef();
  const uidRef = useRef(10);

  const isEdit = mode === "edit";
  const addItem = () => { setItems(p => [...p, { uid: uidRef.current++, product:"", price:"" }]); };
  const removeItem = uid => { if (items.length > 1) setItems(p => p.filter(i => i.uid !== uid)); };
  const updateItem = (uid, field, val) => setItems(p => p.map(i => i.uid === uid ? { ...i, [field]: val } : i));
  const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  const handleSave = () => {
    if (!name.trim() || items.some(i => !i.product.trim() || i.price === "")) {
      setShake(true); setTimeout(() => setShake(false), 500); return;
    }
    onSave({ name: name.trim(), status, items: items.map(({ product, price }) => ({ product, price: parseFloat(price) })) });
  };

  return (
    <div ref={overlayRef} onClick={e => e.target === overlayRef.current && onClose()}
      style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(30,10,0,0.6)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(28px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shake   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)} }
        .mbox { animation:slideUp .3s cubic-bezier(.16,1,.3,1) forwards; background:#fff; border-radius:20px; width:100%; max-width:480px; max-height:90vh; overflow-y:auto; box-shadow:0 30px 80px rgba(80,30,0,.28); direction:rtl; font-family:'Cairo',sans-serif; }
        .mbox.shake { animation:shake .4s ease; }
        .mhdr { background:linear-gradient(135deg,#5C2D0E,#8B4E2A); padding:24px 28px 20px; border-radius:20px 20px 0 0; position:sticky; top:0; z-index:2; }
        .mtitle { font-size:18px; font-weight:900; color:#F0D9C8; }
        .msub   { font-size:12px; color:#C9956E; margin-top:3px; }
        .mbody  { padding:24px 28px; }
        .flbl   { font-size:11px; font-weight:700; color:#9A7C4F; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:7px; }
        .finp   { width:100%; padding:12px 14px; border:1.5px solid #E8DDD3; border-radius:10px; font-family:'Cairo',sans-serif; font-size:14px; color:#2C1A0E; background:#FDF8F4; outline:none; transition:border-color .2s,box-shadow .2s; direction:rtl; }
        .finp:focus { border-color:#C9956E; box-shadow:0 0 0 3px rgba(201,149,110,.15); }
        .stoggle { display:flex; gap:8px; }
        .sbtn { flex:1; padding:11px; border-radius:10px; border:1.5px solid #E8DDD3; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; background:#FDF8F4; color:#9A7C4F; }
        .sbtn.ap { background:#D4EDDA; border-color:#276749; color:#276749; }
        .sbtn.au { background:#F5F0E8; border-color:#9A7C4F; color:#9A7C4F; }
        .irow { display:grid; grid-template-columns:1fr 90px 32px; gap:8px; align-items:center; margin-bottom:8px; }
        .rmbtn { width:32px; height:32px; border-radius:8px; border:none; background:#FDF0E8; color:#C9956E; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; transition:all .2s; }
        .rmbtn:hover { background:#F5D9C0; color:#8B4E2A; }
        .rmbtn:disabled { opacity:.3; cursor:default; }
        .addbtn { width:100%; padding:10px; border-radius:10px; border:1.5px dashed #C9956E; background:transparent; color:#C9956E; font-family:'Cairo',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; margin-top:4px; }
        .addbtn:hover { background:#FDF5EF; }
        .totbar { background:linear-gradient(135deg,#F5EDE3,#EDD9C4); border-radius:12px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; margin-top:20px; }
        .mfooter { padding:16px 28px 24px; display:flex; gap:10px; border-top:1px solid #F0E8E0; }
        .bsave { flex:1; padding:14px; border-radius:12px; border:none; background:linear-gradient(135deg,#8B4E2A,#5C2D0E); color:#F0D9C8; font-family:'Cairo',sans-serif; font-size:15px; font-weight:900; cursor:pointer; transition:all .2s; }
        .bsave:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
        .bsave:disabled { opacity:.6; cursor:wait; }
        .bcancel { padding:14px 20px; border-radius:12px; border:1.5px solid #E8DDD3; background:#FDF8F4; color:#9A7C4F; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all .2s; }
        .bcancel:hover { border-color:#C9956E; color:#8B4E2A; }
        .bdel { padding:14px 16px; border-radius:12px; border:1.5px solid #FFD0CC; background:#FFF5F4; color:#CC3322; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all .2s; }
        .bdel:hover { background:#FFEBE8; border-color:#CC3322; }
        .mbox::-webkit-scrollbar{width:4px} .mbox::-webkit-scrollbar-thumb{background:#E8DDD3;border-radius:2px}
      `}</style>
      <div className={`mbox ${shake?"shake":""}`}>
        <div className="mhdr">
          <div className="mtitle">{isEdit ? `✏️  تعديل — ${client.name}` : "➕  إضافة عميلة جديدة"}</div>
          <div className="msub">{isEdit ? "عدّل البيانات ثم اضغط حفظ" : "أدخل بيانات العميلة والمنتجات"}</div>
        </div>
        <div className="mbody">
          <div style={{marginBottom:18}}>
            <div className="flbl">العميلة</div>
            <input className="finp" placeholder="اسم العميلة..." value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div style={{marginBottom:18}}>
            <div className="flbl">حالة الدفع</div>
            <div className="stoggle">
              <button className={`sbtn ${status==="تم الدفع"?"ap":""}`} onClick={()=>setStatus("تم الدفع")}>✓  تم الدفع</button>
              <button className={`sbtn ${status==="لم يتم الدفع"?"au":""}`} onClick={()=>setStatus("لم يتم الدفع")}>○  لم يتم الدفع</button>
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <div className="flbl">المنتجات والأسعار</div>
            {items.map((item,idx) => (
              <div className="irow" key={item.uid}>
                <input className="finp" placeholder={`المنتج ${idx+1}`} value={item.product} onChange={e=>updateItem(item.uid,"product",e.target.value)} style={{padding:"10px 12px"}} />
                <input className="finp" placeholder="السعر" type="number" min="0" value={item.price} onChange={e=>updateItem(item.uid,"price",e.target.value)} style={{padding:"10px 12px",textAlign:"center"}} />
                <button className="rmbtn" onClick={()=>removeItem(item.uid)} disabled={items.length===1}>✕</button>
              </div>
            ))}
            <button className="addbtn" onClick={addItem}>+ إضافة منتج</button>
          </div>
          <div className="totbar">
            <div style={{fontSize:13,fontWeight:700,color:"#8B4E2A"}}>الإجمالي</div>
            <div style={{fontSize:22,fontWeight:900,color:"#5C2D0E"}}><span style={{fontSize:13,color:"#C9956E",marginLeft:4}}>ج</span>{total.toLocaleString()}</div>
          </div>
        </div>
        <div className="mfooter">
          {isEdit && <button className="bdel" onClick={()=>onDelete(client.id)}>🗑</button>}
          <button className="bcancel" onClick={onClose}>إلغاء</button>
          <button className="bsave" onClick={handleSave} disabled={saving}>{saving ? "جاري الحفظ..." : isEdit ? "💾  حفظ التعديلات" : "✓  إضافة العميلة"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────
export default function App() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [seeded, setSeeded]     = useState(false);

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Real-time listener
  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClients(data);
      setLoading(false);

      // Seed initial data once if empty
      if (data.length === 0 && !seeded) {
        setSeeded(true);
        Promise.all(
          SEED_DATA.map(c => addDoc(collection(db, "clients"), { ...c, createdAt: serverTimestamp() }))
        );
      }
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await addDoc(collection(db, "clients"), { ...data, createdAt: serverTimestamp() });
        showToast(`✓  تمت إضافة ${data.name} بنجاح`);
      } else {
        await updateDoc(doc(db, "clients", modal.client.id), data);
        showToast(`✓  تم تحديث بيانات ${data.name}`);
      }
      setModal(null);
    } catch (e) {
      showToast("حدث خطأ، حاول تاني", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const name = clients.find(c => c.id === id)?.name;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "clients", id));
      setModal(null);
      showToast(`🗑  تم حذف ${name}`, "delete");
    } catch (e) {
      showToast("حدث خطأ في الحذف", "error");
    }
    setSaving(false);
  };

  const handleStatusToggle = async (client) => {
    const newStatus = client.status === "تم الدفع" ? "لم يتم الدفع" : "تم الدفع";
    await updateDoc(doc(db, "clients", client.id), { status: newStatus });
  };

  const grandTotal = clients.reduce((s,c) => s + (c.items||[]).reduce((a,i) => a+i.price,0), 0);
  const collected  = clients.filter(c=>c.status==="تم الدفع").reduce((s,c) => s+(c.items||[]).reduce((a,i)=>a+i.price,0),0);
  const pending    = grandTotal - collected;

  return (
    <div dir="rtl" style={{minHeight:"100vh",background:"#FDF8F4",fontFamily:"'Cairo',sans-serif",color:"#2C1A0E"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .topbar{background:linear-gradient(135deg,#5C2D0E 0%,#8B4E2A 60%,#C9956E 100%);padding:28px 36px 24px;position:relative;overflow:hidden}
        .topbar::after{content:'✦';position:absolute;font-size:160px;color:rgba(255,255,255,.04);bottom:-30px;left:10px;line-height:1}
        .badge{display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#F0D9C8;font-size:10px;font-weight:700;letter-spacing:3px;padding:4px 14px;border-radius:30px;margin-bottom:10px}
        .ptitle{font-size:26px;font-weight:900;color:#fff;letter-spacing:-.5px}
        .live-dot{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#B8F0C8;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;margin-top:10px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .dot{width:7px;height:7px;border-radius:50%;background:#4ADE80;animation:pulse 1.5s infinite}
        .btn-add{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#5C2D0E;padding:11px 22px;border-radius:12px;border:none;font-family:'Cairo',sans-serif;font-size:14px;font-weight:900;cursor:pointer;transition:all .2s;box-shadow:0 2px 12px rgba(0,0,0,.15);margin-top:14px}
        .btn-add:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.2)}
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-bottom:1px solid #E8DDD3}
        .stat-box{padding:20px 24px;border-left:1px solid #E8DDD3;transition:background .2s}
        .stat-box:last-child{border-left:none}
        .stat-box:hover{background:#FDF5EF}
        .slbl{font-size:10px;color:#B09080;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
        .sval{font-size:24px;font-weight:900}
        .main{padding:28px 36px;max-width:980px;margin:0 auto}
        .shead{font-size:11px;font-weight:700;color:#B09080;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:10px}
        .shead::before{content:'';width:3px;height:14px;background:linear-gradient(180deg,#C9956E,#8B4E2A);border-radius:2px}
        .ccard{background:#fff;border:1.5px solid #E8DDD3;border-radius:14px;margin-bottom:10px;overflow:hidden;transition:box-shadow .2s,border-color .2s}
        .ccard:hover{box-shadow:0 4px 20px rgba(180,110,60,.1);border-color:#C9956E}
        .chdr{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;cursor:pointer;user-select:none}
        .cleft{display:flex;align-items:center;gap:12px}
        .avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#F0D9C8,#C9956E);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#fff;flex-shrink:0}
        .cname{font-size:16px;font-weight:700;color:#2C1A0E}
        .icnt{font-size:11px;color:#B09080;margin-top:1px}
        .cright{display:flex;align-items:center;gap:10px}
        .ctotal{font-size:18px;font-weight:900;color:#8B4E2A}
        .spill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;border:none;font-family:'Cairo',sans-serif}
        .paid{background:#D4EDDA;color:#276749}.unpaid{background:#F5F0E8;color:#9A7C4F}
        .paid:hover{background:#B8E0C4}.unpaid:hover{background:#EDE0CC}
        .ebtn{width:32px;height:32px;border-radius:8px;border:1.5px solid #E8DDD3;background:#FDF8F4;color:#C9956E;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s}
        .ebtn:hover{background:#F5EDE3;border-color:#C9956E;color:#8B4E2A}
        .chev{font-size:10px;color:#C9956E;transition:transform .25s}
        .chev.open{transform:rotate(90deg)}
        .ibody{border-top:1px solid #F0E8E0;background:#FDF8F4}
        .irow-d{display:flex;justify-content:space-between;align-items:center;padding:10px 20px 10px 56px;border-bottom:1px solid #F0E8E0;font-size:13.5px;color:#5A3A24}
        .irow-d:last-child{border-bottom:none}
        .idot{width:5px;height:5px;border-radius:50%;background:#C9956E;display:inline-block;margin-left:9px}
        .sum-card{background:linear-gradient(135deg,#5C2D0E,#8B4E2A);border-radius:14px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;z-index:2000;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;box-shadow:0 8px 30px rgba(0,0,0,.2);animation:toastIn .3s ease forwards;white-space:nowrap}
        .toast.success{background:#5C2D0E;color:#F0D9C8}
        .toast.delete{background:#CC3322;color:#fff}
        .toast.error{background:#CC3322;color:#fff}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:40px;height:40px;border:3px solid #E8DDD3;border-top-color:#C9956E;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}
        @media(max-width:650px){.stats-row{grid-template-columns:1fr 1fr}.main{padding:16px}.topbar{padding:20px 16px}}
      `}</style>

      {/* Header */}
      <div className="topbar">
        <div className="badge">مايو ٢٠٢٦</div>
        <div className="ptitle">💄 سجل المبيعات</div>
        <div className="live-dot"><span className="dot" />مباشر — يتحدث تلقائياً</div>
        <div><button className="btn-add" onClick={() => setModal({ mode:"add" })}>
          <span style={{fontSize:18,lineHeight:1}}>+</span> إضافة عميلة جديدة
        </button></div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-box"><div className="slbl">إجمالي المبيعات</div><div className="sval" style={{color:"#8B4E2A"}}>{grandTotal.toLocaleString()} ج</div></div>
        <div className="stat-box"><div className="slbl">تم التحصيل</div><div className="sval" style={{color:"#276749"}}>{collected.toLocaleString()} ج</div></div>
        <div className="stat-box"><div className="slbl">غير محصّل</div><div className="sval" style={{color:"#9A7C4F"}}>{pending.toLocaleString()} ج</div></div>
        <div className="stat-box"><div className="slbl">عدد العملاء</div><div className="sval" style={{color:"#2C1A0E"}}>{clients.length}</div></div>
      </div>

      {/* Cards */}
      <div className="main">
        <div className="shead">تفاصيل الطلبات</div>

        {loading && <div style={{textAlign:"center",padding:"60px"}}><div className="spinner" /></div>}

        {!loading && clients.length === 0 && (
          <div style={{textAlign:"center",padding:"60px",color:"#C9956E",fontSize:15}}>
            لا يوجد عملاء — اضغط "إضافة عميلة جديدة" 💄
          </div>
        )}

        {clients.map(client => {
          const total  = (client.items||[]).reduce((s,i) => s+i.price, 0);
          const isOpen = expanded === client.id;
          const isPaid = client.status === "تم الدفع";
          return (
            <div className="ccard" key={client.id}>
              <div className="chdr" onClick={() => setExpanded(isOpen ? null : client.id)}>
                <div className="cleft">
                  <div className="avatar">{(client.name||"?")[0]}</div>
                  <div>
                    <div className="cname">{client.name}</div>
                    <div className="icnt">{(client.items||[]).length} منتجات</div>
                  </div>
                </div>
                <div className="cright" onClick={e => e.stopPropagation()}>
                  <button className={`spill ${isPaid?"paid":"unpaid"}`} onClick={() => handleStatusToggle(client)} title="اضغط لتغيير الحالة">
                    {isPaid?"✓":"○"}  {client.status}
                  </button>
                  <div className="ctotal">{total.toLocaleString()} ج</div>
                  <button className="ebtn" onClick={() => setModal({ mode:"edit", client })} title="تعديل">✏️</button>
                  <span className={`chev ${isOpen?"open":""}`}>▶</span>
                </div>
              </div>
              {isOpen && (
                <div className="ibody">
                  {(client.items||[]).map((item,j) => (
                    <div className="irow-d" key={j}>
                      <div style={{display:"flex",alignItems:"center"}}><span className="idot"/>{item.product}</div>
                      <div style={{fontWeight:700,color:"#8B4E2A"}}>{item.price.toLocaleString()} ج</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {!loading && clients.length > 0 && (
          <div className="sum-card">
            <div style={{fontSize:14,fontWeight:700,color:"#F0D9C8"}}>💰  الإجمالي الكلي لشهر مايو</div>
            <div style={{fontSize:26,fontWeight:900,color:"#fff"}}>{grandTotal.toLocaleString()} ج</div>
          </div>
        )}
      </div>

      {modal && <Modal mode={modal.mode} client={modal.client} onClose={() => setModal(null)} onSave={handleSave} onDelete={handleDelete} saving={saving} />}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
