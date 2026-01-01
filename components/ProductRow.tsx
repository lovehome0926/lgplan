
import React from 'react';
import { ProductInput, ContractLength, ProductCategory, CatalogItem, Language } from '../types';

interface ProductRowProps {
  product: ProductInput;
  catalog: CatalogItem[];
  language: Language;
  onChange: (updated: ProductInput) => void;
  onRemove: () => void;
  isOnlyOne: boolean;
}

const ProductRow: React.FC<ProductRowProps> = ({ product, catalog, language, onChange, onRemove, isOnlyOne }) => {
  const filteredProducts = catalog.filter(p => p.category === product.category);
  const selectedProductInfo = catalog.find(p => p.name === product.name);

  const getAllowedPlans = (category: string): ContractLength[] => {
    if (category === ProductCategory.WP || category === ProductCategory.AP || category === ProductCategory.DEHUMIDIFIER) {
      return [ContractLength.MONTHS_60, ContractLength.MONTHS_84];
    }
    if (category === ProductCategory.MICROWAVE) {
      return [ContractLength.MONTHS_36, ContractLength.MONTHS_60];
    }
    return [ContractLength.MONTHS_60];
  };

  const getContractLabel = (val: ContractLength) => {
    const isCN = language === Language.CN;
    switch (val) {
      case ContractLength.MONTHS_36:
        return isCN ? '3年 (36期)' : '3 Years (36mo)';
      case ContractLength.MONTHS_60:
        return isCN ? '5年 (60期)' : '5 Years (60mo)';
      case ContractLength.MONTHS_84:
        return isCN ? '7年 (84期)' : '7 Years (84mo)';
      default:
        return val;
    }
  };

  const supportedPlans = selectedProductInfo?.supportedPlans || getAllowedPlans(product.category);

  return (
    <div className="relative p-6 bg-white rounded-3xl border-2 border-slate-100 mb-6 shadow-sm flex flex-col gap-5 transition-all active:scale-[0.99]">
      {!isOnlyOne && (
        <button
          onClick={onRemove}
          className="absolute -top-3 -right-3 w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-md border-2 border-white z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category / 产品类别</label>
          <select
            value={product.category}
            onChange={(e) => {
              const newCat = e.target.value;
              const firstInCategory = catalog.find(p => p.category === newCat);
              const allowed = getAllowedPlans(newCat);
              onChange({ 
                ...product, 
                category: newCat,
                name: firstInCategory?.name || '',
                model: firstInCategory?.models[0] || '',
                contract: allowed[0]
              });
            }}
            className="w-full bg-slate-50 px-4 py-4 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-rose-500/20 outline-none text-base font-bold text-slate-700 appearance-none"
          >
            <option value="">-- Select --</option>
            {Object.values(ProductCategory).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Product Name / 产品名称</label>
          <select
            value={product.name}
            onChange={(e) => {
              const found = catalog.find(p => p.name === e.target.value);
              const allowed = getAllowedPlans(product.category);
              onChange({ 
                ...product, 
                name: e.target.value,
                model: found?.models[0] || '',
                contract: found?.supportedPlans[0] || allowed[0]
              });
            }}
            disabled={!product.category}
            className="w-full bg-slate-50 px-4 py-4 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-rose-500/20 outline-none text-base font-bold text-slate-700 disabled:opacity-50 appearance-none"
          >
            <option value="">-- Select --</option>
            {filteredProducts.map((p, i) => (
              <option key={i} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-1">
           <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Model / 型号</label>
           <select
             value={product.model}
             onChange={(e) => onChange({ ...product, model: e.target.value })}
             disabled={!product.name}
             className="w-full bg-slate-50 px-4 py-4 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-rose-500/20 outline-none text-base font-medium disabled:opacity-50 appearance-none"
           >
             <option value="">-- Model --</option>
             {selectedProductInfo?.models.map((m, i) => (
               <option key={i} value={m}>{m}</option>
             ))}
           </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contract / 合约期</label>
          <select
            value={product.contract}
            onChange={(e) => onChange({ ...product, contract: e.target.value as ContractLength })}
            disabled={!product.name}
            className="w-full bg-rose-50 border-2 border-rose-100 px-4 py-4 rounded-2xl focus:ring-4 focus:ring-rose-500/20 outline-none text-base font-black text-rose-700 disabled:opacity-50 appearance-none"
          >
            {supportedPlans.map((plan, i) => (
              <option key={i} value={plan}>{getContractLabel(plan)}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quantity / 数量</label>
          <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-2xl overflow-hidden">
            <button 
              onClick={() => onChange({ ...product, quantity: Math.max(1, product.quantity - 1) })}
              className="px-5 py-4 text-slate-500 font-bold hover:bg-slate-100 active:bg-slate-200"
            >-</button>
            <input
              type="number"
              min="1"
              value={product.quantity}
              onChange={(e) => onChange({ ...product, quantity: parseInt(e.target.value) || 1 })}
              className="w-full bg-transparent text-center font-black text-lg text-slate-800 outline-none"
            />
            <button 
              onClick={() => onChange({ ...product, quantity: product.quantity + 1 })}
              className="px-5 py-4 text-slate-500 font-bold hover:bg-slate-100 active:bg-slate-200"
            >+</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductRow;
