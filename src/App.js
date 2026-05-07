import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import Room from "./Room";

export default function App() {
  const [userName, setUserName] = useState(
    () => sessionStorage.getItem("cs_name") || ""
  );

  const saveName = (name) => {
    sessionStorage.setItem("cs_name", name);
    setUserName(name);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage onSetName={saveName} />} />
        <Route
          path="/room/:roomID"
          element={
            userName ? (
              <Room userName={userName} />
            ) : (
              <LandingPage onSetName={saveName} redirectToRoom />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
