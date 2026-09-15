import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  fetchMapRiskFeatures,
  fetchMapRainStations,
  fetchMapHistoricalIncidents,
  fetchNepalBoundary,
  fetchProvincesGeoJSON,
  requestPrediction,
  triggerDistrictRefresh,
  fetchDistrictRefreshStatus
} from '../services/api';
import {
  Layers, CloudRain, AlertTriangle, ShieldCheck, MapPin,
  Info, Mountain, Zap, RefreshCw, Compass
} from 'lucide-react';


interface MapViewProps {
  onSelectLocationForPrediction: (loc: any) => void;
}

type BasemapType = 'google_streets' | 'google_terrain' | 'google_hybrid' | 'topo' | 'satellite';

export const MapView: React.FC<MapViewProps> = ({ onSelectLocationForPrediction }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Default to Google Maps Streets (Authentic Google Maps View)
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('google_streets');
  const [showPredictions, setShowPredictions] = useState(true);
  const [showStations, setShowStations] = useState(true);
  // Default showIncidents to FALSE so user is not confused by 2013 past events!
  const [showIncidents, setShowIncidents] = useState(false);
  const [showProvinces, setShowProvinces] = useState(true);
  const [showNationalBorder, setShowNationalBorder] = useState(true);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ predictions: 77, stations: 500, incidents: 300, provinces: 7 });

  const [refreshingDistricts, setRefreshingDistricts] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ progress: number; total: number; district?: string | null }>({ progress: 0, total: 77 });

  const handleRefreshAllDistricts = async () => {
    if (refreshingDistricts) return;
    setRefreshingDistricts(true);
    try {
      await triggerDistrictRefresh();
      const interval = setInterval(async () => {
        try {
          const status = await fetchDistrictRefreshStatus();
          setRefreshProgress({
            progress: status.progress,
            total: status.total,
            district: status.current_district
          });
          if (!status.is_running) {
            clearInterval(interval);
            setRefreshingDistricts(false);
            loadMapData();
          }
        } catch {
          clearInterval(interval);
          setRefreshingDistricts(false);
        }
      }, 1500);
    } catch (e: any) {
      alert('Failed to start refresh: ' + e.message);
      setRefreshingDistricts(false);
    }
  };

  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);

  const nationalBorderLayerRef = useRef<L.GeoJSON>(L.geoJSON(null));
  const provincesLayerRef = useRef<L.GeoJSON>(L.geoJSON(null));
  const predictionsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const stationsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const incidentsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const nepalGeoJsonDataRef = useRef<any>(null);

  // Basemap Tile Providers: Authentic Google Maps & Supporting GIS Layers
  const basemapUrls: Record<BasemapType, { url: string; subdomains?: string[]; attribution: string; hasLabels?: boolean; maxZoom?: number }> = {
    google_streets: {
      url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps',
      maxZoom: 20
    },
    google_terrain: {
      url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps Terrain',
      maxZoom: 20
    },
    google_hybrid: {
      url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps Satellite & Aerial',
      maxZoom: 20
    },
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &copy; USGS, NOAA',
      maxZoom: 19
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, Maxar',
      hasLabels: true,
      maxZoom: 19
    }
  };

  const setBasemap = (type: BasemapType) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    const config = basemapUrls[type];
    tileLayerRef.current = L.tileLayer(config.url, {
      subdomains: config.subdomains || ['a', 'b', 'c'],
      attribution: config.attribution,
      maxZoom: config.maxZoom || 20
    }).addTo(map);

    if (config.hasLabels) {
      const labelUrl = type === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
      labelsLayerRef.current = L.tileLayer(labelUrl, { maxZoom: 19 }).addTo(map);
    }

    nationalBorderLayerRef.current.bringToFront();
    provincesLayerRef.current.bringToFront();

    setActiveBasemap(type);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return '#EF4444'; // Red
      case 'HIGH': return '#F97316';     // Orange
      case 'MODERATE': return '#EAB308'; // Yellow
      default: return '#10B981';         // Green
    }
  };

  const isPointInNepalPolygon = (lat: number, lon: number, geojson: any): boolean => {
    // Fast geodetic bounding box check
    if (lat < 26.347 || lat > 30.447 || lon < 80.058 || lon > 88.201) return false;
    if (!geojson?.features || geojson.features.length === 0) return true;

    for (const feat of geojson.features) {
      const geom = feat.geometry;
      if (!geom) continue;
      let rings: any[] = [];
      if (geom.type === 'Polygon') {
        rings = [geom.coordinates[0]];
      } else if (geom.type === 'MultiPolygon') {
        rings = geom.coordinates.map((p: any) => p[0]);
      }
      for (const ring of rings) {
        let inside = false;
        const n = ring.length;
        let p1x = ring[0][0];
        let p1y = ring[0][1];
        for (let i = 1; i <= n; i++) {
          const p2x = ring[i % n][0];
          const p2y = ring[i % n][1];
          if (Math.min(p1y, p2y) < lat && lat <= Math.max(p1y, p2y)) {
            if (lon <= Math.max(p1x, p2x)) {
              let xinters = lon;
              if (p1y !== p2y) {
                xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x;
              }
              if (p1x === p2x || lon <= xinters) {
                inside = !inside;
              }
            }
          }
          p1x = p2x;
          p1y = p2y;
        }
        if (inside) return true;
      }
    }
    return false;
  };

  // Global window handler so buttons in Leaflet popups can trigger live predictions!
  useEffect(() => {
    (window as any).runLivePredictionAtCoords = async (lat: number, lon: number, title: string) => {
      const popupDiv = document.getElementById('live-pred-target');
      if (popupDiv) {
        popupDiv.innerHTML = '<div style="color: #10B981; font-family: monospace; font-size: 11px; padding: 6px;"><span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> Querying real-time rainfall & DEM slope...</div>';
      }

      try {
        const res = await requestPrediction({
          lat: Number(lat),
          lon: Number(lon),
          location_name: title || `Coordinate (${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)})`
        });

        if (popupDiv) {
          if (res.prediction_status === 'REAL') {
            const color = res.risk_level === 'CRITICAL' ? '#EF4444' : res.risk_level === 'HIGH' ? '#F97316' : res.risk_level === 'MODERATE' ? '#EAB308' : '#10B981';
            popupDiv.innerHTML = `
              <div style="margin-top: 6px; padding: 8px; background: #030712; border: 1px solid ${color}; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="color: #10B981; font-size: 10px; font-weight: bold; font-family: monospace;">● REAL-TIME AI PREDICTION</span>
                  <span style="background: ${color}30; color: ${color}; font-weight: bold; font-size: 10px; padding: 1px 6px; border-radius: 4px; text-transform: uppercase;">${res.risk_level} RISK</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                  <span style="color: #9CA3AF; font-size: 11px;">Probability:</span>
                  <strong style="color: #FFFFFF; font-size: 16px; font-family: monospace;">${res.probability_percentage}</strong>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #D1D5DB; background: #111827; padding: 4px; border-radius: 4px;">
                  <div>24h Rain: <strong style="color: #38BDF8;">${res.features?.rainfall_24h} mm</strong></div>
                  <div>Slope: <strong style="color: #FFFFFF;">${res.features?.slope}°</strong></div>
                  <div>Elevation: <strong style="color: #FFFFFF;">${res.features?.elevation} m</strong></div>
                  <div>Model: <strong style="color: #FFFFFF;">${res.model}</strong></div>
                </div>
                <div style="font-size: 9px; color: #6B7280; font-family: monospace; margin-top: 4px;">
                  Real NPT: ${res.prediction_time_npt}
                </div>
              </div>
            `;
          } else {
            popupDiv.innerHTML = `
              <div style="margin-top: 6px; padding: 6px; background: #451a03; border: 1px solid #f59e0b; border-radius: 6px; color: #fde68a; font-size: 11px;">
                <strong>REAL PREDICTION UNAVAILABLE</strong><br/>
                ${res.message || 'Telemetry not accessible at this exact point.'}
              </div>
            `;
          }
        }
      } catch (e: any) {
        if (popupDiv) {
          popupDiv.innerHTML = `<div style="color: #f87171; font-size: 11px; padding: 4px;">Error: ${e.message}</div>`;
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
      center: [28.3949, 84.1240],
      zoom: 7,
      minZoom: 6,
      maxZoom: 16,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial Basemap: Google Maps Streets
    const config = basemapUrls['google_streets'];
    tileLayerRef.current = L.tileLayer(config.url, {
      subdomains: config.subdomains || ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: config.attribution,
      maxZoom: config.maxZoom || 20
    }).addTo(map);

    // Add layer groups to map
    nationalBorderLayerRef.current.addTo(map);
    provincesLayerRef.current.addTo(map);
    predictionsLayerRef.current.addTo(map);
    stationsLayerRef.current.addTo(map);
    // Notice: incidentsLayer is NOT added by default so user is not misled by 2013 data!
    if (showIncidents) incidentsLayerRef.current.addTo(map);

    // Click anywhere on map for live prediction (Nepal territory only)
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // Exact polygon boundary check for Nepal territory
      const isInsideNepal = isPointInNepalPolygon(lat, lng, nepalGeoJsonDataRef.current);
      if (!isInsideNepal) {
        const outsidePopup = `
          <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #f3f4f6; padding: 4px; min-width: 230px;">
            <div style="border-bottom: 1px solid #ef444450; padding-bottom: 4px; margin-bottom: 6px;">
              <span style="background: #ef444420; color: #ef4444; font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">Outside Nepal Territory</span>
              <strong style="color: #fff; display: block; margin-top: 2px;">Selected Location</strong>
              <span style="color: #9ca3af; font-family: monospace; font-size: 11px;">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</span>
            </div>
            <div style="font-size: 11px; color: #fca5a5; line-height: 1.4; padding: 4px 0;">
              ⚠️ This system is exclusively dedicated to Nepal. Real-time telemetry and hazard models cannot be queried for locations outside Nepal's sovereign national boundary.
            </div>
          </div>
        `;
        L.popup()
          .setLatLng(e.latlng)
          .setContent(outsidePopup)
          .openOn(map);
        return;
      }

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #f3f4f6; padding: 4px; min-width: 240px;">
          <div style="border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 6px;">
            <span style="background: #10b98120; color: #10b981; font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">Point Ingestion</span>
            <strong style="color: #fff; display: block; margin-top: 2px;">Clicked Location</strong>
            <span style="color: #9ca3af; font-family: monospace; font-size: 11px;">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</span>
          </div>
          <div id="live-pred-target">
            <button
              onclick="window.runLivePredictionAtCoords(${lat}, ${lng}, 'Custom GPS Point')"
              style="width: 100%; background: #10b981; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;"
            >
              ⚡ Compute Real-Time Landslide Risk Here
            </button>
          </div>
        </div>
      `;
      L.popup()
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);
    });

    mapInstanceRef.current = map;

    // Load data layers
    loadMapData();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const [
        riskData,
        stationData,
        incidentData,
        nepalBorderData,
        provincesData
      ] = await Promise.all([
        fetchMapRiskFeatures(),
        fetchMapRainStations(),
        fetchMapHistoricalIncidents(),
        fetchNepalBoundary(),
        fetchProvincesGeoJSON()
      ]);

      // Cache national boundary for click and layer polygon checks
      nepalGeoJsonDataRef.current = nepalBorderData;

      // 1. National Nepal Border Polygon
      nationalBorderLayerRef.current.clearLayers();
      if (nepalBorderData?.features) {
        nationalBorderLayerRef.current.addData(nepalBorderData as any);
        nationalBorderLayerRef.current.setStyle({
          color: '#DC143C', // Nepal Crimson
          weight: 2.5,
          opacity: 0.95,
          fillColor: '#DC143C',
          fillOpacity: 0.03,
          dashArray: '4, 4'
        });

        // Fit map view to Nepal bounds
        if (mapInstanceRef.current && nationalBorderLayerRef.current.getBounds().isValid()) {
          mapInstanceRef.current.fitBounds(nationalBorderLayerRef.current.getBounds(), {
            padding: [20, 20]
          });
        }
      }

      // 2. 7 Provinces Polygons Layer
      provincesLayerRef.current.clearLayers();
      if (provincesData?.features) {
        provincesLayerRef.current.addData(provincesData as any);
        provincesLayerRef.current.setStyle((feature) => {
          return {
            color: '#003893', // Nepal Flag Blue
            weight: 1.5,
            opacity: 0.8,
            fillColor: '#3B82F6',
            fillOpacity: 0.05
          };
        });

        provincesLayerRef.current.eachLayer((layer: any) => {
          if (layer.feature?.properties?.name) {
            layer.bindTooltip(`<strong>${layer.feature.properties.name}</strong>`, {
              sticky: true,
              className: 'province-tooltip'
            });
          }
        });
      }

      // 3. Real-Time AI Predictions Layer (PRIMARY)
      predictionsLayerRef.current.clearLayers();
      if (riskData?.features) {
        riskData.features.forEach((feat: any) => {
          const coords = feat.geometry.coordinates;
          // Strictly exclude any point outside sovereign Nepal polygon
          if (!isPointInNepalPolygon(coords[1], coords[0], nepalBorderData)) {
            return;
          }

          const p = feat.properties;
          const color = getRiskColor(p.risk_level);

          const marker = L.circleMarker([coords[1], coords[0]], {
            radius: p.risk_level === 'CRITICAL' ? 11 : p.risk_level === 'HIGH' ? 9 : 7,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
          });

          const popupContent = `
            <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #f3f4f6; padding: 4px; min-width: 240px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 6px;">
                <span style="color: #10B981; font-weight: bold; font-size: 10px; font-family: monospace;">● REAL-TIME AI PREDICTION</span>
                <span style="background: ${color}30; color: ${color}; border: 1px solid ${color}80; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; text-transform: uppercase;">
                  ${p.risk_level} RISK
                </span>
              </div>
              <strong style="color: #fff; font-size: 14px; display: block;">${p.location}</strong>
              <div style="margin-bottom: 6px; color: #9ca3af; font-size: 11px;">
                ${p.district}, ${p.province}
              </div>
              <div style="background: #030712; padding: 8px; border-radius: 6px; border: 1px solid #1f2937; margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                  <span style="color: #9ca3af; font-size: 11px;">Live AI Probability:</span>
                  <strong style="color: ${color}; font-size: 18px; font-family: monospace;">${p.probability_percentage}</strong>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #d1d5db;">
                  <div>24h Rain: <strong style="color: #38bdf8;">${p.rainfall_24h} mm</strong></div>
                  <div>Slope: <strong style="color: #fff;">${p.slope}°</strong></div>
                  <div>Elevation: <strong style="color: #fff;">${p.elevation} m</strong></div>
                  <div>Model: <strong style="color: #fff;">${p.model}</strong></div>
                </div>
              </div>
              <div style="font-size: 10px; color: #6b7280; font-family: monospace;">
                Observed at: ${p.timestamp_npt}
              </div>
            </div>
          `;
          marker.bindPopup(popupContent);
          predictionsLayerRef.current.addLayer(marker);
        });
      }

      // 4. DHM Rain Stations Layer
      stationsLayerRef.current.clearLayers();
      if (stationData?.features) {
        stationData.features.forEach((feat: any) => {
          const coords = feat.geometry.coordinates;
          if (!isPointInNepalPolygon(coords[1], coords[0], nepalBorderData)) return;
          const p = feat.properties;

          const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 4,
            fillColor: '#06B6D4',
            color: '#0891B2',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.7
          });

          const popupContent = `
            <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #f3f4f6; padding: 4px; min-width: 220px;">
              <div style="border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 6px;">
                <span style="background: #06b6d420; color: #06b6d4; font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">DHM Gauge (Live Telemetry)</span>
                <strong style="color: #fff; display: block; margin-top: 2px;">${p.title}</strong>
              </div>
              <div style="margin-bottom: 4px; color: #9ca3af;">Basin: ${p.basin || 'N/A'} • Elev: ${p.elevation || 'N/A'}m</div>
              <div style="background: #0f172a; padding: 6px; border-radius: 6px; margin-bottom: 6px;">
                <span style="color: #9ca3af;">Current 24h Rainfall:</span> <strong style="color: #38bdf8; font-size: 13px;">${p.rainfall_24h} mm</strong>
              </div>
              <div id="live-pred-target">
                <button
                  onclick="window.runLivePredictionAtCoords(${coords[1]}, ${coords[0]}, '${p.title} Station')"
                  style="width: 100%; background: #0891B2; color: #fff; border: none; padding: 5px 8px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer;"
                >
                  ⚡ Run Real-Time AI Prediction for this Gauge
                </button>
              </div>
            </div>
          `;
          marker.bindPopup(popupContent);
          stationsLayerRef.current.addLayer(marker);
        });
      }

      // 5. Historical Landslides Layer (Archive)
      incidentsLayerRef.current.clearLayers();
      if (incidentData?.features) {
        incidentData.features.forEach((feat: any) => {
          const coords = feat.geometry.coordinates;
          if (!isPointInNepalPolygon(coords[1], coords[0], nepalBorderData)) return;
          const p = feat.properties;

          const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 3.5,
            fillColor: '#BE123C',
            color: '#881337',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.7
          });

          const popupContent = `
            <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #f3f4f6; padding: 4px; min-width: 240px;">
              <div style="border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 4px;">
                <span style="background: #be123c20; color: #fb7185; font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">
                  📜 Historical Incident Archive (Past Event)
                </span>
                <strong style="color: #fff; display: block; margin-top: 2px;">${p.title}</strong>
              </div>
              <div style="color: #9ca3af; font-size: 11px;">Past Occurrence Date: <strong style="color: #fca5a5;">${p.incident_on?.slice(0, 10) || 'Verified'}</strong></div>
              <div style="color: #6b7280; font-size: 10px; margin-bottom: 6px;">Source: BIPAD Government Disaster Archive</div>
              
              <div id="live-pred-target">
                <button
                  onclick="window.runLivePredictionAtCoords(${coords[1]}, ${coords[0]}, '${p.title}')"
                  style="width: 100%; background: #10B981; color: #fff; border: none; padding: 5px 8px; border-radius: 5px; font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;"
                >
                  ⚡ Compute Real-Time Landslide Risk Right Now
                </button>
              </div>
            </div>
          `;
          marker.bindPopup(popupContent);
          incidentsLayerRef.current.addLayer(marker);
        });
      }

      setStats({
        predictions: riskData?.count || 77,
        stations: stationData?.count || 500,
        incidents: incidentData?.count || 300,
        provinces: provincesData?.features?.length || 7
      });
    } catch (e) {
      console.error('Failed to load map layers:', e);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Handlers
  const handleToggleNationalBorder = () => {
    if (!mapInstanceRef.current) return;
    if (showNationalBorder) {
      mapInstanceRef.current.removeLayer(nationalBorderLayerRef.current);
    } else {
      mapInstanceRef.current.addLayer(nationalBorderLayerRef.current);
    }
    setShowNationalBorder(!showNationalBorder);
  };

  const handleToggleProvinces = () => {
    if (!mapInstanceRef.current) return;
    if (showProvinces) {
      mapInstanceRef.current.removeLayer(provincesLayerRef.current);
    } else {
      mapInstanceRef.current.addLayer(provincesLayerRef.current);
    }
    setShowProvinces(!showProvinces);
  };

  const handleTogglePredictions = () => {
    if (!mapInstanceRef.current) return;
    if (showPredictions) {
      mapInstanceRef.current.removeLayer(predictionsLayerRef.current);
    } else {
      mapInstanceRef.current.addLayer(predictionsLayerRef.current);
    }
    setShowPredictions(!showPredictions);
  };

  const handleToggleStations = () => {
    if (!mapInstanceRef.current) return;
    if (showStations) {
      mapInstanceRef.current.removeLayer(stationsLayerRef.current);
    } else {
      mapInstanceRef.current.addLayer(stationsLayerRef.current);
    }
    setShowStations(!showStations);
  };

  const handleToggleIncidents = () => {
    if (!mapInstanceRef.current) return;
    if (showIncidents) {
      mapInstanceRef.current.removeLayer(incidentsLayerRef.current);
    } else {
      mapInstanceRef.current.addLayer(incidentsLayerRef.current);
    }
    setShowIncidents(!showIncidents);
  };

  return (
    <div className="relative w-full h-[calc(100vh-105px)] bg-slate-950 overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Floating Basemap Switcher Toolbar */}
      <div className="absolute top-4 right-14 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg p-1 shadow-xl flex items-center space-x-1">
        <button
          onClick={() => setBasemap('google_streets')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeBasemap === 'google_streets'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Standard Google Maps view with highway network, cities, and landmarks"
        >
          <span>🗺️</span>
          <span>Google Maps</span>
        </button>
        <button
          onClick={() => setBasemap('google_terrain')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeBasemap === 'google_terrain'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Google Maps Physical Terrain view with mountain relief & contour details"
        >
          <span>🏔️</span>
          <span>Google Terrain</span>
        </button>
        <button
          onClick={() => setBasemap('google_hybrid')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeBasemap === 'google_hybrid'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Google Satellite imagery with official road network and place labels"
        >
          <span>🛰️</span>
          <span>Google Satellite</span>
        </button>
        <button
          onClick={() => setBasemap('topo')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeBasemap === 'topo'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="ESRI Topographic Relief"
        >
          <span>⛰️</span>
          <span>ESRI Topo</span>
        </button>
      </div>

      {/* Left Floating Layer Switcher Panel */}
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl p-3.5 shadow-2xl space-y-3 w-72">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nepal GIS Layers</span>
          </div>
          {loading && <span className="text-[10px] text-emerald-400 font-mono animate-pulse">Syncing...</span>}
        </div>

        {/* Update All 77 Districts Today Button */}
        <button
          onClick={handleRefreshAllDistricts}
          disabled={refreshingDistricts}
          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-[11px] py-2 px-2.5 rounded-lg shadow-md transition disabled:opacity-60 cursor-pointer"
          title="Fetch today's live precipitation telemetry and recompute landslide risk for all 77 districts"
        >
          <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${refreshingDistricts ? 'animate-spin' : ''}`} />
          <span className="truncate">
            {refreshingDistricts
              ? `Updating [${refreshProgress.progress}/${refreshProgress.total}] ${refreshProgress.district || ''}...`
              : '🔄 Refresh All 77 Districts Today'}
          </span>
        </button>

        <div className="space-y-2.5 text-xs">
          {/* Real-Time AI Predictions (Primary) */}
          <label className="flex items-center justify-between cursor-pointer hover:text-white text-slate-200 bg-emerald-950/20 p-1.5 rounded border border-emerald-500/30">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white animate-pulse" />
              <span className="font-bold text-emerald-300">⚡ Real-Time AI Predictions</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{stats.predictions}</span>
              <input
                type="checkbox"
                checked={showPredictions}
                onChange={handleTogglePredictions}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
              />
            </div>
          </label>

          {/* Nepal National Border */}
          <label className="flex items-center justify-between cursor-pointer hover:text-white text-slate-300">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-1 bg-red-600 border border-white" />
              <span className="font-semibold text-red-300">Nepal National Border</span>
            </div>
            <input
              type="checkbox"
              checked={showNationalBorder}
              onChange={handleToggleNationalBorder}
              className="rounded bg-slate-800 border-slate-700 text-red-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {/* 7 Provinces */}
          <label className="flex items-center justify-between cursor-pointer hover:text-white text-slate-300">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-1 bg-blue-600 border border-blue-400" />
              <span className="text-blue-200">7 Provinces (Federal)</span>
            </div>
            <input
              type="checkbox"
              checked={showProvinces}
              onChange={handleToggleProvinces}
              className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {/* DHM Rain Stations */}
          <label className="flex items-center justify-between cursor-pointer hover:text-white text-slate-300">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>DHM Rain Stations</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-slate-500">{stats.stations}</span>
              <input
                type="checkbox"
                checked={showStations}
                onChange={handleToggleStations}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
            </div>
          </label>

          {/* Historical Landslides (Archive - Unchecked by Default) */}
          <label className="flex items-center justify-between cursor-pointer hover:text-white text-slate-400 pt-1 border-t border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-700" />
              <span>Past Landslides (2013–2023 Archive)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-slate-500">{stats.incidents}</span>
              <input
                type="checkbox"
                checked={showIncidents}
                onChange={handleToggleIncidents}
                className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
              />
            </div>
          </label>
        </div>

        {/* Real-Time Interaction Hint */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 bg-emerald-950/20 p-2 rounded border border-emerald-500/20">
          <div className="flex items-center space-x-1.5 font-bold mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Interactive Real-Time Mode:</span>
          </div>
          <span className="text-slate-300 text-[10px]">
            Click any prediction ring or click anywhere on the map to compute instant real-time AI landslide risk!
          </span>
        </div>

        {/* Risk Classification Legend */}
        <div className="pt-2 border-t border-slate-800">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Real-Time Risk Classification Tiers
          </span>
          <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Low (&lt;25%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-slate-300">Mod (25-50%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-slate-300">High (50-75%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-slate-300">Crit (&gt;75%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Center Scientific Guarantee Badge */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-800 px-4 py-2 rounded-lg text-xs text-slate-300 flex items-center space-x-2 shadow-xl">
        <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          <strong>Real-Time AI Active:</strong> Rings display current live risk across all 77 districts. Click anywhere on Nepal's map to test live inference.
        </span>
      </div>
    </div>
  );
};
