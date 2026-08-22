# Jagdamba Optical Full-Stack Website

This package contains your existing frontend plus a Node.js/Express + MongoDB backend and a responsive admin panel.

## Folder structure
- `frontend/` — customer website + `admin.html`
- `backend/` — REST API, authentication, MongoDB models and seed data

## Backend setup
1. Install Node.js.
2. Create a MongoDB Atlas database.
3. Copy `backend/.env.example` to `backend/.env`.
4. Add your MongoDB URI, JWT secret, admin email and admin password.
5. Run:
   `cd backend`
   `npm install`
   `npm run dev`

## Frontend
Serve the `frontend` folder with Live Server or another static server.
Default API URL is `http://localhost:5000`.

## Admin
Open `/admin.html` and log in with the credentials from `.env`.
From the panel you can:
- Add/edit/hide frames
- See customer enquiries
- Change enquiry status
- Update store phone, WhatsApp, address and opening hours
- See dashboard counts

## Production deployment
Deploy the backend to Render/Railway/Fly.io or another Node host and MongoDB Atlas for the database. Deploy the frontend to Vercel/Netlify/GitHub Pages and change the API URL in `script.js` and `admin.js` from localhost to your deployed backend URL.

## Security
Do not publish `.env`. Change the default admin password and use a long random JWT secret.
