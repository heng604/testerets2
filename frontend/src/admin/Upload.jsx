import React, { useState } from 'react';
import { LABEL_OPTIONS } from '../components/ProductLabel';
import { compressImage } from '../utils/imageCompress';
import { XCLOUD_THEME, inputStyle, labelStyle } from '../styles/theme';
import { uploadMod } from '../services/api';

export default function Upload({ products, setProducts }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [description, setDescription] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [version, setVersion] = useState('');
  const [label, setLabel] = useState('none');
  const [images, setImages] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileToBase64 = (file) => compressImage(file);

  const handleFilesSelected = async (files) => {
    const newEntries = await Promise.all(
      Array.from(files).map(async (file) => ({
        file,
        preview: URL.createObjectURL(file),
        base64: await fileToBase64(file),
      }))
    );
    setImages(prev => [...prev, ...newEntries]);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files.length) handleFilesSelected(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) handleFilesSelected(e.dataTransfer.files);
  };

  const handleRemoveImage = (index) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const resetForm = () => {
    setTitle('');
    setPrice('');
    setDiscountCode('');
    setDiscountPercent('');
    setDescription('');
    setDownloadUrl('');
    setVersion('');
    setLabel('none');
    setImages([]);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    const imageBase64List = images.map(img => img.base64);
    const payload = {
      title,
      description,
      priceInPoints: parseInt(price) || 0,
      downloadUrl,
      images: imageBase64List.length > 0 ? imageBase64List : ['https://i.imgur.com/B9P6w0t.jpeg'],
      screenshots: [],
      ownerName: 'Masatoshi',
      discountCode: discountCode.toUpperCase(),
      discountPercent: parseFloat(discountPercent) || 0,
      version: version.trim(),
      label,
    };

    try {
      const res = await uploadMod(payload);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      const saved = data.product || data;
      setProducts(prev => [saved, ...prev]);
      setSuccessMsg(`✅ បានអាប់ឡូដ "${saved.title}" ដោយជោគជ័យ!`);
      resetForm();
    } catch (err) {
      console.error('Upload error:', err);
      setErrorMsg(`❌ ការអាប់ឡូដបរាជ័យ: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 20px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '20px', color: '#fff' }}>
        អាប់ឡូដធនធាន Mod <span style={{ color: '#475569', fontWeight: 400, fontSize: '16px' }}>(Upload Mod)</span>
      </h2>

      {successMsg && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleUploadSubmit} style={{ background: XCLOUD_THEME.bgCard, padding: '28px', borderRadius: '14px', border: `1px solid ${XCLOUD_THEME.border}`, display: 'flex', flexDirection: 'column', gap: '18px' }}>

        <div>
          <label style={labelStyle}>ចំណងជើង Mod <span style={{ color: '#475569' }}>(Mod Title)</span></label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Scania Euro 7 Premium" style={inputStyle} required />
        </div>

        <div>
          <label style={labelStyle}>តម្លៃគិតជាពិន្ទុ <span style={{ color: '#475569' }}>(Price in Points)</span></label>
          <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 900" style={inputStyle} required />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>លេខកូដបញ្ចុះតម្លៃ <span style={{ color: '#475569' }}>(Discount Code)</span></label>
            <input type="text" value={discountCode} onChange={e => setDiscountCode(e.target.value)} placeholder="e.g. SAVE20" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Label (shown on the product card)</label>
            <select value={label} onChange={e => setLabel(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {LABEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>% បញ្ចុះតម្លៃ</label>
            <select value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">-- គ្មាន --</option>
              {[10,20,30,40,50,60,70,80,90,100].map(n => <option key={n} value={n}>{n}%</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>រូបភាព <span style={{ color: '#475569' }}>(Upload Images)</span></label>
          <label
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '28px 24px', borderRadius: '10px', border: `2px dashed ${isDragOver ? '#fbbf24' : '#d97706'}`, background: isDragOver ? 'rgba(217,119,6,0.12)' : 'rgba(217,119,6,0.04)', cursor: 'pointer', marginBottom: '12px', transition: 'all 0.15s' }}
          >
            <span style={{ fontSize: '32px' }}>☁️</span>
            <span style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px' }}>ចុចដើម្បីជ្រើសរើស ឬទាញ &amp; លាក់រូបភាព</span>
            <span style={{ color: '#4b5563', fontSize: '11px' }}>PNG · JPG · WEBP</span>
            <input type="file" accept="image/*" multiple onChange={handleFileInputChange} style={{ display: 'none' }} />
          </label>
          {images.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {images.map((img, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <img src={img.preview} alt={`preview-${index}`} style={{ width: '80px', height: '66px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #2a2a38', display: 'block' }} />
                  <button type="button" onClick={() => handleRemoveImage(index)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#14110f', border: '1px solid #3b1820', color: '#ef4444', fontSize: '10px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                  {index === 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', fontSize: '9px', color: '#fbbf24', textAlign: 'center', borderRadius: '0 0 8px 8px', padding: '2px 0' }}>គម្រប</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>តំណភ្ជាប់សម្រាប់ទាញយក <span style={{ color: '#475569' }}>(Download Link)</span></label>
          <input type="url" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} placeholder="https://drive.google.com/..." style={inputStyle} required />
        </div>

        <div>
          <label style={labelStyle}>
            កំណែ <span style={{ color: '#475569' }}>(Version)</span>{' '}
            <span style={{ color: '#4b5563', fontWeight: 400, fontSize: '12px' }}>— ស្រេចចិត្ត (optional)</span>
          </label>
          <input
            type="text"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="e.g. v1.0.0, 2.3, 1.5.2"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>ការពិពណ៌នា <span style={{ color: '#475569' }}>(Description)</span></label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="សរសេរពីលក្ខណៈពិសេស និងខ្លឹមសារ Mod..." style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} required />
        </div>

        {(title || price) && (
          <div style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '10px', padding: '14px 16px', fontSize: '13px', color: '#94a3b8' }}>
            <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>👁 មើលមុន</div>
            <div><span style={{ color: '#fff', fontWeight: 600 }}>{title || '—'}</span></div>
            <div style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {price && <span style={{ color: '#10b981' }}>💰 {parseInt(price).toLocaleString()} ពិន្ទុ{discountPercent ? ` (បញ្ចុះ ${discountPercent}%)` : ''}</span>}
              {discountCode && <span style={{ color: '#f59e0b' }}>🏷️ {discountCode.toUpperCase()}</span>}
              {version && <span style={{ color: '#fbbf24' }}>🔖 v{version.replace(/^v/i, '')}</span>}
              <span style={{ color: '#475569' }}>🖼️ {images.length} រូបភាព</span>
            </div>
          </div>
        )}

        <button type="submit" disabled={submitting} style={{ width: '100%', padding: '15px', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '15px', background: submitting ? '#1f2937' : XCLOUD_THEME.accentGreen, cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
          {submitting ? '⏳ កំពុងបោះពុម្ព...' : '🚀 បោះពុម្ពផ្សាយ Mod (Publish Mod)'}
        </button>
      </form>
    </div>
  );
}
