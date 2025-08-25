import React, { useRef, useState } from 'react';
import jspdf from 'jspdf';
import html2canvas from 'html2canvas';
import { AiIcon } from './icons/AiIcon';
import { DocumentIcon } from './icons/DocumentIcon';

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string | null;
  isLoading: boolean;
}

const SuggestionModal: React.FC<SuggestionModalProps> = ({ isOpen, onClose, title, content, isLoading }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    setIsPdfDownloading(true);

    const staffName = title.replace('برنامه پیشنهادی برای ', '');
    const filename = `برنامه-بهبود-${staffName.replace(/ /g, '_')}.pdf`;

    try {
        const contentElement = contentRef.current;
        // The key fix is to tell html2canvas to render the entire scrollable height, not just the visible part.
        const canvas = await html2canvas(contentElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: window.getComputedStyle(contentElement).getPropertyValue('background-color'),
            height: contentElement.scrollHeight,
            windowHeight: contentElement.scrollHeight,
        });

        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jspdf('p', 'pt', 'a4');
        const pdfSize = {
            width: pdf.internal.pageSize.getWidth(),
            height: pdf.internal.pageSize.getHeight(),
        };

        const imgProps = {
            width: canvas.width,
            height: canvas.height,
        };
        const ratio = imgProps.width / imgProps.height;
        const pdfImgWidth = pdfSize.width;
        const pdfImgHeight = pdfSize.width / ratio;
        
        let position = 0;
        let heightLeft = pdfImgHeight;

        pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight);
        heightLeft -= pdfSize.height;

        while (heightLeft > 0) {
            position -= pdfSize.height;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight);
            heightLeft -= pdfSize.height;
        }

        pdf.save(filename);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("خطایی در ساخت فایل PDF رخ داد.");
    } finally {
        setIsPdfDownloading(false);
    }
  };

  const handleDownloadWord = () => {
    if (!contentRef.current) return;

    const staffName = title.replace('برنامه پیشنهادی برای ', '');
    const filename = `برنامه-بهبود-${staffName.replace(/ /g, '_')}.doc`;
    
    // The contentRef contains the formatted prose div, let's get its innerHTML
    const contentHtml = contentRef.current.querySelector('.prose')?.innerHTML || '';

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Improvement Plan</title><style>body { font-family: 'Vazirmatn', 'Times New Roman', serif; direction: rtl; }</style></head><body>`;
    const footer = "</body></html>";
    const sourceHTML = header + `<h1>${title}</h1>` + contentHtml + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = filename;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const formatContent = (text: string | null): string => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/---/g, '<hr class="my-4 border-slate-300 dark:border-slate-600" />')
      .replace(/<QUOTE>(.*?)<\/QUOTE>/gs, (match, p1) => `<blockquote class="border-r-4 border-slate-300 dark:border-slate-600 pr-4 italic text-slate-500 dark:text-slate-400 my-4">${p1.trim().replace(/\n/g, '<br />')}</blockquote>`)
      .replace(/\n/g, '<br />');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 bg-white dark:bg-slate-800">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AiIcon className="w-6 h-6 text-indigo-500" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div ref={contentRef} className="p-6 overflow-y-auto flex-grow bg-white dark:bg-slate-800">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <svg className="animate-spin h-12 w-12 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-4 text-slate-500">در حال آماده سازی برنامه پیشنهادی...</p>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatContent(content) }}></div>
          )}
        </div>
        {!isLoading && content && (
           <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end items-center gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                    onClick={handleDownloadWord} 
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                    <DocumentIcon className="w-5 h-5" />
                    دانلود Word
                </button>
                <button 
                    onClick={handleDownloadPdf}
                    disabled={isPdfDownloading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait"
                >
                     <DocumentIcon className="w-5 h-5" />
                     {isPdfDownloading ? 'در حال ساخت...' : 'دانلود PDF'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionModal;