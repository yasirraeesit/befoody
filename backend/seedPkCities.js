const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const FoodItem = require('./models/FoodItem');

const restaurants = [
    // Lahore (Punjab)
    {
        name: 'Lahore Karahi House',
        description: 'Classic Lahori karahi, BBQ, and tandoor favorites.',
        cuisine: ['Pakistani', 'BBQ'],
        phone: '0300-1111111',
        imageUrl: 'https://images.unsplash.com/photo-1604908554027-1a9b1d1f8a25?auto=format&fit=crop&w=900&q=70',
        rating: 4.6,
        deliveryTime: 35,
        deliveryFee: 0,
        isActive: true,
        serviceCountry: 'Pakistan',
        serviceProvince: 'Punjab',
        serviceCity: 'Lahore'
    },
    {
        name: 'Anday Wala Burger - Lahore',
        description: 'Street-style burgers, fries, and chai.',
        cuisine: ['Pakistani', 'Burgers'],
        phone: '0300-2222222',
        imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=70',
        rating: 4.4,
        deliveryTime: 25,
        deliveryFee: 1.49,
        isActive: true,
        serviceCountry: 'Pakistan',
        serviceProvince: 'Punjab',
        serviceCity: 'Lahore'
    },

    // Karachi (Sindh)
    {
        name: 'Karachi Biryani Center',
        description: 'Spicy biryani, raita, and kebabs—Karachi style.',
        cuisine: ['Pakistani', 'Biryani'],
        phone: '0300-3333333',
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=70',
        rating: 4.7,
        deliveryTime: 30,
        deliveryFee: 0,
        isActive: true,
        serviceCountry: 'Pakistan',
        serviceProvince: 'Sindh',
        serviceCity: 'Karachi'
    },
    {
        name: 'Burns Road BBQ - Karachi',
        description: 'Chapli kebab, seekh kebab, and handi.',
        cuisine: ['Pakistani', 'BBQ'],
        phone: '0300-4444444',
        imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc500f?auto=format&fit=crop&w=900&q=70',
        rating: 4.5,
        deliveryTime: 40,
        deliveryFee: 2.49,
        isActive: true,
        serviceCountry: 'Pakistan',
        serviceProvince: 'Sindh',
        serviceCity: 'Karachi'
    },

    // Islamabad (ICT)
    {
        name: 'Islamabad Grill & Co.',
        description: 'Clean, modern grill—steaks, burgers, and wraps.',
        cuisine: ['American', 'Grill'],
        phone: '0300-5555555',
        imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=70',
        rating: 4.3,
        deliveryTime: 25,
        deliveryFee: 1.99,
        isActive: true,
        serviceCountry: 'Pakistan',
        serviceProvince: 'Islamabad Capital Territory',
        serviceCity: 'Islamabad'
    },
    {
        name: 'Islamabad Cafe Corner',
        description: 'Coffee, sandwiches, desserts, and breakfast.',
        cuisine: ['Cafe', 'Desserts'],
        phone: '0300-6666666',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=70',
        rating: 4.4,
        deliveryTime: 20,
        deliveryFee: 0,
        isActive: true,
        serviceCountry: 'Pakistan',
        serviceProvince: 'Islamabad Capital Territory',
        serviceCity: 'Islamabad'
    }
];

