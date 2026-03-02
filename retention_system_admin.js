/**
 * ============================================
 * RETENTION ADMIN PANEL - PART 5
 * Complete Admin Dashboard for Retention System
 * ============================================
 * 
 * Features:
 * - Analytics Dashboard (DAU, Deposits, Bonus Ratio, Segments)
 * - Segment Control (Manual upgrade/downgrade)
 * - Campaign Creator (CRUD)
 * - Economy Settings (Entry fee, Cashback %, Kill rewards, Bonus caps)
 * - Profit Protection Monitor (Real-time red alert)
 * - Manual Override Tools
 */

const el = React.createElement;

// ============================================
// MAIN RETENTION ADMIN COMPONENT
// ============================================

const RetentionSystemAdmin = () => {
  const [activeTab, setActiveTab] = React.useState('analytics');
  const [isLoading, setIsLoading] = React.useState(false);
  const [notification, setNotification] = React.useState(null);

  // Global stats for the dashboard
  const [globalStats, setGlobalStats] = React.useState({
    totalUsers: 0,
    dau: 0,
    totalDeposits: 0,
    bonusRatio: 0,
    segmentDistribution: { VIP: 0, Active: 0, Risk: 0, Churn: 0 },
    profitStatus: 'HEALTHY',
    isThrottled: false,
    isRedAlert: false,
  });

  // Auto-refresh stats every 30 seconds
  React.useEffect(() => {
    fetchGlobalStats();
    const interval = setInterval(fetchGlobalStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchGlobalStats = async () => {
    try {
      // Get segment distribution
      const segmentDist = await RetentionScoreEngine.getSegmentDistribution();
      
      // Get profit monitor status
      const profitStatus = await ProfitProtectionMonitor.getStatusForDashboard();
      
      // Get total user count
      const usersSnapshot = await db.collection('users').count().get();
      
      // Get DAU (users active today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dauSnapshot = await db.collection('users')
        .where('lastActiveAt', '>=', today)
        .count()
        .get();
      
      setGlobalStats({
        totalUsers: usersSnapshot.data().count || 0,
        dau: dauSnapshot.data().count || 0,
        totalDeposits: profitStatus['totalDeposits'] || 0,
        bonusRatio: profitStatus['bonusRatio'] || 0,
        segmentDistribution: segmentDist,
        profitStatus: profitStatus['status'] || 'HEALTHY',
        isThrottled: profitStatus['isThrottled'] || false,
        isRedAlert: profitStatus['isRedAlert'] || false,
      });
    } catch (error) {
      console.error('Error fetching global stats:', error);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Render notification
  const renderNotification = () => {
    if (!notification) return null;
    const colors = {
      info: 'bg-blue-500',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
    };
    return el('div', {
      className: `fixed top-4 right-4 ${colors[notification.type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`,
    }, notification.message);
  };

  return el('div', { className: 'p-6 max-w-7xl mx-auto' },
    renderNotification(),
    
    // Header
    el('div', { className: 'mb-8' },
      el('h1', { className: 'text-3xl font-bold text-white mb-2' }, 
        '🎯 Smart Retention & Monetization System'
      ),
      el('p', { className: 'text-gray-400' },
        'Advanced retention scoring, segment automation, campaign management, and profit protection'
      )
    ),

    // Red Alert Banner (if active)
    globalStats.isRedAlert && el('div', {
      className: 'bg-red-600 text-white p-4 rounded-lg mb-6 animate-pulse',
    },
      el('div', { className: 'flex items-center gap-3' },
        el('span', { className: 'text-2xl' }, '🚨'),
        el('div', null,
          el('h3', { className: 'font-bold text-lg' }, 'CRITICAL: Bonus Ratio Exceeded 15%!'),
          el('p', null, 'Immediate action required. Bonus distribution is currently blocked.')
        )
      )
    ),

    // Throttle Warning (if active)
    globalStats.isThrottled && !globalStats.isRedAlert && el('div', {
      className: 'bg-yellow-600 text-white p-4 rounded-lg mb-6',
    },
      el('div', { className: 'flex items-center gap-3' },
        el('span', { className: 'text-2xl' }, '⚠️'),
        el('div', null,
          el('h3', { className: 'font-bold' }, 'Warning: Bonus Distribution Throttled'),
          el('p', null, 'Bonus ratio approaching 15% limit. Auto-throttle is active.')
        )
      )
    ),

    // Quick Stats Row
    el('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6' },
      el(RetentionStatCard, {
        title: 'Total Users',
        value: globalStats.totalUsers.toLocaleString(),
        icon: '👥',
        color: 'blue',
      }),
      el(RetentionStatCard, {
        title: 'Daily Active',
        value: globalStats.dau.toLocaleString(),
        icon: '📱',
        color: 'green',
      }),
      el(RetentionStatCard, {
        title: 'Bonus Ratio',
        value: `${globalStats.bonusRatio.toFixed(2)}%`,
        icon: '💰',
        color: globalStats.bonusRatio > 14 ? 'red' : globalStats.bonusRatio > 12 ? 'yellow' : 'green',
        subtext: '/ 15% max',
      }),
      el(RetentionStatCard, {
        title: 'Status',
        value: globalStats.profitStatus,
        icon: globalStats.isRedAlert ? '🔴' : globalStats.isThrottled ? '🟡' : '🟢',
        color: globalStats.isRedAlert ? 'red' : globalStats.isThrottled ? 'yellow' : 'green',
      })
    ),

    // Navigation Tabs
    el('div', { className: 'flex flex-wrap gap-2 mb-6 border-b border-gray-700 pb-2' },
      el(TabButton, { active: activeTab === 'analytics', onClick: () => setActiveTab('analytics'), label: '📊 Analytics' }),
      el(TabButton, { active: activeTab === 'segments', onClick: () => setActiveTab('segments'), label: '👥 Segments' }),
      el(TabButton, { active: activeTab === 'campaigns', onClick: () => setActiveTab('campaigns'), label: '🎯 Campaigns' }),
      el(TabButton, { active: activeTab === 'economy', onClick: () => setActiveTab('economy'), label: '⚙️ Economy' }),
      el(TabButton, { active: activeTab === 'profit', onClick: () => setActiveTab('profit'), label: '🛡️ Profit Monitor' }),
    ),

    // Tab Content
    el('div', { className: 'mt-6' },
      activeTab === 'analytics' && el(AnalyticsDashboard, { stats: globalStats }),
      activeTab === 'segments' && el(SegmentControlPanel, { showNotification }),
      activeTab === 'campaigns' && el(CampaignManager, { showNotification }),
      activeTab === 'economy' && el(EconomySettings, { showNotification }),
      activeTab === 'profit' && el(ProfitMonitorPanel, { stats: globalStats }),
    )
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

const RetentionStatCard = ({ title, value, icon, color, subtext }) => {
  const colorClasses = {
    blue: 'bg-blue-900/50 border-blue-500',
    green: 'bg-green-900/50 border-green-500',
    yellow: 'bg-yellow-900/50 border-yellow-500',
    red: 'bg-red-900/50 border-red-500',
  };

  return el('div', {
    className: `${colorClasses[color]} border rounded-lg p-4`,
  },
    el('div', { className: 'flex items-center justify-between mb-2' },
      el('span', { className: 'text-2xl' }, icon),
      el('span', { className: 'text-xs text-gray-400 uppercase tracking-wide' }, title)
    ),
    el('div', { className: 'flex items-baseline gap-2' },
      el('span', { className: 'text-2xl font-bold text-white' }, value),
      subtext && el('span', { className: 'text-sm text-gray-400' }, subtext)
    )
  );
};

const TabButton = ({ active, onClick, label }) =>
  el('button', {
    onClick,
    className: `px-4 py-2 rounded-lg font-medium transition-colors ${
      active 
        ? 'bg-purple-600 text-white' 
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`,
  }, label);

// ============================================
// ANALYTICS DASHBOARD
// ============================================

const AnalyticsDashboard = ({ stats }) => {
  const [timeRange, setTimeRange] = React.useState('7d');
  const [chartData, setChartData] = React.useState([]);

  React.useEffect(() => {
    fetchChartData();
  }, [timeRange]);

  const fetchChartData = async () => {
    // Mock chart data - in production, fetch from Firestore
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        deposits: Math.floor(Math.random() * 5000) + 2000,
        bonuses: Math.floor(Math.random() * 500) + 100,
        dau: Math.floor(Math.random() * 200) + 100,
      });
    }
    setChartData(data);
  };

  return el('div', { className: 'space-y-6' },
    // Segment Distribution
    el('div', { className: 'bg-gray-800 rounded-lg p-6' },
      el('h3', { className: 'text-xl font-bold text-white mb-4' }, 'Segment Distribution'),
      el('div', { className: 'grid grid-cols-4 gap-4' },
        el(SegmentCard, {
          segment: 'VIP',
          count: stats.segmentDistribution.VIP || 0,
          color: 'purple',
          icon: '💎',
        }),
        el(SegmentCard, {
          segment: 'Active',
          count: stats.segmentDistribution.Active || 0,
          color: 'green',
          icon: '✅',
        }),
        el(SegmentCard, {
          segment: 'Risk',
          count: stats.segmentDistribution.Risk || 0,
          color: 'yellow',
          icon: '⚠️',
        }),
        el(SegmentCard, {
          segment: 'Churn',
          count: stats.segmentDistribution.Churn || 0,
          color: 'red',
          icon: '🔴',
        })
      )
    ),

    // Time Range Selector
    el('div', { className: 'flex gap-2' },
      ['7d', '30d', '90d'].map(range =>
        el('button', {
          key: range,
          onClick: () => setTimeRange(range),
          className: `px-4 py-2 rounded ${timeRange === range ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`,
        }, range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days')
      )
    ),

    // Simple Chart Display
    el('div', { className: 'bg-gray-800 rounded-lg p-6' },
      el('h3', { className: 'text-xl font-bold text-white mb-4' }, 'Deposit & Bonus Trends'),
      el('div', { className: 'h-64 overflow-x-auto' },
        el('div', { className: 'flex items-end h-48 gap-2 min-w-max px-4' },
          chartData.map((day, index) =>
            el('div', { key: index, className: 'flex flex-col items-center gap-1' },
              el('div', { className: 'flex gap-1' },
                el('div', {
                  className: 'w-8 bg-blue-500 rounded-t',
                  style: { height: `${(day.deposits / 7000) * 100}%` },
                }),
                el('div', {
                  className: 'w-8 bg-red-500 rounded-t',
                  style: { height: `${(day.bonuses / 7000) * 100}%` },
                })
              ),
              el('span', { className: 'text-xs text-gray-400 rotate-45 origin-left mt-2' }, day.date)
            )
          )
        )
      ),
      el('div', { className: 'flex gap-6 mt-4 justify-center' },
        el('div', { className: 'flex items-center gap-2' },
          el('div', { className: 'w-4 h-4 bg-blue-500 rounded' }),
          el('span', { className: 'text-sm text-gray-400' }, 'Deposits')
        ),
        el('div', { className: 'flex items-center gap-2' },
          el('div', { className: 'w-4 h-4 bg-red-500 rounded' }),
          el('span', { className: 'text-sm text-gray-400' }, 'Bonuses')
        )
      )
    ),

    // Key Metrics
    el('div', { className: 'grid grid-cols-3 gap-4' },
      el(MetricCard, { title: 'Avg Retention Score', value: '67.5', change: '+2.3%', positive: true }),
      el(MetricCard, { title: 'Conversion Rate', value: '34.2%', change: '-1.2%', positive: false }),
      el(MetricCard, { title: 'Churn Recovery', value: '12.8%', change: '+5.4%', positive: true })
    )
  );
};

const SegmentCard = ({ segment, count, color, icon }) => {
  const colorClasses = {
    purple: 'bg-purple-900/30 border-purple-500 text-purple-400',
    green: 'bg-green-900/30 border-green-500 text-green-400',
    yellow: 'bg-yellow-900/30 border-yellow-500 text-yellow-400',
    red: 'bg-red-900/30 border-red-500 text-red-400',
  };

  return el('div', {
    className: `${colorClasses[color]} border rounded-lg p-4 text-center`,
  },
    el('div', { className: 'text-3xl mb-2' }, icon),
    el('div', { className: 'text-2xl font-bold' }, count.toLocaleString()),
    el('div', { className: 'text-sm font-medium' }, segment)
  );
};

const MetricCard = ({ title, value, change, positive }) =>
  el('div', { className: 'bg-gray-800 rounded-lg p-4' },
    el('h4', { className: 'text-gray-400 text-sm mb-2' }, title),
    el('div', { className: 'flex items-baseline gap-3' },
      el('span', { className: 'text-2xl font-bold text-white' }, value),
      el('span', { className: `text-sm ${positive ? 'text-green-400' : 'text-red-400'}` },
        `${positive ? '↑' : '↓'} ${change}`
      )
    )
  );

// ============================================
// SEGMENT CONTROL PANEL
// ============================================

const SegmentControlPanel = ({ showNotification }) => {
  const [searchEmail, setSearchEmail] = React.useState('');
  const [userData, setUserData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedSegment, setSelectedSegment] = React.useState('');
  const [overrideReason, setOverrideReason] = React.useState('');

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    
    setIsLoading(true);
    try {
      const userQuery = await db.collection('users')
        .where('email', '==', searchEmail.trim())
        .limit(1)
        .get();

      if (userQuery.empty) {
        showNotification('User not found', 'error');
        setUserData(null);
        return;
      }

      const userDoc = userQuery.docs[0];
      const userId = userDoc.id;
      
      // Get retention stats
      const retentionDoc = await db.collection('users')
        .doc(userId)
        .collection('retentionStats')
        .doc('stats')
        .get();

      const stats = retentionDoc.data() || {};
      
      setUserData({
        id: userId,
        ...userDoc.data(),
        retentionScore: stats.retentionScore || 0,
        segment: stats.segment || 'Active',
        vipTier: stats.vipTier || 0,
        totalDeposit: stats.totalDeposit || 0,
        tournamentsPlayed: stats.tournamentsPlayed || 0,
        inactiveDays: stats.inactiveDays || 0,
      });
      setSelectedSegment(stats.segment || 'Active');
      
    } catch (error) {
      showNotification('Error searching user: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const overrideSegment = async () => {
    if (!userData || !overrideReason.trim()) {
      showNotification('Please provide a reason for the override', 'error');
      return;
    }

    try {
      // Call the override function from RetentionScoreEngine
      const result = await RetentionScoreEngine.overrideSegment(
        userData.id,
        selectedSegment,
        overrideReason,
        'admin' // Current admin ID should be passed here
      );

      if (result) {
        showNotification(`Segment updated to ${selectedSegment} successfully!`, 'success');
        setUserData({ ...userData, segment: selectedSegment });
        setOverrideReason('');
      } else {
        showNotification('Failed to update segment', 'error');
      }
    } catch (error) {
      showNotification('Error updating segment: ' + error.message, 'error');
    }
  };

  return el('div', { className: 'space-y-6' },
    // Search Section
    el('div', { className: 'bg-gray-800 rounded-lg p-6' },
      el('h3', { className: 'text-xl font-bold text-white mb-4' }, 'User Segment Control'),
      el('div', { className: 'flex gap-4' },
        el('input', {
          type: 'email',
          placeholder: 'Search by email...',
          value: searchEmail,
          onChange: (e) => setSearchEmail(e.target.value),
          className: 'flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400',
        }),
        el('button', {
          onClick: searchUser,
          disabled: isLoading,
          className: 'bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50',
        }, isLoading ? 'Searching...' : 'Search')
      )
    ),

    // User Details & Override
    userData && el('div', { className: 'bg-gray-800 rounded-lg p-6' },
      el('div', { className: 'grid grid-cols-2 gap-6 mb-6' },
        el('div', null,
          el('h4', { className: 'text-gray-400 text-sm mb-1' }, 'User'),
          el('p', { className: 'text-white font-medium' }, userData.name || userData.email),
          el('p', { className: 'text-gray-400 text-sm' }, userData.email)
        ),
        el('div', null,
          el('h4', { className: 'text-gray-400 text-sm mb-1' }, 'Current Segment'),
          el('span', {
            className: `inline-block px-3 py-1 rounded-full text-sm font-medium ${
              userData.segment === 'VIP' ? 'bg-purple-600 text-white' :
              userData.segment === 'Active' ? 'bg-green-600 text-white' :
              userData.segment === 'Risk' ? 'bg-yellow-600 text-white' :
              'bg-red-600 text-white'
            }`,
          }, userData.segment === 'VIP' ? `VIP Tier ${userData.vipTier}` : userData.segment)
        ),
        el('div', null,
          el('h4', { className: 'text-gray-400 text-sm mb-1' }, 'Retention Score'),
          el('p', { className: 'text-2xl font-bold text-white' }, userData.retentionScore.toFixed(1))
        ),
        el('div', null,
          el('h4', { className: 'text-gray-400 text-sm mb-1' }, 'Total Deposit'),
          el('p', { className: 'text-2xl font-bold text-white' }, `₹${userData.totalDeposit.toLocaleString()}`)
        ),
        el('div', null,
          el('h4', { className: 'text-gray-400 text-sm mb-1' }, 'Tournaments Played'),
          el('p', { className: 'text-white' }, userData.tournamentsPlayed)
        ),
        el('div', null,
          el('h4', { className: 'text-gray-400 text-sm mb-1' }, 'Inactive Days'),
          el('p', { className: userData.inactiveDays > 7 ? 'text-red-400' : 'text-white' },
            userData.inactiveDays)
        )
      ),

      // Override Section
      el('div', { className: 'border-t border-gray-700 pt-6 mt-6' },
        el('h4', { className: 'text-lg font-bold text-white mb-4' }, 'Manual Segment Override'),
        el('div', { className: 'grid grid-cols-2 gap-4 mb-4' },
          el('div', null,
            el('label', { className: 'block text-gray-400 text-sm mb-2' }, 'New Segment'),
            el('select', {
              value: selectedSegment,
              onChange: (e) => setSelectedSegment(e.target.value),
              className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
            },
              el('option', { value: 'VIP' }, 'VIP'),
              el('option', { value: 'Active' }, 'Active'),
              el('option', { value: 'Risk' }, 'Risk'),
              el('option', { value: 'Churn' }, 'Churn')
            )
          ),
          el('div', null,
            el('label', { className: 'block text-gray-400 text-sm mb-2' }, 'Reason for Override'),
            el('input', {
              type: 'text',
              placeholder: 'e.g., Manual VIP upgrade for high value user',
              value: overrideReason,
              onChange: (e) => setOverrideReason(e.target.value),
              className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400',
            })
          )
        ),
        el('button', {
          onClick: overrideSegment,
          disabled: selectedSegment === userData.segment || !overrideReason.trim(),
          className: 'w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed',
        }, 'Override Segment')
      )
    )
  );
};

// ============================================
// CAMPAIGN MANAGER
// ============================================

const CampaignManager = ({ showNotification }) => {
  const [campaigns, setCampaigns] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [editingCampaign, setEditingCampaign] = React.useState(null);

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    bonusPercent: 10,
    minDeposit: 50,
    maxBonusAmount: 100,
    targetSegments: ['Active'],
    expiresAt: '',
    usageLimit: '',
    autoApply: true,
  });

  React.useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const snapshot = await db.collection('campaigns')
        .orderBy('createdAt', 'desc')
        .get();
      
      const campaignsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate(),
      }));
      
      setCampaigns(campaignsList);
    } catch (error) {
      showNotification('Error loading campaigns', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const createCampaign = async () => {
    try {
      await db.collection('campaigns').add({
        ...formData,
        isActive: true,
        usageCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromDate(new Date(formData.expiresAt)),
        createdBy: 'admin',
      });
      
      showNotification('Campaign created successfully!', 'success');
      setShowCreateModal(false);
      resetForm();
      loadCampaigns();
    } catch (error) {
      showNotification('Error creating campaign: ' + error.message, 'error');
    }
  };

  const toggleCampaignStatus = async (campaignId, currentStatus) => {
    try {
      await db.collection('campaigns').doc(campaignId).update({
        isActive: !currentStatus,
      });
      showNotification(`Campaign ${currentStatus ? 'paused' : 'activated'}`, 'success');
      loadCampaigns();
    } catch (error) {
      showNotification('Error updating campaign', 'error');
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await db.collection('campaigns').doc(campaignId).delete();
      showNotification('Campaign deleted', 'success');
      loadCampaigns();
    } catch (error) {
      showNotification('Error deleting campaign', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      bonusPercent: 10,
      minDeposit: 50,
      maxBonusAmount: 100,
      targetSegments: ['Active'],
      expiresAt: '',
      usageLimit: '',
      autoApply: true,
    });
  };

  return el('div', { className: 'space-y-6' },
    // Header with Create Button
    el('div', { className: 'flex justify-between items-center' },
      el('h3', { className: 'text-xl font-bold text-white' }, 'Campaign Manager'),
      el('button', {
        onClick: () => setShowCreateModal(true),
        className: 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium',
      }, '+ Create Campaign')
    ),

    // Campaigns List
    el('div', { className: 'bg-gray-800 rounded-lg overflow-hidden' },
      el('table', { className: 'w-full' },
        el('thead', { className: 'bg-gray-700' },
          el('tr', null,
            el('th', { className: 'text-left px-4 py-3 text-gray-400 font-medium' }, 'Campaign'),
            el('th', { className: 'text-left px-4 py-3 text-gray-400 font-medium' }, 'Bonus'),
            el('th', { className: 'text-left px-4 py-3 text-gray-400 font-medium' }, 'Target'),
            el('th', { className: 'text-left px-4 py-3 text-gray-400 font-medium' }, 'Status'),
            el('th', { className: 'text-left px-4 py-3 text-gray-400 font-medium' }, 'Usage'),
            el('th', { className: 'text-left px-4 py-3 text-gray-400 font-medium' }, 'Actions')
          )
        ),
        el('tbody', null,
          campaigns.length === 0 
            ? el('tr', null, el('td', { colSpan: 6, className: 'px-4 py-8 text-center text-gray-400' },
              isLoading ? 'Loading...' : 'No campaigns yet. Create your first campaign!'
            ))
            : campaigns.map(campaign =>
                el('tr', { key: campaign.id, className: 'border-t border-gray-700' },
                  el('td', { className: 'px-4 py-3' },
                    el('div', null,
                      el('p', { className: 'font-medium text-white' }, campaign.name),
                      el('p', { className: 'text-sm text-gray-400' }, campaign.description)
                    )
                  ),
                  el('td', { className: 'px-4 py-3' },
                    el('div', null,
                      el('p', { className: 'text-white' }, `${campaign.bonusPercent}% up to ₹${campaign.maxBonusAmount}`),
                      el('p', { className: 'text-sm text-gray-400' }, `Min: ₹${campaign.minDeposit}`)
                    )
                  ),
                  el('td', { className: 'px-4 py-3' },
                    el('div', { className: 'flex gap-1 flex-wrap' },
                      campaign.targetSegments.map(seg =>
                        el('span', {
                          key: seg,
                          className: 'text-xs px-2 py-1 rounded bg-gray-700 text-gray-300',
                        }, seg)
                      )
                    )
                  ),
                  el('td', { className: 'px-4 py-3' },
                    el('span', {
                      className: `px-2 py-1 rounded-full text-xs font-medium ${
                        campaign.isActive ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
                      }`,
                    }, campaign.isActive ? 'Active' : 'Paused')
                  ),
                  el('td', { className: 'px-4 py-3 text-white' },
                    `${campaign.usageCount}${campaign.usageLimit ? '/' + campaign.usageLimit : ''}`
                  ),
                  el('td', { className: 'px-4 py-3' },
                    el('div', { className: 'flex gap-2' },
                      el('button', {
                        onClick: () => toggleCampaignStatus(campaign.id, campaign.isActive),
                        className: 'text-blue-400 hover:text-blue-300 text-sm',
                      }, campaign.isActive ? 'Pause' : 'Activate'),
                      el('button', {
                        onClick: () => deleteCampaign(campaign.id),
                        className: 'text-red-400 hover:text-red-300 text-sm',
                      }, 'Delete')
                    )
                  )
                )
              )
        )
      )
    ),

    // Create Campaign Modal
    showCreateModal && el('div', { className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50' },
      el('div', { className: 'bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto' },
        el('h3', { className: 'text-xl font-bold text-white mb-4' }, 'Create New Campaign'),
        
        el('div', { className: 'space-y-4' },
          el('div', null,
            el('label', { className: 'block text-gray-400 text-sm mb-1' }, 'Campaign Name'),
            el('input', {
              type: 'text',
              value: formData.name,
              onChange: (e) => setFormData({ ...formData, name: e.target.value }),
              className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
              placeholder: 'e.g., Weekend Deposit Bonus',
            })
          ),
          
          el('div', null,
            el('label', { className: 'block text-gray-400 text-sm mb-1' }, 'Description'),
            el('input', {
              type: 'text',
              value: formData.description,
              onChange: (e) => setFormData({ ...formData, description: e.target.value }),
              className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
              placeholder: 'e.g., Get 20% bonus on deposits this weekend!',
            })
          ),

          el('div', { className: 'grid grid-cols-3 gap-4' },
            el('div', null,
              el('label', { className: 'block text-gray-400 text-sm mb-1' }, 'Bonus %'),
              el('input', {
                type: 'number',
                value: formData.bonusPercent,
                onChange: (e) => setFormData({ ...formData, bonusPercent: parseInt(e.target.value) }),
                className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
                min: 1,
                max: 100,
              })
            ),
            el('div', null,
              el('label', { className: 'block text-gray-400 text-sm mb-1' }, 'Min Deposit (₹)'),
              el('input', {
                type: 'number',
                value: formData.minDeposit,
                onChange: (e) => setFormData({ ...formData, minDeposit: parseInt(e.target.value) }),
                className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
                min: 0,
              })
            ),
            el('div', null,
              el('label', { className: 'block text-gray-400 text-sm mb-1' }, 'Max Bonus (₹)'),
              el('input', {
                type: 'number',
                value: formData.maxBonusAmount,
                onChange: (e) => setFormData({ ...formData, maxBonusAmount: parseInt(e.target.value) }),
                className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
                min: 1,
              })
            )
          ),

          el('div', null,
            el('label', { className: 'block text-gray-400 text-sm mb-2' }, 'Target Segments'),
            el('div', { className: 'flex gap-3' },
              ['VIP', 'Active', 'Risk', 'Churn'].map(seg =>
                el('label', { key: seg, className: 'flex items-center gap-2 cursor-pointer' },
                  el('input', {
                    type: 'checkbox',
                    checked: formData.targetSegments.includes(seg),
                    onChange: (e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, targetSegments: [...formData.targetSegments, seg] });
                      } else {
                        setFormData({ ...formData, targetSegments: formData.targetSegments.filter(s => s !== seg) });
                      }
                    },
                    className: 'w-4 h-4 rounded',
                  }),
                  el('span', { className: 'text-white' }, seg)
                )
              )
            )
          ),

          el('div', { className: 'grid grid-cols-2 gap-4' },
            el('div', null,
              el('label', { className: 'block text-gray-400 text-sm mb-1' }, 'Expires At'),
              el('input', {
                type: 'datetime-local',
                value: formData.expiresAt,
                onChange: (e) => setFormData({ ...formData, expiresAt: e.target.value }),
                className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
              })
            ),
            el('div', null,
              el('label', { className: 'block text-gray-400 text-sm mb-1' }, 'Usage Limit (optional)'),
              el('input', {
                type: 'number',
                value: formData.usageLimit,
                onChange: (e) => setFormData({ ...formData, usageLimit: e.target.value ? parseInt(e.target.value) : '' }),
                className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white',
                placeholder: 'No limit',
              })
            )
          ),

          el('label', { className: 'flex items-center gap-2 cursor-pointer' },
            el('input', {
              type: 'checkbox',
              checked: formData.autoApply,
              onChange: (e) => setFormData({ ...formData, autoApply: e.target.checked }),
              className: 'w-4 h-4 rounded',
            }),
            el('span', { className: 'text-white' }, 'Auto-apply on qualifying deposits')
          )
        ),

        el('div', { className: 'flex gap-3 mt-6' },
          el('button', {
            onClick: () => { setShowCreateModal(false); resetForm(); },
            className: 'flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg',
          }, 'Cancel'),
          el('button', {
            onClick: createCampaign,
            disabled: !formData.name || !formData.expiresAt,
            className: 'flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50',
          }, 'Create Campaign')
        )
      )
    )
  );
};

