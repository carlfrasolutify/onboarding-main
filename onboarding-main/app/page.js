"use client";

import React, { useState } from "react";
import Onboarding from "../components/Onboarding";

export default function Home() {
  const [formData, setFormData] = useState({});

  const handleFormUpdate = (newData) => {
    setFormData((prevData) => ({
      ...prevData,
      ...newData,
    }));
  };

  return (
    <div>
      <Onboarding onFormUpdate={handleFormUpdate} initialFormData={formData} />
    </div>
  );
}
