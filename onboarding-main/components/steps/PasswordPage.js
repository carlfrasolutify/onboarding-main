// PasswordPage.js

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const PasswordPage = ({ onNext, updateFormData, initialData }) => {
  const [password, setPassword] = useState(initialData.password || "");
  const [error, setError] = useState(false);

  useEffect(() => {
    // Check if the user has already authenticated
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated) {
      onNext();
    }
  }, [onNext]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/check-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.status === 200) {
      setError(false);
      updateFormData({ password });
      localStorage.setItem("isAuthenticated", "true"); // Save authentication status
      onNext();
    } else {
      setError(true);
      setPassword("");
    }
  };

  return (
    <div className="h-full flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl mx-auto -mt-20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            duration: 0.5,
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
          className="mb-8 relative"
        >
          <motion.div
            className="w-24 h-24 mx-auto"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Image
              src="/Logogang.svg"
              alt="Logo"
              width={96}
              height={96}
              priority
              className="drop-shadow-lg"
            />
          </motion.div>
        </motion.div>

        <div className="text-center space-y-5">
          <h1 className="text-3xl font-bold text-gray-900">Velkommen</h1>

          <p className="text-lg text-gray-600 max-w-lg mx-auto">
            Indtast adgangskoden for at fortsætte til onboardingen.
          </p>

          <form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-4">
            <motion.div
              animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setError(false);
                  setPassword(e.target.value);
                }}
                className={`w-full px-4 py-3 text-xl rounded-lg border ${
                  error
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-blue-500"
                } focus:outline-none focus:ring-2`}
                placeholder="Indtast adgangskode"
                autoFocus
                style={{
                  WebkitTextSecurity: "disc",
                  color: "#000",
                }}
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-sm mt-2"
                >
                  Forkert adgangskode. Prøv igen.
                </motion.p>
              )}
            </motion.div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-blue-500 text-white px-10 py-4 rounded-lg text-xl font-medium hover:bg-blue-600 transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              Fortsæt
            </motion.button>
          </form>

          <p className="mt-6 text-gray-600 text-base">
            Kontakt support hvis du mangler adgangskoden - info@solutify.ai
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default PasswordPage;
