import React, { useState } from 'react';

function TransformerSidebar({ 
  transformers, 
  onAddClick, 
  onTransformerClick, 
  onEditClick,
  onDeleteClick,
  onViewDetails,
  isAddMode 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredTransformers = transformers.filter(t => {
    const search = searchTerm.toLowerCase();
    return (
      t.txName?.toLowerCase().includes(search) ||
      t.siteName?.toLowerCase().includes(search) ||
      t.mnemonic?.toLowerCase().includes(search) ||
      t.serialNumber?.toLowerCase().includes(search)
    );
  });

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="collapse-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      {!isCollapsed && (
        <>
          <div className="sidebar-header">
            <h1>
              <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '24px', height: '24px', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Transformer Assets Management
            </h1>
            <div className="header-stats">
              <span className="stat-badge">{transformers.length} Total</span>
            </div>
          </div>

          <div className="sidebar-controls">
            <button 
              className={`btn-add ${isAddMode ? 'active' : ''}`}
              onClick={onAddClick}
            >
              {isAddMode ? '✓ Click Map to Place' : '+ Add Transformer'}
            </button>

            <div className="search-box">
              <input
                type="text"
                placeholder="Search transformers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button 
                  className="clear-search"
                  onClick={() => setSearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="transformer-list">
            {filteredTransformers.length === 0 ? (
              <div className="empty-state">
                {searchTerm ? (
                  <p>No transformers found matching "{searchTerm}"</p>
                ) : (
                  <p>No transformers added yet. Click "Add Transformer" to begin.</p>
                )}
              </div>
            ) : (
              filteredTransformers.map(transformer => (
                <div 
                  key={transformer.id} 
                  className="transformer-card"
                >
                  <div 
                    className="card-main"
                    onClick={() => onTransformerClick(transformer)}
                  >
                    <div className="card-header">
                      <h3>{transformer.txName || 'Unnamed Transformer'}</h3>
                      <span className="voltage-badge">{transformer.voltage || 'N/A'}</span>
                    </div>

                    <div className="card-info">
                      <div className="info-item">
                        <span className="info-label">Site:</span>
                        <span className="info-value">{transformer.siteName || '-'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Mnemonic:</span>
                        <span className="info-value">{transformer.mnemonic || '-'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Serial:</span>
                        <span className="info-value">{transformer.serialNumber || '-'}</span>
                      </div>
                    </div>

                    <div className="card-stats">
                      <span className="stat">
                        <svg className="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        {transformer.oilTests?.length || 0}
                      </span>
                      <span className="stat">
                        <svg className="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {transformer.documents?.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      className="action-btn view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDetails(transformer);
                      }}
                      title="View details"
                    >
                      <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      className="action-btn edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditClick(transformer);
                      }}
                      title="Edit transformer"
                    >
                      <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClick(transformer.id);
                      }}
                      title="Delete transformer"
                    >
                      <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TransformerSidebar;
