import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { type HydratedDocument } from 'mongoose';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/user_management';
const jwtSecret = process.env.JWT_SECRET;
let mongoConnection: Promise<typeof mongoose> | null = null;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set in the environment.');
}

interface UserRecord {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    status: 'Active' | 'Inactive';
    createdAt: Date;
    updatedAt: Date;
}

interface AuthRequest extends Request {
    userId?: string;
}

interface UserInput {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    password?: unknown;
    status?: unknown;
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

const User = mongoose.model<UserRecord>('User', userSchema);
const publicUser = (user: HydratedDocument<UserRecord>) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));
app.use(async (_req: Request, res: Response, next: NextFunction) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            if (mongoose.connection.readyState !== 2 || !mongoConnection) {
                mongoConnection = mongoose.connect(mongoUri).catch((error: unknown) => {
                    mongoConnection = null;
                    throw error;
                });
            }
            await mongoConnection;
        }
        next();
    } catch (error) {
        console.error('Unable to connect to MongoDB.', error);
        res.status(503).json({ message: 'The database is temporarily unavailable.' });
    }
});

const requireText = (value: unknown, field: string, maxLength = 80): string | null => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        return `${field} is required and must be at most ${maxLength} characters.`;
    }
    return null;
};

const normalizeEmail = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return email.length <= 254 && emailPattern.test(email) ? email : null;
};

const handleDuplicateEmail = (error: unknown, res: Response) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ message: 'An account with this email already exists.' });
        return true;
    }
    return false;
};

const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authorization = req.header('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
        res.status(401).json({ message: 'Authentication is required.' });
        return;
    }

    try {
        const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
        if (typeof payload.sub !== 'string') throw new Error('Invalid token subject.');
        req.userId = payload.sub;
        next();
    } catch {
        res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
    }
};

app.post('/api/register', async (req: Request<unknown, unknown, UserInput>, res: Response) => {
    const { firstName, lastName, password } = req.body;
    const firstNameError = requireText(firstName, 'First name');
    const lastNameError = requireText(lastName, 'Last name');
    const email = normalizeEmail(req.body.email);
    if (firstNameError || lastNameError || !email) {
        res.status(400).json({ message: firstNameError ?? lastNameError ?? 'Enter a valid email address.' });
        return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
        return;
    }

    try {
        const existingUser = await User.exists({ email });
        if (existingUser) {
            res.status(409).json({ message: 'An account with this email already exists.' });
            return;
        }
        const user = await User.create({
            firstName: (firstName as string).trim(),
            lastName: (lastName as string).trim(),
            email,
            password: await bcrypt.hash(password, 12),
        });
        res.status(201).json({ message: 'Account created successfully.', user: publicUser(user) });
    } catch (error) {
        if (handleDuplicateEmail(error, res)) return;
        res.status(500).json({ message: 'Unable to create the account right now.' });
    }
});

app.post('/api/login', async (req: Request<unknown, unknown, UserInput>, res: Response) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || typeof password !== 'string' || !password) {
        res.status(400).json({ message: 'Enter a valid email address and password.' });
        return;
    }

    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await bcrypt.compare(password, user.password))) {
            res.status(401).json({ message: 'Email or password is incorrect.' });
            return;
        }
        if (user.status !== 'Active') {
            res.status(403).json({ message: 'This account is inactive. Contact an administrator.' });
            return;
        }
        const token = jwt.sign({}, jwtSecret, { subject: user.id, expiresIn: '12h' });
        res.json({ token, user: publicUser(user) });
    } catch {
        res.status(500).json({ message: 'Unable to sign in right now.' });
    }
});

app.get('/api/profile', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        res.json({ user: publicUser(user) });
    } catch {
        res.status(500).json({ message: 'Unable to load your profile right now.' });
    }
});

app.get('/api/users', authenticate, async (_req: AuthRequest, res: Response) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json({ users: users.map(publicUser) });
    } catch {
        res.status(500).json({ message: 'Unable to load users right now.' });
    }
});

app.get('/api/users/:id', authenticate, async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({ message: 'Invalid user ID.' });
        return;
    }
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        res.json({ user: publicUser(user) });
    } catch {
        res.status(500).json({ message: 'Unable to load this user right now.' });
    }
});

app.put('/api/users/:id', authenticate, async (req: Request<{ id: string }, unknown, UserInput> & AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({ message: 'Invalid user ID.' });
        return;
    }
    const { firstName, lastName, status } = req.body;
    const firstNameError = requireText(firstName, 'First name');
    const lastNameError = requireText(lastName, 'Last name');
    const email = normalizeEmail(req.body.email);
    if (firstNameError || lastNameError || !email) {
        res.status(400).json({ message: firstNameError ?? lastNameError ?? 'Enter a valid email address.' });
        return;
    }
    if (status !== 'Active' && status !== 'Inactive') {
        res.status(400).json({ message: 'Status must be Active or Inactive.' });
        return;
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { firstName: firstName.trim(), lastName: lastName.trim(), email, status },
            { new: true, runValidators: true },
        );
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        res.json({ message: 'User updated successfully.', user: publicUser(user) });
    } catch (error) {
        if (handleDuplicateEmail(error, res)) return;
        res.status(500).json({ message: 'Unable to update this user right now.' });
    }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
        res.status(400).json({ message: 'Request body must be valid JSON.' });
        return;
    }
    res.status(500).json({ message: 'An unexpected server error occurred.' });
});

if (!process.env.VERCEL) {
    mongoose.connect(mongoUri).then(() => {
        app.listen(port, () => console.log(`User API listening on http://localhost:${port}`));
    }).catch((error: unknown) => {
        console.error('Unable to start the API. Check MONGODB_URI and database availability.', error);
        process.exit(1);
    });
}

export default app;