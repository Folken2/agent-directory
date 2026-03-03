# Google OAuth Setup Instructions

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "ADK Samples")
4. Click "Create"

## Step 2: Enable Google+ API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google+ API" or "Google Identity"
3. Click on **Google Identity** (or **Google+ API**)
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace account)
3. Fill in required fields:
   - **App name**: ADK Samples (or your app name)
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **Save and Continue**
5. On **Scopes** page, click **Save and Continue** (default scopes are fine)
6. On **Test users** page (if in testing), add test emails, then **Save and Continue**

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Fill in:
   - **Name**: ADK Samples Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
5. Click **Create**
6. **Copy the Client ID and Client Secret** (you'll need these)

## Step 5: Add to Environment Variables

Add these to your `.env.local` file:

```bash
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your_random_secret_here
# Or use NEXTAUTH_SECRET (both work)
# NEXTAUTH_SECRET=your_random_secret_here
```

**Important:** You must set `NEXTAUTH_URL` to your application URL. This is critical for OAuth callbacks to work correctly.

### Generate AUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Or use an online generator: https://generate-secret.vercel.app/32

## Step 6: Restart Development Server

After adding environment variables, restart your Next.js development server:

```bash
npm run dev
```

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in Google Console exactly matches: `http://localhost:3000/api/auth/callback/google`
- Check for trailing slashes or http vs https mismatches

### "Invalid client" error
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
- Make sure there are no extra spaces in `.env.local`

### OAuth consent screen issues
- If testing, make sure your Google account is added as a test user
- For production, you'll need to submit for verification (if using sensitive scopes)

## Production Checklist

Before deploying to production:

- [ ] Update authorized redirect URIs with production domain
- [ ] Update NEXTAUTH_URL to production domain
- [ ] Submit OAuth consent screen for verification (if needed)
- [ ] Add production domain to authorized JavaScript origins
- [ ] Test Google sign-in on production domain

