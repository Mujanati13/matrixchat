import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoadingPage.css';

function LoadingPage() {
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => navigate('/contact'), 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="loading-page">
      <div className="loading-container">
        <div className="logo-section">
          <div className="app-logo">
            <span className="logo-icon">💬</span>
          </div>
          <h1 className="app-title">MatrixChat</h1>
          <p className="app-subtitle">Secure Communication Platform</p>
        </div>

        <div className="loading-section">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="loading-text">Loading... {progress}%</p>
        </div>

        <div className="features-section">
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <span>End-to-End Encryption</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🚀</span>
            <span>Fast & Reliable</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🌐</span>
            <span>Cross-Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadingPage;
