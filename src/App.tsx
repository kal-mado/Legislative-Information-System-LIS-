import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PrecisionSearchModule } from './components/PrecisionSearchModule';
import { UploadReviewModule } from './components/UploadReviewModule';
import { DocumentDetailModal } from './components/DocumentDetailModal';
import { FormatExplainerModal } from './components/FormatExplainerModal';
import { LegislativeDocument, SearchResultItem } from './types';
import { SEED_LEGISLATIVE_DOCUMENTS } from './data/seedDocuments';

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'upload'>('search');
  const [documents, setDocuments] = useState<LegislativeDocument[]>(SEED_LEGISLATIVE_DOCUMENTS);
  const [selectedResultItem, setSelectedResultItem] = useState<SearchResultItem | null>(null);
  const [isFormatGuideOpen, setIsFormatGuideOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load documents from backend on initial mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          const docs = data.results.map((r: any) => r.document);
          setDocuments(docs);
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using local memory seed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentSaved = (newDoc: LegislativeDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveTab('search');
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend delete error:', err);
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selectedResultItem?.document.id === id) {
      setSelectedResultItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        documentCount={documents.length}
      />

      {/* Main App Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'search' && (
          <PrecisionSearchModule
            documents={documents}
            onSelectDocument={(item) => setSelectedResultItem(item)}
            onOpenFormatGuide={() => setIsFormatGuideOpen(true)}
            onSwitchToUpload={() => setActiveTab('upload')}
            onDeleteDocument={handleDeleteDocument}
          />
        )}

        {activeTab === 'upload' && (
          <UploadReviewModule
            onDocumentSaved={handleDocumentSaved}
            onOpenFormatGuide={() => setIsFormatGuideOpen(true)}
          />
        )}
      </main>

      {/* Document Detail Modal */}
      <DocumentDetailModal
        item={selectedResultItem}
        onClose={() => setSelectedResultItem(null)}
        onDeleteDocument={handleDeleteDocument}
      />

      {/* Standard Title Format Rules Modal */}
      <FormatExplainerModal
        isOpen={isFormatGuideOpen}
        onClose={() => setIsFormatGuideOpen(false)}
      />

      {/* Institutional Footer */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 text-xs py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              LIS
            </div>
            <span>
              Legislative Information System (LIS) • Municipality of Mutia, Zamboanga del Norte
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <button
              onClick={() => setIsFormatGuideOpen(true)}
              className="text-slate-400 hover:text-white underline underline-offset-2 cursor-pointer"
            >
              Format Syntax Rules
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
