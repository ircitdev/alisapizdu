/**
 * Парсинг User-Agent и геолокация по IP
 */

function parseUserAgent(ua) {
  if (!ua) return { device: 'Unknown', os: 'Unknown' };

  let device = 'Desktop';
  let os = 'Unknown';

  // OS detection
  if (/iPhone/.test(ua)) {
    const match = ua.match(/iPhone\s?(?:OS\s)?(\d+[_.\d]*)/);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
    device = 'iPhone';
  } else if (/iPad/.test(ua)) {
    os = 'iPadOS';
    device = 'iPad';
  } else if (/Android/.test(ua)) {
    const verMatch = ua.match(/Android\s([\d.]+)/);
    os = verMatch ? `Android ${verMatch[1]}` : 'Android';
    // Try to get device model
    const modelMatch = ua.match(/;\s*([^;)]+)\s*Build/);
    if (modelMatch) {
      const model = modelMatch[1].trim();
      // Clean up common prefixes
      device = model.length > 20 ? model.slice(0, 20) : model;
    } else {
      device = /Mobile/.test(ua) ? 'Android Phone' : 'Android Tablet';
    }
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    const match = ua.match(/Mac OS X\s([\d_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
    device = 'Mac';
  } else if (/Windows NT/.test(ua)) {
    const match = ua.match(/Windows NT\s([\d.]+)/);
    const versions = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    const ver = match ? versions[match[1]] || match[1] : '';
    os = `Windows ${ver}`.trim();
    device = 'PC';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
    device = /Mobile/.test(ua) ? 'Phone' : 'PC';
  } else if (/CrOS/.test(ua)) {
    os = 'ChromeOS';
    device = 'Chromebook';
  }

  return { device, os };
}

/**
 * Определение города/страны по IP через бесплатный API
 */
async function getGeoByIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { city: 'Local', country: '🏠' };
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,countryCode&lang=ru`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return { city: null, country: null };

    const data = await res.json();
    return {
      city: data.city || null,
      country: data.countryCode || null,
    };
  } catch {
    return { city: null, country: null };
  }
}

// Country code → flag emoji
function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

function parseBrowser(ua) {
  if (!ua) return 'Unknown';
  if (/YaBrowser/.test(ua)) return 'Яндекс Браузер';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Browser';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  return 'Unknown';
}

module.exports = { parseUserAgent, parseBrowser, getGeoByIP, countryFlag };
