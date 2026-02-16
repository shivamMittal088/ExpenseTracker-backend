# TypeScript with Express

## Extending the Request Type

To add custom properties (like `user`) to Express Request:

```typescript
// In src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
```

This lets you access `req.user` with proper typing throughout your app.

**Why it works:**
- TypeScript's declaration merging combines interfaces with the same name
- The `global` keyword makes it available everywhere
- Express looks for these type extensions automatically

---

## Type Casting in Middleware

When middleware adds properties that TypeScript doesn't know about:

```typescript
// Quick way (less safe)
const userId = (req as any).user._id;

// Better way - create a typed interface
interface AuthRequest extends Request {
  user: IUser;
}

// Cast once, use with full typing
const authReq = req as AuthRequest;
const userId = authReq.user._id;  // ✅ Full autocomplete
```

---

## Interfaces for Documents

Define interfaces for your Mongoose schemas:

```typescript
export interface IUser extends Document {
  name: string;
  emailId: string;
  password: string;
  photoURL?: string;
  statusMessage?: string;
  currency: "INR";
  preferences: {
    darkMode: boolean;
    startWeekOnMonday: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  // Schema definition...
});
```

**Benefits:**
- Autocomplete for document properties
- Type errors when accessing wrong properties
- Better refactoring support

---

## Generics in Express Handlers

Type your request body, params, and query:

```typescript
// Define types
interface ExpenseBody {
  amount: number;
  category: { name: string; color: string; emoji: string };
  notes?: string;
  payment_mode: string;
}

interface ExpenseParams {
  expenseId: string;
}

// Use in handler
router.patch(
  "/expense/:expenseId",
  async (req: Request<ExpenseParams, {}, ExpenseBody>, res: Response) => {
    const { expenseId } = req.params;  // ✅ Typed as string
    const { amount } = req.body;       // ✅ Typed as number
  }
);
```

---
