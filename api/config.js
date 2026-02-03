// Service rates configuration
const SERVICE_RATES = {
  'Initial Consultation': 100,
  'Consultation': 100,
  'Pathology Review': 85,
  'Follow-up Consultation': 50,
  'Repeat Script': 33
};

// Helper to get rate for a service type
function getServiceRate(serviceType) {
  // Try exact match first
  if (SERVICE_RATES[serviceType]) {
    return SERVICE_RATES[serviceType];
  }

  // Try case-insensitive match
  const lowerType = serviceType.toLowerCase();
  for (const [key, value] of Object.entries(SERVICE_RATES)) {
    if (key.toLowerCase() === lowerType) {
      return value;
    }
  }

  // Default rate if service type not found
  return 100;
}

module.exports = { SERVICE_RATES, getServiceRate };
