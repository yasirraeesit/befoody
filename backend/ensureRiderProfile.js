const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Rider = require('./models/Rider');

async function ensureRiderProfile() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/befoody';
    const email = process.env.RIDER_EMAIL || 'alex.rider@befoody.com';

    console.log('🔧 Connecting to:', uri);
    await mongoose.connect(uri);

    const user = await User.findOne({ email });
    if (!user) {
        console.error(`❌ User not found for email: ${email}`);
        process.exit(1);
    }

    const existing = await Rider.findOne({ userId: user._id });
    if (existing) {
        console.log(`✅ Rider profile already exists for ${email}:`, existing._id.toString());
        await mongoose.disconnect();
        return;
    }

    const rider = await Rider.create({
        userId: user._id,
        vehicleType: 'bike',
        vehicleNumber: 'BK-1234',
        licenseNumber: 'DL-12345678',
        isAvailable: true,
        activeOrderId: null
    });

    console.log(`✅ Created rider profile for ${email}:`, rider._id.toString());
    await mongoose.disconnect();
}

ensureRiderProfile().catch(async (err) => {
    console.error('❌ Failed:', err?.message || err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});

