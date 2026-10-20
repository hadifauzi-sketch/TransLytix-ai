import React, { useState, useEffect } from 'react';
import OilTestSection from './OilTestSection';
import DocumentSection from './DocumentSection';
import { documentService } from '../lib/documentService';

function TransformerDetailModal({ 
  transformer, 
  onClose, 
  onUpdateOilTests,
  onUpdateDocuments 
}) {
  const [activeTab, setActiveTab] = useState('info');
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // Load documents when modal opens or when switching to documents tab
  useEffect(() => {
    const loadDocuments = async () => {
      if (activeTab === 'documents' && transformer.id) {
        setIsLoadingDocuments(true);
        try {
          const docs = await documentService.getByTransformerId(transformer.id);
          onUpdateDocuments(transformer.id, docs);
        } catch (error) {
          console.error('Error loading documents:', error);
        } finally {
          setIsLoadingDocuments(false);
        }
      }
    };

    loadDocuments();
  }, [activeTab, transformer.id]);

  const renderTabIcon = (iconName) => {
    switch (iconName) {
      case 'info':
        return (
          <svg className="tab-icon-svg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        );
      case 'beaker':
        return (
          <svg className="tab-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2h6V3M7 7h10v10a2 2 0 01-2 2h-6a2 2 0 01-2-2V7z" />
          </svg>
        );
      case 'document':
        return (
          <svg className="tab-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'info', label: 'Information', icon: 'info' },
    { id: 'oilTests', label: 'Oil Tests', icon: 'beaker' },
    { id: 'documents', label: 'Documents', icon: 'document' },
  ];

  return (
    <div className="modal-overlay detail-modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header detail-header">
          <div className="header-content">
            <h2>
              <svg className="inline-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              {transformer.txName || 'Transformer Details'}
            </h2>
            <div className="header-meta">
              <span className="voltage-tag">{transformer.voltage}</span>
              <span className="site-tag">{transformer.siteName}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="tab-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {renderTabIcon(tab.icon)}
              <span className="tab-label">{tab.label}</span>
              {tab.id === 'oilTests' && transformer.oilTests?.length > 0 && (
                <span className="tab-badge">{transformer.oilTests.length}</span>
              )}
              {tab.id === 'documents' && transformer.documents?.length > 0 && (
                <span className="tab-badge">{transformer.documents.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="modal-body detail-body">
          {activeTab === 'info' && (
            <div className="info-tab">
              <div className="info-section">
                <h3>Basic Information</h3>
                <div className="info-grid">
                  <div className="info-field">
                    <label>Site Name</label>
                    <div className="field-value">{transformer.siteName || '-'}</div>
                  </div>
                  <div className="info-field">
                    <label>Transformer Name</label>
                    <div className="field-value">{transformer.txName || '-'}</div>
                  </div>
                  <div className="info-field">
                    <label>Mnemonic</label>
                    <div className="field-value">{transformer.mnemonic || '-'}</div>
                  </div>
                  <div className="info-field">
                    <label>Serial Number</label>
                    <div className="field-value">{transformer.serialNumber || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Technical Specifications</h3>
                <div className="info-grid">
                  <div className="info-field">
                    <label>Voltage</label>
                    <div className="field-value highlight">{transformer.voltage || '-'}</div>
                  </div>
                  <div className="info-field">
                    <label>Load (MVA)</label>
                    <div className="field-value highlight">{transformer.loadMVA || '-'}</div>
                  </div>
                  <div className="info-field">
                    <label>Manufacturer</label>
                    <div className="field-value">{transformer.maker || '-'}</div>
                  </div>
                  <div className="info-field">
                    <label>Year Built</label>
                    <div className="field-value">{transformer.yearBuilt || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Location</h3>
                <div className="location-display">
                  <div className="location-coords">
                    <div className="coord-item">
                      <span className="coord-label">Latitude:</span>
                      <span className="coord-value">{transformer.position[0].toFixed(6)}</span>
                    </div>
                    <div className="coord-item">
                      <span className="coord-label">Longitude:</span>
                      <span className="coord-value">{transformer.position[1].toFixed(6)}</span>
                    </div>
                  </div>
                  <a 
                    href={`https://www.google.com/maps?q=${transformer.position[0]},${transformer.position[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-on-maps"
                  >
                    View on Google Maps →
                  </a>
                </div>
              </div>

              <div className="info-section">
                <h3>Summary</h3>
                <div className="summary-stats">
                  <div className="stat-card">
                    <svg className="stat-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2h6V3M7 7h10v10a2 2 0 01-2 2h-6a2 2 0 01-2-2V7z" />
                    </svg>
                    <div className="stat-content">
                      <div className="stat-number">{transformer.oilTests?.length || 0}</div>
                      <div className="stat-label">Oil Test Records</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <svg className="stat-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="stat-content">
                      <div className="stat-number">{transformer.documents?.length || 0}</div>
                      <div className="stat-label">Documents</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'oilTests' && (
            <OilTestSection
              transformerId={transformer.id}
              oilTests={transformer.oilTests || []}
              onUpdate={onUpdateOilTests}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentSection
              transformerId={transformer.id}
              documents={transformer.documents || []}
              onUpdate={onUpdateDocuments}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default TransformerDetailModal;
