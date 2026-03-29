# UoEm Student's Voice

A full-stack complaint management platform for universities or secondary schools, built with Node.js, Express, SQLite via `sql.js`, JWT authentication, and a responsive frontend.

## Features

- Student registration and login
- Admin login and dashboard
- Complaint submission with category, description, timestamp, and optional file upload
- Complaint tracking with statuses: `Pending`, `In Progress`, `Resolved`
- Admin responses to complaints
- Search, filters, and dashboard statistics
- Demo school branding for `University of Embu`
- Seeded sample users and complaints for presentation/demo use

## Folder Structure

```text
student-complaint-feedback-system/
├── data/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── uploads/
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Setup Instructions

1. Run `npm install`
2. Run `npm start`
3. Open `http://localhost:3000`

## Demo Accounts

- Admin: `admin@uoem.ac.ke` / `Admin@123`
- Student: `student@uoem.ac.ke` / `Student@123`

## Deployment Notes

- Best simple hosting: Render or Railway
- For production, set `JWT_SECRET` to a secure value
- For serverless hosting, replace SQLite/uploads with hosted services

### Render

This repo includes [render.yaml](c:/Users/Dell/Desktop/edith/render.yaml) for a quick web-service deploy.

Render settings:

- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm start`

Important note:

- This app currently stores its SQLite database and uploaded files on the local filesystem.
- On Render free web services, local disk data is not guaranteed to persist across restarts/redeploys.
- For a permanent production setup, move the database and uploads to managed cloud services.
