const { SERVICE_RATES } = require('./config');

// API Handler for monthly summary
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // This endpoint receives approved consultations from the client
    // and calculates the summary
    const { consultations = [] } = req.body || {};

    // Group by service type
    const byServiceType = {};
    let grandTotal = 0;

    for (const consultation of consultations) {
      if (consultation.status !== 'approved') continue;

      const serviceType = consultation.serviceType || 'Consultation';
      if (!byServiceType[serviceType]) {
        byServiceType[serviceType] = {
          count: 0,
          rate: consultation.calculatedAmount,
          subtotal: 0
        };
      }
      byServiceType[serviceType].count++;
      byServiceType[serviceType].subtotal += consultation.calculatedAmount;
      grandTotal += consultation.calculatedAmount;
    }

    // Build summary
    const summary = {
      serviceBreakdown: Object.entries(byServiceType).map(([type, data]) => ({
        serviceType: type,
        count: data.count,
        rate: data.rate,
        subtotal: data.subtotal
      })),
      grandTotal,
      approvedCount: consultations.filter(c => c.status === 'approved').length,
      rejectedCount: consultations.filter(c => c.status === 'rejected').length,
      pendingCount: consultations.filter(c => c.status === 'pending').length,
      rates: SERVICE_RATES
    };

    return res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Summary API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
