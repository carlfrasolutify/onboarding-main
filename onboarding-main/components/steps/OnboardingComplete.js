import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { motion } from "framer-motion";

const OnboardingComplete = ({ formData }) => {
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);
  const [confettiConfig, setConfettiConfig] = useState({
    opacity: 1,
    recycle: true,
    numberOfPieces: 200,
    gravity: 0.3,
    initialVelocityY: 20,
    initialVelocityX: 5,
    wind: 0,
    colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff"],
  });

  const handleRedirect = () => {
    // Ensure navigation happens at the top-level window
    window.top.location.href = "https://dashboard.solutify.ai/logindk";
  };

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    // Start the fade-out animation
    const fadeOutTimer = setTimeout(() => {
      setConfettiConfig((prev) => ({
        ...prev,
        recycle: false,
        numberOfPieces: 0,
        gravity: 0.5,
        wind: 0.1,
      }));
    }, 2000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(fadeOutTimer);
    };
  }, []);

  return (
    <div className="p-6 text-center relative">
      <Confetti
        width={width}
        height={height}
        {...confettiConfig}
        style={{ position: "fixed", top: 0, left: 0, zIndex: 100 }}
        tweenDuration={5000}
      />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.8,
          ease: "easeOut",
          delay: 0.2,
        }}
        className="relative z-10"
      >
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-4xl font-bold mb-4 text-gray-900"
        >
          Tillykke! 🎉
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-gray-700 mb-8 max-w-md mx-auto text-lg"
        >
          Du har gennemført onboarding-processen!
        </motion.p>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="bg-white/90 backdrop-blur-sm p-8 rounded-xl text-left max-w-lg mx-auto shadow-lg border border-gray-100"
        >
          <h3 className="text-2xl font-semibold mb-6 text-gray-900">
            Dine AI Assistent detaljer:
          </h3>
          <ul className="space-y-4">
            <li>
              <span className="font-medium text-gray-900">Navn:</span>{" "}
              <span className="text-gray-700">{formData.companyName}</span>
            </li>
            <li>
              <span className="font-medium text-gray-900">Assistenttype:</span>{" "}
              <span className="text-gray-700">{formData.assistantType}</span>
            </li>
            <li>
              <span className="font-medium text-gray-900">Hjemmesidelink:</span>{" "}
              <span className="text-gray-700">
                {formData.websiteLink || "Ingen"}
              </span>
            </li>
            <li>
              <span className="font-medium text-gray-900">Beskrivelse:</span>{" "}
              <span className="text-gray-700">{formData.prompt}</span>
            </li>
          </ul>
        </motion.div>
        <motion.button
          onClick={handleRedirect}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="inline-block bg-blue-500 text-white px-10 py-4 rounded-lg hover:bg-blue-600 transition-all duration-300 font-medium shadow-md hover:shadow-lg text-lg hover:scale-105 transform mt-8"
        >
          Gå til Dashboard
        </motion.button>
      </motion.div>
    </div>
  );
};

export default OnboardingComplete;
