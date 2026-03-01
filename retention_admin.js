/**
 * ===========================================
 * RETENTION SYSTEM ADMIN CONTROLS
 * ===========================================
 * 
 * Admin panel controls for the retention and redeposit optimization engine.
 * Add this to your admin panel to manage user retention stats.
 */

// Retention Admin Component
const RetentionAdmin = () => {
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [userStats, setUserStats] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [searchEmail, setSearchEmail] = React.useState('');
  const [allUsersStats, setAllUsersStats] = React.useState([]);
  const [activeTab, setActiveTab] = React.useState('overview');

  // Fetch user stats by email
  const searchUser = async () => {
    if (!searchEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      // Find user by email
      const userQuery = await db.collection('users')
        .where('email', '==', searchEmail.trim())
        .get();

      if (userQuery.empty) {
        alert('User not found');
        setLoading(false);
        return;
      }

      const userDoc = userQuery.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      setSelectedUser({ id: userId, ...userData });

      // Fetch user stats
      const statsDoc = await db.collection('users')
        .doc(userId)
        .collection('userStats')
        .doc('stats')
        .get();

      if (statsDoc.exists) {
        setUserStats(statsDoc.data());
      } else {
        setUserStats(null);
        alert('User stats not found - will be created on next login');
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  // Update user stats
  const updateUserStats = async (updates) => {
    if (!selectedUser) return;

    try {
      const statsRef = db.collection('users')
        .doc(selectedUser.id)
        .collection('userStats')
        .doc('stats');

      await statsRef.update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Refresh stats
      const statsDoc = await statsRef.get();
      setUserStats(statsDoc.data());

      alert('User stats updated successfully!');
    } catch (error) {
      console.error('Error updating stats:', error);
      alert('Error: ' + error.message);
    }
  };

  // Grant retry token
  const grantRetryToken = () => {
    updateUserStats({
      retryTokens: firebase.firestore.FieldValue.increment(1)
    });
  };

  // Grant cashback eligibility
  const grantCashback = () => {
    updateUserStats({
      cashbackEligible: true,
      consecutiveLosses: 2
    });
  };

  // Reset consecutive losses
  const resetLosses = () => {
    updateUserStats({
      consecutiveLosses: 0,
      cashbackEligible: false
    });
  };

  // Add points to user
  const addPoints = (points) => {
    updateUserStats({
      points: firebase.firestore.FieldValue.increment(points),
      totalPointsEarned: firebase.firestore.FieldValue.increment(points)
    });
  };

  // Set user level
  const setLevel = (level) => {
    const levelTitles = [
      'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond',
      'Master', 'Grandmaster', 'Legend', 'Mythic', 'Immortal'
    ];
    const title = levelTitles[level - 1] || 'Bronze';

    updateUserStats({
      level: level,
      levelTitle: title
    });
  };

  // Fetch all users stats for leaderboard
  const fetchAllUsersStats = async () => {
    setLoading(true);
    try {
      const usersSnapshot = await db.collection('users').get();
      const statsPromises = usersSnapshot.docs.map(async (userDoc) => {
        const statsDoc = await db.collection('users')
          .doc(userDoc.id)
          .collection('userStats')
          .doc('stats')
          .get();

        return {
          userId: userDoc.id,
          userName: userDoc.data().name,
          email: userDoc.data().email,
          stats: statsDoc.exists ? statsDoc.data() : null
        };
      });

      const allStats = await Promise.all(statsPromises);
      setAllUsersStats(allStats.filter(s => s.stats !== null));
    } catch (error) {
      console.error('Error fetching all stats:', error);
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  // Send retention push notification
  const sendRetentionPush = async (type) => {
    if (!selectedUser) {
      alert('Please select a user first');
      return;
    }

    try {
      // Create notification
      await db.collection('notifications').add({
        userId: selectedUser.id,
        title: type === 'comeback' ? '🎮 We Miss You!' : '🔥 Special Reload Bonus!',
        message: type === 'comeback' 
          ? 'Come back and claim your daily login bonus!'
          : 'Get bonus coins on your next deposit!',
        type: 'retention_' + type,
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert('Retention push notification sent!');
    } catch (error) {
      console.error('Error sending push:', error);
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-white">🎮 Retention System Admin</h2>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        {['overview', 'user-management', 'leaderboard'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab
                ? 'bg-cyan-500 text-gray-900'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            {tab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* User Search */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-3 text-white">Search User</h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="Enter user email..."
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={searchUser}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500 text-gray-900 rounded-lg font-medium hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* User Stats Display */}
      {userStats && (
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">{selectedUser?.name}</h3>
              <p className="text-gray-400">{selectedUser?.email}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-cyan-400">
                {userStats.levelTitle} (Lvl {userStats.level})
              </span>
              <p className="text-gray-400">{userStats.totalPointsEarned} points</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Consecutive Losses"
              value={userStats.consecutiveLosses}
              color={userStats.consecutiveLosses >= 2 ? 'text-red-400' : 'text-white'}
            />
            <StatCard
              label="Retry Tokens"
              value={userStats.retryTokens}
              color="text-purple-400"
            />
            <StatCard
              label="Current Streak"
              value={userStats.currentStreak}
              color="text-orange-400"
            />
            <StatCard
              label="Tournaments Won"
              value={userStats.tournamentsWon}
              color="text-green-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ActionButton
              onClick={grantRetryToken}
              label="🎫 Grant Retry Token"
              color="purple"
            />
            <ActionButton
              onClick={grantCashback}
              label="🎁 Grant Cashback"
              color="green"
            />
            <ActionButton
              onClick={resetLosses}
              label="🔄 Reset Losses"
              color="blue"
            />
            <ActionButton
              onClick={() => addPoints(50)}
              label="⭐ Add 50 Points"
              color="yellow"
            />
            <ActionButton
              onClick={() => setLevel(Math.min(userStats.level + 1, 10))}
              label="⬆️ Level Up"
              color="cyan"
            />
            <ActionButton
              onClick={() => sendRetentionPush('comeback')}
              label="📱 Send Comeback Push"
              color="pink"
            />
          </div>
        </div>
      )}

      {/* Leaderboard View */}
      {activeTab === 'leaderboard' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">User Leaderboard</h3>
            <button
              onClick={fetchAllUsersStats}
              disabled={loading}
              className="px-4 py-2 bg-cyan-500 text-gray-900 rounded-lg font-medium hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {allUsersStats.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-2">User</th>
                    <th className="pb-2">Level</th>
                    <th className="pb-2">Points</th>
                    <th className="pb-2">Streak</th>
                    <th className="pb-2">Wins</th>
                    <th className="pb-2">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsersStats
                    .sort((a, b) => (b.stats?.totalPointsEarned || 0) - (a.stats?.totalPointsEarned || 0))
                    .map((user, index) => (
                      <tr key={user.userId} className="border-b border-gray-700">
                        <td className="py-3">
                          <div>
                            <div className="text-white font-medium">{user.userName}</div>
                            <div className="text-gray-400 text-sm">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">
                            {user.stats?.levelTitle} ({user.stats?.level})
                          </span>
                        </td>
                        <td className="py-3 text-white">{user.stats?.totalPointsEarned || 0}</td>
                        <td className="py-3">
                          <span className={user.stats?.currentStreak > 0 ? 'text-orange-400' : 'text-gray-400'}>
                            🔥 {user.stats?.currentStreak || 0}
                          </span>
                        </td>
                        <td className="py-3 text-green-400">{user.stats?.tournamentsWon || 0}</td>
                        <td className="py-3 text-purple-400">{user.stats?.retryTokens || 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* System Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard
            title="Cashback Trigger"
            value="2+ Consecutive Losses"
            description="25% of entry fee"
          />
          <InfoCard
            title="Retry Token"
            value="50% Discount"
            description="Granted after each loss"
          />
          <InfoCard
            title="Reload Bonus"
            value="10-25%"
            description="Based on daily streak"
          />
        </div>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, color }) => (
  <div className="bg-gray-700 p-3 rounded-lg text-center">
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    <div className="text-gray-400 text-sm">{label}</div>
  </div>
);

// Action Button Component
const ActionButton = ({ onClick, label, color }) => {
  const colors = {
    purple: 'bg-purple-500 hover:bg-purple-400',
    green: 'bg-green-500 hover:bg-green-400',
    blue: 'bg-blue-500 hover:bg-blue-400',
    yellow: 'bg-yellow-500 hover:bg-yellow-400 text-gray-900',
    cyan: 'bg-cyan-500 hover:bg-cyan-400 text-gray-900',
    pink: 'bg-pink-500 hover:bg-pink-400'
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium text-white transition-all ${colors[color]}`}
    >
      {label}
    </button>
  );
};

// Info Card Component
const InfoCard = ({ title, value, description }) => (
  <div className="bg-gray-800 p-4 rounded-lg">
    <h4 className="text-gray-400 text-sm mb-1">{title}</h4>
    <div className="text-xl font-bold text-cyan-400 mb-1">{value}</div>
    <p className="text-gray-500 text-sm">{description}</p>
  </div>
);

// Make RetentionAdmin available globally
window.RetentionAdmin = RetentionAdmin;
