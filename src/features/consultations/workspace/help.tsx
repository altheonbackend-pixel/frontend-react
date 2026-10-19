import { useTranslation } from 'react-i18next';

/** Number of "How it works" points per help topic (keys workspace.help.<topic>.p1…pN). */
const POINTS: Record<string, number> = {
    note: 5, diagnosis: 4, orders: 4, rx: 5, labs: 4, procedures: 4,
};

/** Short purpose line, plus an expandable "How it works" list for doctors. */
export function HelpText({ topic }: { topic: keyof typeof POINTS }) {
    const { t } = useTranslation();
    const n = POINTS[topic];
    return (
        <div className="ws-help">
            <p className="ws-help__intro">{t(`workspace.help.${topic}.intro`)}</p>
            <details className="ws-help__more">
                <summary>{t('workspace.help.how_it_works')}</summary>
                <ul>
                    {Array.from({ length: n }, (_, i) => <li key={i}>{t(`workspace.help.${topic}.p${i + 1}`)}</li>)}
                </ul>
            </details>
        </div>
    );
}
