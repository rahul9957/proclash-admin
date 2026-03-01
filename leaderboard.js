/**
 * ===========================================
 * ADMIN PANEL FALLBACK - Leaderboard Generation
 * ===========================================
 * 
 * Use this function when Firebase Cloud Functions are not available.
 * Call this from your HTML admin panel to manually generate leaderboards.
 * 
 * Prerequisites:
 * - Firebase SDK initialized
 * - User authenticated with admin role
 * 
 * @param {string} tournamentId - The tournament ID to generate leaderboard for
 * @returns {Promise<Object>} - Success status and details
 */
async function generateLeaderboard(tournamentId) {
  const db = firebase.firestore();

  console.log(`[Leaderboard] Starting generation for tournament: ${tournamentId}`);

  try {
    // Step 1: Fetch tournament document
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }

    const tournamentData = tournamentDoc.data();
    const joinedUsers = tournamentData.joinedUsers || [];

    console.log(`[Leaderboard] Found ${joinedUsers.length} joined users`);

    // Step 2: Delete existing leaderboard
    await deleteExistingLeaderboard(db, tournamentId);
    console.log('[Leaderboard] Existing leaderboard deleted');

    // Step 3: Fetch all winning and kill transactions (SINGLE QUERY optimization)
    const transactionsSnapshot = await db.collection('transactions')
      .where('tournamentId', '==', tournamentId)
      .where('type', 'in', ['winning', 'kill'])
      .get();

    console.log(`[Leaderboard] Found ${transactionsSnapshot.size} transactions`);

    // Step 4: Initialize user stats with ALL joined users (zero values)
    const userStats = new Map();

    for (const userId of joinedUsers) {
      userStats.set(userId, {
        userId: userId,
        gameName: '',
        totalWinning: 0,
        totalKillPrize: 0,
        earliestTimestamp: null,
      });
    }

    // Step 5: Process transactions and calculate totals
    for (const doc of transactionsSnapshot.docs) {
      const transaction = doc.data();
      const userId = transaction.userId;
      const type = transaction.type;
      const amount = transaction.amount || 0;
      const createdAt = transaction.createdAt ? transaction.createdAt.toMillis() : Date.now();
      const gameName = transaction.gameName || '';

      // Initialize if user not already in map
      if (!userStats.has(userId)) {
        userStats.set(userId, {
          userId: userId,
          gameName: gameName,
          totalWinning: 0,
          totalKillPrize: 0,
          earliestTimestamp: createdAt,
        });
      }

      const stats = userStats.get(userId);

      // Update gameName
      if (gameName && !stats.gameName) {
        stats.gameName = gameName;
      }

      // Accumulate by type
      if (type === 'winning') {
        stats.totalWinning += amount;
      } else if (type === 'kill') {
        stats.totalKillPrize += amount;
      }

      // Track earliest timestamp for tie-breaking
      if (!stats.earliestTimestamp || createdAt < stats.earliestTimestamp) {
        stats.earliestTimestamp = createdAt;
      }
    }

    // Step 6: Fetch missing game names from users collection
    await fetchMissingGameNames(db, userStats);

    // Step 7: Convert to array and apply ranking logic
    const leaderboardArray = Array.from(userStats.values());

    // SORT: totalWinning DESC → totalKillPrize DESC → earliestTimestamp ASC
    leaderboardArray.sort((a, b) => {
      // Primary: totalWinning descending
      if (b.totalWinning !== a.totalWinning) {
        return b.totalWinning - a.totalWinning;
      }

      // Secondary: totalKillPrize descending
      if (b.totalKillPrize !== a.totalKillPrize) {
        return b.totalKillPrize - a.totalKillPrize;
      }

      // Tertiary: earliest transaction ascending (earlier = better rank)
      const aTime = a.earliestTimestamp || Number.MAX_SAFE_INTEGER;
      const bTime = b.earliestTimestamp || Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    // Step 8: Assign ranks
    leaderboardArray.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(`[Leaderboard] Sorted ${leaderboardArray.length} entries`);

    // Step 9: Save leaderboard in batches
    await saveLeaderboardInBatches(db, tournamentId, leaderboardArray);
    console.log(`[Leaderboard] Saved ${leaderboardArray.length} entries`);

    // Step 10: Update tournament document with summary
    const totalPrizeDistributed = leaderboardArray.reduce(
      (sum, entry) => sum + entry.totalWinning + entry.totalKillPrize, 
      0
    );

    await tournamentRef.update({
      leaderboardGenerated: true,
      leaderboardGeneratedAt: firebase.firestore.FieldValue.serverTimestamp(),
      totalParticipants: leaderboardArray.length,
      totalPrizeDistributed: totalPrizeDistributed,
    });

    console.log('[Leaderboard] Tournament document updated');

    return {
      success: true,
      message: `Leaderboard generated successfully for ${tournamentData.name || tournamentId}`,
      totalParticipants: leaderboardArray.length,
      totalPrizeDistributed: totalPrizeDistributed,
      top3: leaderboardArray.slice(0, 3).map(e => ({
        rank: e.rank,
        gameName: e.gameName,
        totalWinning: e.totalWinning,
        totalKillPrize: e.totalKillPrize,
      })),
    };

  } catch (error) {
    console.error('[Leaderboard] Error:', error);
    throw error;
  }
}

/**
 * Delete existing leaderboard subcollection
 */
async function deleteExistingLeaderboard(db, tournamentId) {
  const leaderboardRef = db.collection('leaderboard').doc(tournamentId).collection('users');
  
  // Get all documents in batches of 500
  const snapshot = await leaderboardRef.limit(500).get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;

    if (count === 500) {
      await batch.commit();
      
      // Check if more exist and recurse
      const moreSnapshot = await leaderboardRef.limit(500).get();
      if (!moreSnapshot.empty) {
        return deleteExistingLeaderboard(db, tournamentId);
      }
      return;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

/**
 * Fetch missing game names from users collection
 * Batch lookup to avoid N+1 queries
 */
async function fetchMissingGameNames(db, userStats) {
  const usersToFetch = [];
  
  for (const [userId, stats] of userStats) {
    if (!stats.gameName) {
      usersToFetch.push(userId);
    }
  }

  if (usersToFetch.length === 0) return;

  // Firestore 'in' query limit is 10
  const batchSize = 10;
  
  for (let i = 0; i < usersToFetch.length; i += batchSize) {
    const batch = usersToFetch.slice(i, i + batchSize);
    
    const usersSnapshot = await db.collection('users')
      .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
      .get();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const gameName = userData.gameName || userData.name || 'Unknown';
      
      if (userStats.has(userId)) {
        userStats.get(userId).gameName = gameName;
      }
    }
  }

  // Set defaults for remaining
  for (const [userId, stats] of userStats) {
    if (!stats.gameName) {
      stats.gameName = 'Unknown';
    }
  }
}

/**
 * Save leaderboard entries in batches of 500
 */
async function saveLeaderboardInBatches(db, tournamentId, leaderboardArray) {
  const batchSize = 500;
  const baseRef = db.collection('leaderboard').doc(tournamentId).collection('users');

  for (let i = 0; i < leaderboardArray.length; i += batchSize) {
    const batch = db.batch();
    const chunk = leaderboardArray.slice(i, i + batchSize);

    for (const entry of chunk) {
      const docRef = baseRef.doc(entry.userId);
      
      batch.set(docRef, {
        userId: entry.userId,
        gameName: entry.gameName,
        totalWinning: entry.totalWinning,
        totalKillPrize: entry.totalKillPrize,
        rank: entry.rank,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
  }
}

/**
 * ===========================================
 * ADMIN PANEL UI FUNCTIONS
 * ===========================================
 */

/**
 * Generate leaderboard from admin panel button click
 * Shows loading state and displays results
 */
async function adminGenerateLeaderboard(tournamentId, statusElementId) {
  const statusElement = document.getElementById(statusElementId);
  
  if (statusElement) {
    statusElement.innerHTML = '<span style="color: orange;">⏳ Generating leaderboard...</span>';
  }

  try {
    const result = await generateLeaderboard(tournamentId);
    
    if (statusElement) {
      statusElement.innerHTML = `
        <span style="color: green;">✅ ${result.message}</span><br>
        <small>Participants: ${result.totalParticipants} | Prize: ${result.totalPrizeDistributed}</small>
      `;
    }

    // Show top 3 in console
    console.log('[Admin Panel] Leaderboard Top 3:', result.top3);
    
    return result;

  } catch (error) {
    if (statusElement) {
      statusElement.innerHTML = `<span style="color: red;">❌ Error: ${error.message}</span>`;
    }
    throw error;
  }
}

/**
 * Fetch and display leaderboard for admin panel
 */
async function fetchLeaderboardForDisplay(tournamentId, containerId) {
  const db = firebase.firestore();
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  try {
    const snapshot = await db.collection('leaderboard')
      .doc(tournamentId)
      .collection('users')
      .orderBy('rank', 'asc')
      .get();

    if (snapshot.empty) {
      container.innerHTML = '<p>No leaderboard data found.</p>';
      return;
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd;">Rank</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Player</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Winning</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Kill Prize</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const total = (data.totalWinning || 0) + (data.totalKillPrize || 0);
      
      html += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${data.rank}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${data.gameName}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${data.totalWinning || 0}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${data.totalKillPrize || 0}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${total}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (error) {
    container.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}

/**
 * Auto-complete tournament and generate leaderboard
 * Call this when admin marks tournament as completed
 */
async function completeTournamentAndGenerateLeaderboard(tournamentId) {
  const db = firebase.firestore();

  try {
    // Update tournament status
    await db.collection('tournaments').doc(tournamentId).update({
      status: 'completed',
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log('[Admin] Tournament marked as completed');

    // Generate leaderboard
    const result = await generateLeaderboard(tournamentId);
    
    return {
      success: true,
      message: 'Tournament completed and leaderboard generated',
      ...result,
    };

  } catch (error) {
    console.error('[Admin] Error completing tournament:', error);
    throw error;
  }
}

/**
 * Auto-generate or update leaderboard after admin creates win/kill prize transaction
 * Call this automatically when admin creates Kill Prize or Winning Prize transaction
 * 
 * @param {string} tournamentId - The tournament ID
 * @param {string} userId - The user who received the prize
 * @param {string} type - 'killPrize' or 'winningPrize'
 * @param {number} amount - Prize amount
 * @returns {Promise<Object>} - Success status
 */
async function autoGenerateLeaderboardAfterTransaction(tournamentId, userId, type, amount) {
  console.log(`[Auto Leaderboard] Transaction created: ${type} - ${amount} coins for user ${userId} in tournament ${tournamentId}`);
  
  try {
    // Check if tournament has leaderboard enabled or if it's completed
    const db = firebase.firestore();
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    
    if (!tournamentDoc.exists) {
      console.log('[Auto Leaderboard] Tournament not found, skipping auto-generation');
      return { success: false, message: 'Tournament not found' };
    }
    
    const tournamentData = tournamentDoc.data();
    
    // Auto-generate leaderboard for completed tournaments or if it already has a leaderboard
    if (tournamentData.status === 'completed' || tournamentData.leaderboardGenerated) {
      console.log('[Auto Leaderboard] Auto-generating/updating leaderboard...');
      const result = await generateLeaderboard(tournamentId);
      console.log('[Auto Leaderboard] ✅ Leaderboard updated successfully:', result.message);
      return { success: true, ...result };
    } else {
      console.log('[Auto Leaderboard] Tournament not completed yet, skipping auto-generation');
      return { success: false, message: 'Tournament not completed' };
    }
  } catch (error) {
    console.error('[Auto Leaderboard] Error auto-generating leaderboard:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-generate leaderboard when tournament is marked as completed
 * Enhanced version of completeTournamentAndGenerateLeaderboard with better logging
 * 
 * @param {string} tournamentId - The tournament ID to complete and generate leaderboard for
 * @param {boolean} autoGenerate - Whether to auto-generate leaderboard (default: true)
 * @returns {Promise<Object>} - Success status and details
 */
async function autoCompleteTournament(tournamentId, autoGenerate = true) {
  console.log(`[Auto Complete] Starting auto-completion for tournament: ${tournamentId}`);
  
  try {
    // First complete the tournament
    const completeResult = await completeTournamentAndGenerateLeaderboard(tournamentId);
    
    if (autoGenerate && completeResult.success) {
      console.log('[Auto Complete] ✅ Tournament completed and leaderboard auto-generated');
    }
    
    return completeResult;
  } catch (error) {
    console.error('[Auto Complete] Error:', error);
    throw error;
  }
}

/**
 * Setup Firestore listener for automatic leaderboard generation
 * This listens for transaction changes and auto-updates leaderboard
 * 
 * @param {string} tournamentId - The tournament ID to monitor
 * @returns {Function} - Unsubscribe function
 */
function setupAutoLeaderboardListener(tournamentId) {
  const db = firebase.firestore();
  
  console.log(`[Auto Leaderboard] Setting up listener for tournament: ${tournamentId}`);
  
  // Listen for new transactions (win/kill prizes)
  const unsubscribe = db.collection('transactions')
    .where('tournamentId', '==', tournamentId)
    .where('type', 'in', ['winning', 'kill'])
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const transaction = change.doc.data();
          console.log(`[Auto Leaderboard] New prize transaction detected:`, {
            type: transaction.type,
            amount: transaction.amount,
            userId: transaction.userId
          });
          
          // Auto-update leaderboard if tournament is completed
          autoGenerateLeaderboardAfterTransaction(
            tournamentId, 
            transaction.userId, 
            transaction.type, 
            transaction.amount
          );
        }
      });
    }, (error) => {
      console.error('[Auto Leaderboard] Listener error:', error);
    });
  
  return unsubscribe;
}

// Export for use in admin panel
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateLeaderboard,
    adminGenerateLeaderboard,
    fetchLeaderboardForDisplay,
    completeTournamentAndGenerateLeaderboard,
    autoGenerateLeaderboardAfterTransaction,
    autoCompleteTournament,
    setupAutoLeaderboardListener,
  };
}
