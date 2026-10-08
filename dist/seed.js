"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("./models/User");
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/user_management';
const seed = async () => {
    await mongoose_1.default.connect(mongoUri);
    const email = 'vinod@gmail.com';
    const existingUser = await User_1.User.exists({ email });
    if (!existingUser) {
        await User_1.User.create({
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
