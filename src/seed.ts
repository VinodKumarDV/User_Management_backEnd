import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/user_management';
const seedSchema = new mongoose.Schema(
    {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, required: true, select: false },
        status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    },
    { timestamps: true },
);
const User = mongoose.model('User', seedSchema);

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