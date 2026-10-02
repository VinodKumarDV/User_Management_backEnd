"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mongoose_1 = __importDefault(require("mongoose"));
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/user_management';
const seedSchema = new mongoose_1.default.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });
const User = mongoose_1.default.model('User', seedSchema);
const seed = async () => {
    await mongoose_1.default.connect(mongoUri);
    const email = 'vinod@gmail.com';
    const existingUser = await User.exists({ email });
    if (!existingUser) {
        await User.create({
            firstName: 'Vinod',
            lastName: 'Kumar',
            email,
            password: await bcryptjs_1.default.hash('Password123', 12),
            status: 'Active',
        });
        console.log(`Seed user created: ${email} / Password123`);
    }
    else {
        console.log(`Seed user already exists: ${email}`);
    }
    await mongoose_1.default.disconnect();
};
seed().catch(async (error) => {
    console.error('Seeding failed.', error);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
