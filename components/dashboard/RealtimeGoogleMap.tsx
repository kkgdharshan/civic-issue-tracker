'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CivicIssue } from '@/types/issue';
import { useIncidentStore } from '@/stores/useIncidentStore';

interface RealtimeGoogleMapProps {
  issues: CivicIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  onResolveIssue: (id: string) => void;
  onOpenModal: () => void;
  activeFilter: 'ALL' | 'EMERGENCY' | 'OPEN';
  setActiveFilter: (filter: 'ALL' | 'EMERGENCY' | 'OPEN') => void;
  onSimulateEmergency: () => void;
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  triggerDrainQueue: () => void;
}

const DEFAULT_COORDS = { lat: 10.9757, lng: 77.9398 };

export default function RealtimeGoogleMap({
  issues,
  selectedIssueId,
  onSelectIssue,
  onResolveIssue,
  onOpenModal,
  activeFilter,
  setActiveFilter,
  onSimulateEmergency,
  isOnline,
  pendingCount,
  isSyncing,
  triggerDrainQueue,
}: RealtimeGoogleMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circlesLayerRef = useRef<any>(null);
  const userPinpointLayerRef = useRef<any>(null);
  const geoFenceLayerRef = useRef<any>(null);
  const markerByIdRef = useRef<Record<string, any>>({});
  const tileLayersRef = useRef<Record<string, any>>({});

  // Zustand Store Integration
  const hoveredIncidentId = useIncidentStore((s) => s.hoveredIncidentId);
  const setHoveredIncidentId = useIncidentStore((s) => s.setHoveredIncidentId);
  const setSelectedIncidentId = useIncidentStore((s) => s.setSelectedIncidentId);
  const setScrollToIncidentId = useIncidentStore((s) => s.setScrollToIncidentId);
  const geoFencePolygon = useIncidentStore((s) => s.geoFencePolygon);
  const setGeoFencePolygon = useIncidentStore((s) => s.setGeoFencePolygon);
  const isDrawingGeoFence = useIncidentStore((s) => s.isDrawingGeoFence);
  const setIsDrawingGeoFence = useIncidentStore((s) => s.setIsDrawingGeoFence);

  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'google-streets' | 'google-satellite' | 'dark-tactical'>('google-streets');
  const [mapCenter, setMapCenter] = useState(DEFAULT_COORDS);
  const [currentZoom, setCurrentZoom] = useState(14);
  const [isLocating, setIsLocating] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  // 1. Dynamic Leaflet CDN script & style injector
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Inject dark-tactical filter style and Google GPS pulse
    if (!document.getElementById('dark-tactical-style')) {
      const style = document.createElement('style');
      style.id = 'dark-tactical-style';
      style.textContent = `
        .dark-tactical-tiles {
          filter: invert(95%) hue-rotate(180deg) brightness(85%) contrast(120%) saturate(75%) !important;
        }
        @keyframes googleGpsPulse {
          0% { transform: scale(0.6); opacity: 0.95; }
          70% { transform: scale(2.3); opacity: 0; }
          100% { transform: scale(2.3); opacity: 0; }
        }
        .google-gps-halo {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 9999px;
          background: rgba(66, 133, 244, 0.35);
          border: 1.5px solid rgba(66, 133, 244, 0.7);
          animation: googleGpsPulse 2s ease-out infinite;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    const win = window as any;
    if (win.L) {
      setIsLeafletReady(true);
      return;
    }

    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Inject JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setIsLeafletReady(true);
    };
    document.body.appendChild(script);
  }, []);

  // Google Maps Pinpoint Marker (Home Badge + Pulsing Blue Dot matching reference)
  const renderUserPinpoint = useCallback((coords: { lat: number; lng: number }, accuracy = 12, shouldOpenPopup = false) => {
    const layer = userPinpointLayerRef.current;
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const L = win?.L;
    if (!layer || !L) return;
    layer.clearLayers();

    // 1. Google Maps Accuracy Circle (Translucent Blue Halo)
    const accuracyCircle = L.circle([coords.lat, coords.lng], {
      radius: Math.max(accuracy, 25),
      color: '#1a73e8',
      fillColor: '#4285f4',
      fillOpacity: 0.14,
      weight: 1.5,
      dashArray: '4, 4',
    });
    layer.addLayer(accuracyCircle);

    // 2. Dual Pinpoint Marker: Home Pin + Iconic Pulsing Google Blue Dot
    const markerHtml = `
      <div style="position: relative; display: flex; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55));">
        <!-- Google Maps Home Pin Badge -->
        <div style="
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          background: #1a73e8;
          border: 2.5px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 6px;
          z-index: 10;
          transition: transform 0.2s;
        " title="My Location / Home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </div>

        <!-- Google Maps Iconic Blue Pulsing GPS Dot -->
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; z-index: 10;">
          <div class="google-gps-halo"></div>
          <div style="
            width: 16px;
            height: 16px;
            border-radius: 9999px;
            background: #1a73e8;
            border: 2.5px solid #ffffff;
            box-shadow: 0 0 12px rgba(66, 133, 244, 0.95), 0 2px 5px rgba(0,0,0,0.35);
          "></div>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: markerHtml,
      className: 'google-gps-pinpoint',
      iconSize: [68, 36],
      iconAnchor: [34, 18],
      popupAnchor: [0, -20],
    });

    const marker = L.marker([coords.lat, coords.lng], { icon: customIcon, zIndexOffset: 2000 });

    const popupDiv = document.createElement('div');
    popupDiv.style.cssText = 'min-width: 210px; font-family: ui-sans-serif, system-ui, sans-serif;';
    popupDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 9999px; background: #1a73e8; box-shadow: 0 0 8px #1a73e8;"></span>
        <span style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">📍 Your Location Pinpointed</span>
      </div>
      <div style="font-size: 11px; color: #f1f5f9; margin-bottom: 4px;">
        Coords: <b>${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}</b>
      </div>
      <div style="font-size: 10px; color: #94a3b8; margin-bottom: 8px; font-family: monospace;">
        Signal: Google GPS Live Telemetry (±${Math.round(accuracy)}m)
      </div>
    `;

    const btn = document.createElement('button');
    btn.textContent = '+ Report Incident at My Location';
    btn.style.cssText = 'width: 100%; padding: 6px 10px; font-size: 10px; font-weight: bold; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; transition: background 0.15s;';
    btn.onmouseover = () => (btn.style.background = '#10b981');
    btn.onmouseout = () => (btn.style.background = '#059669');
    btn.onclick = (e) => {
      e.stopPropagation();
      onOpenModal();
    };
    popupDiv.appendChild(btn);

    marker.bindPopup(popupDiv);
    layer.addLayer(marker);

    if (shouldOpenPopup) {
      setTimeout(() => {
        marker.openPopup();
      }, 250);
    }
  }, [onOpenModal]);

  // 2. Initialize Leaflet Map Instance with Google Maps Tiles
  useEffect(() => {
    if (!isLeafletReady || !mapContainerRef.current || mapInstanceRef.current) return;

    const win = window as any;
    const L = win.L;
    if (!L) return;

    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    // Real-Time Google Maps Tile Endpoints
    const googleStreets = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps Telemetry',
    });

    const googleSatellite = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Satellite Imagery',
    });

    const darkTactical = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps Dark Ops',
      className: 'dark-tactical-tiles',
    });

    tileLayersRef.current = {
      'google-streets': googleStreets,
      'google-satellite': googleSatellite,
      'dark-tactical': darkTactical,
    };

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_COORDS.lat, DEFAULT_COORDS.lng],
      zoom: 14,
      zoomControl: false,
      layers: [googleStreets],
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const circlesLayer = L.layerGroup().addTo(map);
    const userPinpointLayer = L.layerGroup().addTo(map);
    const geoFenceLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    circlesLayerRef.current = circlesLayer;
    userPinpointLayerRef.current = userPinpointLayer;
    geoFenceLayerRef.current = geoFenceLayer;

    // Immediately render initial user pinpoint at sector center
    renderUserPinpoint(DEFAULT_COORDS, 15, false);

    map.on('move', () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
      setCurrentZoom(map.getZoom());
    });

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isLeafletReady, renderUserPinpoint]);

  // 3. Switch Base Layer
  const handleSwitchLayer = (layerKey: 'google-streets' | 'google-satellite' | 'dark-tactical') => {
    if (!mapInstanceRef.current || layerKey === activeLayer) return;
    const map = mapInstanceRef.current;
    Object.values(tileLayersRef.current).forEach((layer) => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    if (tileLayersRef.current[layerKey]) {
      tileLayersRef.current[layerKey].addTo(map);
      setActiveLayer(layerKey);
    }
  };

  // 4. Geo-fence Interactive Drawing Click Handler
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: any) => {
      if (!isDrawingGeoFence) return;
      setDrawingPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    };

    map.on('click', handleMapClick);
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = isDrawingGeoFence ? 'crosshair' : '';
    }

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawingGeoFence]);

  // 5. Draw Geo-fence visual layers on Leaflet
  useEffect(() => {
    const win = window as any;
    const L = win?.L;
    const layer = geoFenceLayerRef.current;
    if (!L || !layer) return;

    layer.clearLayers();

    // While drawing in progress
    if (isDrawingGeoFence && drawingPoints.length > 0) {
      drawingPoints.forEach((pt) => {
        const circle = L.circleMarker(pt, {
          radius: 5,
          color: '#10b981',
          fillColor: '#34d399',
          fillOpacity: 1,
          weight: 2,
        });
        layer.addLayer(circle);
      });

      if (drawingPoints.length >= 2) {
        const polyline = L.polyline(drawingPoints, {
          color: '#10b981',
          weight: 2,
          dashArray: '5, 5',
        });
        layer.addLayer(polyline);
      }

      if (drawingPoints.length >= 3) {
        const preview = L.polygon(drawingPoints, {
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '3, 3',
        });
        layer.addLayer(preview);
      }
    }

    // Active Geo-fence committed in store
    if (geoFencePolygon && geoFencePolygon.length >= 3) {
      const activePoly = L.polygon(geoFencePolygon, {
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.15,
        weight: 2.5,
        dashArray: '6, 6',
      });
      activePoly.bindTooltip('📍 Active Geo-fence Boundary (Spatial Filter)', {
        sticky: true,
        className: 'font-mono text-xs',
      });
      layer.addLayer(activePoly);
    }
  }, [isDrawingGeoFence, drawingPoints, geoFencePolygon]);

  const handleApplyGeoFence = () => {
    if (drawingPoints.length >= 3) {
      setGeoFencePolygon(drawingPoints);
      setIsDrawingGeoFence(false);
      setDrawingPoints([]);
    }
  };

  const handleCancelDrawing = () => {
    setIsDrawingGeoFence(false);
    setDrawingPoints([]);
  };

  const handleClearGeoFence = () => {
    setGeoFencePolygon(null);
    setDrawingPoints([]);
    geoFenceLayerRef.current?.clearLayers();
  };

  // 6. Synchronize Markers & Perimeters with Bi-Directional Hover / Click Store Sync
  useEffect(() => {
    const win = window as any;
    const L = win.L;
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    const circlesGroup = circlesLayerRef.current;
    if (!L || !map || !markersGroup || !circlesGroup) return;

    markersGroup.clearLayers();
    circlesGroup.clearLayers();
    markerByIdRef.current = {};

    issues.forEach((issue) => {
      const isSelected = issue.id === selectedIssueId;
      const isHovered = issue.id === hoveredIncidentId;
      const isResolved = issue.status === 'RESOLVED';
      const isEmergency = issue.severity === 'CRITICAL_EMERGENCY';

      const pinColor = isResolved ? '#10b981' : isEmergency ? '#ef4444' : '#f59e0b';
      const pulseColor = isResolved
        ? 'rgba(16, 185, 129, 0.5)'
        : isEmergency
        ? 'rgba(239, 68, 68, 0.5)'
        : 'rgba(245, 158, 11, 0.5)';

      const markerHtml = `
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transform: ${isHovered ? 'scale(1.4)' : isSelected ? 'scale(1.18)' : 'scale(1)'};
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: ${isHovered ? 50 : isSelected ? 40 : 10};
        ">
          ${(!isResolved || isHovered) ? `<div style="position: absolute; width: 30px; height: 30px; border-radius: 9999px; background-color: ${pulseColor}; animation: pulseRing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
          <div style="
            position: relative;
            width: ${isSelected || isHovered ? '28px' : '22px'};
            height: ${isSelected || isHovered ? '28px' : '22px'};
            border-radius: 9999px;
            background: ${pinColor};
            border: ${isSelected || isHovered ? '3px solid #ffffff' : '2px solid #0f172a'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 ${isHovered ? '24px' : isSelected ? '16px' : '8px'} ${pinColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: ${isSelected || isHovered ? '12px' : '10px'};
            color: #ffffff;
            transition: all 0.25s ease-out;
          ">
            ${isEmergency ? '!' : isResolved ? '✓' : '●'}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'google-map-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([issue.latitude, issue.longitude], {
        icon: customIcon,
        zIndexOffset: isHovered ? 4000 : isSelected ? 3000 : 100,
      });

      // Interactive Popup
      const container = document.createElement('div');
      container.style.cssText = 'min-width: 200px; max-width: 260px; font-family: ui-sans-serif, system-ui, sans-serif;';

      const header = document.createElement('div');
      header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;';
      header.innerHTML = `
        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${pinColor}25; color: ${pinColor}; border: 1px solid ${pinColor}60;">
          ${issue.severity.replace('_', ' ')}
        </span>
        <span style="font-size: 10px; font-family: monospace; color: #94a3b8;">
          #${issue.id.slice(-6)}
        </span>
      `;
      container.appendChild(header);

      const title = document.createElement('div');
      title.style.cssText = 'font-weight: 700; font-size: 12px; color: #f8fafc; line-height: 1.35; margin-bottom: 4px;';
      title.textContent = issue.title;
      container.appendChild(title);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 11px; color: #94a3b8; line-height: 1.4; margin-bottom: 8px;';
      desc.textContent = issue.description;
      container.appendChild(desc);

      const meta = document.createElement('div');
      meta.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 10px; font-family: monospace; color: #64748b; padding-top: 6px; border-top: 1px solid #334155;';
      meta.innerHTML = `
        <span>▲ ${issue.upvoteCount} Upvotes</span>
        <span style="color: ${pinColor}; font-weight: bold;">${issue.status}</span>
      `;
      container.appendChild(meta);

      if (!isResolved) {
        const btn = document.createElement('button');
        btn.textContent = '✓ Mark Resolved in Sector';
        btn.style.cssText = 'width: 100%; margin-top: 8px; padding: 5px 8px; font-size: 10px; font-weight: bold; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; transition: background 0.15s;';
        btn.onmouseover = () => (btn.style.background = '#10b981');
        btn.onmouseout = () => (btn.style.background = '#059669');
        btn.onclick = (e) => {
          e.stopPropagation();
          onResolveIssue(issue.id);
          map.closePopup();
        };
        container.appendChild(btn);
      }

      marker.bindPopup(container);

      // Bi-directional click sync: select issue and trigger stream scroll
      marker.on('click', () => {
        onSelectIssue(issue.id);
        setSelectedIncidentId(issue.id);
        setScrollToIncidentId(issue.id);
      });

      // Bi-directional hover sync
      marker.on('mouseover', () => {
        setHoveredIncidentId(issue.id);
      });
      marker.on('mouseout', () => {
        setHoveredIncidentId(null);
      });

      markersGroup.addLayer(marker);
      markerByIdRef.current[issue.id] = marker;

      // Emergency boundary perimeter
      if (isEmergency && !isResolved) {
        const dangerCircle = L.circle([issue.latitude, issue.longitude], {
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '5, 5',
          radius: 350,
        });
        circlesGroup.addLayer(dangerCircle);
      }
    });

    if (selectedIssueId && markerByIdRef.current[selectedIssueId]) {
      setTimeout(() => {
        if (markerByIdRef.current[selectedIssueId]) {
          markerByIdRef.current[selectedIssueId].openPopup();
        }
      }, 150);
    }
  }, [issues, selectedIssueId, hoveredIncidentId, onSelectIssue, onResolveIssue, setSelectedIncidentId, setScrollToIncidentId, setHoveredIncidentId]);

  // 7. Smooth flyTo on selected issue
  useEffect(() => {
    if (!selectedIssueId || !mapInstanceRef.current) return;
    const target = issues.find((i) => i.id === selectedIssueId);
    if (target) {
      mapInstanceRef.current.flyTo([target.latitude, target.longitude], 16, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [selectedIssueId, issues]);

  // Recenter to My Area core and re-pinpoint
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    renderUserPinpoint(DEFAULT_COORDS, 15, true);
    mapInstanceRef.current.flyTo([DEFAULT_COORDS.lat, DEFAULT_COORDS.lng], 16, { duration: 1.0 });
  };

  // GPS Locating - Pinpoints live location with Google Maps blue dot & home badge
  const handleLocateMe = () => {
    setIsLocating(true);
    const executePinpoint = (lat: number, lng: number, accuracy = 10) => {
      setIsLocating(false);
      renderUserPinpoint({ lat, lng }, accuracy, true);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.5 });
      }
    };

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          executePinpoint(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || 8);
        },
        (err) => {
          console.warn('GPS location request timed out or denied; pinpointing to sector core:', err);
          executePinpoint(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng, 15);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    } else {
      executePinpoint(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng, 15);
    }
  };

  return (
    <section
      aria-label="Interactive Civic Google Map"
      className="relative flex-1 h-full bg-slate-900 border-r border-slate-800 flex flex-col justify-between overflow-hidden isolate z-0"
    >
      {/* Top Control Bar */}
      <div className="relative z-20 p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-950/85 backdrop-blur border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onOpenModal}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500 active:scale-95 transition-all focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          >
            <span className="text-base leading-none font-black">+</span>
            Report Incident
          </button>

          {/* Offline Sync Badge */}
          {!isOnline ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Offline ({pendingCount} queued)
            </span>
          ) : pendingCount > 0 ? (
            <button
              onClick={triggerDrainQueue}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {isSyncing ? 'Draining Queue...' : `Sync ${pendingCount} offline records`}
            </button>
          ) : null}

          {/* Real-Time Layer Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => handleSwitchLayer('google-streets')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                activeLayer === 'google-streets'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Real-Time Google Maps Street View"
            >
              <span>🗺️</span>
              <span>Google Streets</span>
            </button>
            <button
              onClick={() => handleSwitchLayer('google-satellite')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                activeLayer === 'google-satellite'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Real Google Maps Satellite Hybrid"
            >
              <span>🛰️</span>
              <span>Google Satellite</span>
            </button>
            <button
              onClick={() => handleSwitchLayer('dark-tactical')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                activeLayer === 'dark-tactical'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="High-Contrast Tactical Dark Mode"
            >
              <span>🌑</span>
              <span>Dark Ops</span>
            </button>
          </div>

          {/* Spatial Filtering Geo-fence Controls */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            {!isDrawingGeoFence && !geoFencePolygon && (
              <button
                onClick={() => setIsDrawingGeoFence(true)}
                className="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                title="Draw a polygon boundary to filter incidents"
              >
                <span>📐</span>
                <span>Draw Geo-fence</span>
              </button>
            )}

            {isDrawingGeoFence && (
              <>
                <span className="px-2 py-1 text-[11px] font-mono text-emerald-400 animate-pulse">
                  Click map to place points ({drawingPoints.length})
                </span>
                <button
                  onClick={handleApplyGeoFence}
                  disabled={drawingPoints.length < 3}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                    drawingPoints.length >= 3
                      ? 'bg-emerald-600 text-white shadow hover:bg-emerald-500'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>✓</span>
                  <span>Apply Fence</span>
                </button>
                <button
                  onClick={handleCancelDrawing}
                  className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-400"
                >
                  Cancel
                </button>
              </>
            )}

            {geoFencePolygon && !isDrawingGeoFence && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Geo-fence Active ({geoFencePolygon.length} pts)
                </span>
                <button
                  onClick={handleClearGeoFence}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all"
                  title="Clear Geo-fence spatial filter"
                >
                  ✕ Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Severity / Status Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeFilter === 'ALL' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({issues.length})
          </button>
          <button
            onClick={() => setActiveFilter('EMERGENCY')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeFilter === 'EMERGENCY' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Emergencies
          </button>
          <button
            onClick={() => setActiveFilter('OPEN')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeFilter === 'OPEN' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Only
          </button>
        </div>
      </div>

      {/* Leaflet Real-Time Google Maps Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden isolate z-0">
        <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px', zIndex: 1 }} />

        {/* Floating Quick Action Overlay */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleRecenter}
            title="Recenter Map to My Area (K. Kalipalayam)"
            className="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-2xl backdrop-blur transition-all active:scale-95 text-xs font-bold flex items-center gap-1.5"
          >
            <span>🧭</span>
            <span>Center My Area</span>
          </button>
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            title="Fly to My Current GPS Location"
            className="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-slate-700 shadow-2xl backdrop-blur transition-all active:scale-95 text-xs font-bold flex items-center gap-1.5"
          >
            <span>{isLocating ? '⏳' : '🎯'}</span>
            <span>{isLocating ? 'Locating...' : 'GPS Locate'}</span>
          </button>
        </div>

        {/* Floating Live Telemetry HUD */}
        <div className="absolute bottom-4 left-4 z-10 bg-slate-950/90 backdrop-blur border border-slate-800 rounded-xl px-3.5 py-2 text-[11px] font-mono text-slate-300 shadow-2xl flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-400">Google Map Live</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>Lat: {mapCenter.lat.toFixed(4)}</span>
          <span>Lng: {mapCenter.lng.toFixed(4)}</span>
          <span>Zoom: {currentZoom}</span>
        </div>
      </div>

      {/* Status Footer */}
      <div className="relative z-20 p-3 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Engine: {activeLayer.replace('-', ' ').toUpperCase()}
          </span>
          <span>|</span>
          <span>Rendered Pins: {issues.length}</span>
        </div>
        <button
          onClick={onSimulateEmergency}
          className="px-3 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all font-semibold"
        >
          ⚡ Ingest Spike Event
        </button>
      </div>
    </section>
  );
}
