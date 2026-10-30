import React, { useState, useEffect } from 'react';
import { LABEL_OPTIONS } from '../components/ProductLabel';
import { compressImage } from '../utils/imageCompress';
import { XCLOUD_THEME, inputStyle, labelStyle } from '../styles/theme';

const BASE_URL = '/api';

export default function EditProductModal({ product, onClose, onSave }) {
  const [title, setTitle]                     = useState(product.title || '');
  const [price, setPrice]                     = useState(product.priceInPoints || 0);
  const [description, setDescription]         = useState(product.description || '');
  const [downloadUrl, setDownloadUrl]         = useState(product.downloadUrl || '');
  const [discountCode, setDiscountCode]       = useState(product.discountCode || '');
  const [discountPercent, setDiscountPercent] = useState(product.discountPercent || 0);
  const [version, setVersion]                 = useState(product.version || '');
  const [label, setLabel]                     = useState(product.label || 'none');
  const [saving, setSaving]                   = useState(false);
  const [isDragOver, setIsDragOver]           = useState(false);

  // Existing images from DB (URLs), new images added by admin (base64)
  const [existingImages, setExistingImages] = useState(product.images || []);
  const [newImages, setNewImages]           = useState([]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fileToBase64 = (file) => compressImage(file);

  const handleFilesSelected = async (files) => {
    const entries = await Promise.all(
      Array.from(files).map(async (file) => ({
        file,
        preview: URL.createObjectURL(file),
        base64: await fileToBase64(file),
      }))
    );
    setNewImages(prev => [...prev, ...entries]);
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

  const removeExisting = (index) => setExistingImages(prev => prev.filter((_, i) => i !== index));
  const removeNew = (index) => {
    setNewImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const totalImages = existingImages.length + newImages.length;

  const handleSave = async () => {
    if (!title.trim()) return alert('សូមបញ្ចូលចំណងជើង!');
    if (!price || price <= 0) return alert('សូមបញ្ចូលតម្លៃ!');

    setSaving(true);
    try {
      // Combine: kept existing URLs + new base64 images
      const allImages = [...existingImages, ...newImages.map(n => n.base64)];

      const res = await fetch(`${BASE_URL}/products/${product._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priceInPoints: parseInt(price),
          description,
          downloadUrl,
          discountCode: discountCode.toUpperCase(),
          discountPercent: parseFloat(discountPercent) || 0,
          version: version.trim(),
          label,
          images: allImages,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Update failed');
      }

      const updated = await res.json();
      const savedProduct = updated.product || {
        ...product, title, priceInPoints: parseInt(price),
        description, downloadUrl, discountCode, discountPercent,
        version, label, images: allImages, screenshots: allImages,
      };

      onSave(savedProduct);
      onClose();
    } catch (err) {
      alert('ការកែប្រែបរាជ័យ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const thumbStyle = { width: '80px', height: '66px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #2a2a38', display: 'block' };
  const removeBtn = { position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#100d1c', border: '1px solid #3b1820', color: '#ef4444', fontSize: '10px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1001, background: '#100d1c', border: `1px solid ${XCLOUD_THEME.border}`,
        borderRadius: '16px', padding: '28px 32px', width: '100%', maxWidth: '520px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>✏️ កែប្រែផលិតផល</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>ចំណងជើង (Title) *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Scania Euro7" style={inputStyle} />
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>តម្លៃ (Points) *</label>
            <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 900" style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>ការពិពណ៌នា (Description)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="សរសេរពីលក្ខណៈពិសេស..." style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
          </div>

          {/* Download URL */}
          <div>
            <label style={labelStyle}>តំណទាញយក (Download URL)</label>
            <input type="url" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} placeholder="https://drive.google.com/..." style={inputStyle} />
          </div>

          {/* Version */}
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

          {/* Images */}
          <div>
            <label style={labelStyle}>
              រូបភាព <span style={{ color: '#475569' }}>(Images)</span>{' '}
              <span style={{ color: '#4b5563', fontWeight: 400, fontSize: '12px' }}>{totalImages} រូប</span>
            </label>

            {/* Drag & drop zone */}
            <label
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', padding: '20px 24px', borderRadius: '10px',
                border: `2px dashed ${isDragOver ? '#fbbf24' : '#7c5cff'}`,
                background: isDragOver ? 'rgba(124,92,255,0.12)' : 'rgba(124,92,255,0.04)',
                cursor: 'pointer', marginBottom: '12px', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '28px' }}>☁️</span>
              <span style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px' }}>ចុចដើម្បីបន្ថែម ឬទាញ &amp; លាក់រូបភាព</span>
              <span style={{ color: '#4b5563', fontSize: '11px' }}>PNG · JPG · WEBP</span>
              <input type="file" accept="image/*" multiple onChange={handleFileInputChange} style={{ display: 'none' }} />
            </label>

            {/* Thumbnails: existing (URLs) + new (base64 previews) */}
            {totalImages > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {existingImages.map((url, i) => (
                  <div key={`ex-${i}`} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={thumbStyle} />
                    <button type="button" onClick={() => removeExisting(i)} style={removeBtn}>✕</button>
                    {i === 0 && existingImages.length + newImages.length > 0 && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', fontSize: '9px', color: '#fbbf24', textAlign: 'center', borderRadius: '0 0 8px 8px', padding: '2px 0' }}>គម្រប</div>
                    )}
                  </div>
                ))}
                {newImages.map((img, i) => (
                  <div key={`new-${i}`} style={{ position: 'relative' }}>
                    <img src={img.preview} alt="" style={thumbStyle} />
                    <button type="button" onClick={() => removeNew(i)} style={removeBtn}>✕</button>
                    {existingImages.length === 0 && i === 0 && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', fontSize: '9px', color: '#fbbf24', textAlign: 'center', borderRadius: '0 0 8px 8px', padding: '2px 0' }}>គម្រប</div>
                    )}
                    <div style={{ position: 'absolute', top: '-6px', left: '-6px', width: '16px', height: '16px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '8px', color: '#fff', fontWeight: '900' }}>+</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discount */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>លេខកូដបញ្ចុះតម្លៃ</label>
              <input value={discountCode} onChange={e => setDiscountCode(e.target.value)} placeholder="e.g. SAVE20" style={inputStyle} />
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
                <option value="0">0%</option>
                {[10,20,30,40,50,60,70,80,90,100].map(n => (
                  <option key={n} value={n}>{n}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '8px', color: '#64748b', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
              បោះបង់
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '12px', background: saving ? '#374151' : XCLOUD_THEME.accentPurple, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳ កំពុងរក្សាទុក...' : '💾 រក្សាទុក'}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
