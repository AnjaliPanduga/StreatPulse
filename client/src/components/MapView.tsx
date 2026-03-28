import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import * as h3 from 'h3-js';
import { RiskCell } from '../hooks/useRiskSocket';

interface MapViewProps {
  risks: Map<string, RiskCell>;
  userPosition: { lat: number; lng: number } | null;
}

const RISK_COLORS: Record<string, string> = {
  safe: '#22c55e',
  caution: '#f59e0b',
  high_risk: '#ef4444',
};

const RISK_FILL_OPACITY: Record<string, number> = {
  safe: 0.25,
  caution: 0.4,
  high_risk: 0.55,
};

export default function MapView({ risks, userPosition }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hexLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);

  const [navMode, setNavMode] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ safe: boolean; msg: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [17.385, 78.486],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    hexLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const updateRiskZones = useCallback(() => {
    const map = mapRef.current;
    const hexLayer = hexLayerRef.current;
    if (!map || !hexLayer) return;

    hexLayer.clearLayers();

    risks.forEach((cell) => {
      if (cell.riskScore <= 0) return;

      try {
        const boundary = h3.cellToBoundary(cell.h3Index);
        const latLngs: L.LatLngExpression[] = boundary.map(([lat, lng]) => [lat, lng]);

        const color = RISK_COLORS[cell.riskLevel] || RISK_COLORS.safe;
        const fillOpacity = RISK_FILL_OPACITY[cell.riskLevel] || 0.15;

        const polygon = L.polygon(latLngs, {
          color: color,
          weight: 1.5,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: fillOpacity,
          className: `risk-hex risk-hex-${cell.riskLevel}`,
        });

        const levelLabel = cell.riskLevel === 'high_risk' ? '🔴 High Risk'
          : cell.riskLevel === 'caution' ? '🟡 Caution' : '🟢 Safe';

        polygon.bindPopup(`
          <div style="font-family:Inter,sans-serif;color:#f0f0f5;padding:4px 0;min-width:180px;">
            <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:${color}">
              ${levelLabel}
            </div>
            <div style="font-size:12px;color:#8a8a9a;line-height:1.8;">
              Risk Score: <b style="color:#f0f0f5">${cell.riskScore}</b>/100<br/>
              Slowdowns: <b style="color:#f0f0f5">${cell.slowdownCount || 0}</b> · 
              Reroutes: <b style="color:#f0f0f5">${cell.rerouteCount || 0}</b><br/>
              Danger Reports: <b style="color:#f0f0f5">${cell.dangerTapCount || 0}</b> · 
              Users: <b style="color:#f0f0f5">${cell.uniqueUsers || 0}</b>
            </div>
          </div>
        `, {
          className: 'risk-popup-leaflet',
          closeButton: true,
        });

        polygon.on('mouseover', (e) => {
          (e.target as L.Polygon).setStyle({ fillOpacity: fillOpacity + 0.2, weight: 2.5 });
        });
        polygon.on('mouseout', (e) => {
          (e.target as L.Polygon).setStyle({ fillOpacity: fillOpacity, weight: 1.5 });
        });

        hexLayer.addLayer(polygon);
      } catch {
        // skip invalid h3 cells
      }
    });
  }, [risks]);

  useEffect(() => {
    updateRiskZones();
  }, [updateRiskZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition) return;

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker([userPosition.lat, userPosition.lng], {
        radius: 8,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 3,
        className: 'user-marker-pulse',
      }).addTo(map);

      map.setView([userPosition.lat, userPosition.lng], 14);
    } else {
      userMarkerRef.current.setLatLng([userPosition.lat, userPosition.lng]);
    }
  }, [userPosition]);

  const calculateRoute = async (targetLat: number, targetLng: number) => {
    const map = mapRef.current;
    if (!map || !userPosition) return;

    try {
      setRouteInfo({ safe: true, msg: 'Calculating route...' });
      const url = `https://router.project-osrm.org/route/v1/driving/${userPosition.lng},${userPosition.lat};${targetLng},${targetLat}?overview=full&geometries=geojson`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geometry = route.geometry;
        
        if (routeLayerRef.current) {
          map.removeLayer(routeLayerRef.current);
        }

        let isUnsafe = false;
        let interceptLevel = 'safe';
        
        for (const coord of geometry.coordinates) {
          const hex = h3.latLngToCell(coord[1], coord[0], 9);
          const riskData = risks.get(hex);
          if (riskData && (riskData.riskLevel === 'high_risk' || riskData.riskLevel === 'caution')) {
            isUnsafe = true;
            interceptLevel = riskData.riskLevel;
            break;
          }
        }

        const routeColor = !isUnsafe ? '#3b82f6' : (interceptLevel === 'high_risk' ? '#ef4444' : '#f59e0b');

        routeLayerRef.current = L.geoJSON(geometry, {
          style: { color: routeColor, weight: 6, opacity: 0.8, dashArray: isUnsafe ? '10 10' : undefined }
        }).addTo(map);

        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [50, 50] });

        if (isUnsafe) {
          setRouteInfo({ safe: false, msg: `⚠️ Route intersects ${interceptLevel === 'high_risk' ? 'High Risk' : 'Caution'} zone` });
        } else {
          setRouteInfo({ safe: true, msg: `✅ Safest Route Found (${(route.distance / 1000).toFixed(1)}km)` });
        }
      }
    } catch (err) {
      setRouteInfo({ safe: false, msg: 'Error calculating route' });
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navMode || !userPosition) return;

    const onClick = (e: L.LeafletMouseEvent) => calculateRoute(e.latlng.lat, e.latlng.lng);

    map.on('click', onClick);
    map.getContainer().style.cursor = 'crosshair';

    return () => {
      map.off('click', onClick);
      map.getContainer().style.cursor = '';
    };
  }, [navMode, userPosition, risks]);

  // Clean up route when exiting Nav mode
  useEffect(() => {
    if (!navMode) {
      if (routeLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      setRouteInfo(null);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [navMode]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <div ref={containerRef} className="map-container" id="map-view" />
      
      {userPosition && (
        <div className="map-tools">
          <button 
            className={`tool-btn ${navMode ? 'active-nav' : ''}`}
            onClick={() => setNavMode(!navMode)}
            title="SafeNav Predictive Routing"
          >
            <span className="btn-icon">🗺️</span>
          </button>

          <button 
            className="tool-btn"
            onClick={() => {
              if (mapRef.current && userPosition) {
                mapRef.current.setView([userPosition.lat, userPosition.lng], 15, { animate: true, duration: 1 });
              }
            }}
            title="My Location"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2" />
              <circle cx="12" cy="12" r="6" />
            </svg>
          </button>
        </div>
      )}

      {navMode && (
        <div className="route-info-panel">
          <form className="route-search-form" onSubmit={handleSearch}>
            <input 
              type="text" 
              placeholder="Search destination..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="route-search-input"
            />
            <button type="submit" className="route-search-btn">
              {isSearching ? '...' : '🔍'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((res: any, idx: number) => (
                <div 
                  key={idx} 
                  className="search-result-item"
                  onClick={() => {
                    setSearchResults([]);
                    calculateRoute(parseFloat(res.lat), parseFloat(res.lon));
                  }}
                >
                  {res.display_name}
                </div>
              ))}
            </div>
          )}

          {routeInfo && (
            <div style={{ marginTop: 12 }}>
              <div className={`route-status ${routeInfo.safe ? 'safe' : 'unsafe'}`}>
                {routeInfo.msg}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
