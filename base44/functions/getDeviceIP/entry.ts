export async function handler(payload: any) {
  try {
    // Get client IP from request headers
    const clientIp = payload.ip || "Unknown";
    
    return {
      success: true,
      ip_address: clientIp,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get IP"
    };
  }
}