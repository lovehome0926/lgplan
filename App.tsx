
import React, { useState, useEffect, useRef } from 'react';
import { CustomerType, PlanType, ContractLength, OrderData, ProductInput, FileData, Language, ProductCategory, CatalogItem, DEFAULT_CATALOG, SystemConfig } from './types';
import { analyzeDealStream } from './services/geminiService';
import ProductRow from './components/ProductRow';

/**
 * 核心系统默认配置 (一进来就看到的资料)
 */
const SYSTEM_DEFAULTS: SystemConfig = {
  catalog: DEFAULT_CATALOG,
  masterKnowledge: `
    LG SUBSCRIBE 销售大师核心规则 (2024/2025 最新版):
    
    1. 【RM88 Picks 专项策略】：
       - 洗衣机 & 烘干机 (Washer/Dryer): 促销价统一为 RM88。必须引导客户选购目录中最昂贵、最高端的型号（如 V5 系列），因为型号越贵，客户省下的钱越多。
       - 冰箱 (Fridge): 强烈推荐 "Regular Visit 12M" 方案，这是最平衡的维护选择。
    
    2. 【微波炉 (Microwave) 特殊限制】：
       - 微波炉仅支持 5年(60个月) 和 3年(36个月) 方案。
       - 默认必须优先推荐 5年(60个月)，月租金更低且更具竞争力。
    
    3. 【提前结算优惠 (Early Settlement)】：
       - 勾选此项表示客户愿意一次性买断剩余租期。
       - 规则：通常可基于剩余租金总额申请约 10% 的减免优惠。
    
    4. 【产品捆绑方案】：
       - 组合购买（如 WP + AP）时，应计算组合月租减免（通常比单买省 RM10-15/月）。
    
    5. 【老顾客优惠 (Existing Customer)】：
       - 老顾客再次下单可享受处理费减免或额外的月租扣减。
  `,
  memos: [] 
}; 

const DB_NAME = 'LG_Sales_DB';
const STORE_NAME = 'memos';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveMemosToDB = async (memos: FileData[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const userOnly = memos.filter(m => !m.isSystem);
  store.clear();
  userOnly.forEach(memo => store.put(memo));
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
  });
};

