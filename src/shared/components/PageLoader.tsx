import './PageLoader.css';

interface PageLoaderProps {
    message?: string;
}

const PageLoader = ({ message = 'Loading' }: PageLoaderProps) => (
    <div className="page-loader">
        <div className="page-loader-card">

            {/* ECG monitor strip */}
            <div className="ecg-monitor" aria-hidden="true">
                <div className="ecg-grid" />
                <div className="ecg-scan" />
                <svg
                    className="ecg-svg"
                    viewBox="0 0 500 70"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                >
                    {/* Glow duplicate */}
                    <polyline
                        className="ecg-glow"
                        points="0,35 25,35 30,33 35,35 55,35 62,8 68,62 74,35 90,35 95,33 100,35 125,35 132,8 138,62 144,35 160,35 165,33 170,35 195,35 202,8 208,62 214,35 230,35 235,33 240,35 265,35 272,8 278,62 284,35 300,35 305,33 310,35 335,35 342,8 348,62 354,35 370,35 375,33 380,35 405,35 412,8 418,62 424,35 440,35 445,33 450,35 475,35 482,8 488,62 494,35 500,35"
                    />
                    {/* Main trace */}
                    <polyline
                        className="ecg-trace"
                        points="0,35 25,35 30,33 35,35 55,35 62,8 68,62 74,35 90,35 95,33 100,35 125,35 132,8 138,62 144,35 160,35 165,33 170,35 195,35 202,8 208,62 214,35 230,35 235,33 240,35 265,35 272,8 278,62 284,35 300,35 305,33 310,35 335,35 342,8 348,62 354,35 370,35 375,33 380,35 405,35 412,8 418,62 424,35 440,35 445,33 450,35 475,35 482,8 488,62 494,35 500,35"
                    />
                </svg>
            </div>

            {/* Label */}
            <p className="page-loader-label">
                {message}
                <span className="loader-dot" />
                <span className="loader-dot" />
                <span className="loader-dot" />
            </p>

        </div>
    </div>
);

export default PageLoader;
