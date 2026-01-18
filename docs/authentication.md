# Authentication

## JWT with HTTP-only Cookies

HTTP-only cookies prevent JavaScript from accessing the token, protecting against XSS attacks.

```typescript
res.cookie("token", token, {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  expires: expiresAt,
});
```

---

## Password Hashing with bcrypt

Never store plain text passwords. Use bcrypt to hash and compare:

```typescript
// Hashing (on signup)
const hashPassword = await bcrypt.hash(password, 10);

// Comparing (on login)
const isMatch = await bcrypt.compare(password, user.password);
```

The number `10` is the salt rounds - higher is more secure but slower.

---

## Single-Device Login

To enforce one device at a time, delete old sessions when a new login occurs:

```typescript
await SessionToken.findOneAndDelete({ userId: user._id });
// Then create new session...
```

---