const loadMemosFromDB = async (): Promise<FileData[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

const App: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [masterKnowledge, setMasterKnowledge] = useState<string>('');
  const [settingsTab, setSettingsTab] = useState<'catalog' | 'rules' | 'memos' | 'sync'>('catalog');
  const [showSettings, setShowSettings] = useState(false);
  const [showSecretMenu, setShowSecretMenu] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<any>(null);

  const [orderData, setOrderData] = useState<OrderData>({
    customerType: CustomerType.NEW,
    products: [{ category: '', name: '', model: '', quantity: 1, contract: ContractLength.MONTHS_60 }],
    plan: PlanType.SUBSCRIBE,
    promotion: '',
    manualKnowledge: '',
    additionalContext: '',
    wantsFullSettlement: false,
    language: Language.CN
  });

  const [stagedMemos, setStagedMemos] = useState<FileData[]>([]);
  const [activeMemos, setActiveMemos] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [syncInput, setSyncInput] = useState('');

  useEffect(() => {
    const init = async () => {
      let initialCatalog = SYSTEM_DEFAULTS.catalog;
      let initialRules = SYSTEM_DEFAULTS.masterKnowledge;
      let initialMemos: FileData[] = (SYSTEM_DEFAULTS.memos || []).map(m => ({ ...m, isSystem: true }));

      const savedCatalog = localStorage.getItem('lg_custom_catalog');
      const savedRules = localStorage.getItem('lg_master_rules');
      
      if (savedCatalog) { try { initialCatalog = JSON.parse(savedCatalog); } catch (e) {} }
      if (savedRules) { initialRules = savedRules; }
      
      try {
        const userMemos = await loadMemosFromDB();
        const systemNames = new Set(initialMemos.map(m => m.name));
        const filteredUserMemos = userMemos.filter((um: FileData) => !systemNames.has(um.name));
        initialMemos = [...initialMemos, ...filteredUserMemos];
      } catch (e) {}

      setCatalog(initialCatalog);
      setMasterKnowledge(initialRules);
      setActiveMemos(initialMemos);
    };
    init();
  }, []);

  const handleLogoClick = () => {
    logoClickCount.current++;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, 1000);

    if (logoClickCount.current === 5) {
      setShowSecretMenu(true);
      logoClickCount.current = 0;
      showStatus('Admin Mode Unlocked');
    }
  };

  const resetToSystemDefaults = () => {
    if (window.confirm('确定要恢复到官方系统默认设置吗？这将同步代码中最新的策略资料。')) {
      localStorage.removeItem('lg_custom_catalog');
      localStorage.removeItem('lg_master_rules');
      saveMemosToDB([]);
      window.location.reload();
    }
  };

  const applySyncCode = async (code: string) => {
    try {
      const config = JSON.parse(code);
      if (config.catalog) saveCatalog(config.catalog);
      if (config.masterKnowledge) saveMasterRules(config.masterKnowledge);
      if (config.activeMemos) await updateMemosStateAndStorage(config.activeMemos);
      showStatus('Sync Applied Successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      showStatus('Invalid Sync Code');
    }
  };

  const updateMemosStateAndStorage = async (memos: FileData[]) => {
    setActiveMemos(memos);
    await saveMemosToDB(memos);
  };

  const saveCatalog = (newCatalog: CatalogItem[]) => {
    setCatalog(newCatalog);
    localStorage.setItem('lg_custom_catalog', JSON.stringify(newCatalog));
  };

  const saveMasterRules = (val: string) => {
    setMasterKnowledge(val);
    localStorage.setItem('lg_master_rules', val);
  };

  const handleExport = () => {
    const config = { catalog, masterKnowledge, activeMemos };
    const blob = new Blob([JSON.stringify(config)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LG_AI_MasterConfig_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showStatus('Exported!');
  };

  const getMasterPayload = () => {
    return JSON.stringify({ catalog, masterKnowledge, activeMemos });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const config = JSON.parse(text);
      if (config.catalog) saveCatalog(config.catalog);
      if (config.masterKnowledge) saveMasterRules(config.masterKnowledge);
      if (config.activeMemos) await updateMemosStateAndStorage(config.activeMemos);
      showStatus('Import Success!');
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      showStatus('Invalid File');
    }
  };

  const t = (en: string, cn: string) => (orderData.language === Language.CN ? cn : en);
  const showStatus = (msg: string) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(''), 4000); };

  const handleAnalyze = async () => {
    if (orderData.products.some(p => !p.name)) { 
      showStatus(t('Select items first', '请先选择产品')); 
      return; 
    }
    setLoading(true);
    setResult('');
    try {
      await analyzeDealStream(orderData, masterKnowledge, activeMemos, (text) => {
        setResult(text);
      });
    } catch (err: any) {
      console.error("Analysis Error:", err);
      showStatus(t('Computing Error. Please try again.', '计算出错，请重试'));
    }
    setLoading(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const reader = (file: File): Promise<FileData> => new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res({ name: file.name, base64: r.result as string, mimeType: file.type });
      r.readAsDataURL(file);
    });
    const newFiles: FileData[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type === 'application/pdf') newFiles.push(await reader(files[i]));
    }
    setStagedMemos(prev => [...prev, ...newFiles]);
  };

  const removeMemo = async (index: number) => {
    const newMemos = activeMemos.filter((_, i) => i !== index);
    await updateMemosStateAndStorage(newMemos);
    showStatus(t('Deleted', '已删除'));
  };

  const savingsMatch = result.match(/\[SAVED_AMOUNT\]:\s*(.*)/i);
  const totalSavedValue = savingsMatch ? savingsMatch[1].split('\n')[0] : '';
  const displayResult = result.replace(/\[SAVED_AMOUNT\]:\s*(.*)/i, '').trim();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <header className="bg-rose-700 text-white py-5 px-6 sticky top-0 z-[60] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 cursor-pointer select-none active:opacity-70" onClick={handleLogoClick}>
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-700 font-black text-lg shadow-inner">LG</div>
          <h1 className="text-lg font-black uppercase tracking-tight">{t('Sales Assistant', '销售智助')}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setOrderData({...orderData, language: orderData.language === Language.EN ? Language.CN : Language.EN})} className="bg-white/20 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest active:scale-95 transition-all">{orderData.language}</button>
          <button onClick={() => setShowSettings(true)} className="bg-white text-rose-700 p-2 rounded-xl text-xl shadow-md active:scale-95 transition-all">⚙️</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl border-2 border-slate-100">
            <div className="flex flex-col gap-6 mb-10">
              <div className="flex p-2 bg-slate-100 rounded-3xl w-full">
                <button onClick={() => setOrderData({...orderData, customerType: CustomerType.NEW})} className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${orderData.customerType === CustomerType.NEW ? 'bg-white text-rose-700 shadow-md' : 'text-slate-400'}`}>{t('New', '新顾客')}</button>
                <button onClick={() => setOrderData({...orderData, customerType: CustomerType.EXISTING})} className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${orderData.customerType === CustomerType.EXISTING ? 'bg-white text-rose-700 shadow-md' : 'text-slate-400'}`}>{t('Existing', '老顾客')}</button>
              </div>
              <div className="flex items-center justify-between bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                 <span className="text-sm font-black text-slate-500 uppercase tracking-widest">{t('Early Settlement Discount', '提前结算优惠')}</span>
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input type="checkbox" checked={orderData.wantsFullSettlement} onChange={(e) => setOrderData({...orderData, wantsFullSettlement: e.target.checked})} className="sr-only peer" />
                   <div className="w-14 h-8 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-600"></div>
                 </label>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-4">{t('Product Selection', '选择下单产品')}</label>
              {orderData.products.map((p, idx) => (
                <ProductRow 
                  key={idx} 
                  product={p} 
                  catalog={catalog} 
                  language={orderData.language}
                  onChange={(u) => {
                    const n=[...orderData.products]; 
                    n[idx]=u; 
                    setOrderData({...orderData, products:n});
                  }} 
                  onRemove={() => setOrderData({...orderData, products: orderData.products.filter((_,i)=>i!==idx)})} 
                  isOnlyOne={orderData.products.length===1} 
                />
              ))}
              <button onClick={() => setOrderData({...orderData, products: [...orderData.products, {category:'', name:'', model:'', quantity:1, contract: ContractLength.MONTHS_60}]})} className="w-full py-8 border-4 border-dashed border-slate-100 rounded-[2.5rem] text-sm font-black uppercase text-slate-400 hover:border-rose-400 hover:text-rose-600 active:scale-[0.98] transition-all">
                + {t('Add More Items', '继续添加产品')}
              </button>
            </div>

            <div className="mt-10">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">{t('Extra Notes', '其他补充备注')}</label>
              <textarea 
                value={orderData.additionalContext} 
                onChange={(e) => setOrderData({...orderData, additionalContext: e.target.value})} 
                className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 text-base font-medium focus:ring-4 focus:ring-rose-500/20 outline-none resize-none"
                placeholder={t('e.g. Combine with promos...', '例如：配合最新促销...')}
              />
            </div>
          </section>

          <button onClick={handleAnalyze} disabled={loading} className="w-full py-8 md:py-12 bg-rose-600 text-white rounded-[3rem] font-black text-2xl md:text-3xl shadow-2xl hover:bg-rose-700 transition-all transform active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-2">
            {loading ? <div className="animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full" /> : (
              <>
                <span className="tracking-widest">{t('GENERATE BEST PRICE', '生成最优方案')}</span>
                <span className="text-xs font-bold opacity-60 tracking-[0.3em] uppercase">✨ {t('AI Smart Calculation', 'AI 智能极速计算')}</span>
              </>
            )}
          </button>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white rounded-[3rem] shadow-2xl border-2 border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
             <div className="bg-slate-900 px-8 py-8 flex justify-between items-center">
                <h2 className="text-white text-xl font-black tracking-tight uppercase">{t('Smart Quote', '方案详情')}</h2>
                {result && <button onClick={() => {navigator.clipboard.writeText(result); showStatus('Copied!');}} className="bg-white/20 hover:bg-white text-rose-500 text-sm font-black uppercase px-6 py-3 rounded-2xl transition-all active:scale-95">Copy</button>}
             </div>
             <div className="p-8 flex-1 overflow-y-auto bg-[radial-gradient(#f1f5f9_1.5px,transparent_1.5px)] [background-size:24px_24px]">
                {!result && !loading && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                      <div className="text-7xl mb-6">📉</div>
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-center">{t('Click button to start', '点击按钮开始方案设计')}</p>
                   </div>
                )}
                {totalSavedValue && (
                  <div className="mb-10 relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-rose-600 to-pink-600 rounded-[2.5rem] blur opacity-30"></div>
                    <div className="relative bg-rose-600 rounded-[2.2rem] p-8 text-white shadow-2xl">
                      <p className="text-xs font-black uppercase opacity-70 mb-2 tracking-widest">{t('Total Savings', '总共节省金额')}</p>
                      <p className="text-5xl font-black tracking-tighter leading-none">{totalSavedValue}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-10 pb-12 whitespace-pre-wrap">
                   {displayResult.split('\n').map((line, i) => {
                      if (line.startsWith('[') && line.includes(']')) {
                         const tag = line.replace(/[\[\]]/g, '').trim();
                         const isStrategy = tag === 'STRATEGY NOTE';
                         const isDashboard = tag === 'DASHBOARD';
                         return (
                           <div key={i} className={`flex items-center gap-4 ${isDashboard ? 'mt-4' : 'mt-12'}`}>
                             <div className="h-0.5 flex-1 bg-slate-200"></div>
                             <h4 className={`text-xs font-black uppercase tracking-[0.2em] px-4 py-2 rounded-lg ${isStrategy ? 'text-white bg-amber-500' : 'text-rose-600/50 bg-rose-50'}`}>{tag}</h4>
                             <div className="h-0.5 flex-1 bg-slate-200"></div>
                           </div>
                         );
                      }
                      return line.trim() ? <p key={i} className="text-lg text-slate-700 leading-relaxed font-bold tracking-tight">{line}</p> : null;
                   })}
                </div>
             </div>
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
             <div className="p-8 border-b flex items-center justify-between bg-slate-50">
                <h3 className="text-xl font-black uppercase tracking-tight">{t('Admin / 系统', '后台管理')}</h3>
                <div className="flex gap-4">
                  <button onClick={resetToSystemDefaults} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-rose-100 hover:text-rose-600 transition-all">重置为官方默认</button>
                  <button onClick={() => setShowSettings(false)} className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-2xl hover:bg-rose-500 hover:text-white transition-all transform hover:rotate-90">✕</button>
                </div>
             </div>
             
             <div className="flex bg-slate-100 p-3 m-6 rounded-3xl overflow-x-auto no-scrollbar">
                {(['catalog', 'rules', 'memos', 'sync'] as const).map(tab => (
                  <button key={tab} onClick={() => setSettingsTab(tab)} className={`flex-shrink-0 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${settingsTab===tab ? 'bg-white text-rose-600 shadow-lg' : 'text-slate-400'}`}>
                    {t(tab.toUpperCase(), tab === 'memos' ? '促销PDF' : tab === 'catalog' ? '型号库' : tab === 'rules' ? '规则' : '同步')}
                  </button>
                ))}
             </div>

             <div className="flex-1 overflow-y-auto p-8 pt-0">
                {settingsTab === 'catalog' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {catalog.map((item, idx) => (
                      <div key={item.id} className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100">
                         <div className="flex justify-between items-start mb-2">
                           <span className="text-[10px] font-black uppercase text-rose-600 px-3 py-1 bg-rose-50 rounded-lg">{item.category}</span>
                           <button onClick={() => saveCatalog(catalog.filter(c=>c.id!==item.id))} className="text-slate-300 hover:text-rose-600 text-lg">✕</button>
                         </div>
                         <p className="text-lg font-black text-slate-800">{item.name}</p>
                         <p className="text-sm text-slate-500 mt-2">{item.models.join(' • ')}</p>
                      </div>
                    ))}
                  </div>
                )}
                {settingsTab === 'rules' && (
                  <div className="h-full flex flex-col">
                    <textarea value={masterKnowledge} onChange={(e) => saveMasterRules(e.target.value)} className="w-full flex-1 p-8 bg-slate-50 rounded-[2rem] text-lg font-bold border-2 border-slate-100 outline-none shadow-inner resize-none" placeholder="Master Logic rules..." />
                  </div>
                )}
                {settingsTab === 'memos' && (
                  <div className="space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
                        <div className="flex justify-between items-center mb-10">
                          <h3 className="text-2xl font-black uppercase">{t('Memos', 'PDF情报')}</h3>
                          <label className="bg-rose-600 px-8 py-4 rounded-2xl text-sm font-black uppercase cursor-pointer hover:bg-rose-500 active:scale-95 transition-all shadow-xl shadow-rose-900/20">
                            + {t('Upload', '上传新PDF')}
                            <input type="file" multiple accept=".pdf" className="hidden" onChange={handleFileSelect} />
                          </label>
                        </div>
                        {stagedMemos.length > 0 && (
                          <button onClick={async () => { await updateMemosStateAndStorage([...activeMemos, ...stagedMemos]); setStagedMemos([]); showStatus('Saved'); }} className="w-full mb-8 py-6 bg-white text-rose-700 rounded-3xl text-sm font-black uppercase shadow-2xl">
                            {t('Confirm & Save to DB', '确定并保存到数据库')} (+{stagedMemos.length})
                          </button>
                        )}
                        <div className="grid grid-cols-1 gap-4">
                            {activeMemos.map((m, i) => (
                              <div key={i} className="p-5 rounded-2xl flex items-center justify-between border-2 border-white/10 bg-white/5">
                                <div className="flex items-center gap-4">
                                  <div className={`w-3 h-3 rounded-full ${m.isSystem ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-slate-500'}`}></div>
                                  <span className="text-base font-bold truncate max-w-[200px]">{m.name} {m.isSystem && '(官方)'}</span>
                                </div>
                                {!m.isSystem && <button onClick={() => removeMemo(i)} className="text-rose-500 text-2xl p-2">✕</button>}
                              </div>
                            ))}
                        </div>
                    </div>
                  </div>
                )}
                {settingsTab === 'sync' && (
                  <div className="grid grid-cols-1 gap-6">
                    <button onClick={handleExport} className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all">Export Master Config</button>
                    <label className="w-full py-8 bg-white border-4 border-dashed border-slate-200 text-center rounded-[2rem] font-black uppercase tracking-widest text-lg cursor-pointer hover:bg-slate-50 active:scale-95 transition-all block">
                      Import Master Config
                      <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                    </label>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {showSecretMenu && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
           <div className="bg-slate-900 border-2 border-white/10 w-full max-w-2xl rounded-[3rem] p-10 text-white shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-3xl font-black tracking-tighter uppercase italic">LG <span className="text-rose-600">Master Sync</span></h2>
                 <button onClick={() => setShowSecretMenu(false)} className="text-2xl opacity-50 hover:opacity-100 transition-all">✕</button>
              </div>
              <p className="text-slate-400 mb-6 text-sm font-bold uppercase tracking-widest">Master Payload (复制此代码发给 AI 以更新系统默认):</p>
              <textarea readOnly value={getMasterPayload()} className="w-full h-32 bg-black border border-white/5 rounded-2xl p-4 text-[10px] font-mono text-emerald-500 mb-8 overflow-auto cursor-pointer active:scale-[0.98] transition-all" onClick={(e) => { (e.target as HTMLTextAreaElement).select(); navigator.clipboard.writeText(getMasterPayload()); showStatus('Payload Copied'); }} />
              
              <p className="text-slate-400 mb-4 text-sm font-bold uppercase tracking-widest">Apply Sync Code (粘贴代码以在所有手机同步资料):</p>
              <div className="flex gap-4">
                <input type="text" value={syncInput} onChange={(e) => setSyncInput(e.target.value)} placeholder="Paste JSON Payload here..." className="flex-1 bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm font-mono focus:border-rose-600 outline-none" />
                <button onClick={() => applySyncCode(syncInput)} className="bg-rose-600 px-8 py-4 rounded-2xl text-xs font-black uppercase hover:bg-rose-500 active:scale-95 transition-all">Sync</button>
              </div>
              <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-500 leading-relaxed font-bold">⚠️ 注意：同步操作会覆盖当前设备上的所有自定义设置。若要让所有代理都能看到，请将 Master Payload 发送给 AI 工程师进行代码更新。</p>
              </div>
           </div>
        </div>
      )}

      {statusMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-12 py-5 rounded-full text-sm font-black uppercase tracking-[0.3em] shadow-2xl z-[200] animate-bounce">
          {statusMsg}
        </div>
      )}
    </div>
  );
};

export default App;
