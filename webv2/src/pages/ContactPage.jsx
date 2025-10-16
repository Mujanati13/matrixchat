import { useState } from 'react';
import './ContactPage.css';

function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    }, 3000);
  };

  return (
    <div className="contact-page">
      <div className="contact-container">
        <header className="contact-header">
          <div className="logo-small">
            <span className="logo-icon-small">💬</span>
            <span className="logo-text">MatrixChat</span>
          </div>
        </header>

        <div className="contact-content">
          <div className="contact-info">
            <h1>Get in Touch</h1>
            <p className="contact-description">
              Have questions or feedback? We'd love to hear from you. 
              Send us a message and we'll respond as soon as possible.
            </p>

            <div className="info-cards">
              <div className="info-card">
                <span className="info-icon">📧</span>
                <h3>Email</h3>
                <p>support@matrixchat.com</p>
              </div>
              <div className="info-card">
                <span className="info-icon">🌐</span>
                <h3>Website</h3>
                <p>www.matrixchat.com</p>
              </div>
              <div className="info-card">
                <span className="info-icon">📱</span>
                <h3>Social Media</h3>
                <p>@matrixchat</p>
              </div>
            </div>
          </div>

          <div className="contact-form-section">
            <form className="contact-form" onSubmit={handleSubmit}>
              <h2>Send us a Message</h2>
              
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Your name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your.email@example.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="What is this about?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="5"
                  placeholder="Tell us more..."
                ></textarea>
              </div>

              <button type="submit" className="submit-btn">
                {submitted ? '✓ Sent!' : 'Send Message'}
              </button>

              {submitted && (
                <p className="success-message">
                  Thank you! We'll get back to you soon.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