const menuByRestaurantName = {
    'Lahore Karahi House': [
        { name: 'Chicken Karahi', description: 'Half kg chicken karahi.', price: 12.99, category: 'Karahi', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1604908554027-1a9b1d1f8a25?auto=format&fit=crop&w=800&q=70' },
        { name: 'Seekh Kebab (6 pcs)', description: 'Juicy seekh kebabs.', price: 8.99, category: 'BBQ', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc500f?auto=format&fit=crop&w=800&q=70' },
        { name: 'Garlic Naan', description: 'Fresh tandoori naan.', price: 1.99, category: 'Bread', isVegetarian: true, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=70' }
    ],
    'Anday Wala Burger - Lahore': [
        { name: 'Anday Wala Burger', description: 'Egg burger with chutney.', price: 4.99, category: 'Burgers', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=70' },
        { name: 'Masala Fries', description: 'Crispy fries with masala.', price: 2.99, category: 'Sides', isVegetarian: true, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=70' },
        { name: 'Doodh Patti Chai', description: 'Strong chai.', price: 1.49, category: 'Beverages', isVegetarian: true, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=70' }
    ],
    'Karachi Biryani Center': [
        { name: 'Chicken Biryani', description: 'Karachi style biryani.', price: 7.99, category: 'Biryani', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=70' },
        { name: 'Beef Biryani', description: 'Spicy beef biryani.', price: 8.99, category: 'Biryani', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=70' },
        { name: 'Raita', description: 'Cooling yogurt raita.', price: 0.99, category: 'Sides', isVegetarian: true, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=70' }
    ],
    'Burns Road BBQ - Karachi': [
        { name: 'Chapli Kebab', description: 'Classic chapli kebab.', price: 6.99, category: 'BBQ', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc500f?auto=format&fit=crop&w=800&q=70' },
        { name: 'Chicken Handi', description: 'Creamy handi.', price: 11.99, category: 'Handi', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=70' },
        { name: 'Kheer', description: 'Traditional dessert.', price: 3.49, category: 'Desserts', isVegetarian: true, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1605979399824-1f54d844d5f7?auto=format&fit=crop&w=800&q=70' }
    ],
    'Islamabad Grill & Co.': [
        { name: 'Classic Beef Burger', description: 'Beef burger with cheese.', price: 9.49, category: 'Burgers', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=70' },
        { name: 'Chicken Wrap', description: 'Grilled chicken wrap.', price: 6.99, category: 'Wraps', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=800&q=70' },
        { name: 'Cola', description: 'Chilled drink.', price: 1.25, category: 'Beverages', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1622484211045-a2b69a3b8b15?auto=format&fit=crop&w=800&q=70' }
    ],
    'Islamabad Cafe Corner': [
        { name: 'Cappuccino', description: 'Hot cappuccino.', price: 3.99, category: 'Cafe', isVegetarian: true, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=70' },
        { name: 'Club Sandwich', description: 'Toasted sandwich.', price: 5.99, category: 'Sandwiches', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=70' },
        { name: 'Chocolate Cake Slice', description: 'Rich chocolate cake.', price: 4.49, category: 'Desserts', isVegetarian: true, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=800&q=70' }
    ]
};

async function seedPkCities() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/befoody';
    console.log('🌱 Seeding PK city restaurants into:', uri);
    await mongoose.connect(uri);

    // Prefer demo restaurant owner, fallback to admin
    const owner = await User.findOne({ email: 'owner@restaurant.com' }) || await User.findOne({ role: 'admin' });
    if (!owner) {
        console.error('❌ No owner user found. Create admin/owner first.');
        process.exit(1);
    }

    let createdRestaurants = 0;
    let createdFoodItems = 0;

    for (const r of restaurants) {
        const existing = await Restaurant.findOne({ name: r.name });
        const restaurantDoc = existing
            ? await Restaurant.findByIdAndUpdate(existing._id, { $set: { ...r, ownerId: owner._id } }, { new: true })
            : await Restaurant.create({ ...r, ownerId: owner._id });

        if (!existing) createdRestaurants += 1;

        const menu = menuByRestaurantName[r.name] || [];
        for (const item of menu) {
            const existsFood = await FoodItem.findOne({ name: item.name, restaurantId: restaurantDoc._id });
            if (existsFood) continue;
            await FoodItem.create({ ...item, restaurantId: restaurantDoc._id });
            createdFoodItems += 1;
        }
    }

    console.log('✅ Seed complete.');
    console.log('Restaurants created:', createdRestaurants);
    console.log('Food items created:', createdFoodItems);

    await mongoose.disconnect();
}

seedPkCities().catch(async (err) => {
    console.error('❌ Seed failed:', err?.message || err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});

