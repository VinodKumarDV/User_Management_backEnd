import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from './models/User';

const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/user_management';

const seed = async () => {
    await mongoose.connect(mongoUri);
    const email = 'vinod@gmail.com';
    const existingUser = await User.exists({ email });
    if (!existingUser) {
        await User.create({
            firstName: 'Vinod',
            lastName: 'Kumar',
            email,
            password: await bcrypt.hash('Password123', 12),
            status: 'Active',
        });
        console.log(`Seed user created: ${email} / Password123`);
    } else {
        console.log(`Seed user already exists: ${email}`);
    }
    await mongoose.disconnect();
};

seed().catch(async (error: unknown) => {
    console.error('Seeding failed.', error);
    await mongoose.disconnect();
    process.exit(1);
});