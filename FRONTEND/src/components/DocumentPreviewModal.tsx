import { useMemo } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import * as api from '../lib/api';
import DocxViewer from './DocxViewer';

export interface DocumentPreviewFile {
  name: string;
  url?: string;
  fileType?: string | null;
  isLoading?: boolean;
  error?: string | null;
}

interface DocumentPreviewModalProps {
  file: DocumentPreviewFile | null;
  onClose: () => void;
}

export default function DocumentPreviewModal({ file, onClose }: DocumentPreviewModalProps) {
  const preview = useMemo(() => {
    if (!file || !file.url) return null;

    const kind = api.inferDocumentPreviewKind({
      fileName: file.name,
      fileType: file.fileType,
      filePath: file.url,
    });

    const inlineUrl = api.getDocumentPreviewUrl(file.url, kind, file.name, file.fileType);
    const downloadUrl = api.getDocumentDownloadUrl(file.url, kind, file.name, file.fileType);

    return { kind, inlineUrl, downloadUrl };
  }, [file]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline-variant rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-5 py-3 border-b border-outline-variant/30 flex justify-between items-center bg-surface-low shrink-0">
          <h3 className="font-bold text-on-surface truncate flex-1 pr-4">{file.name}</h3>
          <div className="flex items-center gap-2">
            {preview && (
              <a
                href={preview.downloadUrl}
                download={file.name}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-lg transition-colors text-sm font-semibold"
              >
                <Download className="w-4 h-4" /> Tải về
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-surface-highest rounded-full text-on-surface-variant transition-colors"
              aria-label="Đóng xem trước"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative bg-surface-lowest overflow-hidden">
          {file.isLoading && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Đang tải tệp để xem trước...</p>
              </div>
            </div>
          )}

          {!file.isLoading && file.error && (
            <div className="w-full h-full flex items-center justify-center px-8">
              <p className="text-sm text-error text-center">{file.error}</p>
            </div>
          )}

          {!file.isLoading && !file.error && preview?.kind === 'word' && (
            <DocxViewer url={preview.downloadUrl} />
          )}

          {!file.isLoading && !file.error && preview?.kind === 'pdf' && (
            <iframe
              src={preview.inlineUrl}
              title="PDF Preview"
              className="w-full h-full border-none"
            />
          )}

          {!file.isLoading && !file.error && preview?.kind === 'image' && (
            <div className="w-full h-full overflow-auto p-4 flex items-start justify-center">
              <img
                src={preview.inlineUrl}
                alt={file.name}
                className="max-w-full h-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          )}

          {!file.isLoading && !file.error && preview?.kind === 'other' && (
            <iframe
              src={preview.inlineUrl}
              className="w-full h-full border-none bg-white"
              title="Document Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
