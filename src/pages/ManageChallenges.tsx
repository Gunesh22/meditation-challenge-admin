import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'; // updateDoc kept for handleSaveChallenge
import { PlusCircle, Search, Trash2, Calendar, LayoutList, RefreshCw, CheckCircle, Edit2, X } from 'lucide-react';

interface Challenge {
    id: string;
    title: string;
    description: string;
    durationDays: number;
    startType: 'rolling' | 'cohort';
    startDate?: string;
    isActive: boolean;
}

export default function ManageChallenges() {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [durationDays, setDurationDays] = useState(11);
    const [startType, setStartType] = useState<'rolling' | 'cohort'>('rolling');
    const [startDate, setStartDate] = useState('');

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'running' | 'done' | 'rolling'>('all');

    const fetchChallenges = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'challenges'));
            const fetchedChallenges: Challenge[] = [];
            querySnapshot.forEach((docSnap) => {
                fetchedChallenges.push({ id: docSnap.id, ...docSnap.data() } as Challenge);
            });
            setChallenges(fetchedChallenges);
        } catch (err) {
            console.error('Error fetching challenges', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChallenges();
    }, []);

    const handleSaveChallenge = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage('');

        try {
            const challengeData = {
                title,
                description,
                durationDays: Number(durationDays),
                startType,
                startDate: startType === 'cohort' ? startDate : null,
                icon: '🪷', // Default icon
            };

            if (editingId) {
                await updateDoc(doc(db, 'challenges', editingId), challengeData);
                setMessage('Challenge updated successfully!');
            } else {
                await addDoc(collection(db, 'challenges'), {
                    ...challengeData,
                    isActive: true,
                    createdAt: new Date()
                });
                setMessage('Challenge created successfully!');
            }

            setTimeout(() => setMessage(''), 3000);

            // Reset form
            setEditingId(null);
            setTitle('');
            setDescription('');
            setDurationDays(11);
            setStartType('rolling');
            setStartDate('');
            setIsFormOpen(false);

            // Refresh list
            fetchChallenges();

        } catch (err) {
            console.error('Error saving challenge', err);
            setMessage(`Failed to save challenge: ${(err as any).message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (challenge: Challenge) => {
        setEditingId(challenge.id);
        setTitle(challenge.title || (challenge as any).name || '');
        setDescription(challenge.description || '');
        setDurationDays(challenge.durationDays || 11);
        setStartType(challenge.startType || 'rolling');
        setStartDate(challenge.startDate || '');
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setDurationDays(11);
        setStartType('rolling');
        setStartDate('');
        setIsFormOpen(false);
    };

    const handleAddNewClick = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setDurationDays(11);
        setStartType('rolling');
        setStartDate('');
        setIsFormOpen(!isFormOpen);
    };

    const handleDelete = async (id: string, challengeTitle: string) => {
        if (window.confirm(`Are you sure you want to completely delete "${challengeTitle}"? This action cannot be undone.`)) {
            try {
                await deleteDoc(doc(db, 'challenges', id));
                fetchChallenges();
            } catch (err) {
                console.error('Error deleting challenge', err);
                alert('Failed to delete challenge.');
            }
        }
    };



    if (loading) {
        return (
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw className="animate-spin" size={32} color="var(--accent)" />
            </div>
        );
    }

    const filteredChallenges = challenges.filter(c => {
        const matchesSearch = (c.title || (c as any).name || '').toLowerCase().includes(searchQuery.toLowerCase());

        let status = 'rolling'; // default
        if (c.startType === 'cohort' && c.startDate) {
            const todayISO = new Date().toISOString().split('T')[0];
            const startStr = c.startDate;
            const startDateObj = new Date(startStr);
            const endDateObj = new Date(startDateObj.getTime() + (c.durationDays - 1) * 24 * 60 * 60 * 1000);
            const endStr = endDateObj.toISOString().split('T')[0];

            if (startStr > todayISO) {
                status = 'upcoming';
            } else if (todayISO >= startStr && todayISO <= endStr) {
                status = 'running';
            } else {
                status = 'done';
            }
        }

        const matchesStatus = statusFilter === 'all' || statusFilter === status;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="main-content">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Manage Challenges</h1>
                    <p>Create, manage, and configure the rules for multiple meditation challenges.</p>
                </div>
                {!isFormOpen && (
                    <button className="glass-button" onClick={handleAddNewClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
                        <PlusCircle size={18} /> Add New Challenge
                    </button>
                )}
            </div>

            {message && (
                <div className="notice" style={{ marginBottom: '24px' }}>
                    <CheckCircle size={20} />
                    {message}
                </div>
            )}

            {/* CREATE / EDIT CHALLENGE FORM */}
            {isFormOpen && (
                <form onSubmit={handleSaveChallenge} className="glass-panel settings-section" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0 }}>
                            {editingId ? (
                                <><Edit2 size={20} color="var(--accent)" style={{ marginRight: '8px' }} /> Edit Challenge</>
                            ) : (
                                <><PlusCircle size={20} color="var(--accent)" style={{ marginRight: '8px' }} /> Create New Challenge</>
                            )}
                        </h2>
                        <button type="button" onClick={handleCancelEdit} className="btn-icon" style={{ backgroundColor: 'var(--bg-container)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={16} /> Cancel
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label>Challenge Title</label>
                            <input
                                type="text"
                                className="glass-input"
                                placeholder="e.g. March Happy Thoughts"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Duration (Number of Days)</label>
                            <input
                                type="number"
                                className="glass-input"
                                value={durationDays}
                                onChange={(e) => setDurationDays(Number(e.target.value))}
                                min={1}
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label>Description</label>
                        <textarea
                            className="glass-input"
                            placeholder="A short description of this challenge..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={{ minHeight: '80px', resize: 'vertical' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Challenge Start Rule</label>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                            <div
                                className={`glass-panel ${startType === 'rolling' ? 'active' : ''}`}
                                style={{
                                    flex: 1,
                                    border: startType === 'rolling' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                    backgroundColor: startType === 'rolling' ? '#f1f5f9' : 'var(--bg-container)',
                                    padding: '16px', cursor: 'pointer', borderRadius: '8px'
                                }}
                                onClick={() => setStartType('rolling')}
                            >
                                <h3 style={{ marginBottom: '8px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <RefreshCw size={18} /> Rolling Start
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Users start Day 1 immediately upon registration.</p>
                            </div>

                            <div
                                className={`glass-panel ${startType === 'cohort' ? 'active' : ''}`}
                                style={{
                                    flex: 1,
                                    border: startType === 'cohort' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                                    backgroundColor: startType === 'cohort' ? '#f1f5f9' : 'var(--bg-container)',
                                    padding: '16px', cursor: 'pointer', borderRadius: '8px'
                                }}
                                onClick={() => setStartType('cohort')}
                            >
                                <h3 style={{ marginBottom: '8px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={18} /> Cohort Start
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Everyone starts concurrently on an exact specific date.</p>
                            </div>
                        </div>
                    </div>

                    {startType === 'cohort' && (
                        <div className="form-group" style={{ marginTop: '20px' }}>
                            <label>Cohort Start Date</label>
                            <input
                                type="date"
                                className="glass-input"
                                style={{ maxWidth: '250px' }}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                If users join late, they skip to the current ongoing day of this cohort.
                            </p>
                        </div>
                    )}

                    <button type="submit" className="glass-button" disabled={submitting} style={{ marginTop: '24px' }}>
                        {submitting ? (editingId ? 'Updating...' : 'Creating...') : (editingId ? 'Update Challenge' : 'Create Challenge')}
                    </button>
                </form>
            )}

            {/* LIST OF EXISTING CHALLENGES */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LayoutList size={20} color="var(--accent)" /> Existing Challenges
                    </h2>

                    {/* FILTERS */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="search-bar" style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Search challenges..."
                                className="glass-input"
                                style={{ paddingLeft: '36px', width: '250px', margin: 0 }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="filter-dropdown" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-container)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: statusFilter === 'all' ? '#f1f5f9' : 'transparent', color: statusFilter === 'all' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: statusFilter === 'all' ? 600 : 400 }}
                            >All</button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('running')}
                                style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: statusFilter === 'running' ? '#f1f5f9' : 'transparent', color: statusFilter === 'running' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: statusFilter === 'running' ? 600 : 400 }}
                            >Running</button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('upcoming')}
                                style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: statusFilter === 'upcoming' ? '#f1f5f9' : 'transparent', color: statusFilter === 'upcoming' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: statusFilter === 'upcoming' ? 600 : 400 }}
                            >Upcoming</button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('done')}
                                style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: statusFilter === 'done' ? '#f1f5f9' : 'transparent', color: statusFilter === 'done' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: statusFilter === 'done' ? 600 : 400 }}
                            >Done</button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('rolling')}
                                style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: statusFilter === 'rolling' ? '#f1f5f9' : 'transparent', color: statusFilter === 'rolling' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: statusFilter === 'rolling' ? 600 : 400 }}
                            >Rolling</button>
                        </div>
                    </div>
                </div>

                {filteredChallenges.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        {challenges.length === 0 ? 'No challenges created yet. Add your first challenge!' : 'No challenges match your filters.'}
                    </div>
                ) : (
                    <div className="data-table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Challenge Name</th>
                                    <th>Duration</th>
                                    <th>Format</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredChallenges.map((challenge) => (
                                    <tr key={challenge.id}>
                                        <td style={{ fontWeight: 500 }}>{challenge.title || (challenge as any).name}</td>
                                        <td>{challenge.durationDays} Days</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {challenge.startType === 'rolling' ? <RefreshCw size={14} /> : <Calendar size={14} />}
                                                <span style={{ textTransform: 'capitalize' }}>{challenge.startType}</span>
                                                {challenge.startType === 'cohort' && challenge.startDate && <small style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>({challenge.startDate})</small>}
                                            </div>
                                        </td>
                                        <td>
                                            {(() => {
                                                let status = 'rolling';
                                                let badgeColor = 'var(--text-secondary)';
                                                let badgeBg = 'var(--bg-container)';

                                                if (challenge.startType === 'cohort' && challenge.startDate) {
                                                    const todayISO = new Date().toISOString().split('T')[0];
                                                    const startStr = challenge.startDate;
                                                    const startDateObj = new Date(startStr);
                                                    const endDateObj = new Date(startDateObj.getTime() + (challenge.durationDays - 1) * 24 * 60 * 60 * 1000);
                                                    const endStr = endDateObj.toISOString().split('T')[0];

                                                    if (startStr > todayISO) {
                                                        status = 'upcoming';
                                                        badgeColor = '#eab308';
                                                        badgeBg = '#fef08a';
                                                    } else if (todayISO >= startStr && todayISO <= endStr) {
                                                        status = 'running';
                                                        badgeColor = 'var(--success)';
                                                        badgeBg = '#bbf7d0';
                                                    } else {
                                                        status = 'done';
                                                        badgeColor = '#64748b';
                                                        badgeBg = '#f1f5f9';
                                                    }
                                                } else {
                                                    badgeColor = 'var(--accent)';
                                                    badgeBg = '#e0e7ff';
                                                }

                                                return (
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        color: badgeColor,
                                                        backgroundColor: badgeBg,
                                                        border: `1px solid ${badgeColor}40`,
                                                        textTransform: 'capitalize'
                                                    }}>
                                                        {status}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td>
                                            <div className="actions" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                                                <button
                                                    className="btn-icon"
                                                    title="Edit Challenge"
                                                    onClick={() => handleEditClick(challenge)}
                                                    style={{ backgroundColor: 'var(--bg-container)' }}
                                                >
                                                    <Edit2 size={16} color="var(--text-secondary)" />
                                                </button>
                                                <button
                                                    className="btn-icon danger"
                                                    title="Delete Challenge"
                                                    onClick={() => handleDelete(challenge.id, challenge.title || (challenge as any).name)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}
