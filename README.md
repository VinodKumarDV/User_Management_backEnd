# Backend

The Express API uses MongoDB for persistence and JWT for authenticated user operations. For workspace prerequisites and full-stack setup, see the [workspace README](../README.md).

Copy `.env.example` to `.env`, set a unique `JWT_SECRET`, then run:

```powershell
npm install
npm run dev
```

The API listens on port 4000 by default. Run `npm run seed` to create the sample account, `npm test` for directory-query tests, and `npm run build` to compile the backend.
"# User_Management_backEnd" 
