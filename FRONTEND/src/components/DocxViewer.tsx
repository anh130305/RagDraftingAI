import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2, FileWarning } from 'lucide-react';

interface DocxViewerProps {
  url: string;
}

const DocxViewer: React.FC<DocxViewerProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const renderDocx = async () => {
      if (!containerRef.current || !url) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Không thể tải tệp tin');
        
        const arrayBuffer = await response.arrayBuffer();
        
        if (isMounted && containerRef.current) {
          // Clear previous content
          containerRef.current.innerHTML = '';
          
          await renderAsync(arrayBuffer, containerRef.current, undefined, {
            className: 'docx-content',
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            debug: false,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Docx render error:', err);
          setError(err.message || 'Lỗi khi hiển thị văn bản');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    renderDocx();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-white overflow-auto relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-sm font-medium text-gray-500">Đang chuẩn bị nội dung văn bản...</p>
        </div>
      )}

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
          <FileWarning className="w-12 h-12 text-error/60 mb-4" />
          <h4 className="text-lg font-bold text-on-surface mb-2">Không thể hiển thị bản thảo</h4>
          <p className="text-sm text-on-surface-variant max-w-md">{error}</p>
        </div>
      )}

      <div 
        ref={containerRef} 
        className="docx-viewer-container p-4 md:p-8 flex justify-center"
      >
        {/* docx-preview will inject content here */}
      </div>

      <style>{`
        .docx-viewer-container {
          background-color: #f3f4f6; /* Gray-100 */
        }
        .docx-content {
          background-color: white !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          padding: 40px !important;
          width: 800px !important;
          max-width: 100% !important;
          min-height: 1000px !important;
          margin: 0 auto !important;
          border: 1px solid #e5e7eb !important;
        }
        .docx-content section {
            margin: 0 !important;
            padding: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default DocxViewer;
