
import React from 'react';
import { ProductInput, ContractLength, ProductCategory, CatalogItem } from '../types';

interface ProductRowProps {
  product: ProductInput;
  catalog: CatalogItem[];
  onChange: (updated: ProductInput) => void;
  onRemove: () => void;
  isOnlyOne: boolean;
}

const ProductRow: React.FC<ProductRowProps> = ({ product, catalog, onChange, onRemove, isOnlyOne }) => {
  const filteredProducts = catalog.filter(p => p.category === product.category);
  const selectedProductInfo = catalog.find(p => p.name === product.name);

  // Determine allowed contract lengths based on business rules
  const getAllowedPlans = (category: string): ContractLength[] => {
    if (category === ProductCategory.WP || category === ProductCategory.AP || category === ProductCategory.DEHUMIDIFIER) {
      return [ContractLength.MONTHS_60, ContractLength.MONTHS_84];
    }
    if (category === ProductCategory.MICROWAVE) {
      return [ContractLength.MONTHS_36, ContractLength.MONTHS_60];
    }
    return [ContractLength.MONTHS_60];
  };

  const supportedPlans = selectedProductInfo?.supportedPlans || getAllowedPlans(product.category);

  return (
    <div className="flex flex-wrap gap-3 items-end p-5 bg-slate-50 rounded-3xl border border-slate-100 mb-4 transition-all hover:shadow-lg group">
      <div className="flex-1 min-w-[150px]">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Category</label>
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
              contract: allowed[0] // Set to first valid option
            });
          }}
          className="w-full bg-white px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold text-slate-700"
        >
          <option value="">-- Category --</option>
          {Object.values(ProductCategory).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="flex-[1.5] min-w-[180px]">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Product Name</label>
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
          className="w-full bg-white px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          <option value="">-- Select Product --</option>
          {filteredProducts.map((p, i) => (
            <option key={i} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      
      <div className="flex-1 min-w-[140px]">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Model</label>
        <select
          value={product.model}
          onChange={(e) => onChange({ ...product, model: e.target.value })}
          disabled={!product.name}
          className="w-full bg-white px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-medium disabled:opacity-50"
        >
          <option value="">-- Model --</option>
          {selectedProductInfo?.models.map((m, i) => (
            <option key={i} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[140px]">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Contract</label>
        <select
          value={product.contract}
          onChange={(e) => onChange({ ...product, contract: e.target.value as ContractLength })}
          disabled={!product.name}
          className="w-full bg-rose-50/50 border border-rose-100 px-4 py-3 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-black text-rose-700 disabled:opacity-50"
        >
          {supportedPlans.map((plan, i) => (
            <option key={i} value={plan}>{plan}</option>
          ))}
        </select>
      </div>

      <div className="w-16">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Qty</label>
        <input
          type="number"
          min="1"
          value={product.quantity}
          onChange={(e) => onChange({ ...product, quantity: parseInt(e.target.value) || 1 })}
          className="w-full bg-white px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm text-center font-bold"
        />
      </div>

      {!isOnlyOne && (
        <button
          onClick={onRemove}
          className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      )}
    </div>
  );
};

export default ProductRow;
