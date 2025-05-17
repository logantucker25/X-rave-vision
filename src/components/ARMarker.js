// src/components/ARMarker.js
import React, { useState, useEffect } from 'react';
import './ARMarker.css';

const ARMarker = ({ userLocation, markerLocation, deviceOrientation, userName, isOnline, lastSeen }) => {
  const [markerPosition, setMarkerPosition] = useState({ x: 50, y: 50 }); 
  const [distance, setDistance] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [markerColor, setMarkerColor] = useState('#FFFFFF'); // Default color
  
  // Field of view angle 
  const FIELD_OF_VIEW = 70;

  // Generate a random user color when the component mounts
  useEffect(() => {

    const generateRandomColor = () => {
      const hue = Math.floor(Math.random() * 360); 
      const saturation = 70 + Math.floor(Math.random() * 30); 
      const lightness = 40 + Math.floor(Math.random() * 20); 
      
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };
    
    setMarkerColor(generateRandomColor());
  }, [userName]); // Re-generate color if username changes

  useEffect(() => {
    if (!userLocation || !markerLocation || !deviceOrientation) {
      return;
    }

    // Calculate the distance between the user and marker
    const dist = calculateDistance(
      userLocation.latitude, 
      userLocation.longitude,
      markerLocation.latitude,
      markerLocation.longitude
    );
    setDistance(dist);

    // Calculate bearing between user and marker
    const bearing = calculateBearing(
      userLocation.latitude, 
      userLocation.longitude,
      markerLocation.latitude,
      markerLocation.longitude
    );

    // Get device compass heading
    const compassHeading = deviceOrientation.alpha || 0;
    
    // Calculate the difference between the bearing and the compass heading
    let relativeBearing = bearing - compassHeading;
    
    // Normalize to -180 to 180 degrees
    relativeBearing = ((relativeBearing + 180) % 360) - 180;
    
    // Check if the marker is within the camera's expanded field of view (±70 degrees)
    const inView = Math.abs(relativeBearing) <= FIELD_OF_VIEW;
    setIsInView(inView);
    
    // Only update position if the marker is in view
    if (inView) {
      // Map -70 to 70 degrees to 0 to 100% of the screen width
      const x = ((relativeBearing + FIELD_OF_VIEW) / (FIELD_OF_VIEW * 2)) * 100;
      
      // Y position can be based on distance or device pitch
      // Adjust the division factor to make the vertical positioning less sensitive
      let y = 50 - (deviceOrientation.beta || 0) / 3;
      
      // Keep y within screen bounds (10% to 90%)
      y = Math.max(10, Math.min(90, y));
      
      setMarkerPosition({ x, y });
    }
    
  }, [userLocation, markerLocation, deviceOrientation]);

  // Haversine FTW
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate the bearing between two points this is kinda messed up rn
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const λ1 = lon1 * Math.PI / 180;
    const λ2 = lon2 * Math.PI / 180;

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    const bearing = (θ * 180 / Math.PI + 360) % 360; // in degrees
    return bearing;
  };

  // Format last seen time
  const formatLastSeen = (lastSeenTime) => {
    if (!lastSeenTime) return '';
    
    try {
      const date = new Date(lastSeenTime);
      if (isNaN(date.getTime())) return 'Unknown time';
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins === 1) return '1 minute ago';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays} days ago`;
    } catch (e) {
      console.error("Date parsing error:", e);
      return 'Unknown time';
    }
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };

  // If marker is not in view, don't render anything
  if (!isInView) {
    return null;
  }

  const containerClass = "ar-marker";
  
  const lastSeenText = !isOnline && lastSeen ? formatLastSeen(lastSeen) : '';

  return (
    <div 
      className={containerClass}
      style={{
        left: `${markerPosition.x}%`,
        top: `${markerPosition.y}%`
      }}
    >
      <div 
        className="ar-marker-icon"
        style={{ backgroundColor: markerColor }}
      ></div>
      <div className="ar-marker-info">
        <div className="ar-marker-name">{userName}</div>
        <div className="ar-marker-distance">{formatDistance(distance)}</div>
        {lastSeenText && <div className="ar-marker-last-seen">{lastSeenText}</div>}
      </div>
    </div>
  );
};

export default ARMarker;