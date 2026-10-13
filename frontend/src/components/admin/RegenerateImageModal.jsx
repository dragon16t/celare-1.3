import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Upload, Sparkles, Loader2, Check, RotateCcw } from 'lucide-react';
import { resolveImageUrl } from '../../utils/productImage';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MAX_REFS = 4;

const RefPicker = ({ files, setFiles }) => {
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-1">Reference images <span className="font-normal text-gray-500">(optional, up to {MAX_REFS})</span></p>
      <div className="flex flex-wrap gap-2">
        {previews.map((u, i) => (
          <div key={u} className="relative w-16 h-16 rounded-lg overflow-hidden ring-1 ring-gray-200">
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5" data-testid={`regen-ref-remove-${i}`}><X size={12} /></button>
          </div>
        ))}
        {files.length < MAX_REFS && (
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-emerald-500 flex items-center justify-center cursor-pointer text-gray-500 hover:text-emerald-600 transition-colors" data-testid="regen-ref-add">
            <Upload size={18} />
            <input type="file" accept="image/*" multiple className="hidden" data-testid="regen-ref-input"
              onChange={(e) => { setFiles([...files, ...Array.from(e.target.files || [])].slice(0, MAX_REFS)); e.target.value = ''; }} />
          </label>
        )}
      </div>
    </div>
  );
};

export const RegenerateImageModal = ({ product, headers, onClose, onApplied }) => {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState('');
  const current = product?.images?.[0];

  const generate = async () => {
    setStatus('running'); setError(''); setCandidate('');
    try {
      const fd = new FormData();
      fd.append('prompt', prompt);
      files.forEach((f) => fd.append('references', f));
      const { data } = await axios.post(`${API}/admin/products/${product.slug}/regenerate-image`, fd, { headers });
      const deadline = Date.now() + 4 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data: j } = await axios.get(`${API}/admin/products/regenerate-image-job/${data.job_id}`, { headers });
        if (j.status === 'done') { setCandidate(j.result?.image_url || ''); setStatus('ready'); return; }
        if (j.status === 'failed') throw new Error(j.error || 'Generation failed');
      }
      throw new Error('Still generating — please try again in a minute.');
    } catch (e) {
      setError(e.response?.data?.detail || e.message); setStatus('idle');
    }
  };

  const apply = async () => {
    setStatus('applying');
    try {
      await axios.post(`${API}/admin/products/${product.slug}/set-main-image`, { image_url: candidate }, { headers });
      onApplied?.(); onClose();
    } catch (e) {
      setError(e.response?.data?.detail || e.message); setStatus('ready');
    }
  };

  const busy = status === 'running' || status === 'applying';
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="regen-image-modal">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <p className="font-bold text-gray-900">Regenerate image</p>
            <p className="text-xs text-gray-600 truncate">{product?.name}</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-2 rounded-lg hover:bg-gray-100" data-testid="regen-close-btn"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <figure>
              <figcaption className="text-xs font-semibold text-gray-600 mb-1">Current</figcaption>
              <div className="aspect-square rounded-xl bg-gray-50 ring-1 ring-gray-200 overflow-hidden">
                {current && <img src={resolveImageUrl(current)} alt="" className="w-full h-full object-contain" data-testid="regen-current-img" />}
              </div>
            </figure>
            <figure>
              <figcaption className="text-xs font-semibold text-gray-600 mb-1">New</figcaption>
              <div className="aspect-square rounded-xl bg-emerald-50/40 ring-1 ring-emerald-200 overflow-hidden flex items-center justify-center">
                {candidate ? <img src={candidate} alt="" className="w-full h-full object-contain" data-testid="regen-new-img" />
                  : status === 'running' ? <span className="flex flex-col items-center text-emerald-700 text-xs gap-2"><Loader2 className="animate-spin" size={22} />Gemini is generating…</span>
                  : <span className="text-xs text-gray-500 px-4 text-center">Your new image will appear here</span>}
              </div>
            </figure>
          </div>
          <div>
            <label htmlFor="regen-prompt" className="text-sm font-semibold text-gray-800">What should change?</label>
            <textarea id="regen-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={2000}
              placeholder="e.g. Use a frosted glass bottle with a gold cap, add orange slices behind it, keep the white background"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" data-testid="regen-prompt-input" />
          </div>
          <RefPicker files={files} setFiles={setFiles} />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" data-testid="regen-error">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t bg-gray-50">
          <button onClick={generate} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold transition-colors" data-testid="regen-generate-btn">
            {candidate ? <RotateCcw size={16} /> : <Sparkles size={16} />} {status === 'running' ? 'Generating…' : candidate ? 'Try again' : 'Generate'}
          </button>
          {candidate && (
            <button onClick={apply} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-sm font-bold transition-colors" data-testid="regen-apply-btn">
              <Check size={16} /> {status === 'applying' ? 'Saving…' : 'Use this image'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
