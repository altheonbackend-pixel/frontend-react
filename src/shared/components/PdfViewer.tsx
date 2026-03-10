import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import '../styles/PdfViewer.css'; // Nous allons créer ce fichier CSS ensuite

// Assurez-vous que le worker de pdf.js est correctement configuré
// C'est nécessaire pour que react-pdf fonctionne
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  onClose: () => void; // Fonction pour fermer le lecteur PDF
}

const PdfViewer = ({ url, onClose }: PdfViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Fonction appelée lorsque le document PDF est chargé avec succès
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1); // Réinitialiser à la première page lors d'un nouveau chargement
  };

  // Fonctions pour naviguer entre les pages
  const goToPrevPage = () => setPageNumber(prevPage => Math.max(prevPage - 1, 1));
  const goToNextPage = () => setPageNumber(prevPage => Math.min(prevPage + 1, numPages || 1));

  return (
    <div className="pdf-viewer-overlay"> {/* Div pour l'arrière-plan sombre */}
      <div className="pdf-viewer-modal">
        <div className="pdf-viewer-header">
          <button onClick={onClose} className="pdf-viewer-close-btn">&times;</button>
        </div>
        <div className="pdf-viewer-content">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading="Chargement du PDF..." // Message pendant le chargement
            error="Erreur lors du chargement du PDF." // Message en cas d'erreur
          >
            <Page pageNumber={pageNumber} />
          </Document>
        </div>
        <div className="pdf-viewer-footer">
          <p>Page {pageNumber} sur {numPages}</p>
          <div className="pdf-viewer-controls">
            <button onClick={goToPrevPage} disabled={pageNumber <= 1}>Précédent</button>
            <button onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)}>Suivant</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;