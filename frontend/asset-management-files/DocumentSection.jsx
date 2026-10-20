import React, { useState } from 'react';
import { documentService } from '../lib/documentService';

function DocumentSection({ transformerId, documents, onUpdate }) {
  const [isUploading, setIsUploading] = useState(false);

  console.log('DocumentSection rendered with:', { transformerId, documents });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      // Upload files to Supabase
      const uploadPromises = files.map(file => documentService.upload(transformerId, file));
      await Promise.all(uploadPromises);

      // Reload documents from database
      const updatedDocuments = await documentService.getByTransformerId(transformerId);
      onUpdate(transformerId, updatedDocuments);
      
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleDeleteDocument = async (docId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await documentService.delete(docId);
        
        // Reload documents from database
        const updatedDocuments = await documentService.getByTransformerId(transformerId);
        onUpdate(transformerId, updatedDocuments);
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document. Please try again.');
      }
    }
  };

  const handleDownloadDocument = async (doc) => {
    try {
      await documentService.download(doc.storagePath, doc.fileName);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  const handleViewDocument = (doc) => {
    try {
      const url = documentService.getPublicUrl(doc.storagePath);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Failed to open document. Please try again.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (!type) return 'file';
    if (type === 'application/pdf') return 'pdf';
    if (type.startsWith('image/')) return 'image';
    if (type.includes('word') || type.includes('document')) return 'word';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'excel';
    return 'file';
  };

  const renderFileIcon = (iconType) => {
    switch (iconType) {
      case 'pdf':
        return (
          <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'image':
        return (
          <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'word':
        return (
          <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'excel':
        return (
          <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 5h6m6 0a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h12zm-2 7h-4v-2h4v2zm0 4h-4v-2h4v2z" />
          </svg>
        );
      default:
        return (
          <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        );
    }
  };

  return (
    <div className="document-section">
      <div className="section-header">
        <h3>Documents & Reports</h3>
        <label className="btn-upload">
          {isUploading ? 'Uploading...' : '+ Upload Files'}
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="upload-info">
        <p>Supported formats: PDF, Word, Excel, Images (JPG, PNG)</p>
        <p>Maximum file size: 10MB per file</p>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No documents uploaded yet</p>
          <label className="btn-add-empty">
            Upload First Document
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              disabled={isUploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      ) : (
        <div className="document-list">
          {documents && documents.map(doc => {
            console.log('Rendering document:', doc);
            return (
            <div key={doc.id} className="document-card">
              <div className="doc-icon">
                {renderFileIcon(getFileIcon(doc.type || doc.fileType))}
              </div>
              
              <div className="doc-info">
                <div className="doc-name">{doc.name || doc.fileName}</div>
                <div className="doc-meta">
                  <span className="doc-size">{formatFileSize(doc.size || doc.fileSize)}</span>
                  <span className="doc-separator">•</span>
                  <span className="doc-date">
                    {new Date(doc.uploadDate || doc.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="doc-actions">
                <button
                  className="doc-btn view-btn"
                  onClick={() => handleViewDocument(doc)}
                  title="View document"
                >
                  <svg className="doc-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  className="doc-btn download-btn"
                  onClick={() => handleDownloadDocument(doc)}
                  title="Download document"
                >
                  <svg className="doc-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  className="doc-btn delete-btn"
                  onClick={() => handleDeleteDocument(doc.id)}
                  title="Delete document"
                >
                  <svg className="doc-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DocumentSection;
