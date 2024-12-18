// startjourney.js -
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RocketIcon } from "lucide-react";

const StartJourney = ({ onNext }) => {
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunch = () => {
    setIsLaunching(true);
    // Start the transition immediately
    setTimeout(onNext, 1500);
  };

  const rocketVariants = {
    idle: {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
    },
    launch: {
      x: 500,
      y: -1000,
      rotate: 45,
      scale: 0.2,
      transition: {
        duration: 1.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const loadingVariants = {
    idle: {
      width: "0%",
    },
    loading: {
      width: "100%",
      transition: {
        duration: 1.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const smokeVariants = {
    idle: { opacity: 0, scale: 0 },
    launch: {
      opacity: [0, 1, 0],
      scale: [0.5, 1.5, 2],
      transition: {
        duration: 0.8,
        times: [0, 0.5, 1],
      },
    },
  };

  return (
    <div className="h-full flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl mx-auto"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="mb-10 relative"
        >
          {/* Rocket container */}
          <motion.div
            className="bg-blue-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto relative z-10"
            variants={rocketVariants}
            animate={isLaunching ? "launch" : "idle"}
          >
            <RocketIcon className="text-blue-500 w-12 h-12" />
          </motion.div>

          {/* Smoke effect */}
          <AnimatePresence>
            {isLaunching && (
              <>
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 w-16 h-16 bg-gray-200 rounded-full"
                  variants={smokeVariants}
                  initial="idle"
                  animate="launch"
                  style={{ filter: "blur(8px)" }}
                />
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 w-16 h-16 bg-gray-300 rounded-full"
                  variants={smokeVariants}
                  initial="idle"
                  animate="launch"
                  transition={{ delay: 0.1 }}
                  style={{ filter: "blur(8px)" }}
                />
              </>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-gray-900">
            Starten på din AI rejse!
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Vi guider dig gennem opsætningen af din AI Assistent, så du kan
            komme i gang med det samme. Det er nemt og ligetil!
          </p>

          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLaunch}
              disabled={isLaunching}
              className={`relative bg-blue-500 text-white px-10 py-4 rounded-lg text-xl font-medium 
                hover:bg-blue-600 transition-colors duration-200 shadow-sm hover:shadow-md overflow-hidden
                ${isLaunching ? "cursor-not-allowed" : ""}`}
            >
              {/* Loading bar overlay */}
              <motion.div
                className="absolute left-0 bottom-0 h-full bg-blue-600/50"
                variants={loadingVariants}
                initial="idle"
                animate={isLaunching ? "loading" : "idle"}
              />
              {/* Button text */}
              <span className="relative z-10">
                {isLaunching ? "Starter op..." : "Start opsætning"}
              </span>
            </motion.button>
          </div>

          <p className="mt-6 text-gray-600 text-base">
            Forventet opsætningstid: 5 minutter
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default StartJourney;
