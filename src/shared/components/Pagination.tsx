import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || isLoading}
        aria-label={t('pagination.previous_page')}
      >
        {t('common.previous')}
      </button>
      <span className="pagination__info">
        {t('pagination.page_of', { current: currentPage, total: totalPages })}
        {totalCount > 0 && ` (${t('pagination.total', { count: totalCount })})`}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages || isLoading}
        aria-label={t('pagination.next_page')}
      >
        {t('common.next')}
      </button>
    </div>
  );
}
