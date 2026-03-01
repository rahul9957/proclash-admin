// Script to create mini admin role for rahilkhan7638@gmail.com
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'proclashtournament'
});

const db = admin.firestore();

async function createMiniAdmin() {
  try {
    const uid = 'rWQQhrC7ENO7elwirzTIjf7hHLu1';
    const email = 'rahilkhan7638@gmail.com';
    
    const adminRoleData = {
      uid: uid,
      email: email,
      status: 'active',
      role: 'mini_admin',
      permissions: {
        dashboard: true,
        users: true,
        wallet_requests: true,
        tournaments: true,
        live_joins: true,
        support_tickets: true,
        messages: true,
        transactions: true,
        game_profiles: true,
        app_settings: false,
        app_config: false,
        team_entries: true
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'system'
    };

    // Create the admin role document
    await db.collection('admin_roles').doc(uid).set(adminRoleData);
    
    console.log('✅ Mini admin role created successfully for:', email);
    console.log('UID:', uid);
    console.log('Permissions granted:', Object.keys(adminRoleData.permissions).filter(key => adminRoleData.permissions[key]));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating mini admin role:', error);
    process.exit(1);
  }
}

createMiniAdmin();
