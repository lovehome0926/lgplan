
import React, { useState, useEffect } from 'react';
import { CustomerType, PlanType, ContractLength, OrderData, ProductInput, FileData, Language, ProductCategory, CatalogItem, DEFAULT_CATALOG, SystemConfig } from './types';
import { analyzeDeal } from './services/geminiService';
import ProductRow from './components/ProductRow';

/**
 * OWNER/ADMIN: PASTE YOUR EXPORTED CONFIG DATA HERE
 */
const SYSTEM_DEFAULTS: SystemConfig | null = null; 

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
  
  const [orderData, setOrderData] = useState<OrderData>({
    customerType: CustomerType.NEW,
    products: [{ category: '', name: '', model: '', quantity: 1, contract: ContractLength.MONTHS_60 }],
    plan: PlanType.SUBSCRIBE,
    promotion: '',
    manualKnowledge: '',
    additionalContext: '',
    wantsFullSettlement: false,
    language: Language.EN
  });

  const [stagedMemos, setStagedMemos] = useState<FileData[]>([]);
  const [activeMemos, setActiveMemos] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      let initialCatalog = SYSTEM_DEFAULTS?.catalog || DEFAULT_CATALOG;
      let initialRules = SYSTEM_DEFAULTS?.masterKnowledge || '';
      let initialMemos: FileData[] = (SYSTEM_DEFAULTS?.memos || []).map(m => ({ ...m, isSystem: true }));

      const savedCatalog = localStorage.getItem('lg_custom_catalog');
      const savedRules = localStorage.getItem('lg_master_rules');
      
      if (savedCatalog) { try { initialCatalog = JSON.parse(savedCatalog); } catch (e) {} }
      if (savedRules) initialRules = savedRules;
      
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
    a.download = `LG_AI_Config_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showStatus('Config Exported!');
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
      setTimeout(() => window.location.reload(), 1000);
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
      const analysis = await analyzeDeal(orderData, masterKnowledge, activeMemos);
      setResult(analysis);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      if (err.message === "API_KEY_MISSING") {
        showStatus(t('API Key not found in Vercel settings', 'Vercel 环境变量中未检测到 API_KEY'));
      } else if (err.message?.includes("429")) {
        showStatus(t('Rate limit exceeded. Try again in 1 min.', '请求太频繁，请 1 分钟后再试'));
      } else if (err.message?.includes("403")) {
        showStatus(t('Invalid API Key', 'API Key 无效或权限不足'));
      } else {
        showStatus(t('Computing Error. Check console (F12) for details.', '计算出错。请按 F12 查看控制台详情。'));
      }
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
  const totalSavedValue = savingsMatch ? savingsMatch[1] : '';
  const displayResult = result.replace(/\[SAVED_AMOUNT\]:\s*(.*)/i, '').trim();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-rose-700 text-white py-4 px-8 sticky top-0 z-50 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-rose-700 font-black text-sm">LG</div>
          <h1 className="text-sm font-black uppercase tracking-widest">{t('Subscribe Sales AI', 'LG 销售智能助理')}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOrderData({...orderData, language: orderData.language === Language.EN ? Language.CN : Language.EN})} className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">{orderData.language}</button>
          <button onClick={() => setShowSettings(true)} className="bg-white text-rose-700 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-md hover:bg-rose-50 transition-all">⚙️ {t('Admin Settings', '系统设定')}</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-10">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                <button onClick={() => setOrderData({...orderData, customerType: CustomerType.NEW})} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${orderData.customerType === CustomerType.NEW ? 'bg-white text-rose-700 shadow-lg' : 'text-slate-400'}`}>{t('New Customer', '新顾客')}</button>
                <button onClick={() => setOrderData({...orderData, customerType: CustomerType.EXISTING})} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${orderData.customerType === CustomerType.EXISTING ? 'bg-white text-rose-700 shadow-lg' : 'text-slate-400'}`}>{t('Existing User', '老顾客')}</button>
              </div>
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('10% Buyout Discount', '10% 买断优惠')}</span>
                 <input type="checkbox" checked={orderData.wantsFullSettlement} onChange={(e) => setOrderData({...orderData, wantsFullSettlement: e.target.checked})} className="w-6 h-6 accent-rose-600 rounded-lg cursor-pointer" />
              </div>
            </div>
            <div className="space-y-4">
              {orderData.products.map((p, idx) => (
                <ProductRow key={idx} product={p} catalog={catalog} onChange={(u) => {const n=[...orderData.products]; n[idx]=u; setOrderData({...orderData, products:n});}} onRemove={() => setOrderData({...orderData, products: orderData.products.filter((_,i)=>i!==idx)})} isOnlyOne={orderData.products.length===1} />
              ))}
              <button onClick={() => setOrderData({...orderData, products: [...orderData.products, {category:'', name:'', model:'', quantity:1, contract: ContractLength.MONTHS_60}]})} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-[10px] font-black uppercase text-slate-400 hover:border-rose-400 hover:text-rose-600 transition-all">+ {t('Add Bundle', '添加产品')}</button>
            </div>

            <div className="mt-8">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{t('Additional Context', '补充需求')}</label>
              <textarea 
                value={orderData.additionalContext} 
                onChange={(e) => setOrderData({...orderData, additionalContext: e.target.value})} 
                className="w-full h-24 bg-slate-50 border border-slate-100 rounded-3xl p-4 text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                placeholder={t('e.g. Combine with 2024 New Year Promo...', '例如：配合2024新年优惠...')}
              />
            </div>
          </section>

          <button onClick={handleAnalyze} disabled={loading} className="w-full py-10 bg-rose-600 text-white rounded-[3.5rem] font-black text-2xl shadow-2xl hover:bg-rose-700 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4">
            {loading ? <div className="animate-spin h-6 w-6 border-4 border-white border-t-transparent rounded-full" /> : t('GENERATE BEST PRICE ✨', '生成最省方案 ✨')}
          </button>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-28 bg-white rounded-[4rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col min-h-[700px]">
             <div className="bg-slate-900 px-10 py-8 flex justify-between items-center">
                <h2 className="text-white text-lg font-black tracking-tighter uppercase">{t('Smart Quote', 'AI 报价详情')}</h2>
                {result && <button onClick={() => {navigator.clipboard.writeText(result); showStatus('Copied!');}} className="bg-white/10 hover:bg-white text-rose-500 text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all">Copy</button>}
             </div>
             <div className="p-10 flex-1 overflow-y-auto bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:32px_32px]">
                {!result && !loading && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">💰</div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">{t('Waiting for data', '等待计算...')}</p>
                   </div>
                )}
                {totalSavedValue && (
                  <div className="mb-10 relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-rose-600 to-pink-600 rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <div className="relative bg-rose-600 rounded-[2.5rem] p-8 text-white shadow-2xl">
                      <p className="text-[11px] font-black uppercase opacity-70 mb-2">{t('Total Savings Found', '总共节省')}</p>
                      <p className="text-5xl font-black tracking-tighter leading-none">{totalSavedValue}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-8 pb-10 whitespace-pre-wrap">
                   {displayResult.split('\n').map((line, i) => {
                      if (line.includes('[DASHBOARD]') || line.includes('[CALCULATION BREAKDOWN]') || line.includes('[WHY]') || line.includes('[PITCH]')) {
                         const tag = line.replace(/[\[\]]/g, '');
                         return (
                           <div key={i} className="flex items-center gap-3 mt-10 first:mt-0">
                             <div className="h-0.5 flex-1 bg-slate-100"></div>
                             <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">{tag}</h4>
                             <div className="h-0.5 flex-1 bg-slate-100"></div>
                           </div>
                         );
                      }
                      return <p key={i} className="text-[13px] text-slate-700 leading-relaxed font-medium">{line}</p>;
                   })}
                </div>
             </div>
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
             <div className="p-10 border-b flex flex-wrap gap-4 justify-between items-center bg-slate-50">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSettingsTab('catalog')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab==='catalog'?'bg-rose-600 text-white shadow-xl shadow-rose-200':'text-slate-400 hover:text-slate-600'}`}>{t('Catalog', '型号库')}</button>
                  <button onClick={() => setSettingsTab('rules')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab==='rules'?'bg-rose-600 text-white shadow-xl shadow-rose-200':'text-slate-400 hover:text-slate-600'}`}>{t('Logic Rules', '通用规则')}</button>
                  <button onClick={() => setSettingsTab('memos')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab==='memos'?'bg-rose-600 text-white shadow-xl shadow-rose-200':'text-slate-400 hover:text-slate-600'}`}>{t('Memos (PDF)', '促销文档')}</button>
                  <button onClick={() => setSettingsTab('sync')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab==='sync'?'bg-rose-600 text-white shadow-xl shadow-rose-200':'text-slate-400 hover:text-slate-600'}`}>{t('Sync', '数据同步')}</button>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all transform hover:rotate-90">✕</button>
             </div>
             <div className="flex-1 overflow-y-auto p-12">
                {settingsTab === 'catalog' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catalog.map((item, idx) => (
                      <div key={item.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 group">
                         <div className="flex justify-between items-start mb-2">
                           <span className="text-[8px] font-black uppercase text-rose-600">{item.category}</span>
                           <button onClick={() => saveCatalog(catalog.filter(c=>c.id!==item.id))} className="text-slate-300 hover:text-rose-600 transition-all text-xs">✕</button>
                         </div>
                         <p className="text-xs font-black text-slate-800">{item.name}</p>
                         <p className="text-[9px] text-slate-500 mt-1 leading-tight">{item.models.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                )}
                {settingsTab === 'rules' && (
                  <div className="h-full flex flex-col">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Master logic for the AI (Prices, Rebate Rules, etc.)</p>
                    <textarea value={masterKnowledge} onChange={(e) => saveMasterRules(e.target.value)} className="w-full flex-1 p-8 bg-slate-50 rounded-[2.5rem] text-sm font-medium border-2 border-slate-100 outline-none shadow-inner resize-none" placeholder="Paste master logic here..." />
                  </div>
                )}
                {settingsTab === 'memos' && (
                  <div className="space-y-6">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                       <div className="relative z-10">
                          <div className="flex justify-between items-center mb-6">
                            <div>
                              <h3 className="text-lg font-black uppercase tracking-tighter">{t('Knowledge Base', '促销情报中心')}</h3>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{activeMemos.length} {t('Active Memos', '份生效文档')}</p>
                            </div>
                            <label className="bg-rose-600 px-5 py-2 rounded-full text-[10px] font-black uppercase cursor-pointer hover:bg-rose-500 transition-all">
                              + {t('Upload PDF', '上传')}
                              <input type="file" multiple accept=".pdf" className="hidden" onChange={handleFileSelect} />
                            </label>
                          </div>
                          {stagedMemos.length > 0 && (
                            <button onClick={async () => { await updateMemosStateAndStorage([...activeMemos, ...stagedMemos]); setStagedMemos([]); showStatus('Database Updated'); }} className="w-full mb-4 py-4 bg-white text-rose-700 rounded-2xl text-[10px] font-black uppercase animate-pulse shadow-xl">
                              {t('Confirm & Save to DB', '确认并保存到数据库')} (+{stagedMemos.length})
                            </button>
                          )}
                          <div className="flex flex-wrap gap-2">
                              {activeMemos.map((m, i) => (
                                <div key={i} className={`group px-3 py-1.5 rounded-xl flex items-center gap-2 border transition-all ${m.isSystem ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/5 border-white/10'}`}>
                                  <span className={`w-2 h-2 rounded-full ${m.isSystem ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                  <span className="text-[10px] font-bold truncate max-w-[150px]">{m.name}</span>
                                  <button onClick={() => removeMemo(i)} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-all ml-2">✕</button>
                                </div>
                              ))}
                          </div>
                       </div>
                    </div>
                  </div>
                )}
                {settingsTab === 'sync' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="p-10 bg-slate-900 rounded-[4rem] text-white flex flex-col justify-between shadow-2xl">
                      <div>
                        <h4 className="text-xl font-black uppercase mb-2">Export Config</h4>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Download all models, rules and PDFs as one file.</p>
                      </div>
                      <button onClick={handleExport} className="mt-8 py-4 bg-rose-600 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-500 transition-all">Download .JSON</button>
                    </div>
                    <div className="p-10 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xl font-black uppercase mb-2">Import Config</h4>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Overwrite everything with a previously exported file.</p>
                      </div>
                      <label className="mt-8 py-4 bg-white border border-slate-200 text-center rounded-2xl font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-all">
                        Upload File
                        <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                      </label>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {statusMsg && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl z-[200] animate-bounce">{statusMsg}</div>}
    </div>
  );
};

export default App;
