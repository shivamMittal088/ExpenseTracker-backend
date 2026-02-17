# MongoDB & Mongoose

## Schema Design

### Embedded Documents vs References

In Expense Tracker, we use **embedded documents** for category inside expense:

```typescript
// Embedded (stored inside expense document)
const ExpenseSchema = new Schema({
  category: {
    name: String,
    color: String,
    emoji: String
  }
});
```

**When to embed:**
- Data is always accessed together
- One-to-few relationship
- Data doesn't change often

**When to reference:**
- Many-to-many relationships
- Data is accessed independently
- Frequently updated

---

## The `.lean()` Method

When you only need to read data (not modify it), use `.lean()` to get plain JavaScript objects instead of Mongoose documents.

```typescript
  .sort({ loginAt: -1 })
  .lean();
```

**Why it's faster:**
- Skips building full Mongoose document objects
- No getters/setters or change tracking
- Uses less memory
- Can be 3-5x faster for read operations

**When NOT to use:**
- When you need to call `.save()` on the document
- When you need Mongoose virtuals or methods

---

## Set vs Array for Lookups

For checking if a value exists in a list, use `Set` instead of `Array`:

```typescript
// Array - O(n) lookup (checks each item one by one)
const allowedModes = ["cash", "card", "bank_transfer", "wallet", "UPI"];
allowedModes.includes("UPI");  // Checks 5 items

// Set - O(1) lookup (instant hash-based lookup)
const allowedModes = new Set(["cash", "card", "bank_transfer", "wallet", "UPI"]);
allowedModes.has("UPI");  // Instant!
```

**Rule of thumb:** Use Set when checking membership frequently or with large lists.

---

## Queries and Indexes

### Date Range Queries

```typescript
const startOfDay = new Date(rawDate + "T00:00:00.000Z");
const endOfDay = new Date(rawDate + "T23:59:59.999Z");

await Expense.find({
  occurredAt: {
    $gte: startOfDay,
    $lte: endOfDay
  }
});
```

---
