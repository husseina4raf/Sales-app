import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, setDoc
} from "firebase/firestore";

const CATEGORIES = [
  { id: "private", label: "🔒 خاص"         },
  { id: "korean",  label: "🌸 كوريان"       },
  { id: "makeup",  label: "💄 مكياج وعطور" },
];

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const STATUS_CYCLE = ["لم يتم الدفع", "تم الدفع", "تم التحويل"];
const STATUS_STYLE = {
  "تم الدفع":     { cls: "paid",        icon: "✓", label: "تم الدفع"     },
  "لم يتم الدفع": { cls: "unpaid",      icon: "○", label: "لم يتم الدفع" },
  "تم التحويل":   { cls: "transferred", icon: "↗", label: "تم التحويل"   },
};

const toMonthKey     = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const currentKey     = toMonthKey(new Date());
const getClientMonth = c => c.month || (c.createdAt?.toDate ? toMonthKey(c.createdAt.toDate()) : currentKey);

// Modal
function Modal({ mode, client, category, onClose, onSave, onDelete, saving }) {
  const [name,   setName]   = useState(client?.name   || "");
  const [status, setStatus] = useState(client?.status || "لم يتم الدفع");
  const [items,  setItems]  = useState(
    client?.items?.map((i, idx) => ({ ...i, uid: idx, qty: i.qty ?? 1 })) ||
    [{ uid: 0, product: "", qty: 1, price: "" }]
  );
  const [shake, setShake] = useState(false);
  const overlayRef = useRef();
  const uidRef     = useRef(100);

  const isEdit     = mode === "edit";
  const addItem    = () => setItems(p => [...p, { uid: uidRef.current++, product: "", qty: 1, price: "" }]);
  const removeItem = uid => { if (items.length > 1) setItems(p => p.filter(i => i.uid !== uid)); };
  const updateItem = (uid, field, val) => setItems(p => p.map(i => i.uid === uid ? { ...i, [field]: val } : i));
  const lineTotal  = item => (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1);
  const total      = items.reduce((s, i) => s + lineTotal(i), 0);

  const handleSave = () => {
    if (!name.trim() || items.some(i => !i.product.trim() || i.price === "")) {
      setShake(true); setTimeout(() => setShake(false), 500); return;
    }
    onSave({
      name: name.trim(), status, category,
      items: items.map(({ product, qty, price }) => ({
        product, qty: parseInt(qty) || 1, price: parseFloat(price) || 0,
      })),
    });
  };

  return (
    <div ref={overlayRef} onClick={e => e.target === overlayRef.current && onClose()}
      style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(30,10,0,0.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}60%{transform:translateX(8px)}}
        .mbox{animation:slideUp .3s cubic-bezier(.16,1,.3,1) forwards;background:#fff;border-radius:20px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(80,30,0,.3);direction:rtl;font-family:'Cairo',sans-serif}
        .mbox.shake{animation:shake .4s ease}
        .mhdr{background:linear-gradient(135deg,#5C2D0E,#8B4E2A);padding:24px 28px 20px;border-radius:20px 20px 0 0;position:sticky;top:0;z-index:2}
        .mtitle{font-size:18px;font-weight:900;color:#F0D9C8}.msub{font-size:12px;color:#C9956E;margin-top:3px}
        .mbody{padding:24px 28px}
        .flbl{font-size:11px;font-weight:700;color:#9A7C4F;letter-spacing:1.5px;margin-bottom:7px}
        .finp{width:100%;padding:11px 13px;border:1.5px solid #E8DDD3;border-radius:10px;font-family:'Cairo',sans-serif;font-size:14px;color:#2C1A0E;background:#FDF8F4;outline:none;transition:border-color .2s,box-shadow .2s;direction:rtl}
        .finp:focus{border-color:#C9956E;box-shadow:0 0 0 3px rgba(201,149,110,.15)}
        .stoggle{display:flex;gap:8px}
        .sbtn{flex:1;padding:10px 6px;border-radius:10px;border:1.5px solid #E8DDD3;font-family:'Cairo',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;background:#FDF8F4;color:#9A7C4F}
        .sbtn.ap{background:#D4EDDA;border-color:#276749;color:#276749}
        .sbtn.au{background:#F5F0E8;border-color:#9A7C4F;color:#9A7C4F}
        .sbtn.at{background:#DBEAFE;border-color:#1A56A0;color:#1A56A0}
        .col-hdrs{display:grid;grid-template-columns:1fr 64px 90px 32px;gap:6px;margin-bottom:5px}
        .col-h{font-size:10px;font-weight:700;color:#B09080;text-align:center}
        .col-h:first-child{text-align:right}
        .irow{display:grid;grid-template-columns:1fr 64px 90px 32px;gap:6px;align-items:center;margin-bottom:6px}
        .line-total{font-size:11px;color:#8B4E2A;font-weight:700;background:#FDF0E8;border-radius:8px;padding:3px 8px;margin:-2px 0 8px 38px;display:inline-block}
        .rmbtn{width:32px;height:32px;border-radius:8px;border:none;background:#FDF0E8;color:#C9956E;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
        .rmbtn:hover{background:#F5D9C0;color:#8B4E2A}.rmbtn:disabled{opacity:.3;cursor:default}
        .addbtn{width:100%;padding:10px;border-radius:10px;border:1.5px dashed #C9956E;background:transparent;color:#C9956E;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;margin-top:6px}
        .addbtn:hover{background:#FDF5EF}
        .totbar{background:linear-gradient(135deg,#F5EDE3,#EDD9C4);border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
        .mfooter{padding:16px 28px 24px;display:flex;gap:10px;border-top:1px solid #F0E8E0}
        .bsave{flex:1;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#8B4E2A,#5C2D0E);color:#F0D9C8;font-family:'Cairo',sans-serif;font-size:15px;font-weight:900;cursor:pointer;transition:all .2s}
        .bsave:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}.bsave:disabled{opacity:.6;cursor:wait}
        .bcancel{padding:14px 20px;border-radius:12px;border:1.5px solid #E8DDD3;background:#FDF8F4;color:#9A7C4F;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s}
        .bcancel:hover{border-color:#C9956E;color:#8B4E2A}
        .bdel{padding:14px 16px;border-radius:12px;border:1.5px solid #FFD0CC;background:#FFF5F4;color:#CC3322;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s}
        .bdel:hover{background:#FFEBE8;border-color:#CC3322}
        .mbox::-webkit-scrollbar{width:4px}.mbox::-webkit-scrollbar-thumb{background:#E8DDD3;border-radius:2px}
      `}</style>

      <div className={`mbox ${shake ? "shake" : ""}`}>
        <div className="mhdr">
          <div className="mtitle">{isEdit ? `✏️  تعديل — ${client.name}` : "➕  إضافة عميلة جديدة"}</div>
          <div className="msub">{isEdit ? "عدّل البيانات ثم اضغط حفظ" : "أدخل بيانات العميلة والمنتجات"}</div>
        </div>
        <div className="mbody">
          <div style={{marginBottom:18}}>
            <div className="flbl">العميلة</div>
            <input className="finp" placeholder="اسم العميلة..." value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{marginBottom:18}}>
            <div className="flbl">حالة الدفع</div>
            <div className="stoggle">
              <button className={`sbtn ${status==="تم الدفع"?"ap":""}`}     onClick={() => setStatus("تم الدفع")}>✓  تم الدفع</button>
              <button className={`sbtn ${status==="لم يتم الدفع"?"au":""}`} onClick={() => setStatus("لم يتم الدفع")}>○  لم يتم الدفع</button>
              <button className={`sbtn ${status==="تم التحويل"?"at":""}`}   onClick={() => setStatus("تم التحويل")}>↗  تم التحويل</button>
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
            {items.map((item, idx) => (
              <div key={item.uid}>
                <div className="irow">
                  <input className="finp" placeholder={`المنتج ${idx+1}`} value={item.product}
                    onChange={e => updateItem(item.uid,"product",e.target.value)} style={{padding:"10px 11px"}} />
                  <input className="finp" placeholder="١" type="number" min="1" value={item.qty}
                    onChange={e => updateItem(item.uid,"qty",e.target.value)} style={{padding:"10px 8px",textAlign:"center"}} />
                  <input className="finp" placeholder="السعر" type="number" min="0" value={item.price}
                    onChange={e => updateItem(item.uid,"price",e.target.value)} style={{padding:"10px 11px",textAlign:"center"}} />
                  <button className="rmbtn" onClick={() => removeItem(item.uid)} disabled={items.length===1}>✕</button>
                </div>
                {(parseInt(item.qty)||1) > 1 && item.price !== "" && (
                  <div style={{textAlign:"left",marginBottom:4}}>
                    <span className="line-total">
                      {item.qty} × {parseFloat(item.price).toLocaleString()} = {lineTotal(item).toLocaleString()} ج
                    </span>
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
          {isEdit && <button className="bdel" onClick={() => onDelete(client.id)}>🗑</button>}
          <button className="bcancel" onClick={onClose}>إلغاء</button>
          <button className="bsave" onClick={handleSave} disabled={saving}>
            {saving ? "جاري الحفظ..." : isEdit ? "💾  حفظ التعديلات" : "✓  إضافة العميلة"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [clients,        setClients]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [expanded,       setExpanded]       = useState(null);
  const [modal,          setModal]          = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [toast,          setToast]          = useState(null);
  const [activeCategory, setActiveCategory] = useState("private");
  const [selectedMonth,  setSelectedMonth]  = useState(currentKey);
  const [baseCost,       setBaseCost]       = useState("");
  const [editingBase,    setEditingBase]    = useState(false);

  const showToast = (msg, type="success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("createdAt", "asc"));
    return onSnapshot(q, snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
  }, []);

  useEffect(() => {
    setBaseCost(""); setEditingBase(false);
    const key = `${activeCategory}_${selectedMonth}`;
    return onSnapshot(doc(db, "settings", key), snap => {
      setBaseCost(snap.exists() ? (snap.data().baseCost ?? "") : "");
    });
  }, [activeCategory, selectedMonth]);

  const saveBaseCost = async val => {
    const num = parseFloat(val) || 0;
    setBaseCost(num); setEditingBase(false);
    await setDoc(doc(db, "settings", `${activeCategory}_${selectedMonth}`), { baseCost: num });
  };

  const handleSave = async data => {
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await addDoc(collection(db, "clients"), { ...data, month: selectedMonth, createdAt: serverTimestamp() });
        showToast(`✓  تمت إضافة ${data.name} بنجاح`);
      } else {
        await updateDoc(doc(db, "clients", modal.client.id), data);
        showToast(`✓  تم تحديث بيانات ${data.name}`);
      }
      setModal(null);
    } catch { showToast("حدث خطأ، حاول تاني", "error"); }
    setSaving(false);
  };

  const handleDelete = async id => {
    const name = clients.find(c => c.id === id)?.name;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "clients", id));
      setModal(null);
      showToast(`🗑  تم حذف ${name}`, "delete");
    } catch { showToast("حدث خطأ في الحذف", "error"); }
    setSaving(false);
  };

  const handleStatusToggle = async client => {
    const idx = STATUS_CYCLE.indexOf(client.status ?? "لم يتم الدفع");
    await updateDoc(doc(db, "clients", client.id), { status: STATUS_CYCLE[(idx+1) % STATUS_CYCLE.length] });
  };

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTHS_AR[selMonth-1]} ${selYear}`;
  const shiftMonth = delta => {
    const d = new Date(selYear, selMonth - 1 + delta);
    setSelectedMonth(toMonthKey(d)); setExpanded(null);
  };

  const itemTotal   = item => (item.price || 0) * (item.qty || 1);
  const clientTotal = c    => (c.items || []).reduce((s, i) => s + itemTotal(i), 0);

  const catClients = clients.filter(c =>
    (c.category || "private") === activeCategory && getClientMonth(c) === selectedMonth
  );
  const grandTotal  = catClients.reduce((s, c) => s + clientTotal(c), 0);
  const collected   = catClients.filter(c => c.status === "تم الدفع" || c.status === "تم التحويل")
                                .reduce((s, c) => s + clientTotal(c), 0);
  const pending     = catClients.filter(c => c.status === "لم يتم الدفع")
                                .reduce((s, c) => s + clientTotal(c), 0);
  const baseCostNum = parseFloat(baseCost) || 0;
  const profit      = baseCostNum > 0 ? grandTotal - baseCostNum : null;
  const profitPos   = profit !== null && profit >= 0;
  const catLabel    = CATEGORIES.find(c => c.id === activeCategory)?.label || "";

  return (
    <div dir="rtl" style={{minHeight:"100vh",background:"#FDF8F4",fontFamily:"'Cairo',sans-serif",color:"#2C1A0E"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .topbar{background:linear-gradient(135deg,#5C2D0E 0%,#8B4E2A 60%,#C9956E 100%);padding:28px 36px 20px;position:relative;overflow:hidden}
        .topbar::after{content:'✦';position:absolute;font-size:160px;color:rgba(255,255,255,.04);bottom:-30px;left:10px;line-height:1}
        .badge{display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#F0D9C8;font-size:10px;font-weight:700;letter-spacing:3px;padding:4px 14px;border-radius:30px;margin-bottom:10px}
        .ptitle{font-size:26px;font-weight:900;color:#fff;letter-spacing:-.5px}
        .live-dot{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#B8F0C8;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;margin-top:10px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .dot{width:7px;height:7px;border-radius:50%;background:#4ADE80;animation:pulse 1.5s infinite}
        .btn-add{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#5C2D0E;padding:11px 22px;border-radius:12px;border:none;font-family:'Cairo',sans-serif;font-size:14px;font-weight:900;cursor:pointer;transition:all .2s;box-shadow:0 2px 12px rgba(0,0,0,.15);margin-top:14px}
        .btn-add:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.2)}
        .cat-tabs{display:flex;background:#fff;border-bottom:2px solid #E8DDD3;overflow-x:auto}
        .cat-tab{flex:1;padding:14px 20px;border:none;background:transparent;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;color:#B09080;cursor:pointer;transition:all .2s;border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap;min-width:120px}
        .cat-tab.active{color:#5C2D0E;border-bottom-color:#8B4E2A;background:#FDF8F4}
        .cat-tab:hover:not(.active){color:#8B4E2A;background:#FDF5EF}
        .month-nav{display:flex;align-items:center;justify-content:center;background:#F5EDE3;border-bottom:1px solid #E8DDD3;padding:10px 0}
        .mnav-label{font-size:16px;font-weight:900;color:#5C2D0E;min-width:170px;text-align:center}
        .mnav-btn{width:36px;height:36px;border:none;background:transparent;color:#8B4E2A;font-size:24px;cursor:pointer;border-radius:8px;transition:background .2s;display:flex;align-items:center;justify-content:center}
        .mnav-btn:hover{background:#EDD9C4}
        .stats-row{display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border-bottom:1px solid #E8DDD3}
        .stat-box{padding:16px 18px;border-left:1px solid #E8DDD3;transition:background .2s;min-width:0}
        .stat-box:last-child{border-left:none}
        .stat-box:hover{background:#FDF5EF}
        .slbl{font-size:10px;color:#B09080;font-weight:700;letter-spacing:1px;margin-bottom:5px;white-space:nowrap}
        .sval{font-size:20px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .profit-row{font-size:12px;font-weight:700;margin-top:4px;white-space:nowrap}
        .base-inp{font-size:18px;font-weight:900;color:#5C2D0E;background:transparent;border:none;border-bottom:2px dashed #C9956E;outline:none;font-family:'Cairo',sans-serif;width:100%;direction:ltr}
        .main{padding:28px 36px;max-width:980px;margin:0 auto}
        .shead{font-size:11px;font-weight:700;color:#B09080;letter-spacing:2px;margin-bottom:14px;display:flex;align-items:center;gap:10px}
        .shead::before{content:'';width:3px;height:14px;background:linear-gradient(180deg,#C9956E,#8B4E2A);border-radius:2px}
        .ccard{background:#fff;border:1.5px solid #E8DDD3;border-radius:14px;margin-bottom:10px;overflow:hidden;transition:box-shadow .2s,border-color .2s}
        .ccard:hover{box-shadow:0 4px 20px rgba(180,110,60,.1);border-color:#C9956E}
        .chdr{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;cursor:pointer;user-select:none}
        .cleft{display:flex;align-items:center;gap:12px}
        .avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#F0D9C8,#C9956E);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#fff;flex-shrink:0}
        .cname{font-size:16px;font-weight:700;color:#2C1A0E}
        .icnt{font-size:11px;color:#B09080;margin-top:1px}
        .cright{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
        .ctotal{font-size:18px;font-weight:900;color:#8B4E2A}
        .spill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;border:none;font-family:'Cairo',sans-serif;white-space:nowrap}
        .paid{background:#D4EDDA;color:#276749}
        .unpaid{background:#F5F0E8;color:#9A7C4F}
        .transferred{background:#DBEAFE;color:#1A56A0}
        .paid:hover{background:#B8E0C4}.unpaid:hover{background:#EDE0CC}.transferred:hover{background:#BFDBFE}
        .ebtn{width:32px;height:32px;border-radius:8px;border:1.5px solid #E8DDD3;background:#FDF8F4;color:#C9956E;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s;flex-shrink:0}
        .ebtn:hover{background:#F5EDE3;border-color:#C9956E;color:#8B4E2A}
        .chev{font-size:10px;color:#C9956E;transition:transform .25s;flex-shrink:0}
        .chev.open{transform:rotate(90deg)}
        .ibody{border-top:1px solid #F0E8E0;background:#FDF8F4}
        .irow-d{display:flex;justify-content:space-between;align-items:center;padding:10px 20px 10px 56px;border-bottom:1px solid #F0E8E0;font-size:13.5px;color:#5A3A24}
        .irow-d:last-child{border-bottom:none}
        .idot{width:5px;height:5px;border-radius:50%;background:#C9956E;display:inline-block;margin-left:9px;flex-shrink:0}
        .qty-badge{background:#F5EDE3;color:#8B4E2A;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:7px}
        .sum-card{background:linear-gradient(135deg,#5C2D0E,#8B4E2A);border-radius:14px;padding:20px 24px;margin-top:20px}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;z-index:2000;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;box-shadow:0 8px 30px rgba(0,0,0,.2);animation:toastIn .3s ease forwards;white-space:nowrap}
        .toast.success{background:#5C2D0E;color:#F0D9C8}
        .toast.delete,.toast.error{background:#CC3322;color:#fff}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:40px;height:40px;border:3px solid #E8DDD3;border-top-color:#C9956E;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}
        @media(max-width:700px){.stats-row{grid-template-columns:repeat(2,1fr)!important}.main{padding:16px}.topbar{padding:20px 16px}.cat-tab{font-size:12px;padding:12px 10px}}
      `}</style>

      <div className="topbar">
        <div className="badge">{monthLabel}</div>
        <div className="ptitle">&#x1F484; &#x633;&#x62C;&#x644; &#x627;&#x644;&#x645;&#x628;&#x64A;&#x639;&#x627;&#x62A;</div>
        <div className="live-dot"><span className="dot"/>&#x645;&#x628;&#x627;&#x634;&#x631; &#x2014; &#x64A;&#x62A;&#x62D;&#x62F;&#x62B; &#x62A;&#x644;&#x642;&#x627;&#x626;&#x64A;&#x64B;&#x627;</div>
        <div><button className="btn-add" onClick={() => setModal({ mode:"add" })}>
          <span style={{fontSize:18,lineHeight:1}}>+</span> &#x625;&#x636;&#x627;&#x641;&#x629; &#x639;&#x645;&#x64A;&#x644;&#x629; &#x62C;&#x62F;&#x64A;&#x62F;&#x629;
        </button></div>
      </div>

      <div className="cat-tabs">
        {CATEGORIES.map(cat => (
          <button key={cat.id} className={`cat-tab ${activeCategory===cat.id?"active":""}`}
            onClick={() => { setActiveCategory(cat.id); setExpanded(null); }}>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="month-nav">
        <button className="mnav-btn" onClick={() => shiftMonth(-1)}>&#8250;</button>
        <div className="mnav-label">{monthLabel}</div>
        <button className="mnav-btn" onClick={() => shiftMonth(1)}>&#8249;</button>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="slbl">&#x625;&#x62C;&#x645;&#x627;&#x644;&#x64A; &#x627;&#x644;&#x645;&#x628;&#x64A;&#x639;&#x627;&#x62A;</div>
          <div className="sval" style={{color:"#8B4E2A"}}>{grandTotal.toLocaleString()} &#x62C;</div>
        </div>
        <div className="stat-box">
          <div className="slbl">&#x62A;&#x645; &#x627;&#x644;&#x62A;&#x62D;&#x635;&#x64A;&#x644;</div>
          <div className="sval" style={{color:"#276749"}}>{collected.toLocaleString()} &#x62C;</div>
        </div>
        <div className="stat-box">
          <div className="slbl">&#x63A;&#x64A;&#x631; &#x645;&#x62D;&#x635;&#x651;&#x644;</div>
          <div className="sval" style={{color:"#9A7C4F"}}>{pending.toLocaleString()} &#x62C;</div>
        </div>
        <div className="stat-box">
          <div className="slbl">&#x639;&#x62F;&#x62F; &#x627;&#x644;&#x639;&#x645;&#x644;&#x627;&#x621;</div>
          <div className="sval" style={{color:"#2C1A0E"}}>{catClients.length}</div>
        </div>
        <div className="stat-box" style={{cursor:"pointer"}} onClick={() => !editingBase && setEditingBase(true)}>
          <div className="slbl">&#x62A;&#x643;&#x644;&#x641;&#x629; &#x627;&#x644;&#x628;&#x636;&#x627;&#x639;&#x629; &#x270E;</div>
          {editingBase ? (
            <input className="base-inp" type="number" autoFocus value={baseCost}
              onChange={e => setBaseCost(e.target.value)}
              onBlur={() => saveBaseCost(baseCost)}
              onKeyDown={e => e.key==="Enter" && saveBaseCost(baseCost)}
              onClick={e => e.stopPropagation()} />
          ) : (
            <>
              <div className="sval" style={{color:"#5C2D0E"}}>
                {baseCostNum > 0 ? baseCostNum.toLocaleString() : "—"} &#x62C;
              </div>
              {profit !== null && (
                <div className="profit-row" style={{color:profitPos?"#276749":"#CC3322"}}>
                  {profitPos?"▲":"▼"} &#x627;&#x644;&#x631;&#x628;&#x62D;: {Math.abs(profit).toLocaleString()} &#x62C;
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="main">
        <div className="shead">&#x62A;&#x641;&#x627;&#x635;&#x64A;&#x644; &#x627;&#x644;&#x637;&#x644;&#x628;&#x627;&#x62A; &#x2014; {catLabel} &#x2014; {monthLabel}</div>

        {loading && <div style={{textAlign:"center",padding:"60px"}}><div className="spinner"/></div>}

        {!loading && catClients.length===0 && (
          <div style={{textAlign:"center",padding:"60px",color:"#C9956E",fontSize:15}}>
            &#x644;&#x627; &#x64A;&#x648;&#x62C;&#x62F; &#x639;&#x645;&#x644;&#x627;&#x621; &#x641;&#x64A; &#x647;&#x630;&#x627; &#x627;&#x644;&#x634;&#x647;&#x631; &#x2014; &#x627;&#x636;&#x63A;&#x637; "&#x625;&#x636;&#x627;&#x641;&#x629; &#x639;&#x645;&#x64A;&#x644;&#x629; &#x62C;&#x62F;&#x64A;&#x62F;&#x629;" &#x1F484;
          </div>
        )}

        {catClients.map(client => {
          const total  = clientTotal(client);
          const isOpen = expanded === client.id;
          const st     = STATUS_STYLE[client.status] || STATUS_STYLE["لم يتم الدفع"];
          return (
            <div className="ccard" key={client.id}>
              <div className="chdr" onClick={() => setExpanded(isOpen ? null : client.id)}>
                <div className="cleft">
                  <div className="avatar">{(client.name||"?")[0]}</div>
                  <div>
                    <div className="cname">{client.name}</div>
                    <div className="icnt">{(client.items||[]).length} &#x645;&#x646;&#x62A;&#x62C;&#x627;&#x62A;</div>
                  </div>
                </div>
                <div className="cright" onClick={e => e.stopPropagation()}>
                  <button className={`spill ${st.cls}`} onClick={() => handleStatusToggle(client)}>
                    {st.icon}  {st.label}
                  </button>
                  <div className="ctotal">{total.toLocaleString()} &#x62C;</div>
                  <button className="ebtn" onClick={() => setModal({ mode:"edit", client })}>&#x270F;&#xFE0F;</button>
                  <span className={`chev ${isOpen?"open":""}`}>&#x25B6;</span>
                </div>
              </div>
              {isOpen && (
                <div className="ibody">
                  {(client.items||[]).map((item, j) => {
                    const qty  = item.qty || 1;
                    const line = item.price * qty;
                    return (
                      <div className="irow-d" key={j}>
                        <div style={{display:"flex",alignItems:"center"}}>
                          <span className="idot"/>
                          {qty > 1 && <span className="qty-badge">&#xD7;{qty}</span>}
                          {item.product}
                        </div>
                        <div style={{fontWeight:700,color:"#8B4E2A",whiteSpace:"nowrap"}}>
                          {qty > 1
                            ? `${qty} × ${item.price.toLocaleString()} = ${line.toLocaleString()}`
                            : item.price.toLocaleString()
                          } &#x62C;
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!loading && catClients.length > 0 && (
          <div className="sum-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:profit!==null?12:0}}>
              <div style={{fontSize:14,fontWeight:700,color:"#F0D9C8"}}>&#x1F4B0;  &#x625;&#x62C;&#x645;&#x627;&#x644;&#x64A; {monthLabel} &#x2014; {catLabel}</div>
              <div style={{fontSize:26,fontWeight:900,color:"#fff"}}>{grandTotal.toLocaleString()} &#x62C;</div>
            </div>
            {profit !== null && (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(255,255,255,.2)",paddingTop:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.7)"}}>
                  &#x62A;&#x643;&#x644;&#x641;&#x629; &#x627;&#x644;&#x628;&#x636;&#x627;&#x639;&#x629;: {baseCostNum.toLocaleString()} &#x62C;
                </div>
                <div style={{fontSize:18,fontWeight:900,color:profitPos?"#86EFAC":"#FCA5A5"}}>
                  {profitPos?"▲":"▼"} &#x627;&#x644;&#x631;&#x628;&#x62D;: {Math.abs(profit).toLocaleString()} &#x62C;
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <Modal mode={modal.mode} client={modal.client} category={activeCategory}
          onClose={() => setModal(null)} onSave={handleSave} onDelete={handleDelete} saving={saving} />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
