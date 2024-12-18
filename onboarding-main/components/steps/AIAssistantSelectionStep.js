// AIAssistantSelectionStep.js

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

const AIAssistantSelectionStep = ({
  onNext,
  onPrev,
  updateFormData,
  initialData,
}) => {
  const [selectedAssistant, setSelectedAssistant] = useState(
    initialData?.assistantType || "Support AI"
  );

  useEffect(() => {
    if (initialData?.assistantType) {
      setSelectedAssistant(initialData.assistantType);
    } else {
      setSelectedAssistant("Support AI");
      updateFormData({ assistantType: "Support AI" });
    }
  }, [initialData, updateFormData]);

  const assistantTypes = [
    {
      id: "Support AI",
      name: "Support AI",
      description: "Hjælper med at håndtere henvendelser hurtigt og effektivt.",
      icon: "👥",
      available: true,
      recommended: true,
    },
    {
      id: "sales",
      name: "Salgs AI",
      description: "Genererer leads og understøtter salgskommunikation.",
      icon: "💼",
      available: true,
      recommended: false,
      comingSoon: null,
      backgroundColor: "bg-white",
    },
    {
      id: "content",
      name: "Indholds AI",
      description: "Skaber relevant indhold som LinkedIn-opslag og artikler.",
      icon: "✍️",
      available: false,
      comingSoon: "Kommer snart",
    },
    {
      id: "custom",
      name: "Byg Din Egen AI",
      description: "Tilpas din assistent helt fra bunden.",
      icon: "🛠️",
      available: false,
      comingSoon: "Kommer snart",
    },
  ];

  const handleSelection = (assistantType) => {
    setSelectedAssistant(assistantType);
    updateFormData({ assistantType });
  };

  const handleNext = () => {
    if (selectedAssistant) {
      updateFormData({ assistantType: selectedAssistant });
      onNext();
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">
          Vælg Din AI Assistent
        </h2>
        <div className="space-y-4 mb-8">
          {assistantTypes.map((assistant) => (
            <motion.div
              key={assistant.id}
              whileHover={{ scale: assistant.available ? 1.02 : 1 }}
              whileTap={{ scale: assistant.available ? 0.98 : 1 }}
              animate={{
                scale: selectedAssistant === assistant.id ? 1.02 : 1,
                y: selectedAssistant === assistant.id ? -4 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                mass: 0.5,
              }}
              onClick={() =>
                assistant.available && handleSelection(assistant.id)
              }
              className={`
                relative border rounded-lg p-4
                transform-gpu will-change-transform
                transition-colors duration-200 ease-in-out
                ${
                  selectedAssistant === assistant.id
                    ? "border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-500/20"
                    : assistant.available
                    ? "border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer bg-white"
                    : "border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed"
                }
              `}
            >
              <div className="flex items-center gap-4">
                <motion.span
                  className="text-2xl"
                  animate={{
                    scale: selectedAssistant === assistant.id ? 1.1 : 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                >
                  {assistant.icon}
                </motion.span>
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <motion.h3
                      className="font-semibold text-gray-900"
                      animate={{
                        color:
                          selectedAssistant === assistant.id
                            ? "#2563EB"
                            : "#111827",
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {assistant.name}
                    </motion.h3>
                    {assistant.recommended && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Anbefalet
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm">
                    {assistant.description}
                  </p>
                </div>
                {!assistant.available && (
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                      {assistant.comingSoon}
                    </span>
                  </div>
                )}
              </div>
              {assistant.recommended && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <div className="flex justify-between pt-4 border-t">
          <button
            onClick={onPrev}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Tilbage
          </button>
          <button
            onClick={handleNext}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition font-medium"
          >
            Næste
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantSelectionStep;