import React, { useState } from 'react';

const ReceiptScanner = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
      setScannedData(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select or drop a receipt image first.');
      return;
    }

    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://127.0.0.1:8000/api/expenses/scan-receipt/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, // Synchronized perfectly with App.js config
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setScannedData(result.data);
      } else {
        setError(result.message || 'Failed to extract data from receipt.');
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError('Connection to backend failed. Make sure your server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', color: '#fff' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#00f2fe' }}>
        Smart Receipt OCR Scanner
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Upload Box */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ border: '2px dashed #00f2fe', padding: '20px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'rgba(0,242,254,0.05)' }}>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              id="receipt-upload" 
              style={{ display: 'none' }}
            />
            <label htmlFor="receipt-upload" style={{ cursor: 'pointer', color: '#00f2fe', fontWeight: '600' }}>
              {previewUrl ? 'Change Receipt Photo' : 'Click to upload receipt image'}
            </label>
          </div>

          {previewUrl && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '8px' }}>Image Preview:</p>
              <img 
                src={previewUrl} 
                alt="Receipt Preview" 
                style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} 
              />
              <button
                onClick={handleUpload}
                disabled={loading}
                style={{ width: '100%', marginTop: '12px', padding: '10px', backgroundColor: loading ? '#2c3e50' : '#00f2fe', color: loading ? '#fff' : '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'AI Scanning Receipt...' : 'Process with Gemini'}
              </button>
            </div>
          )}

          {error && <p style={{ marginTop: '10px', color: '#ff4b4b', fontSize: '13px' }}>{error}</p>}
        </div>

        {/* Results Panel */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px', color: '#fff' }}>Extracted Details</h3>
          
          {scannedData ? (
            <div>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                {scannedData.items?.map((item, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{item.name}</span>
                    <span style={{ fontWeight: '600', color: '#00f2fe' }}>₹{item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div style={{ paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '13px', opacity: 0.7 }}>
                  <span>Tax Amount:</span>
                  <span>₹{scannedData.tax?.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '16px', fontWeight: 'bold', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: '4px' }}>
                  <span>Grand Total:</span>
                  <span>₹{scannedData.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', opacity: 0.4, fontSize: '13px', padding: '20px', textAlign: 'center' }}>
              Upload and process a bill snapshot to populate structured financial elements.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReceiptScanner;




