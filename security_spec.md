# Security Specification - Kunthy Watch Store Management

This document outlines the security requirements, data invariants, adversarial attack vectors (the "Dirty Dozen" payloads), and test assertions for the Firestore Database securing the Kunthy Watch Store.

## 1. Data Invariants

Our database architecture stores the full application state in a single document under the `/shop/{shopId}` collection (specifically `/shop/kunthy_watch`). The data invariants for this schema are as follows:

1. **Path Variable Integrity**:
   - The `{shopId}` document ID must be valid: string, size between 1 and 128, matching the regex `^[a-zA-Z0-9_\-]+$`.

2. **Schema Uniformity (Strict Properties)**:
   - The shop document must strictly contain the five core transaction lists: `watches`, `sales`, `incomes`, `expenses`, and `capitalTransactions`.
   - No unknown top-level keys are permitted (prevention of "Ghost Fields" and Shadow updates).

3. **Value Boundary Limits (Denial-of-Wallet Guard)**:
   - Every string field in `watches`, `sales`, `incomes`, etc., must be strictly bounded in length (e.g., names and descriptions <= 250 characters) to prevent excessive memory and storage usage.
   - All numeric properties representing quantities, stock, prices, or transaction amounts must be non-negative.

4. **Relational Constraints**:
   - Every transaction in the `sales` list must reference a valid `watchId`.
   - Profit calculations on sales must mathematically match: `profit == (sellPrice - costPrice) * quantity` and `totalPrice == sellPrice * quantity`.

---

## 2. The "Dirty Dozen" Payloads

These 12 payloads represent malicious attempts to bypass identity validation, inject toxic payloads, corrupt state logic, or exhaust resources.

### Payload 1: Shadow Fields / Schema Poisoning
An attacker attempts to inject a top-level `isAdmin` or `role` property into the shop state document to elevate their client privileges.
```json
{
  "watches": [],
  "sales": [],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": [],
  "isAdmin": true,
  "system_override_key": "malicious"
}
```

### Payload 2: Path Poisoning (Huge ID)
An attacker attempts to write to a document with a 2MB generated ID containing illegal special characters.
```
Path: /shop/kunthy_watch_$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$__VERY_LONG_STRING_OVER_1000_CHARACTERS_TO_CAUSE_DENIAL_OF_WALLET
```

### Payload 3: Toxic String Injection in Watch Brand
An attacker attempts to inject a 10MB string as a watch brand to blow up Firestore database storage costs.
```json
{
  "watches": [
    {
      "id": "watch_1",
      "brand": "A".repeat(1000000),
      "model": "Submariner",
      "costPrice": 5000,
      "sellPrice": 7500,
      "stock": 10
    }
  ],
  "sales": [],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": []
}
```

### Payload 4: Negative Inventory (Stock Poisoning)
An attacker attempts to set a negative stock value (`stock: -999`) to corrupt inventory metrics.
```json
{
  "watches": [
    {
      "id": "watch_1",
      "brand": "Rolex",
      "model": "Datejust",
      "costPrice": 6000,
      "sellPrice": 8500,
      "stock": -999
    }
  ],
  "sales": [],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": []
}
```

### Payload 5: Negative Price Injection
An attacker attempts to inject negative pricing to trick the financial reporting components.
```json
{
  "watches": [
    {
      "id": "watch_1",
      "brand": "Rolex",
      "model": "Daytona",
      "costPrice": -500,
      "sellPrice": 12000,
      "stock": 5
    }
  ],
  "sales": [],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": []
}
```

### Payload 6: Malformed Transaction (Empty Fields)
An attacker attempts to insert a sale entry missing critical identification or monetary fields.
```json
{
  "watches": [],
  "sales": [
    {
      "id": "sale_1",
      "quantity": 1
    }
  ],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": []
}
```

### Payload 7: Impossible Profit Math
An attacker attempts to falsify transaction records to show $0.01 profit on a high-value transaction or report negative sales profit.
```json
{
  "watches": [],
  "sales": [
    {
      "id": "sale_1",
      "watchId": "watch_1",
      "quantity": 2,
      "costPrice": 100,
      "sellPrice": 150,
      "totalPrice": 300,
      "profit": -5000,
      "date": "2026-06-25",
      "seller": "Pich"
    }
  ],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": []
}
```

### Payload 8: Falsifying Capital Transaction Types
An attacker tries to inject an invalid capital transaction type (e.g. `"steal"` instead of `"deposit"` or `"withdraw"`).
```json
{
  "watches": [],
  "sales": [],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": [
    {
      "id": "tx_1",
      "amount": 5000,
      "type": "steal",
      "desc": "Malicious taking",
      "date": "2026-06-25"
    }
  ]
}
```

### Payload 9: Large Array Exhaustion (Denial-of-Wallet)
An attacker attempts to upload an array of 500,000 blank or tiny items to overwhelm the Firestore parser and reader.
```json
{
  "watches": [],
  "sales": [],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": []
  // repeated 10000 times
}
```

### Payload 10: Unauthorized Global Database Access
An attacker attempts to write to a completely random collection (e.g. `/users/attacker` or `/admin_settings/config`) to store phishing code or bypass the `/shop` namespace rules.
```
Path: /users/attacker
Payload: { "phishing": "active" }
```

### Payload 11: Falsified System-Generated Fields
An attacker tries to tamper with the system-generated metadata or logs of the store.
```json
{
  "watches": [],
  "sales": [],
  "incomes": [],
  "expenses": [],
  "capitalTransactions": [],
  "system_log": "OVERWRITTEN"
}
```

### Payload 12: Invalid Expense/Income Category Injection
An attacker inserts extreme/toxic strings into operational expense categories to break categorization charts.
```json
{
  "watches": [],
  "sales": [],
  "incomes": [],
  "expenses": [
    {
      "id": "exp_1",
      "amount": 200,
      "category": "A".repeat(5000),
      "desc": "Toxic Category",
      "date": "2026-06-25"
    }
  ],
  "capitalTransactions": []
}
```

---

## 3. The Test Runner Spec

We describe the local assertions that ensure the security rules robustly deny all twelve payloads.

| Test Case ID | Payload Checked | Target Resource / Action | Expected Result |
|--------------|-----------------|--------------------------|-----------------|
| T1           | Payload 1       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T2           | Payload 2       | `/shop/illegal_$$$` (Write)  | `PERMISSION_DENIED` |
| T3           | Payload 3       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T4           | Payload 4       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T5           | Payload 5       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T6           | Payload 6       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T7           | Payload 7       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T8           | Payload 8       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T9           | Payload 9       | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T10          | Payload 10      | `/users/attacker` (Write)    | `PERMISSION_DENIED` |
| T11          | Payload 11      | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
| T12          | Payload 12      | `/shop/kunthy_watch` (Write) | `PERMISSION_DENIED` |
