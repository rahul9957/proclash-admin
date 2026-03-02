/**
 * Referral Code Fix Tool for ProClash Admin Panel
 * 
 * This script helps fix referral codes that were incorrectly regenerated
 * after app updates. It allows admins to:
 * 1. Find users with mismatched referral codes
 * 2. Restore original referral codes
 * 3. Ensure one user has only one permanent referral code
 */

class ReferralCodeFixTool {
    constructor(db) {
        this.db = db;
        this.fixedCount = 0;
        this.errors = [];
    }

    async getUserDoc(userId) {
        const userDoc = await this.db.collection('users').doc(userId).get();
        return userDoc.exists ? userDoc : null;
    }

    async getStatsDoc(userId) {
        const statsDoc = await this.db.collection('user_referral_stats').doc(userId).get();
        return statsDoc.exists ? statsDoc : null;
    }

    async getOriginalCodeFromReferralsHistory(userId) {
        try {
            const snap = await this.db.collection('referrals')
                .where('referrerId', '==', userId)
                .orderBy('createdAt', 'asc')
                .limit(1)
                .get();

            if (snap.empty) return null;
            const data = snap.docs[0].data();
            const code = data.referralCode;
            return (code && typeof code === 'string' && code.trim()) ? code.trim().toUpperCase() : null;
        } catch (e) {
            // If the index/orderBy isn't available, we still don't want to crash the tool.
            console.warn('⚠️ Could not read referrals history for user', userId, e);
            return null;
        }
    }

