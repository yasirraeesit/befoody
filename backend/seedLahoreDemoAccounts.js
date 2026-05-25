const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Rider = require('./models/Rider');
const Restaurant = require('./models/Restaurant');

const PASSWORD = 'password123';

async function upsertUser({ name, email, role, phone }) {
    const existing = await User.findOne({ email });
    if (existing) {
        // Ensure role is correct but don't overwrite password
        if (existing.role !== role) {
            existing.role = role;
            await existing.save();
        }
        return existing;
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(PASSWORD, salt);
    return User.create({ name, email, password: hashed, role, phone });
}

async function ensureRiderProfileForUser(user) {
    const existing = await Rider.findOne({ userId: user._id });
    if (existing) return existing;
    return Rider.create({
        userId: user._id,
        vehicleType: 'bike',
        vehicleNumber: 'LH-1010',
        licenseNumber: 'DL-LHR-1010',
        isAvailable: true,
        activeOrderId: null
    });
}

async function seedLahoreDemoAccounts() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/befoody';
    console.log('🌱 Seeding Lahore demo accounts into:', uri);
    await mongoose.connect(uri);

    const [customer, restaurantOwner, riderUser] = await Promise.all([
        upsertUser({ name: 'Lahore Customer', email: 'lahore.user@befoody.com', role: 'customer', phone: '0300-7000001' }),
        upsertUser({ name: 'Lahore Restaurant', email: 'lahore.owner@befoody.com', role: 'restaurant', phone: '0300-7000002' }),
        upsertUser({ name: 'Lahore Rider', email: 'lahore.rider@befoody.com', role: 'rider', phone: '0300-7000003' })
    ]);

    await ensureRiderProfileForUser(riderUser);

    // Assign at least one Lahore restaurant to the Lahore restaurant owner (idempotent).
    const lahores = await Restaurant.find({ serviceCity: { $regex: '^lahore$', $options: 'i' } }).sort({ createdAt: 1 });
    if (lahores.length === 0) {
        console.warn('⚠️ No Lahore restaurants found (serviceCity=Lahore). Run db:set-demo-locations and db:seed-pk-cities first.');
    } else {
        // Assign all Lahore restaurants to the Lahore owner so their dashboard always has a match.
        const res = await Restaurant.updateMany(
            { _id: { $in: lahores.map((r) => r._id) } },
            { $set: { ownerId: restaurantOwner._id } }
        );
        console.log('✅ Assigned Lahore restaurants to:', restaurantOwner.email);
        console.log('Matched:', res.matchedCount ?? res.n);
        console.log('Modified:', res.modifiedCount ?? res.nModified);
    }

    console.log('\n🔐 Lahore demo credentials (password is always password123):');
    console.log('- Customer:', customer.email);
    console.log('- Restaurant:', restaurantOwner.email);
    console.log('- Rider:', riderUser.email);

    await mongoose.disconnect();
}

seedLahoreDemoAccounts().catch(async (err) => {
    console.error('❌ Seed failed:', err?.message || err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});

