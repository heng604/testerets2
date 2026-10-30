import React, { useState, useEffect } from 'react';
import { XCLOUD_THEME, inputStyle, labelStyle } from '../styles/theme';

const API = '/api/settings';
const ADMIN_API = '/api/settings/admin';

export default function Settings() {
  const [siteName,    setSiteName]    = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [discordUrl,  setDiscordUrl]  = useState('');
  const [pointRate,   setPointRate]   = useState('100');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');

  // ── Bakong KHQR auto top-up config ──────────────────────────
  const [bakongAccountId,    setBakongAccountId]    = useState('');
  const [bakongToken,        setBakongToken]        = useState('');
  const [bakongBaseUrl,      setBakongBaseUrl]      = useState('');
  const [bakongMerchantName, setBakongMerchantName] = useState('');
  const [bakongMerchantCity, setBakongMerchantCity] = useState('');
  const [usdExchangeRate,    setUsdExchangeRate]    = useState('4100');
  const [showToken,          setShowToken]          = useState(false);

  useEffect(() => {
    // Use the admin-only endpoint so the current bakongToken is visible for editing.
    fetch(ADMIN_API)
      .then(r => r.json())
      .then(data => {
        setSiteName(data.siteName    || '');
        setTelegramUrl(data.telegramUrl || '');
        setDiscordUrl(data.discordUrl  || '');
        setPointRate(String(data.pointRate ?? 100));
        setBakongAccountId(data.bakongAccountId || '');
        setBakongToken(data.bakongToken || '');
        setBakongBaseUrl(data.bakongBaseUrl || 'https://api-bakong.nbc.gov.kh');
        setBakongMerchantName(data.bakongMerchantName || '');
        setBakongMerchantCity(data.bakongMerchantCity || 'Phnom Penh');
        setUsdExchangeRate(String(data.usdExchangeRate ?? 4100));
      })
      .catch(e => setError('មិនអាចផ្ទុកការកំណត់: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName:    siteName.trim(),
          telegramUrl: telegramUrl.trim(),
          discordUrl:  discordUrl.trim(),
          pointRate:   parseFloat(pointRate) || 100,
          bakongAccountId:    bakongAccountId.trim(),
          bakongToken:        bakongToken.trim(),
          bakongBaseUrl:      bakongBaseUrl.trim(),
          bakongMerchantName: bakongMerchantName.trim(),
          bakongMerchantCity: bakongMerchantCity.trim(),
          usdExchangeRate:    parseFloat(usdExchangeRate) || 4100,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || `Server error ${res.status}`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) {
      setError('រក្សាទុកបានបរាជ័យ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>⏳ កំពុងផ្ទុក...</div>
  );

  return (
    <div style={{ padding: '40px 80px', maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '28px', color: '#fff' }}>
        ⚙️ ការកំណត់ប្រព័ន្ធ
      </h2>

      <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '14px', border: `1px solid ${XCLOUD_THEME.border}`, padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {error && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '12px', color: '#fca5a5', fontSize: '13px' }}>
            ❌ {error}
          </div>
        )}

        <div>
          <label style={labelStyle}>ឈ្មោះគេហទំព័រ (Site Name)</label>
          <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>តំណ Telegram</label>
          <input type="text" value={telegramUrl} onChange={e => setTelegramUrl(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>តំណ Discord</label>
          <input type="text" value={discordUrl} onChange={e => setDiscordUrl(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>អត្រាការបំប្លែង (ៀ្ ក្នុងមួយពិន្ទុ)</label>
          <input
            type="number"
            min="1"
            value={pointRate}
            onChange={e => setPointRate(e.target.value)}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            បច្ចុប្បន្ន: 1 ពិន្ទុ = {pointRate} ៛
          </div>
        </div>

        <div style={{ height: 1, background: XCLOUD_THEME.border, margin: '4px 0' }} />

        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 4 }}>⚡ Bakong KHQR ស្វ័យប្រវត្តិ</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
            ការកំណត់ទាំងនេះត្រូវការសម្រាប់ការបង្កើត QR និងផ្ទៀងផ្ទាត់ការទូទាត់ដោយស្វ័យប្រវត្តិ។
            ទាញយក Token ថ្មីពី <a href="https://api-bakong.nbc.gov.kh/register" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>api-bakong.nbc.gov.kh</a> (ត្រូវ renew រៀងរាល់ ៩០ថ្ងៃ)។
          </div>
        </div>

        <div>
          <label style={labelStyle}>Bakong Account ID</label>
          <input type="text" placeholder="seangheng_theng@bkrt" value={bakongAccountId} onChange={e => setBakongAccountId(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>ឈ្មោះ Merchant (ដូចលើ Bakong app)</label>
          <input type="text" placeholder="THENG SEANGHENG" value={bakongMerchantName} onChange={e => setBakongMerchantName(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>ទីក្រុង (Merchant City)</label>
          <input type="text" placeholder="Phnom Penh" value={bakongMerchantCity} onChange={e => setBakongMerchantCity(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Bakong Open API Token (Bearer)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showToken ? 'text' : 'password'}
              placeholder="eyJhbGciOiJIUzI1NiIsI..."
              value={bakongToken}
              onChange={e => setBakongToken(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="button" onClick={() => setShowToken(s => !s)} style={{ padding: '0 14px', borderRadius: 8, border: `1px solid ${XCLOUD_THEME.border}`, background: XCLOUD_THEME.bgDark, color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
              {showToken ? 'លាក់' : 'មើល'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            {bakongToken ? '✅ Token បានកំណត់រួច' : '⚠️ មិនទាន់មាន Token — QR បង្កើតបានតែពិន្ទុមិនអាចផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិទេ'}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Bakong API Base URL</label>
          <input type="text" placeholder="https://api-bakong.nbc.gov.kh" value={bakongBaseUrl} onChange={e => setBakongBaseUrl(e.target.value)} style={inputStyle} />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            ប្រសិនបើ server នៅក្រៅប្រទេសកម្ពុជា ប្រើសេវា relay (ឧ. bakongrelay.com) ដើម្បីជៀសវាងការទប់ស្កាត់ពី Bakong។
          </div>
        </div>

        <div>
          <label style={labelStyle}>អត្រាប្តូរប្រាក់ USD (៛ ក្នុងមួយ $1)</label>
          <input type="number" min="1" value={usdExchangeRate} onChange={e => setUsdExchangeRate(e.target.value)} style={inputStyle} />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            ប្រើសម្រាប់គណនាតម្លៃ QR ជា USD ពីអត្រា ៛/ពិន្ទុខាងលើ (បច្ចុប្បន្ន 1 USD = {usdExchangeRate} ៛)
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '13px',
            background: saved ? XCLOUD_THEME.accentGreen : saving ? '#374151' : XCLOUD_THEME.accentPurple,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '14px',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {saved ? '✅ បានរក្សាទុករួចរាល់!' : saving ? '⏳ កំពុងរក្សាទុក...' : '💾 រក្សាទុកការកំណត់'}
        </button>
      </div>
    </div>
  );
}
