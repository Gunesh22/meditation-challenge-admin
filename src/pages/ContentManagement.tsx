import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FileText, Save, RefreshCw, Languages } from 'lucide-react';

export default function ContentManagement() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [content, setContent] = useState('');
    const [hindiTranslation, setHindiTranslation] = useState('');

    useEffect(() => {
        fetchContent();
    }, []);

    const fetchContent = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, 'admin_settings', 'content_management');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setContent(data.dailyWisdom || 'Default Wisdom text');
                setHindiTranslation(data.hindiTranslation || 'Default Hindi text');
            }
        } catch (err) {
            console.error("Error fetching content:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            await setDoc(doc(db, 'admin_settings', 'content_management'), {
                dailyWisdom: content,
                hindiTranslation: hindiTranslation
            }, { merge: true });
            setMessage('Content saved successfully! The app will now show these strings.');
            setTimeout(() => setMessage(''), 5000);
        } catch (err) {
            console.error("Error saving config:", err);
            setMessage('Failed to save configuration!');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw className="animate-spin" size={32} color="var(--accent)" />
            </div>
        );
    }

    return (
        <div className="main-content">
            <div className="page-header">
                <h1>Content & Translations</h1>
                <p>Edit the copy, text, and translations across the Meditation Challenge directly without touching the code.</p>
            </div>

            {message && (
                <div className="notice">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    {message}
                </div>
            )}

            <form onSubmit={handleSave} className="glass-panel settings-section">
                <h2><FileText size={24} color="var(--accent)" /> Daily Wisdom Quote</h2>

                <div className="form-group">
                    <label>Global English Message (After Meditation)</label>
                    <textarea
                        className="glass-input"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={4}
                        required
                        style={{ resize: 'vertical' }}
                    />
                </div>

                <div className="form-group">
                    <label><Languages size={18} style={{ display: 'inline', marginRight: '8px' }} />Global Hindi Translation</label>
                    <textarea
                        className="glass-input"
                        value={hindiTranslation}
                        onChange={(e) => setHindiTranslation(e.target.value)}
                        rows={4}
                        required
                        style={{ resize: 'vertical' }}
                    />
                </div>

                <button type="submit" className="glass-button" disabled={saving}>
                    {saving ? 'Saving...' : (
                        <>
                            <Save size={20} />
                            Save Content
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
