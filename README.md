# Consultant Invoice Calculator

A web application to automatically calculate monthly invoices by pulling consultation data from Stripe and Go High Level, with manual approval/rejection capability.

## Features

- **Data Integration**: Pulls transactions from Stripe and appointments from Go High Level
- **Automatic Calculation**: Calculates invoice amounts based on service type rates
- **Manual Approval**: Approve or reject individual consultations
- **Monthly Filtering**: View and filter consultations by month
- **Service Breakdown**: See subtotals grouped by service type
- **CSV Export**: Export approved consultations to CSV
- **Print Ready**: Clean print layout for physical copies

## Service Rates

| Service Type | Rate |
|-------------|------|
| Initial Consultation | $100 |
| Consultation | $100 |
| Pathology Review | $85 |
| Follow-up Consultation | $50 |
| Repeat Script | $33 |

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

- **STRIPE_SECRET_KEY**: Get from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
- **GHL_API_KEY**: Get from Go High Level Settings > Business Info > API Key
- **GHL_LOCATION_ID**: Found in Go High Level Settings > Business Info

### 3. Deploy to Vercel

**Option A: Using Vercel CLI**

```bash
npm install -g vercel
vercel
```

**Option B: Using Vercel Dashboard**

1. Push code to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com)
3. Add environment variables in project settings
4. Deploy

### 4. Add Environment Variables in Vercel

In Vercel project settings, add:

- `STRIPE_SECRET_KEY`
- `GHL_API_KEY`
- `GHL_LOCATION_ID`

## Local Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
webpage-appointment-peakspan/
├── api/
│   ├── config.js         # Service rates configuration
│   ├── consultations.js  # Fetch consultations endpoint
│   └── summary.js        # Monthly summary endpoint
├── public/
│   ├── index.html        # Main dashboard
│   ├── css/
│   │   └── styles.css    # Dashboard styling
│   └── js/
│       └── app.js        # Frontend logic
├── package.json
├── vercel.json           # Vercel deployment config
├── .env.example          # Environment template
└── README.md
```

## API Endpoints

- `GET /api/consultations?year=YYYY&month=MM` - Fetch consultations for a month
- `POST /api/summary` - Calculate invoice summary

## How It Works

1. **Data Fetching**: The app fetches payment data from Stripe and appointment data from Go High Level
2. **Deduplication**: Records are merged and deduplicated based on patient email
3. **Rate Calculation**: Each consultation is assigned a rate based on service type
4. **Approval System**: Users can approve/reject each consultation
5. **Invoice Calculation**: Only approved consultations are included in the total

## Notes

- Approval states are stored in browser localStorage
- For production, consider using Vercel KV or a database for persistent storage
- The app shows mock data if API calls fail (useful for testing)
