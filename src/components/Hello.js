
// src/components/Hello.js 
import React, { useState, useEffect } from 'react';
import { useRef } from "react";
import { database } from '../firebase';
import { ref, set, push, get, child } from 'firebase/database';
import './Hello.css';

const Hello = ({ onSubmit }) => {
  const [username, setUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestLocation = () => {
    
    return new Promise((resolve, reject) => {
      
      if (!navigator.geolocation) {
        // this browser doesnt support geo-location
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude:  position.coords.altitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          resolve(locationData);
        },
        (error) => {
          console.error('Location error:', error);
          reject(error);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  async function requestMotionOrientation() {
    console.log("Requesting motion and orientation permissions...");

    const requestPermission = async (PermissionEvent, name) => {
      if (
        typeof PermissionEvent === "undefined" ||
        typeof PermissionEvent.requestPermission !== "function"
      ) {
        return true;
      }
      
      try {
        const permissionResult = await PermissionEvent.requestPermission();
        const granted = permissionResult === "granted";
        console.log(`${name} permission ${granted ? 'granted' : 'denied'}`);
        return granted;
      } catch (e) {
        console.error(`${name} permission request error:`, e);
        return false;
      }
    };

    let orientationGranted = false;
    let motionGranted = false;
    
    try {
      orientationGranted = await requestPermission(
        window.DeviceOrientationEvent, 
        "orientation"
      );  
      motionGranted = await requestPermission(
        window.DeviceMotionEvent,
        "motion"
      );

      if (orientationGranted) {
        window.addEventListener("deviceorientation", () => {
          console.log("First orientation event received");
        }, { once: true });
      }
      
      if (motionGranted) {
        window.addEventListener("devicemotion", () => {
          console.log("First motion event received");
        }, { once: true });
      }
      
      if ((typeof window.DeviceOrientationEvent !== 'undefined' && 
           typeof window.DeviceOrientationEvent.requestPermission === 'function' && 
           !orientationGranted) || 
          (typeof window.DeviceMotionEvent !== 'undefined' && 
           typeof window.DeviceMotionEvent.requestPermission === 'function' && 
           !motionGranted)) {
        console.warn("Some motion/orientation permissions were denied");
      }
      
      return {
        orientationGranted,
        motionGranted,
      };
    } catch (error) {
      console.error("Error during motion/orientation permission request:", error);
      return {
        orientationGranted: false,
        motionGranted: false,
        error: error.message
      };
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !groupName.trim()) {
      setError("Please enter both your name and a group name");
      return; 
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Requesting location permission...");
      const locationData = await requestLocation();
      console.log("Location permission granted and data obtained");
      
      console.log("Requesting orientation permissions...");
      const orientationPermissions = await requestMotionOrientation();
      console.log("Orientation permission result:", orientationPermissions);
      
      const usersRef = ref(database, 'users');
      const newUserRef = push(usersRef);
      
      const userData = {
        username: username.trim(),
        groupName: groupName.trim().toLowerCase(), // Store group name in lowercase for case-insensitive comparisons
        location: locationData,
        orientationPermissions: orientationPermissions, 
        createdAt: new Date().toISOString()
      };
      
      console.log("Saving user data to Realtime Database...");
      await set(newUserRef, userData);
      console.log("User data saved successfully with ID:", newUserRef.key);
      
      onSubmit({
        id: newUserRef.key,
        username: username.trim(),
        groupName: groupName.trim().toLowerCase(),
        location: locationData,
        orientationPermissions: orientationPermissions
      });
      
    } catch (error) {
      console.error('Error in submission process:', error);      
      setError("An error occurred while setting up. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="hello-container">
      <div className="hello-card">
        <h1 className="hello-title">x-rave-vision</h1>
        <form onSubmit={handleSubmit}>
          <input
            className="hello-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Name thy self"
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
          />
          <input
            className="hello-input"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button 
            className="hello-button"
            type="submit"
            disabled={!username.trim() || !groupName.trim() || isLoading}
          >
            {isLoading ? 'Processing...' : 'Continue'}
          </button>
        </form>
        
        {error && (
          <p className="hello-warning">
            {error}
          </p>
        )}
        
      </div>
    </div>
  );
};

export default Hello;