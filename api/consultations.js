const Stripe = require('stripe');
const axios = require('axios');
const { getServiceRate } = require('./config');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory storage for approvals (in production, use a database)
// For Vercel, we'll use Vercel KV or store in client-side localStorage
let approvalCache = {};

// Fetch consultations from Stripe
async function fetchStripeConsultations(startDate, endDate) {
  try {
    const charges = await stripe.charges.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      },
      limit: 100,
      expand: ['data.customer']
    });

    return charges.data
      .filter(charge => charge.status === 'succeeded')
      .map(charge => ({
        id: `stripe_${charge.id}`,
        source: 'stripe',
        patientName: charge.customer?.name || charge.billing_details?.name || 'Unknown',
        patientEmail: charge.customer?.email || charge.billing_details?.email || '',
        serviceType: charge.description || 'Consultation',
        amount: charge.amount / 100,
        calculatedAmount: getServiceRate(charge.description || 'Consultation'),
        date: new Date(charge.created * 1000).toISOString(),
        status: 'pending',
        stripeChargeId: charge.id
      }));
  } catch (error) {
    console.error('Stripe fetch error:', error.message);
    return [];
  }
}

// Fetch consultations from Go High Level
async function fetchGHLConsultations(startDate, endDate) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    console.log('GHL credentials not configured');
    return [];
  }

  try {
    const response = await axios.get(
      `https://services.leadconnectorhq.com/calendars/events`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28'
        },
        params: {
          locationId: locationId,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        }
      }
    );

    const events = response.data?.events || [];
    return events
      .filter(event => event.status === 'confirmed' || event.status === 'showed')
      .map(event => ({
        id: `ghl_${event.id}`,
        source: 'gohighlevel',
        patientName: event.contact?.name || event.title || 'Unknown',
        patientEmail: event.contact?.email || '',
        serviceType: event.calendarName || event.title || 'Consultation',
        amount: 0,
        calculatedAmount: getServiceRate(event.calendarName || event.title || 'Consultation'),
        date: event.startTime || event.start,
        status: 'pending',
        ghlEventId: event.id
      }));
  } catch (error) {
    console.error('GHL fetch error:', error.message);
    return [];
  }
}

// Merge and deduplicate consultations from both sources
function mergeConsultations(stripeData, ghlData) {
  const merged = [...stripeData];
  const stripeEmails = new Set(stripeData.map(c => c.patientEmail.toLowerCase()).filter(e => e));

  // Add GHL consultations that don't have a matching Stripe payment
  for (const ghlConsult of ghlData) {
    const emailMatch = ghlConsult.patientEmail &&
      stripeEmails.has(ghlConsult.patientEmail.toLowerCase());

    if (!emailMatch) {
      merged.push(ghlConsult);
    }
  }

  // Sort by date descending
  return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// API Handler
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse query parameters for date filtering
    const { year, month } = req.query;

    let startDate, endDate;

    if (year && month) {
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Fetch from both sources
    const [stripeData, ghlData] = await Promise.all([
      fetchStripeConsultations(startDate, endDate),
      fetchGHLConsultations(startDate, endDate)
    ]);

    // Merge and deduplicate
    const consultations = mergeConsultations(stripeData, ghlData);

    return res.status(200).json({
      success: true,
      period: {
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      consultations,
      sources: {
        stripe: stripeData.length,
        gohighlevel: ghlData.length,
        total: consultations.length
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
