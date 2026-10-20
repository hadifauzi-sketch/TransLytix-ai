import React, { useState, useEffect } from 'react';

function TransformerModal({ transformer, onSave, onClose }) {
  const [formData, setFormData] = useState({
    siteName: '',
    txName: '',
    mnemonic: '',
    serialNumber: '',
    voltage: '',
    loadMVA: '',
    maker: '',
    yearBuilt: '',
    position: [3.1390, 101.6869],
    oilTests: [],
    documents: [],
  });

  useEffect(() => {
    if (transformer) {
      setFormData(transformer);
    }
  }, [transformer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.siteName.trim()) {
      alert('Please enter a Site Name');
      return;
    }
    if (!formData.txName.trim()) {
      alert('Please enter a Transformer Name');
      return;
    }
    if (!formData.voltage.trim()) {
      alert('Please enter a Voltage');
      return;
    }
    
    const transformerData = {
      ...formData,
      id: transformer?.id || Date.now().toString(),
    };

    onSave(transformerData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{transformer?.id ? 'Edit Transformer' : 'Add New Transformer'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="transformer-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="siteName">Site Name *</label>
              <input
                type="text"
                id="siteName"
                name="siteName"
                value={formData.siteName}
                onChange={handleChange}
                placeholder="e.g., Substation Alpha"
              />
            </div>

            <div className="form-group">
              <label htmlFor="txName">Transformer Name *</label>
              <input
                type="text"
                id="txName"
                name="txName"
                value={formData.txName}
                onChange={handleChange}
                placeholder="e.g., TX-001"
              />
            </div>

            <div className="form-group">
              <label htmlFor="mnemonic">Mnemonic</label>
              <input
                type="text"
                id="mnemonic"
                name="mnemonic"
                value={formData.mnemonic}
                onChange={handleChange}
                placeholder="e.g., TXALP01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="serialNumber">Serial Number</label>
              <input
                type="text"
                id="serialNumber"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder="e.g., SN-2024-001"
              />
            </div>

            <div className="form-group">
              <label htmlFor="voltage">Voltage *</label>
              <input
                type="text"
                id="voltage"
                name="voltage"
                value={formData.voltage}
                onChange={handleChange}
                placeholder="e.g., 132/33 kV"
              />
            </div>

            <div className="form-group">
              <label htmlFor="loadMVA">Load (MVA)</label>
              <input
                type="text"
                id="loadMVA"
                name="loadMVA"
                value={formData.loadMVA}
                onChange={handleChange}
                placeholder="e.g., 60"
              />
            </div>

            <div className="form-group">
              <label htmlFor="maker">Manufacturer</label>
              <input
                type="text"
                id="maker"
                name="maker"
                value={formData.maker}
                onChange={handleChange}
                placeholder="e.g., ABB, Siemens"
              />
            </div>

            <div className="form-group">
              <label htmlFor="yearBuilt">Year Built</label>
              <input
                type="text"
                id="yearBuilt"
                name="yearBuilt"
                value={formData.yearBuilt}
                onChange={handleChange}
                placeholder="e.g., 2020"
              />
            </div>
          </div>

          <div className="location-info">
            <div className="info-box">
              <strong>Location:</strong>
              <span>Lat: {formData.position[0].toFixed(6)}, Lng: {formData.position[1].toFixed(6)}</span>
            </div>
            <p className="info-hint">💡 You can drag the marker on the map to adjust the location</p>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save">
              {transformer?.id ? 'Update Transformer' : 'Add Transformer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TransformerModal;
