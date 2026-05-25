const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const FoodItem = require('./models/FoodItem');

async function inspectDb() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/befoody';
    console.log('🔎 Inspecting MongoDB:', uri);

    await mongoose.connect(uri);
    console.log('✅ Connected to DB:', mongoose.connection.name);

    const [userCount, restaurantCount, foodCount] = await Promise.all([
        User.countDocuments({}),
        Restaurant.countDocuments({}),
        FoodItem.countDocuments({})
    ]);

    console.log('\nCounts');
    console.log('-----------------------------------');
    console.log('👤 Users:', userCount);
    console.log('🏪 Restaurants:', restaurantCount);
    console.log('🍔 Food items:', foodCount);
    console.log('-----------------------------------');

    const users = await User.find({}, { name: 1, email: 1, role: 1 }).limit(50).lean();
    console.log('\nUsers (up to 50)');
    users.forEach((u) => {
        console.log(`- ${u.role || 'unknown'} | ${u.email || '(no email)'} | ${u.name || '(no name)'} | ${u._id}`);
    });

    const restaurants = await Restaurant.find({}, { name: 1, cuisine: 1, isActive: 1, ownerId: 1, serviceCity: 1, serviceProvince: 1 }).limit(50).lean();
    console.log('\nRestaurants (up to 50)');
    restaurants.forEach((r) => {
        const cuisine = Array.isArray(r.cuisine) ? r.cuisine.join(', ') : r.cuisine;
        const service = r.serviceCity ? `${r.serviceCity}${r.serviceProvince ? `, ${r.serviceProvince}` : ''}` : '-';
        console.log(`- ${r.name || '(no name)'} | ${cuisine || '-'} | ${service} | active=${String(!!r.isActive)} | ownerId=${r.ownerId || '-'} | ${r._id}`);
    });

    const foods = await FoodItem.find({}, { name: 1, price: 1, category: 1, isAvailable: 1, restaurantId: 1 }).limit(100).lean();
    console.log('\nFood Items (up to 100)');
    foods.forEach((f) => {
        console.log(`- ${f.name || '(no name)'} | ${f.category || '-'} | $${f.price ?? '-'} | available=${String(!!f.isAvailable)} | restaurantId=${f.restaurantId || '-'} | ${f._id}`);
    });

    await mongoose.disconnect();
}

inspectDb().catch(async (err) => {
    console.error('❌ Inspect failed:', err?.message || err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});
