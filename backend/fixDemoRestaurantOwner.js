const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Restaurant = require('./models/Restaurant');

async function fixDemoRestaurantOwner() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/befoody';
    console.log('🔧 Connecting to:', uri);
    await mongoose.connect(uri);

    const owner = await User.findOne({ email: 'owner@restaurant.com' });
    if (!owner) {
        console.error('❌ Demo restaurant user not found: owner@restaurant.com');
        process.exit(1);
    }

    const result = await Restaurant.updateMany(
        {},
        { $set: { ownerId: owner._id } }
    );

    console.log('✅ Updated restaurants ownerId to demo user.');
    console.log('Matched:', result.matchedCount ?? result.n);
    console.log('Modified:', result.modifiedCount ?? result.nModified);

    await mongoose.disconnect();
}

fixDemoRestaurantOwner().catch(async (err) => {
    console.error('❌ Failed:', err?.message || err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});

