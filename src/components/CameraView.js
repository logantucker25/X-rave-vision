// src/components/CameraView.js 
import React, { useEffect, useRef, useState } from 'react';
import { database } from '../firebase';
import { ref, update, onDisconnect, onValue, off } from 'firebase/database';
import ARMarker from './ARMarker';
import './CameraView.css';

const CameraView = ({ userData }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("requesting"); // "requesting", "granted", "denied"
  const locationWatchId = useRef(null);
  const userRef = useRef(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [deviceOrientation, setDeviceOrientation] = useState({
    alpha: 0,
    beta: 0,
    gamma: 0,
    absolute: false,
    eventCount: 0
  });
  const [orientationStatus, setOrientationStatus] = useState("waiting");
  const [otherUsers, setOtherUsers] = useState([]);
  const [debugInfoExpanded, setDebugInfoExpanded] = useState(false);

  const eventCountRef = useRef(0);
  const orientationTimerRef = useRef(null);

  // Enhanced device orientation tracking
  useEffect(() => {
    console.log("Setting up device orientation tracking...");
    console.log("Orientation permissions from userData:", userData?.orientationPermissions);
    
    // More robust orientation handler with better logging
    const handleOrientation = (event) => {
      
      // Update state with the orientation values
      setDeviceOrientation({
        alpha: event.alpha ?? 0,
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0,
        absolute: Boolean(event.absolute),
        eventCount: eventCountRef.current,
        lastUpdated: Date.now()
      });
      
      if (orientationStatus !== "active") {
        console.log("First orientation event received - orientation tracking is now active");
        setOrientationStatus("active");
      }
    };

    // Motion handler for complementary data
    const handleMotion = (event) => {
      const rotation = event.rotationRate;
    };

    // Add event listeners - we already requested permissions in Hello.js
    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);

  }, [userData]);

  // Set up real-time location tracking 
  useEffect(() => {
    if (!userData || !userData.id) {
      console.error("No user data available for location tracking");
      return;
    }

    // Create reference to this user's location in Firebase
    userRef.current = ref(database, `users/${userData.id}`);
    
    // Initialize with high accuracy options
    const locationOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    };

    // Success callback when location is updated
    const locationSuccess = (position) => {
      const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
      const timestamp = position.timestamp;
      
      const locationData = {
        location: {
          latitude,
          longitude,
          accuracy,
          altitude: altitude || null,
          heading: heading || null,
          speed: speed || null,
          timestamp,
          lastUpdated: new Date().toISOString()
        },
        online: true
      };
      
      // Update local state for AR use
      setCurrentLocation({
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        altitude
      });
      
      
      // Update the location in Firebase
      update(userRef.current, locationData)
        .catch(error => {
          console.error("Error updating location in database:", error);
        });
    };

    // Error callback
    const locationError = (error) => {
      console.error("Location tracking error:", error.code, error.message);
      
      // Still update the database to indicate location error
      update(userRef.current, {
        locationError: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        }
      }).catch(e => console.error("Error updating location error status:", e));
    };

    // Start watching position (continuous updates)
    locationWatchId.current = navigator.geolocation.watchPosition(
      locationSuccess,
      locationError,
      locationOptions
    );
    
    // Set user as online and set up disconnect handler
    update(userRef.current, { online: true });
    
    // When user disconnects (closes app), mark them as offline
    onDisconnect(userRef.current).update({
      online: false,
      lastSeen: new Date().toISOString()
    });

    // Clean up function
    return () => {
      // Stop watching location
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
        console.log("Location tracking stopped");
      }
      
      // Update user status to offline
      if (userRef.current) {
        update(userRef.current, {
          online: false,
          lastSeen: new Date().toISOString()
        }).catch(e => console.error("Error updating offline status:", e));
      }
    };
  }, [userData]);

  // Listen for other users' locations - MODIFIED TO FILTER BY GROUP
  useEffect(() => {
    if (!userData || !userData.id || !userData.groupName) return;
    
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const usersData = snapshot.val();
      const otherUsersArray = [];
      
      // Process only users who are in the same group as the current user
      Object.keys(usersData).forEach(userId => {
        // Only include users with location data and matching group name
        if (userId !== userData.id && 
            usersData[userId].location && 
            usersData[userId].groupName && 
            usersData[userId].groupName.toLowerCase() === userData.groupName.toLowerCase()) {
          
          otherUsersArray.push({
            id: userId,
            name: usersData[userId].username || 'Unknown User',
            location: usersData[userId].location,
            online: usersData[userId].online || false,
            lastSeen: usersData[userId].lastSeen || null,
            groupName: usersData[userId].groupName
          });
        }
      });
      
      setOtherUsers(otherUsersArray);
      console.log(`Found ${otherUsersArray.length} users in group "${userData.groupName}" (${otherUsersArray.filter(u => u.online).length} online)`);
    });
    
    return () => {
      // Unsubscribe from Firebase updates
      off(usersRef);
    };
  }, [userData]);

  // Camera setup effect - unchanged from original
  useEffect(() => {
    let mounted = true;
    
    async function setupCamera() {
      try {
        console.log("Starting camera setup...");
        
        // Request the back-facing camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        console.log("Camera permission granted, got stream");
        
        // Make sure component is still mounted
        if (!mounted) return;
        
        if (videoRef.current) {
          console.log("Setting srcObject on video element");
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded, playing video");
            videoRef.current.play()
              .then(() => {
                console.log("Video playback started successfully");
                if (mounted) setStatus("granted");
              })
              .catch(e => console.error('Error playing video:', e));
          };
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        if (mounted) setStatus("denied");
      }
    }

    setupCamera();

    // Clean up function
    return () => {
      mounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Format coordinates to be more readable
  const formatCoordinate = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(6);
  };

  // Format device orientation values
  const formatOrientation = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(1);
  };

  
  // Function to request orientation permissions manually
  const requestOrientationPermissions = async () => {
    console.log("Manually requesting orientation permissions");
    
    try {
      if (typeof window.DeviceOrientationEvent !== 'undefined' && 
          typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        
        const permissionState = await window.DeviceOrientationEvent.requestPermission();
        console.log("Orientation permission state:", permissionState);
        
        if (permissionState === 'granted') {
          setOrientationStatus("permission_granted");
          
          // Reset event count to check if events start coming in
          eventCountRef.current = 0;
          
          // Check again after a short delay if events are being received
          setTimeout(() => {
            if (eventCountRef.current === 0) {
              console.warn("Permission granted but still no orientation events");
              setOrientationStatus("permission_granted_but_no_events");
            }
          }, 1000);
        } else {
          console.error("Orientation permission denied by user");
          setOrientationStatus("permission_denied");
        }
      } else {
        console.log("This device doesn't support orientation permission requests");
        setOrientationStatus("permissions_not_required");
        
        // Since permissions aren't required, events should flow - if they don't, it might be a sensor issue
        setTimeout(() => {
          if (eventCountRef.current === 0) {
            console.warn("No orientation events even though permissions not required");
            setOrientationStatus("no_sensor_data");
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error requesting orientation permissions:", error);
      setOrientationStatus("permission_error");
    }
  };

  // Toggle debug info expanded/collapsed
  const toggleDebugInfo = () => {
    setDebugInfoExpanded(!debugInfoExpanded);
  };

  // Count nearby online users
  const nearbyOnlineUsers = otherUsers.filter(u => u.online).length;

  return (
    <div className="camera-container">
      {/* Camera feed */}
      <video 
        ref={videoRef}
        className="camera-video"
        autoPlay
        playsInline
        muted
      />
      
      {/* AR Markers for other users in the same group */}
      {status === "granted" && currentLocation && deviceOrientation && 
        otherUsers.map(user => (
          <ARMarker 
            key={user.id}
            userLocation={currentLocation}
            markerLocation={user.location}
            deviceOrientation={deviceOrientation}
            userName={user.name}
            isOnline={user.online}
            lastSeen={user.lastSeen}
          />
        ))
      }
      
      {/* Overlays for camera status */}
      {status === "requesting" && (
        <div className="camera-overlay">
          <p className="camera-text">Requesting camera permission...</p>
        </div>
      )}
      
      {status === "denied" && (
        <div className="camera-overlay">
          <p className="camera-error">Camera access denied</p>
          <p className="camera-text">This app requires camera access to function</p>
        </div>
      )}
      
      {/* New button for orientation permission requests */}
      {(orientationStatus === "waiting" || 
        orientationStatus === "no_events" || 
        orientationStatus === "permission_denied" || 
        orientationStatus === "permission_error" ||
        orientationStatus === "no_sensor_data") && (
        <div className="orientation-controls">
          <button 
            className="orientation-button"
            onClick={requestOrientationPermissions}
          >
            Click to enable orientation access
          </button>
          
          
          {orientationStatus === "permission_denied" && (
            <p className="orientation-message">
              Orientation permission was denied. Some AR features may not work correctly.
            </p>
          )}
          
          {orientationStatus === "no_sensor_data" && (
            <p className="orientation-message">
              No orientation data detected. Your device may not have the required sensors.
            </p>
          )}
        </div>
      )}
      
      {/* Location tracking indicator */}
      <div className="location-indicator"></div>
      
      {/* Enhanced debug information with collapse functionality */}
      <div className="debug-info">
        <div className="debug-header" onClick={toggleDebugInfo}>
          <span className={`debug-toggle-icon ${debugInfoExpanded ? 'expanded' : 'collapsed'}`}>
            {debugInfoExpanded ? '▼' : '►'}
          </span>
          <span className="debug-title">View Location Info</span>
        </div>

        {/* Collapsible debug content */}
        {debugInfoExpanded && (
          <div className="debug-content">
            {currentLocation && (
              <div className="debug-section">
                <div className="debug-title">Location:</div>
                <div>Lat: {formatCoordinate(currentLocation.latitude)}</div>
                <div>Lng: {formatCoordinate(currentLocation.longitude)}</div>
                <div>Acc: {currentLocation.accuracy ? `±${Math.round(currentLocation.accuracy)}m` : 'N/A'}</div>
                {currentLocation.altitude !== null && 
                  <div>Alt: {Math.round(currentLocation.altitude || 0)}m</div>
                }
                {currentLocation.speed !== null && 
                  <div>Speed: {Math.round(currentLocation.speed || 0)} m/s</div>
                }
              </div>
            )}
            
            <div className="debug-section">
              <div className="debug-title">Orientation: {orientationStatus}</div>
              <div>α: {formatOrientation(deviceOrientation.alpha)}° (compass)</div>
              <div>β: {formatOrientation(deviceOrientation.beta)}° (tilt)</div>
              <div>γ: {formatOrientation(deviceOrientation.gamma)}° (rotation)</div>
              <div>Events: {deviceOrientation.eventCount}</div>
              <div>Absolute: {deviceOrientation.absolute ? 'Yes' : 'No'}</div>
              {deviceOrientation.lastUpdated && (
                <div>Last: {new Date(deviceOrientation.lastUpdated).toLocaleTimeString()}</div>
              )}
            </div>
            
            {/* Added group information in debug view */}
            <div className="debug-section">
              <div className="debug-title">Group Info:</div>
              <div>Current Group: {userData?.groupName || 'Not set'}</div>
              <div>Members: {otherUsers.length + 1} (including you)</div>
              <div>Online: {nearbyOnlineUsers + 1} (including you)</div>
            </div>
          </div>
        )}
        
        {/* User count info - always visible */}
        <div className="users-info">
          <div>
            Group: {userData?.groupName || 'None'} | Online: {nearbyOnlineUsers}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraView;