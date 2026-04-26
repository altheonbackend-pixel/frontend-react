// src/shared/components/AttachmentList.tsx
// Shared file attachment chip list — used in lab results, consultations, procedures, referrals

export interface Attachment {
    id: number;
    original_filename: string;
    file_size: number | null;
    mime_type: string;
    download_url: string | null;
    created_at?: string;
}

function fileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    return '📎';
}

function formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
    attachments: Attachment[];
    style?: React.CSSProperties;
}

export function AttachmentList({ attachments, style }: Props) {
    if (!attachments.length) return null;

    return (
        <div className="attachment-list" style={style}>
            {attachments.map(att => (
                att.download_url ? (
                    <a
                        key={att.id}
                        href={att.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="attachment-chip attachment-chip--link"
                        title={att.original_filename}
                    >
                        <span className="attachment-icon">{fileIcon(att.mime_type)}</span>
                        <span className="attachment-name">{att.original_filename}</span>
                        {att.file_size && (
                            <span className="attachment-size">{formatBytes(att.file_size)}</span>
                        )}
                    </a>
                ) : (
                    <span
                        key={att.id}
                        className="attachment-chip attachment-chip--unavailable"
                        title="File not available"
                    >
                        <span className="attachment-icon">{fileIcon(att.mime_type)}</span>
                        <span className="attachment-name">{att.original_filename}</span>
                    </span>
                )
            ))}
        </div>
    );
}

export default AttachmentList;
