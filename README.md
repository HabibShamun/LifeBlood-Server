# 🩸 LifeBlood Donation Platform (Backend)

The backend powers all core functionality of the LifeBlood Donation Platform.  
It provides secure APIs for authentication, donation request management, donor profiles, and funding support.

---

## 🌐 API Base URL
[https://your-backend-api-url.com]

---

## ⚙️ Key Backend Features
- 🔐 **Authentication & Security**
  - Firebase Admin SDK for verifying tokens.
  - Role-based access control (Admin, Volunteer, Donor).
  - Middleware to protect sensitive routes.

- 📝 **Donation Request Management**
  - Create, update, delete, and filter donation requests.
  - Status lifecycle: `pending → inprogress → done`.
  - Query endpoints for requests by email, ID, or status.

- 📊 **User Management**
  - Register new donors with profile details (district, upazila, blood type, phone, address).
  - Update donor profiles with secure validation.
  - Store donor information in MongoDB.

- 💳 **Funding & Payments**
  - Stripe integration for creating checkout sessions.
  - Support for preset and custom donation amounts.
  - Secure webhook handling for payment confirmation.

- 🖼️ **Image Hosting**
  - Profile photo uploads handled via **imgbb API**.
  - Stored URLs linked to donor profiles.

- 🛡️ **Robust API Design**
  - RESTful endpoints with clear naming conventions.
  - Error handling with descriptive responses.
  - Sorting and limiting queries for performance.

---

## 📦 Backend Packages Used

### Core
- **Express.js** – Web framework for building RESTful APIs.
- **MongoDB (Native Driver)** – Database for storing users, requests, and donations.
- **dotenv** – Environment variable management.
- **CORS** – Cross-origin resource sharing.

### Authentication & Security
- **Firebase Admin SDK** – Token verification for secure routes.
- **bcrypt / crypto** – Password hashing and security (if used for custom auth).
- **jsonwebtoken (JWT)** – Token handling for sessions (if used alongside Firebase).

### Payments
- **Stripe** – Payment gateway integration for donations.

### Utilities
- **Nodemon** – Development server auto-restart.
- **morgan** – HTTP request logging.
- **axios** – External API calls (e.g., imgbb).

---

## 🚀 Backend Highlights
- Clean RESTful API design with consistent route naming.
- Middleware enforcing **role-based permissions** and preventing bypass logic.
- Secure handling of **donation request lifecycle** and **funding transactions**.
- Integration with **Firebase Auth** and **Stripe** for a production-ready backend.
- Error handling and logging for maintainability.

---

💡 *This backend ensures the platform runs securely, reliably, and scales to support communities in need.*
