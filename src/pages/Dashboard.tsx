import { useState, useEffect } from 'react';
import { Users, UserCheck, CheckCircle, TrendingDown, RefreshCw, Download, Calendar, BarChart3, Clock, AlertTriangle, ShieldCheck, Heart, Activity, PieChart as PieIcon, BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

interface Challenge {
    id: string;
    name: string;
    title?: string;
    durationDays: number;
}

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [selectedChallengeId, setSelectedChallengeId] = useState<string>('');

    const [stats, setStats] = useState({
        totalUsers: 0,
        activeToday: 0,
        completionRate: 0,
        dropOffDay: 0,
        avgStreak: 0,
        dormantUsers: 0
    });

    const [chartData, setChartData] = useState<{ day: string, active: number }[]>([]);
    const [streakData, setStreakData] = useState<{ streak: string, count: number }[]>([]);
    const [sentimentData, setSentimentData] = useState<{ mood: string, value: number, color: string }[]>([]);
    const [cohortData, setCohortData] = useState<{ period: string, count: number }[]>([]);
    const [timeData, setTimeData] = useState<{ hour: string, count: number }[]>([]);
    
    const [activeTab, setActiveTab] = useState<'overview' | 'retention' | 'sentiment' | 'audit'>('overview');
    const [rawEnrollments, setRawEnrollments] = useState<any[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

    // 1. Fetch available challenges to populate the dropdown
    useEffect(() => {
        const fetchChallenges = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'challenges'));
                const fetched: Challenge[] = [];
                querySnapshot.forEach((docSnap) => {
                    fetched.push({ id: docSnap.id, ...docSnap.data() } as Challenge);
                });
                setChallenges(fetched);
                if (fetched.length > 0) {
                    setSelectedChallengeId(fetched[0].id);
                }
            } catch (err) {
                console.error('Error fetching challenges', err);
            } finally {
                setLoading(false);
            }
        };

        const fetchUsers = async () => {
            try {
                const uSnap = await getDocs(collection(db, 'users'));
                const map: Record<string, any> = {};
                uSnap.forEach(doc => {
                    map[doc.id] = doc.data();
                });
                setUserProfiles(map);
            } catch (err) {
                console.error('Failed to fetch users', err);
            }
        };

        fetchChallenges();
        fetchUsers();
    }, []);

    // 2. Fetch enrollments for the specifically selected challenge
    useEffect(() => {
        if (!selectedChallengeId) return;

        const fetchEnrollments = async () => {
            try {
                const selectedChallenge = challenges.find(c => c.id === selectedChallengeId);
                if (!selectedChallenge) return;

                const duration = selectedChallenge.durationDays;

                const q = query(
                    collection(db, 'user_challenges'),
                    where('challengeId', '==', selectedChallengeId)
                );

                const querySnapshot = await getDocs(q);
                const enrollments: any[] = [];
                querySnapshot.forEach((docSnap) => {
                    enrollments.push({ 
                        id: docSnap.id, 
                        ...docSnap.data(),
                        // Map Firestore Timestamp to Date for processing
                        createdAtDate: (docSnap.data().createdAt as Timestamp)?.toDate() || new Date()
                    });
                });
                setRawEnrollments(enrollments);

                // --- 1. Compute Base Statistics ---
                let totalUsers = enrollments.length;
                let activeToday = 0;
                let completedUsers = 0;
                let totalStreak = 0;
                let dormantCount = 0;

                const dayCounts = new Array(duration).fill(0);
                const streakTally: Record<number, number> = { 1: 0, 3: 0, 7: 0, 14: 0, 21: 0 };
                const moodTally: Record<string, number> = { peaceful: 0, deep: 0, calm: 0, distracted: 0, difficult: 0 };
                const cohortTally: Record<string, number> = {};
                const hourTally: Record<number, number> = new Array(24).fill(0);

                const todayStr = new Date().toISOString().split('T')[0];
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                enrollments.forEach(enroll => {
                    const progress = enroll.completedDays || {};
                    const progressKeys = Object.keys(progress).sort();

                    // Active Today
                    if (progress[todayStr]) activeToday++;

                    // Dormant (No activity in 7 days)
                    const lastActivityDate = progressKeys.length > 0 ? new Date(progressKeys[progressKeys.length - 1]) : enroll.createdAtDate;
                    if (lastActivityDate < sevenDaysAgo) dormantCount++;

                    // Completion
                    if (progressKeys.length >= duration) completedUsers++;

                    // Tally for Retention Chart
                    for (let i = 1; i <= duration; i++) {
                        if (progressKeys.length >= i) dayCounts[i - 1]++;
                    }

                    // --- 2. Advanced Retention (Streaks) ---
                    let currentStreak = 0;
                    let maxStreak = 0;
                    // Simplistic streak calc: consecutive dates in progressKeys
                    if (progressKeys.length > 0) {
                        let prevDate = new Date(progressKeys[0]);
                        currentStreak = 1;
                        maxStreak = 1;
                        for (let i = 1; i < progressKeys.length; i++) {
                            const currDate = new Date(progressKeys[i]);
                            const diff = (currDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
                            if (diff === 1) {
                                currentStreak++;
                            } else {
                                maxStreak = Math.max(maxStreak, currentStreak);
                                currentStreak = 1;
                            }
                            prevDate = currDate;
                        }
                        maxStreak = Math.max(maxStreak, currentStreak);
                    }
                    totalStreak += maxStreak;
                    if (maxStreak >= 21) streakTally[21]++;
                    else if (maxStreak >= 14) streakTally[14]++;
                    else if (maxStreak >= 7) streakTally[7]++;
                    else if (maxStreak >= 3) streakTally[3]++;
                    else if (maxStreak >= 1) streakTally[1]++;

                    // --- 3. Sentiment Analytics ---
                    const reflections = enroll.reflections || {};
                    Object.values(reflections).forEach((refl: any) => {
                        if (refl.feeling && moodTally[refl.feeling] !== undefined) {
                            moodTally[refl.feeling]++;
                        }
                    });

                    // --- 4. Cohort Analysis (Registration Trends) ---
                    const regMonth = enroll.createdAtDate.toLocaleString('default', { month: 'short', year: '2-digit' });
                    cohortTally[regMonth] = (cohortTally[regMonth] || 0) + 1;

                    // --- 5. Time-Based Engagement (Proxy from registration hour) ---
                    const regHour = enroll.createdAtDate.getHours();
                    hourTally[regHour]++;
                });

                // Finalize Stats
                const completionRate = totalUsers > 0 ? Math.round((completedUsers / totalUsers) * 100) : 0;
                
                let dropOffDay = 0;
                let maxDrop = 0;
                for (let i = 0; i < dayCounts.length - 1; i++) {
                    const drop = dayCounts[i] - dayCounts[i + 1];
                    if (drop > maxDrop) {
                        maxDrop = drop;
                        dropOffDay = i + 1;
                    }
                }

                setStats({
                    totalUsers,
                    activeToday,
                    completionRate,
                    dropOffDay: dropOffDay || 1,
                    avgStreak: totalUsers > 0 ? Math.round(totalStreak / totalUsers) : 0,
                    dormantUsers: dormantCount
                });

                // Set Chart Datas
                setChartData(dayCounts.map((count, index) => ({ day: `Day ${index + 1}`, active: count })));
                setStreakData([
                    { streak: '1+ Day', count: streakTally[1] },
                    { streak: '3+ Days', count: streakTally[3] },
                    { streak: '7+ Days', count: streakTally[7] },
                    { streak: '14+ Days', count: streakTally[14] },
                    { streak: '21+ Days', count: streakTally[21] },
                ]);
                setSentimentData([
                    { mood: 'Peaceful', value: moodTally.peaceful, color: '#10b981' },
                    { mood: 'Deep', value: moodTally.deep, color: '#3b82f6' },
                    { mood: 'Calm', value: moodTally.calm, color: '#8b5cf6' },
                    { mood: 'Distracted', value: moodTally.distracted, color: '#f59e0b' },
                    { mood: 'Difficult', value: moodTally.difficult, color: '#ef4444' },
                ].filter(d => d.value > 0));
                setCohortData(Object.keys(cohortTally).map(key => ({ period: key, count: cohortTally[key] })));
                setTimeData(hourTally.map((count, hr) => ({ hour: `${hr}:00`, count })));

            } catch (err) {
                console.error('Error fetching analytics', err);
            }
        };

        fetchEnrollments();
    }, [selectedChallengeId, challenges]);

    const handleExportExcel = () => {
        const challengeName = challenges.find(c => c.id === selectedChallengeId)?.title || "Challenge";

        // Format data to export
        const exportData = rawEnrollments.map(enroll => {
            const user = userProfiles[enroll.userId] || {};
            const completedCount = Object.keys(enroll.completedDays || {}).length;

            return {
                Name: user.name || 'Unknown',
                Phone: user.phone || enroll.userId || 'Unknown',
                Email: user.email || 'N/A',
                "Challenge Start Date": enroll.startDate || 'N/A',
                "Days Completed": completedCount,
                "Is Finished?": completedCount >= (challenges.find(c => c.id === selectedChallengeId)?.durationDays || 11) ? "Yes" : "No"
            };
        });

        if (exportData.length === 0) {
            alert('No data to export for this challenge.');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Participants");

        // Download the file
        XLSX.writeFile(wb, `${challengeName}_Participants.xlsx`);
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
            <div className="flex-between page-header">
                <div>
                    <h1>Dashboard Analytics</h1>
                    <p>Monitor real-time engagement across your active cohorts.</p>
                </div>

                {challenges.length > 0 && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select
                            className="glass-input"
                            style={{ width: '250px', cursor: 'pointer', fontWeight: 600, margin: 0 }}
                            value={selectedChallengeId}
                            onChange={(e) => setSelectedChallengeId(e.target.value)}
                        >
                            {challenges.map(c => (
                                <option key={c.id} value={c.id}>
                                    📊 {c.title || c.name} ({c.durationDays} Days)
                                </option>
                            ))}
                        </select>
                        <button
                            className="glass-button"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
                            onClick={handleExportExcel}
                            disabled={rawEnrollments.length === 0}
                        >
                            <Download size={18} /> Export Excel
                        </button>
                    </div>
                )}
            </div>

            <div className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <BarChart2 size={18} /> Overview
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'retention' ? 'active' : ''}`}
                    onClick={() => setActiveTab('retention')}
                >
                    <Activity size={18} /> Retention
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'sentiment' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sentiment')}
                >
                    <Heart size={18} /> Sentiment
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    <ShieldCheck size={18} /> Admin Audit
                </button>
            </div>

            {challenges.length === 0 ? (
                <div className="glass-panel" style={{ padding: '50px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>No Challenges Found</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Create your first challenge in the Manage Challenges tab to start tracking analytics!</p>
                </div>
            ) : (
                <>
                    <div className="dashboard-grid">
                        <div className="glass-panel stat-card">
                            <div className="flex-between">
                                <div>
                                    <div className="stat-label">Total Enrollments</div>
                                    <div className="stat-value">{stats.totalUsers}</div>
                                </div>
                                <div className="stat-icon" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}><Users size={20} /></div>
                            </div>
                        </div>

                        <div className="glass-panel stat-card">
                            <div className="flex-between">
                                <div>
                                    <div className="stat-label">Avg. Max Streak</div>
                                    <div className="stat-value">{stats.avgStreak} Days</div>
                                </div>
                                <div className="stat-icon" style={{ color: '#8b5cf6', background: '#f5f3ff', border: '1px solid #ddd6fe' }}><Clock size={20} /></div>
                            </div>
                        </div>

                        <div className="glass-panel stat-card">
                            <div className="flex-between">
                                <div>
                                    <div className="stat-label">Completion Rate</div>
                                    <div className="stat-value">{stats.completionRate}%</div>
                                </div>
                                <div className="stat-icon" style={{ color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe' }}><CheckCircle size={20} /></div>
                            </div>
                        </div>

                        <div className="glass-panel stat-card">
                            <div className="flex-between">
                                <div>
                                    <div className="stat-label">Dormant Users</div>
                                    <div className="stat-value">{stats.dormantUsers}</div>
                                </div>
                                <div className="stat-icon" style={{ color: 'var(--danger)', background: '#fef2f2', border: '1px solid #fecaca' }}><AlertTriangle size={20} /></div>
                            </div>
                        </div>

                        <div className="glass-panel stat-card">
                            <div className="flex-between">
                                <div>
                                    <div className="stat-label">Drop-off Point</div>
                                    <div className="stat-value">Day {stats.dropOffDay}</div>
                                </div>
                                <div className="stat-icon" style={{ color: '#f59e0b', background: '#fffbeb', border: '1px solid #fef3c7' }}><TrendingDown size={20} /></div>
                            </div>
                        </div>
                    </div>

                    {activeTab === 'overview' && (
                        <div className="glass-panel">
                            <div style={{ padding: '24px 24px 0 24px' }}>
                                <h2 style={{ fontSize: '18px' }}>Challenge Retention Curve</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>How many users successfully complete each medidate day over time.</p>
                            </div>
                            <div className="chart-container">
                                {stats.totalUsers === 0 ? (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                        No active enrollments for this challenge yet.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                            <XAxis dataKey="day" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                                            <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--bg-container)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    boxShadow: 'var(--shadow-md)'
                                                }}
                                            />
                                            <Area type="step" dataKey="active" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorActive)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'retention' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-panel">
                                <div style={{ padding: '24px' }}>
                                    <h2 style={{ fontSize: '18px' }}>Streak Distribution</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Users grouped by their longest consecutive meditation streak.</p>
                                </div>
                                <div className="chart-container" style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={streakData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="streak" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="glass-panel">
                                <div style={{ padding: '24px' }}>
                                    <h2 style={{ fontSize: '18px' }}>Enrollment Cohorts</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>New participants joining the challenge over time.</p>
                                </div>
                                <div className="chart-container" style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={cohortData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sentiment' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="glass-panel">
                                <div style={{ padding: '24px' }}>
                                    <h2 style={{ fontSize: '18px' }}>Community Mood Profile</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Aggregated "Feelings" from user reflections after meditation.</p>
                                </div>
                                <div className="chart-container" style={{ height: '300px', display: 'flex', alignItems: 'center' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={sentimentData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                nameKey="mood"
                                            >
                                                {sentimentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ paddingRight: '40px' }}>
                                        {sentimentData.map((d, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '14px' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: d.color }}></div>
                                                <span>{d.mood}: {d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="glass-panel">
                                <div style={{ padding: '24px' }}>
                                    <h2 style={{ fontSize: '18px' }}>Registration Hours</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>When are most people finding and joining the challenge?</p>
                                </div>
                                <div className="chart-container" style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={timeData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#ddd6fe" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audit' && (
                        <div className="glass-panel">
                            <div style={{ padding: '24px' }}>
                                <h2 style={{ fontSize: '18px' }}>Participation Audit Log</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Reviewing user consistency and identifying dormant accounts.</p>
                            </div>
                            <div className="data-table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Participant</th>
                                            <th>Last Active</th>
                                            <th>Completed</th>
                                            <th>Reflections</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rawEnrollments
                                            .map(enroll => {
                                                const progressKeys = Object.keys(enroll.completedDays || {});
                                                const lastDate = progressKeys.sort().reverse()[0] || 'N/A';
                                                return { ...enroll, lastDate, progressKeys };
                                            })
                                            .sort((a, b) => {
                                                if (a.lastDate === 'N/A') return 1;
                                                if (b.lastDate === 'N/A') return -1;
                                                return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
                                            })
                                            .slice(0, 15)
                                            .map((enroll, idx) => {
                                                const user = userProfiles[enroll.userId] || {};
                                                const reflectionCount = Object.keys(enroll.reflections || {}).length;
                                                const isDormant = enroll.lastDate !== 'N/A' && (new Date().getTime() - new Date(enroll.lastDate).getTime()) / (1000 * 3600 * 24) > 7;

                                                return (
                                                    <tr key={idx}>
                                                        <td>
                                                            <div style={{ fontWeight: 600 }}>{user.name || 'Anonymous'}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.phone || enroll.userId}</div>
                                                        </td>
                                                        <td>{enroll.lastDate}</td>
                                                        <td>{enroll.progressKeys.length} Days</td>
                                                        <td>{reflectionCount} Logs</td>
                                                        <td>
                                                            <span style={{ 
                                                                padding: '4px 8px', 
                                                                borderRadius: '10px', 
                                                                fontSize: '11px', 
                                                                fontWeight: 700,
                                                                background: isDormant ? '#fee2e2' : '#dcfce7',
                                                                color: isDormant ? '#b91c1c' : '#15803d'
                                                            }}>
                                                                {isDormant ? 'DORMANT' : 'ACTIVE'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                                <div style={{ padding: '16px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    Showing top 10 recent participants. Export Excel for full audit.
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
