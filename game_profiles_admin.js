/**
 * ===========================================
 * GAME PROFILES ADMIN COMPONENT (Updated with Mobile Number)
 * ===========================================
 * 
 * Updated GameProfiles component for admin panel that displays
 * mobile number alongside game name and game ID.
 * 
 * Add this to your admin panel HTML or include as a separate script.
 */

// Updated GameProfiles Component with Mobile Number Support
function GameProfiles() {
    const { data: profiles, loading } = useCollection('game_profiles', 'updatedAt');
    const [users, setUsers] = React.useState({});
    const [searchGameId, setSearchGameId] = React.useState('');
    const [filteredProfiles, setFilteredProfiles] = React.useState([]);

    // Fetch user data for each profile
    React.useEffect(() => {
        const fetchUsers = async () => {
            const userIds = [...new Set(profiles.map(p => p.userId))];
            const userData = {};
            
            for (const userId of userIds) {
                try {
                    const userDoc = await db.collection('users').doc(userId).get();
                    if (userDoc.exists) {
                        userData[userId] = userDoc.data();
                    }
                } catch (e) {
                    console.error('Error fetching user:', e);
                }
            }
            
            setUsers(userData);
        };

        if (profiles.length > 0) {
            fetchUsers();
        }
    }, [profiles]);

    // Filter profiles by Game ID
    React.useEffect(() => {
        if (!searchGameId.trim()) {
            setFilteredProfiles(profiles);
        } else {
            const filtered = profiles.filter(profile => 
                profile.gameId && profile.gameId.toLowerCase().includes(searchGameId.toLowerCase())
            );
            setFilteredProfiles(filtered);
        }
    }, [profiles, searchGameId]);

    return (
        React.createElement(Card, null,
            React.createElement('div', { className: 'flex justify-between items-center mb-4' },
                React.createElement('h2', { className: 'text-xl font-bold text-white' }, 'Game Profiles'),
                React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('label', { className: 'text-sm font-medium text-white' }, '🎮 Game ID Search:'),
                    React.createElement('input', {
                        type: 'text',
                        value: searchGameId,
                        onChange: (e) => setSearchGameId(e.target.value),
                        placeholder: 'Search by Game ID...',
                        className: 'px-3 py-1 rounded bg-gray-700 text-white border border-gray-600 focus:border-cyan-500 focus:outline-none'
                    })
                )
            ),
            React.createElement('p', { className: 'text-gray-300 mb-4' }, 
                `Total Profiles: ${profiles.length} | Showing: ${filteredProfiles.length}`
            ),

            loading ? 
                React.createElement('div', { className: 'spinner mx-auto' }) :
            filteredProfiles.length === 0 ? 
                React.createElement('p', { className: 'text-white' }, 
                    searchGameId ? `No profiles found with Game ID containing "${searchGameId}"` : 'No game profiles found.'
                ) :
            React.createElement(Table, { 
                headers: ['User Email', 'Game Type', 'Game Name', 'Game ID', 'Mobile Number', 'Last Updated']
            },
                filteredProfiles.map(profile => {
                    const user = users[profile.userId];
                    return React.createElement('tr', { key: profile.id, className: 'border-b border-gray-700' },
                        React.createElement('td', { className: 'py-3 text-white' }, 
                            user?.email || profile.userId
                        ),
                        React.createElement('td', { className: 'py-3' },
                            React.createElement('span', { 
                                className: `px-2 py-1 rounded text-sm font-medium ${
                                    profile.gameType === 'Free Fire' ? 'bg-orange-500/20 text-orange-400' :
                                    profile.gameType === 'BGMI' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`
                            }, profile.gameType || 'N/A')
                        ),
                        React.createElement('td', { className: 'py-3 text-white font-medium' }, 
                            profile.gameName || 'N/A'
                        ),
                        React.createElement('td', { className: 'py-3' },
                            React.createElement('span', { 
                                className: 'px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded font-mono text-sm'
                            }, profile.gameId || 'N/A')
                        ),
                        React.createElement('td', { className: 'py-3' },
                            React.createElement('span', { 
                                className: 'px-2 py-1 bg-green-500/20 text-green-400 rounded font-mono text-sm'
                            }, profile.mobileNumber || 'Not set')
                        ),
                        React.createElement('td', { className: 'py-3 text-gray-400 text-sm' }, 
                            profile.updatedAt ? formatDate(profile.updatedAt) : 'N/A'
                        )
                    );
                })
            )
        )
    );
}

// Make GameProfiles available globally
window.GameProfiles = GameProfiles;