    async syncStatsCodeToUserDoc(userId) {
        try {
            const statsDoc = await this.getStatsDoc(userId);
            if (!statsDoc) return false;

            const statsData = statsDoc.data() || {};
            const statsCode = statsData.referralCode;
            if (!statsCode) return false;

            const userDoc = await this.getUserDoc(userId);
            if (!userDoc) return false;

            const userData = userDoc.data() || {};
            const userCode = userData.referralCode;
            if (userCode === statsCode) return true;

            const batch = this.db.batch();
            batch.update(this.db.collection('users').doc(userId), {
                referralCode: statsCode,
                referralInitialized: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();

            this.fixedCount++;
            console.log(`✅ Synced users.referralCode from stats for ${userId}: ${statsCode}`);
            return true;
        } catch (e) {
            console.error('❌ syncStatsCodeToUserDoc failed:', userId, e);
            this.errors.push({ userId, error: e.message || String(e) });
            return false;
        }
    }

    async recoverUserReferralCode(userId) {
        try {
            const statsDoc = await this.getStatsDoc(userId);
            const userDoc = await this.getUserDoc(userId);

            const statsCode = statsDoc?.data()?.referralCode;
            const userCode = userDoc?.data()?.referralCode;

            let candidate = null;

            if (statsCode && typeof statsCode === 'string' && statsCode.trim()) {
                candidate = statsCode.trim().toUpperCase();
            } else if (userCode && typeof userCode === 'string' && userCode.trim()) {
                candidate = userCode.trim().toUpperCase();
            } else {
                candidate = await this.getOriginalCodeFromReferralsHistory(userId);
            }

            if (!candidate) {
                candidate = await this.generateUniqueCode();
            }

            return await this.fixUserReferralCode(userId, candidate);
        } catch (e) {
            console.error('❌ recoverUserReferralCode failed:', userId, e);
            this.errors.push({ userId, error: e.message || String(e) });
            return false;
        }
    }

    async recoverAllFromMismatchesPreferStats() {
        const mismatches = await this.findMismatchedCodes();
        for (const m of mismatches) {
            // Prefer statsCode when present, otherwise fall back to recovery logic.
            if (m.statsCode && typeof m.statsCode === 'string' && m.statsCode.trim()) {
                await this.fixUserReferralCode(m.userId, m.statsCode.trim().toUpperCase());
            } else {
                await this.recoverUserReferralCode(m.userId);
            }
        }
        return this.getReport();
    }

    /**
     * Find all users who have mismatched referral codes
     * Compares user_referral_stats with users collection
     */
    async findMismatchedCodes() {
        console.log('🔍 Scanning for mismatched referral codes...');
        
        const mismatches = [];
        
        try {
            // Get all user_referral_stats documents
            const statsSnapshot = await this.db.collection('user_referral_stats').get();
            
            for (const statsDoc of statsSnapshot.docs) {
                const userId = statsDoc.id;
                const statsData = statsDoc.data();
                const statsCode = statsData.referralCode;
                
                // Get corresponding user document
                const userDoc = await this.db.collection('users').doc(userId).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const userCode = userData.referralCode;
                    
                    // Check for mismatch
                    if (userCode !== statsCode) {
                        mismatches.push({
                            userId,
                            userName: userData.name || userData.email || 'Unknown',
                            email: userData.email,
                            userCode,
                            statsCode,
                            issue: 'MISMATCH'
                        });
                    }
                } else {
                    mismatches.push({
                        userId,
                        userName: 'Unknown',
                        email: null,
                        userCode: null,
                        statsCode,
                        issue: 'MISSING_USER_DOC'
                    });
                }
            }
            
            console.log(`⚠️ Found ${mismatches.length} mismatched codes`);
            return mismatches;
            
        } catch (error) {
            console.error('❌ Error finding mismatches:', error);
            throw error;
        }
    }

    /**
     * Find duplicate referral codes (same code assigned to multiple users)
     */
    async findDuplicateCodes() {
        console.log('🔍 Scanning for duplicate referral codes...');
        
        const duplicates = [];
        const codeMap = new Map();
        
        try {
            const statsSnapshot = await this.db.collection('user_referral_stats').get();
            
            // Build map of codes to users
            for (const doc of statsSnapshot.docs) {
                const code = doc.data().referralCode;
                const userId = doc.id;
                
                if (codeMap.has(code)) {
                    codeMap.get(code).push(userId);
                } else {
                    codeMap.set(code, [userId]);
                }
            }
            
            // Find codes with multiple users
            for (const [code, userIds] of codeMap.entries()) {
                if (userIds.length > 1) {
                    duplicates.push({
                        code,
                        userIds,
                        count: userIds.length
                    });
                }
            }
            
            console.log(`⚠️ Found ${duplicates.length} duplicate codes`);
            return duplicates;
            
        } catch (error) {
            console.error('❌ Error finding duplicates:', error);
            throw error;
        }
    }

    /**
     * Fix a specific user's referral code
     * Updates both user_referral_stats and users collections
     */
    async fixUserReferralCode(userId, correctCode) {
        try {
            const batch = this.db.batch();
            
            // Update user_referral_stats
            const statsRef = this.db.collection('user_referral_stats').doc(userId);
            batch.update(statsRef, {
                referralCode: correctCode,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update users collection
            const userRef = this.db.collection('users').doc(userId);
            batch.update(userRef, {
                referralCode: correctCode,
                referralInitialized: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await batch.commit();
            
            this.fixedCount++;
            console.log(`✅ Fixed referral code for user ${userId}: ${correctCode}`);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Error fixing code for user ${userId}:`, error);
            this.errors.push({ userId, error: error.message });
            return false;
        }
    }

    /**
     * Generate a new unique referral code
     * Checks for conflicts before returning
     */
    async generateUniqueCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            // Generate 8-character code
            let code = '';
            for (let i = 0; i < 8; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            // Check if code already exists
            const existing = await this.db.collection('user_referral_stats')
                .where('referralCode', '==', code)
                .limit(1)
                .get();
            
            if (existing.empty) {
                return code;
            }
            
            attempts++;
        }
        
        throw new Error('Failed to generate unique code after max attempts');
    }

    /**
     * Fix all duplicate codes by assigning new unique codes
     */
    async fixAllDuplicates() {
        const duplicates = await this.findDuplicateCodes();
        
        for (const duplicate of duplicates) {
            console.log(`🔧 Fixing duplicate code: ${duplicate.code}`);
            
            // Keep the first user with this code, assign new codes to others
            for (let i = 1; i < duplicate.userIds.length; i++) {
                const userId = duplicate.userIds[i];
                const newCode = await this.generateUniqueCode();
                
                console.log(`   Assigning new code ${newCode} to user ${userId}`);
                await this.fixUserReferralCode(userId, newCode);
            }
        }
    }

    /**
     * Restore original code for a user
     * Use this when you know the original code that should be restored
     */
    async restoreOriginalCode(userId, originalCode) {
        console.log(`🔄 Restoring original code for ${userId}: ${originalCode}`);
        
        // Check if original code is already used by someone else
        const existing = await this.db.collection('user_referral_stats')
            .where('referralCode', '==', originalCode)
            .get();
        
        if (!existing.empty) {
            const otherUser = existing.docs[0];
            if (otherUser.id !== userId) {
                console.error(`❌ Code ${originalCode} already used by user ${otherUser.id}`);
                return false;
            }
        }
        
        return await this.fixUserReferralCode(userId, originalCode);
    }

    /**
     * Get fix summary report
     */
    getReport() {
        return {
            fixedCount: this.fixedCount,
            errors: this.errors,
            timestamp: new Date().toISOString()
        };
    }
}

// Export for use in admin panel
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReferralCodeFixTool;
}

// Browser global export (admin_panel.html loads scripts directly in browser)
if (typeof window !== 'undefined') {
    window.ReferralCodeFixTool = ReferralCodeFixTool;
}

// Example usage in admin panel console:
/*
const fixTool = new ReferralCodeFixTool(db);

// 1. Find mismatches
const mismatches = await fixTool.findMismatchedCodes();
console.table(mismatches);

// 2. Find duplicates
const duplicates = await fixTool.findDuplicateCodes();
console.table(duplicates);

// 3. Fix a specific user
await fixTool.restoreOriginalCode('USER_ID_HERE', 'ORIGINAL_CODE_HERE');

// 4. Fix all duplicates
await fixTool.fixAllDuplicates();

// 5. Get report
console.log(fixTool.getReport());
*/
