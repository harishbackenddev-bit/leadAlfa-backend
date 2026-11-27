# Leeds Alpha – Backend

This repository contains the backend implementation for the Leeds Alpha platform – a user-generated content web application. The backend is built using Node.js, Express.js, PostgreSQL, Sequelize ORM

## Tech Stack

Runtime: Node.js (Express.js)

Database: PostgreSQL (local / Neon cloud)

ORM: Sequelize

Authentication:

JWT (Access + Refresh tokens)

Auth0 (Google, Apple, Facebook logins)

Email OTP verification

Deployment: Render (backend) + Neon (database)

## Project Structure
```bash
├── config/        # Database & service configurations
├── controllers/   # API controllers
├── middlewares/   # Auth & role-based middlewares
├── models/        # Sequelize models
├── routes/        # API routes
├── services/      # Business logic (auth, assets, etc.)
├── utils/         # Helpers (JWT, password hashing, errors)
└── index.js       # Entry point
```

## Setup Instructions
1. Clone the repository
```bash
git clone https://github.com/pushkar33/Leeds-Alpha.git
cd Leeds-Alpha
git checkout master   # switch to master branch where code is present
```
2. Install dependencies
```bash
npm install
```
3. Setup environment variables

Create a .env file in the project root based on the example below:
```bash
# Server
PORT=8080
NODE_ENV=development

# Database (local Postgres)
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=leads_alpha
DB_DIALECT=postgres

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret

# Email (Nodemailer)
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_app_password   # if Gmail, use App Password

# Auth0
AUTH0_DOMAIN=your_auth0_domain
AUTH0_CLIENT_ID=your_auth0_client_id
```

4. Database Setup

Local: Make sure PostgreSQL is running and your .env values match.

5. Start the server
```bash
node index
```



