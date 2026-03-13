import { useState, useEffect } from 'react';
import { Users, UserCheck, CheckCircle, TrendingDown, RefreshCw, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
        dropOffDay: 0
    });

    const [chartData, setChartData] = useState<{ day: string, active: number }[]>([]);
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
                    enrollments.push(docSnap.data());
                });
                setRawEnrollments(enrollments);

                // Compute Statistics
                let totalUsers = enrollments.length;
                let activeToday = 0;
                let completedUsers = 0;



                // Array to count completions per day to build chart and find edge drops
                const dayCounts = new Array(duration).fill(0);

                enrollments.forEach(enroll => {
                    const progress = enroll.completedDays || {};

                    // Check if active today
                    const playedToday = Object.keys(progress).some((dateStr: string) => {
                        return dateStr === new Date().toISOString().split('T')[0];
                    });

                    if (playedToday) activeToday++;

                    const progressKeys = Object.keys(progress);

                    // Check Completion
                    if (progressKeys.length >= duration) {
                        completedUsers++;
                    }

                    // Tally for chart (simplistic count by how many days finished)
                    for (let i = 1; i <= duration; i++) {
                        if (progressKeys.length >= i) {
                            dayCounts[i - 1]++;
                        }
                    }
                });

                const completionRate = totalUsers > 0 ? Math.round((completedUsers / totalUsers) * 100) : 0;

                // Find biggest dropoff day (biggest absolute difference between day X and day X+1)
                let dropOffDay = 0;
                let maxDrop = 0;
                for (let i = 0; i < dayCounts.length - 1; i++) {
                    const drop = dayCounts[i] - dayCounts[i + 1];
                    if (drop > maxDrop) {
                        maxDrop = drop;
                        dropOffDay = i + 1; // day 1 based
                    }
                }

                setStats({
                    totalUsers,
                    activeToday,
                    completionRate,
                    dropOffDay: dropOffDay || 1
                });

                // Build Chart Data
                const cData = dayCounts.map((count, index) => ({
                    day: `Day ${index + 1}`,
                    active: count
                }));

                setChartData(cData);

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
                                    <div className="stat-label">Active Users (Today)</div>
                                    <div className="stat-value">{stats.activeToday}</div>
                                </div>
                                <div className="stat-icon" style={{ color: 'var(--success)', background: '#ecfdf5', border: '1px solid #a7f3d0' }}><UserCheck size={20} /></div>
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
                                    <div className="stat-label">Biggest Drop-off</div>
                                    <div className="stat-value">Day {stats.dropOffDay}</div>
                                </div>
                                <div className="stat-icon" style={{ color: 'var(--danger)', background: '#fef2f2', border: '1px solid #fecaca' }}><TrendingDown size={20} /></div>
                            </div>
                        </div>
                    </div>

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
                </>
            )}
        </div>
    );
}
