import React, { useRef, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';

function TransformerMarker({ 
  transformer, 
  icon, 
  onDragEnd, 
  onEdit, 
  onDelete,
  onViewDetails 
}) {
  const markerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          onDragEnd(transformer.id, [newPos.lat, newPos.lng]);
        }
      },
    }),
    [transformer.id, onDragEnd]
  );

  return (
    <Marker
      position={transformer.position}
      draggable={true}
      eventHandlers={eventHandlers}
      ref={markerRef}
      icon={icon}
    >
      <Popup className="transformer-popup" maxWidth={320}>
        <div className="popup-content">
          <div className="popup-header">
            <h3>
              <svg className="popup-header-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              {transformer.txName || 'Unnamed Transformer'}
            </h3>
            <div className="popup-badge">{transformer.voltage || 'N/A'}</div>
          </div>

          <div className="popup-details">
            <div className="detail-row">
              <span className="label">Site:</span>
              <span className="value">{transformer.siteName || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Mnemonic:</span>
              <span className="value">{transformer.mnemonic || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Serial:</span>
              <span className="value">{transformer.serialNumber || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Load:</span>
              <span className="value">{transformer.loadMVA || '-'} MVA</span>
            </div>
            <div className="detail-row">
              <span className="label">Maker:</span>
              <span className="value">{transformer.maker || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Year:</span>
              <span className="value">{transformer.yearBuilt || '-'}</span>
            </div>
          </div>

          <div className="popup-stats">
            <div className="stat-item">
              <svg className="popup-stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2h6V3M7 7h10v10a2 2 0 01-2 2h-6a2 2 0 01-2-2V7z" />
              </svg>
              <span className="stat-text">{transformer.oilTests?.length || 0} Oil Tests</span>
            </div>
            <div className="stat-item">
              <svg className="popup-stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="stat-text">{transformer.documents?.length || 0} Documents</span>
            </div>
          </div>

          <div className="popup-actions">
            <button 
              className="btn-view"
              onClick={() => onViewDetails(transformer)}
            >
              View Details
            </button>
            <button 
              className="btn-edit"
              onClick={() => onEdit(transformer)}
            >
              Edit
            </button>
            <button 
              className="btn-delete"
              onClick={() => onDelete(transformer.id)}
            >
              Delete
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default TransformerMarker;
