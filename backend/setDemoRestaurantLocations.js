const mongoose = require('mongoose');
require('dotenv').config();

const Restaurant = require('./models/Restaurant');

const DEFAULTS = [
    { name: 'Pizza Paradise', province: 'Punjab', city: 'Lahore' },
    { name: 'Sushi Master', province: 'Sindh', city: 'Karachi' },
    { name: 'Burger House', province: 'Islamabad Capital Territory', city: 'Islamabad' },
    { name: 'Taco Fiesta', province: 'Punjab', city: 'Rawalpindi' },
    { name: 'Curry Palace', province: 'Khyber Pakhtunkhwa', city: 'Peshawar' },
    { name: 'Noodle Express', province: 'Sindh', city: 'Hyderabad' }
];

async function setDemoRestaurantLocations() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/befoody';
    console.log('📍 Connecting to:', uri);
    await mongoose.connect(uri);

    let modified = 0;
    for (const item of DEFAULTS) {
        const res = await Restaurant.updateMany(
            { name: item.name },
            {
                $set: {
                    serviceCountry: 'Pakistan',
                    serviceProvince: item.province,
                    serviceCity: item.city
                }
            }
        );
        modified += res.modifiedCount ?? 0;
    }

    // Fallback: any remaining restaurants get Karachi/Sindh so they show up somewhere
    const remaining = await Restaurant.updateMany(
        { $or: [{ serviceCity: { $exists: false } }, { serviceCity: '' }, { serviceCity: null }] },
        {
            $set: {
                serviceCountry: 'Pakistan',
                serviceProvince: 'Sindh',
                serviceCity: 'Karachi'
            }
        }
    );

    console.log('✅ Updated demo restaurant locations.');
    console.log('Modified (named matches):', modified);
    console.log('Modified (fallback):', remaining.modifiedCount ?? remaining.nModified ?? 0);

    await mongoose.disconnect();
}

setDemoRestaurantLocations().catch(async (err) => {
    console.error('❌ Failed:', err?.message || err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});

