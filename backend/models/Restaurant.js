const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    cuisine: [{
        type: String,
        trim: true
    }],
    imageUrl: {
        type: String
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String
    },
    phone: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    deliveryTime: {
        type: Number, // in minutes
        default: 30
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    minimumOrder: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isOpen: {
        type: Boolean,
        default: true
    },
    hours: [{
        day: { type: String, trim: true },
        open: { type: String, trim: true },  // "10:00"
        close: { type: String, trim: true }, // "22:00"
        closed: { type: Boolean, default: false }
    }],
    notificationSoundEnabled: {
        type: Boolean,
        default: true
    },
    notificationsMutedUntil: {
        type: Date
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    serviceCountry: {
        type: String,
        default: 'Pakistan',
        trim: true
    },
    serviceProvince: {
        type: String,
        trim: true
    },
    serviceCity: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Restaurant', restaurantSchema);
