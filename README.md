# SocialNet Manager

**LBYCPG3 Online Technologies Laboratory — Activity 7**

A responsive Social Network Profile Manager built with HTML, CSS, Bootstrap 5, and Supabase.

## Features

- Add, search, and delete social network profiles
- View profile picture, status, favorite quote, and friends list
- Edit status, quote, and profile picture path
- Manage friends: add and remove by name
- All data persisted in Supabase (PostgreSQL) — survives page refresh
- Fully responsive: three-panel desktop layout stacks vertically on mobile
- Live status bar reflects every action

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | HTML5, CSS3, Bootstrap 5.3 (CDN)    |
| Fonts    | Source Serif 4 + DM Sans (Google)   |
| Icons    | Bootstrap Icons (CDN)               |
| Backend  | Supabase (PostgreSQL + REST API)    |
| Hosting  | Vercel (static deployment)          |

## Project Structure

```
socialnet-manager/
├── index.html              Main application file
├── css/
│   └── style.css           Custom styles and Bootstrap overrides
├── js/
│   └── app.js              Supabase queries and DOM logic
├── resources/
│   └── images/
│       └── default.svg     Default profile picture placeholder
└── README.md
```

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL blocks from the lab guide to create `profiles` and `friends` tables
3. Copy your **Project URL** and **Publishable (anon) key** from Supabase Settings > API
4. Open `js/app.js` and replace the placeholder values:
   ```js
   const SUPABASE_URL             = 'https://YOUR-PROJECT-ID.supabase.co'
   const SUPABASE_PUBLISHABLE_KEY = 'YOUR-PUBLISHABLE-KEY'
   ```
5. Open `index.html` in a browser or deploy to Vercel

## Deployment

Push to GitHub, then import the repository into [Vercel](https://vercel.com):
- Framework Preset: **Other**
- Build Command: *(leave blank)*
- Output Directory: *(leave blank)*

Vercel auto-deploys on every push to `main`.
