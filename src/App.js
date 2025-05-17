// src/App.js
import React, { useState } from 'react';
import './App.css';
import Hello from './components/Hello';
import CameraView from './components/CameraView';

function App() {
  const [showCamera, setShowCamera] = useState(false);
  const [userData, setUserData] = useState(null);

  const handleUserSubmit = (data) => {
    console.log("User data received in App.js:", data);
    setUserData(data);
    setShowCamera(true);
  };

  return (
    <div className="App">
      {!showCamera ? (
        <Hello onSubmit={handleUserSubmit} />
      ) : (
        <CameraView userData={userData} />
      )}
    </div>
  );
}

export default App;