// ============================================
// ECONOMY SETTINGS
// ============================================

const EconomySettings = ({ showNotification }) => {
  const [settings, setSettings] = React.useState({
    entryFeeMultiplier: 1.0,
    cashbackPercent: 25,
    killRewardBase: 10,
    maxBonusPerUser: 500,
    vipWeeklyCashbackEnabled: true,
    riskInterventionEnabled: true,
    churnRecoveryEnabled: true,
    autoThrottleEnabled: true,
  });
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const doc = await db.collection('retentionEngine').doc('config').get();
      if (doc.exists) {
        setSettings({ ...settings, ...doc.data() });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await db.collection('retentionEngine').doc('config').set({
        ...settings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'admin',
      }, { merge: true });
      
      showNotification('Economy settings saved successfully!', 'success');
    } catch (error) {
      showNotification('Error saving settings: ' + error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const SettingRow = ({ label, description, children }) =>
    el('div', { className: 'flex items-center justify-between py-4 border-b border-gray-700 last:border-0' },
      el('div', null,
        el('h4', { className: 'font-medium text-white' }, label),
        el('p', { className: 'text-sm text-gray-400' }, description)
      ),
      children
    );

  return el('div', { className: 'bg-gray-800 rounded-lg p-6' },
    el('h3', { className: 'text-xl font-bold text-white mb-6' }, 'Economy Settings'),
    
    el('div', { className: 'space-y-2' },
      el(SettingRow, {
        label: 'Entry Fee Multiplier',
        description: 'Global multiplier for all tournament entry fees (1.0 = normal, 0.9 = 10% discount)',
      },
        el('input', {
          type: 'number',
          step: 0.1,
          min: 0.5,
          max: 2.0,
          value: settings.entryFeeMultiplier,
          onChange: (e) => setSettings({ ...settings, entryFeeMultiplier: parseFloat(e.target.value) }),
          className: 'w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-center',
        })
      ),

      el(SettingRow, {
        label: 'Cashback Percentage',
        description: 'Percentage of entry fee returned as cashback after consecutive losses',
      },
        el('div', { className: 'flex items-center gap-2' },
          el('input', {
            type: 'number',
            min: 0,
            max: 50,
            value: settings.cashbackPercent,
            onChange: (e) => setSettings({ ...settings, cashbackPercent: parseInt(e.target.value) }),
            className: 'w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-center',
          }),
          el('span', { className: 'text-gray-400' }, '%')
        )
      ),

      el(SettingRow, {
        label: 'Kill Reward Base',
        description: 'Base amount for kill rewards in tournaments',
      },
        el('div', { className: 'flex items-center gap-2' },
          el('span', { className: 'text-gray-400' }, '₹'),
          el('input', {
            type: 'number',
            min: 5,
            max: 100,
            value: settings.killRewardBase,
            onChange: (e) => setSettings({ ...settings, killRewardBase: parseInt(e.target.value) }),
            className: 'w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-center',
          })
        )
      ),

      el(SettingRow, {
        label: 'Max Bonus Per User',
        description: 'Maximum bonus amount a single user can receive per month',
      },
        el('div', { className: 'flex items-center gap-2' },
          el('span', { className: 'text-gray-400' }, '₹'),
          el('input', {
            type: 'number',
            min: 100,
            max: 5000,
            value: settings.maxBonusPerUser,
            onChange: (e) => setSettings({ ...settings, maxBonusPerUser: parseInt(e.target.value) }),
            className: 'w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-center',
          })
        )
      ),

      el('div', { className: 'pt-4 border-t border-gray-700' },
        el('h4', { className: 'font-medium text-white mb-4' }, 'Feature Toggles'),
        
        el('div', { className: 'space-y-3' },
          el('label', { className: 'flex items-center justify-between cursor-pointer' },
            el('span', { className: 'text-gray-300' }, 'VIP Weekly Cashback'),
            el('input', {
              type: 'checkbox',
              checked: settings.vipWeeklyCashbackEnabled,
              onChange: (e) => setSettings({ ...settings, vipWeeklyCashbackEnabled: e.target.checked }),
              className: 'w-5 h-5 rounded',
            })
          ),
          
          el('label', { className: 'flex items-center justify-between cursor-pointer' },
            el('span', { className: 'text-gray-300' }, 'Risk User Intervention'),
            el('input', {
              type: 'checkbox',
              checked: settings.riskInterventionEnabled,
              onChange: (e) => setSettings({ ...settings, riskInterventionEnabled: e.target.checked }),
              className: 'w-5 h-5 rounded',
            })
          ),
          
          el('label', { className: 'flex items-center justify-between cursor-pointer' },
            el('span', { className: 'text-gray-300' }, 'Churn Recovery System'),
            el('input', {
              type: 'checkbox',
              checked: settings.churnRecoveryEnabled,
              onChange: (e) => setSettings({ ...settings, churnRecoveryEnabled: e.target.checked }),
              className: 'w-5 h-5 rounded',
            })
          ),
          
          el('label', { className: 'flex items-center justify-between cursor-pointer' },
            el('span', { className: 'text-gray-300' }, 'Auto-Throttle at 14%'),
            el('input', {
              type: 'checkbox',
              checked: settings.autoThrottleEnabled,
              onChange: (e) => setSettings({ ...settings, autoThrottleEnabled: e.target.checked }),
              className: 'w-5 h-5 rounded',
            })
          )
        )
      )
    ),

    el('button', {
      onClick: saveSettings,
      disabled: isSaving,
      className: 'w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50',
    }, isSaving ? 'Saving...' : 'Save Economy Settings')
  );
};

// ============================================
// PROFIT MONITOR PANEL
// ============================================

const ProfitMonitorPanel = ({ stats }) => {
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    // Load recent bonus/deposit transactions
    try {
      const snapshot = await db.collection('transactions')
        .where('type', 'in', ['campaign_bonus', 'vip_cashback', 'cashback'])
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      }));
      
      setHistory(transactions);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'HEALTHY': return 'text-green-400';
      case 'WARNING': return 'text-yellow-400';
      case 'THROTTLED': return 'text-orange-400';
      case 'CRITICAL': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return el('div', { className: 'space-y-6' },
    // Status Overview
    el('div', { className: 'bg-gray-800 rounded-lg p-6' },
      el('h3', { className: 'text-xl font-bold text-white mb-4' }, 'Profit Protection Monitor'),
      
      el('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6' },
        el(RetentionStatCard, {
          title: 'Total Deposits',
          value: `₹${(stats.totalDeposits || 0).toLocaleString()}`,
          icon: '💰',
          color: 'blue',
        }),
        el(RetentionStatCard, {
          title: 'Total Bonuses',
          value: `₹${(stats.totalDeposits * (stats.bonusRatio / 100) || 0).toLocaleString()}`,
          icon: '🎁',
          color: 'purple',
        }),
        el(RetentionStatCard, {
          title: 'Current Ratio',
          value: `${(stats.bonusRatio || 0).toFixed(2)}%`,
          icon: '📊',
          color: stats.bonusRatio > 14 ? 'red' : stats.bonusRatio > 12 ? 'yellow' : 'green',
        }),
        el(RetentionStatCard, {
          title: 'Remaining Budget',
          value: `₹${((stats.totalDeposits * 0.15) - (stats.totalDeposits * (stats.bonusRatio / 100)) || 0).toLocaleString()}`,
          icon: '💵',
          color: 'green',
        })
      ),

      // Status Indicator
      el('div', { className: 'bg-gray-900 rounded-lg p-4' },
        el('div', { className: 'flex items-center justify-between mb-2' },
          el('span', { className: 'text-gray-400' }, 'System Status'),
          el('span', { className: `font-bold text-lg ${getStatusColor(stats.profitStatus)}` },
            stats.profitStatus
          )
        ),
        
        // Progress Bar
        el('div', { className: 'relative h-4 bg-gray-700 rounded-full overflow-hidden' },
          el('div', {
            className: `h-full transition-all ${
              stats.bonusRatio > 14 ? 'bg-red-500' :
              stats.bonusRatio > 12 ? 'bg-yellow-500' :
              'bg-green-500'
            }`,
            style: { width: `${Math.min(stats.bonusRatio / 15 * 100, 100)}%` },
          }),
          // Threshold markers
          el('div', { className: 'absolute top-0 bottom-0 w-0.5 bg-white/50', style: { left: '80%' } },
            el('span', { className: 'absolute -top-5 left-0 text-xs text-gray-400 transform -translate-x-1/2' }, '12%')
          ),
          el('div', { className: 'absolute top-0 bottom-0 w-0.5 bg-white/50', style: { left: '93.33%' } },
            el('span', { className: 'absolute -top-5 left-0 text-xs text-gray-400 transform -translate-x-1/2' }, '14%')
          ),
        ),
        
        el('div', { className: 'flex justify-between mt-2 text-xs text-gray-400' },
          el('span', null, '0%'),
          el('span', null, '7.5%'),
          el('span', { className: stats.bonusRatio > 14 ? 'text-red-400 font-bold' : '' }, '15% (MAX)')
        )
      ),

      // Threshold Explanations
      el('div', { className: 'grid grid-cols-3 gap-4 mt-6' },
        el('div', { className: 'bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3' },
          el('h4', { className: 'text-yellow-400 font-medium mb-1' }, '⚠️ Warning (12%)'),
          el('p', { className: 'text-sm text-gray-400' }, 'Admin notification sent when ratio exceeds 12%')
        ),
        el('div', { className: 'bg-orange-900/20 border border-orange-600/30 rounded-lg p-3' },
          el('h4', { className: 'text-orange-400 font-medium mb-1' }, '🛑 Throttle (14%)'),
          el('p', { className: 'text-sm text-gray-400' }, 'Auto-throttle activates, bonus approval required')
        ),
        el('div', { className: 'bg-red-900/20 border border-red-600/30 rounded-lg p-3' },
          el('h4', { className: 'text-red-400 font-medium mb-1' }, '🚨 Critical (15%)'),
          el('p', { className: 'text-sm text-gray-400' }, 'All bonus distribution blocked until deposits increase')
        )
      )
    ),

    // Recent Bonus Transactions
    el('div', { className: 'bg-gray-800 rounded-lg p-6' },
      el('h3', { className: 'text-lg font-bold text-white mb-4' }, 'Recent Bonus Transactions'),
      
      history.length === 0 
        ? el('p', { className: 'text-gray-400 text-center py-8' }, 'No bonus transactions yet')
        : el('div', { className: 'overflow-x-auto' },
            el('table', { className: 'w-full' },
              el('thead', null,
                el('tr', { className: 'text-left text-gray-400 text-sm' },
                  el('th', { className: 'pb-2' }, 'Time'),
                  el('th', { className: 'pb-2' }, 'Type'),
                  el('th', { className: 'pb-2' }, 'Amount'),
                  el('th', { className: 'pb-2' }, 'User')
                )
              ),
              el('tbody', null,
                history.map(txn =>
                  el('tr', { key: txn.id, className: 'border-t border-gray-700' },
                    el('td', { className: 'py-3 text-gray-300 text-sm' },
                      txn.timestamp?.toLocaleString() || 'N/A'
                    ),
                    el('td', { className: 'py-3' },
                      el('span', {
                        className: 'px-2 py-1 rounded text-xs font-medium ' +
                          (txn.type === 'vip_cashback' ? 'bg-purple-900/50 text-purple-400' :
                           txn.type === 'campaign_bonus' ? 'bg-blue-900/50 text-blue-400' :
                           'bg-green-900/50 text-green-400'),
                      }, txn.type)
                    ),
                    el('td', { className: 'py-3 text-white font-medium' }, `₹${txn.amount}`),
                    el('td', { className: 'py-3 text-gray-400 text-sm' },
                      txn.userId?.substring(0, 8) + '...'
                    )
                  )
                )
              )
            )
          )
    )
  );
};

// Make component available globally
window.RetentionAdmin = RetentionSystemAdmin;
