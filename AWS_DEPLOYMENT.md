# AWS Prototype Deployment

This branch prepares the Drug Logbook to run from a cloud server so iPads and MacBooks can open the app without Sasa's MacBook being present.

Use demo/test data only until hospital IT, information governance, data protection, and clinical safety approval are complete.

## Recommended First Deployment

Use **AWS Lightsail Ubuntu** for the first hosted prototype.

Why Lightsail first:

- The current app is a normal React + Express + SQLite project.
- Lightsail gives the app a persistent server disk for the SQLite database.
- It is simpler than rewriting the backend for Cloudflare Workers/D1.
- It can stay online when the MacBook is off.

## What Runs In The Cloud

- Express API: `server/server.js`
- React frontend: built into `client/dist`
- Database: SQLite file on the AWS server
- One public URL serves both frontend and backend

## Required Environment Variables

Create `server/.env` on the AWS server:

```bash
NODE_ENV=production
PORT=8000
CORS_ORIGIN=https://your-demo-domain.example
JWT_SECRET=replace-with-a-long-random-secret
DEFAULT_ADMIN_PASSWORD=change-this-admin-password
DRUGLOG_DB_PATH=/var/lib/drug-logbook/druglog.db
```

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

## Build Commands

From the project root:

```bash
npm run install:all
npm run build
npm start
```

The production server serves the React build automatically from `client/dist`.

## Lightsail Server Setup

On a new Ubuntu Lightsail instance:

```bash
sudo apt update
sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Create database directory:

```bash
sudo mkdir -p /var/lib/drug-logbook
sudo chown -R $USER:$USER /var/lib/drug-logbook
```

Clone the project:

```bash
git clone https://github.com/sashajokic74/drug-logbook.git
cd drug-logbook
git checkout deploy/aws-prototype
```

Create `server/.env`, then install and build:

```bash
npm run install:all
npm run build
NODE_ENV=production npm start
```

## Keep It Running With PM2

```bash
sudo npm install -g pm2
pm2 start server/server.js --name drug-logbook --update-env
pm2 save
pm2 startup
```

After `pm2 startup`, run the command it prints.

Useful PM2 commands:

```bash
pm2 status
pm2 logs drug-logbook
pm2 restart drug-logbook --update-env
```

## Updating The Cloud App

On the AWS server:

```bash
cd drug-logbook
git pull
npm run install:all
npm run build
pm2 restart drug-logbook --update-env
```

## Important Safety Notes

- Do not use real patients or real controlled drug records in this prototype until formal approval is in place.
- Use strong admin passwords and a strong `JWT_SECRET`.
- Do not commit `server/.env` or the live SQLite database to GitHub.
- For a real pilot, move from SQLite on disk to a managed database with backups and access controls.
