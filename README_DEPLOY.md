# Cloud Deployment Guide (Exact Replica)

This folder (`cloud_deploy_v2`) contains your **Cloud-Enabled** version of the Aone Board Tracker.
It has the **exact same features** as your local version (including the new NREGA Crawler), but saves data to **Supabase** instead of your PC.

## Prerequisites
*   **Git Bash** (or Git for Windows) must be installed. [Download Git](https://git-scm.com/downloads)
*   **Node.js** (you already have this).

## 1. Setup GitHub
1.  Open your terminal inside this folder (`cloud_deploy_v2`).
2.  Run these commands one by one to initialize the repository:
    ```bash
    git init
    git add .
    git commit -m "Initial Cloud Deployment"
    ```
3.  Go to [GitHub.com](https://github.com) and create a **New Repository** (empty).
4.  Copy the URL of your new repository.
5.  Link your local folder to GitHub:
    ```bash
    git remote add origin <YOUR_GITHUB_REPO_URL>
    git push -u origin main
    ```

## 2. Deploy to Netlify
1.  Log in to [Netlify](https://app.netlify.com).
2.  Click **"Add new site"** -> **"Import from existing project"**.
3.  Choose **GitHub** and select your repository.
4.  **Important:**
    *   **Base directory:** (Leave empty if you pushed just this folder)
    *   **Build Command:** `npm run build`
    *   **Publish Directory:** `.next`
5.  Click **Deploy**.

## 3. Configure Supabase Database
1.  Go to [Supabase](https://supabase.com) and create a New Project.
2.  Go to the **SQL Editor** section.
3.  Open the file `supabase_schema.sql` (included in this folder), copy all the text, and paste it into the SQL Editor.
4.  Click **Run** to create your database tables.

## 4. Connect Netlify to Supabase
1.  In Supabase, go to **Project Settings** -> **API**.
2.  Copy your **Project URL** and **anon public key**.
3.  In Netlify, go to **Site Settings** -> **Environment variables**.
4.  Add these two variables:
    *   `NEXT_PUBLIC_SUPABASE_URL`: (Paste your URL)
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Paste your Key)
5.  Trigger a **Redeploy** in Netlify (Deploys -> Trigger deploy).

## 5. Done!
Your app is now live! You can open it on your phone, log in with PIN `1234`, and see the data sync instantly!
