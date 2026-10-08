import mongoose from 'mongoose';

export interface UserRecord {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    status: 'Active' | 'Inactive';
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserRecord>(
    {
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, select: false },
        status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    },
    { timestamps: true },
);

export const User = mongoose.models.User ?? mongoose.model<UserRecord>('User', userSchema);