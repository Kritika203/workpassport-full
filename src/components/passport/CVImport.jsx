import { useState } from 'react';
import { readApiSession } from '../../api/client.js';
const base=(import.meta.env.VITE_API_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
export function CVImport({ user, onSave, lang='en' }) {
  const [preview,setPreview]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const ne=lang==='ne';
  async function upload(e){ const file=e.target.files?.[0];if(!file)return;setError('');setPreview(null);
    if(file.size>3*1024*1024){setError('Maximum CV size is 3 MB.');return;}
    const session=readApiSession(); if(!session){setError('Sign in to import a CV.');return;}
    setLoading(true);try{const body=new FormData();body.append('file',file);
      const response=await fetch(base+'/api/auth/passport/import-cv/',{method:'POST',headers:{Authorization:`Bearer ${session.access}`},body});
      const data=await response.json();if(!response.ok)throw new Error(data.detail||JSON.stringify(data));setPreview(data);
    }catch(err){setError(err.message||'CV import failed.');}finally{setLoading(false);}}
  function save(){if(!preview)return;onSave({...user,...preview, skills:[...new Set([...(user.skills||[]),...(preview.skills||[])])],onboarded:true});setPreview(null);}
  return <section className="bg-white border border-[#e5e7dd] rounded-2xl p-5 space-y-3">
    <h3 className="font-semibold text-lg">{ne?'CV बाट प्रोफाइल भर्नुहोस्':'Import your CV'}</h3>
    <p className="text-sm text-gray-600">{ne?'PDF वा DOCX (३ MB सम्म)। सुरक्षित गर्नु अघि जाँच्नुहोस्।':'Upload a text-based PDF or DOCX (up to 3 MB). Review extracted details before saving. Scanned files may not work.'}</p>
    <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={upload} aria-label="CV file"/>
    {loading&&<p role="status">Reading CV…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}
    {preview&&<div className="space-y-3 border-t pt-3"><p className="text-sm">No experience or skills are verified by this import. Review everything.</p>
      <label className="block">Name<input className="border rounded p-2 w-full" value={preview.name||''} onChange={e=>setPreview({...preview,name:e.target.value})}/></label>
      <label className="block">Headline<input className="border rounded p-2 w-full" value={preview.headline||''} onChange={e=>setPreview({...preview,headline:e.target.value})}/></label>
      <label className="block">About<textarea className="border rounded p-2 w-full" rows={3} value={preview.about||''} onChange={e=>setPreview({...preview,about:e.target.value})}/></label>
      <label className="block">Skills (comma-separated)<input className="border rounded p-2 w-full" value={(preview.skills||[]).join(', ')} onChange={e=>setPreview({...preview,skills:e.target.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,30)})}/></label>
      <button onClick={save} className="bg-[#59684a] text-white rounded-full px-5 py-3">{ne?'जाँचेर सुरक्षित गर्नुहोस्':'Save reviewed details'}</button>
    </div>}
  </section>;
}
