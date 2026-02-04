const Stripe = require('stripe');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Check if payment is a consultation
function isConsultation(description) {
  if (!description) return false;
  return description.toLowerCase().includes('consultation');
}

// Fetch consultations from Stripe
async function fetchStripeConsultations(startDate, endDate) {
  const charges = await stripe.charges.list({
    created: {
      gte: Math.floor(startDate.getTime() / 1000),
      lte: Math.floor(endDate.getTime() / 1000)
    },
    limit: 100,
    expand: ['data.customer']
  });

  return charges.data
    .filter(charge =>
      charge.status === 'succeeded' &&
      isConsultation(charge.description)
    )
    .map(charge => ({
      id: `stripe_${charge.id}`,
      source: 'stripe',
      patientName: charge.customer?.name || charge.billing_details?.name || 'Unknown',
      patientEmail: charge.customer?.email || charge.billing_details?.email || '',
      serviceType: charge.description || 'Consultation',
      amount: charge.amount / 100,
      calculatedAmount: 100, // Dr Lachlan gets $100 per consultation
      date: new Date(charge.created * 1000).toISOString(),
      status: 'pending',
      stripeChargeId: charge.id
    }));
}

// API Handler
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { year, month } = req.query;

    let startDate, endDate;

    if (year && month) {
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const consultations = await fetchStripeConsultations(startDate, endDate);
    consultations.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      success: true,
      period: {
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      consultations,
      total: consultations.length
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
