// Onboarding.js

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PasswordPage from "./steps/PasswordPage";
import StartJourney from "./steps/StartJourney";
import UserInformationStep from "./steps/UserInformationStep";
import AISetupDemoPage from "./steps/AISetupDemoPage";
// import AIAssistantSelectionStep from "./steps/AIAssistantSelectionStep";
import CompanyInformationStep from "./steps/CompanyInformationStep";
import AISetupStep from "./steps/AISetupStep";
import OnboardingComplete from "./steps/OnboardingComplete";

const ProgressBar = ({ currentStep, totalSteps }) => {
  const progress = (currentStep / (totalSteps - 1)) * 100;

  return (
    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200/30">
      <motion.div
        className="h-full bg-blue-500"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    </div>
  );
};

const sendDataToWebhook = async (data) => {
  try {
    const formData = new FormData();

    // Handle regular uploaded files
    if (data.uploadedFiles && data.uploadedFiles.length > 0) {
      for (let i = 0; i < data.uploadedFiles.length; i++) {
        const fileData = data.uploadedFiles[i];
        if (fileData.file instanceof File) {
          // New upload case - use File object
          formData.append(`uploadedFiles[${i}]`, fileData.file);
        } else if (fileData.preview) {
          // Reload case - reconstruct file from preview data
          const response = await fetch(fileData.preview);
          const blob = await response.blob();
          const file = new File([blob], fileData.metadata.name, {
            type: fileData.metadata.type,
            lastModified: fileData.metadata.lastModified
          });
          formData.append(`uploadedFiles[${i}]`, file);
        }
      }
    }

    // Handle logo with special case for preview data structure
    if (data.uploadedLogo) {
      if (data.uploadedLogo.file instanceof File) {
        // New upload case - use direct File object
        formData.append('uploadedLogo', data.uploadedLogo.file);
      } else if (data.uploadedLogo.preview) {
        // Reload case - reconstruct file from preview data
        const response = await fetch(data.uploadedLogo.preview);
        const blob = await response.blob();
        const file = new File([blob], data.uploadedLogo.metadata.name, {
          type: data.uploadedLogo.metadata.type,
          lastModified: data.uploadedLogo.metadata.lastModified
        });
        formData.append('uploadedLogo', file);
      }
    }

    // Handle remaining data
    const dataWithoutFiles = { ...data };
    delete dataWithoutFiles.uploadedFiles;
    delete dataWithoutFiles.uploadedLogo;

    // Append other data
    Object.entries(dataWithoutFiles).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value, value.name);
      } else if (value !== null && value !== undefined) {
        formData.append(
          key, 
          typeof value === 'object' ? JSON.stringify(value) : value
        );
      }
    });

    const response = await fetch("https://solutifyaps.app.n8n.cloud/webhook/03a9c9e9-3b59-4d53-aebe-17c6ff75a904", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Fejl ved afsendelse af data til webhook:", error);
    throw error;
  }
};

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false); // Add completion state

  // Memoiser funktioner for at forhindre unødvendige opdateringer
  const updateFormData = useCallback((newData) => {
    // Prevent redundant updates
    setFormData(prevData => {
      const updatedData = { ...prevData };
      let hasChanges = false;
      
      Object.entries(newData).forEach(([key, value]) => {
        if (JSON.stringify(updatedData[key]) !== JSON.stringify(value)) {
          updatedData[key] = value;
          hasChanges = true;
        }
      });

      return hasChanges ? updatedData : prevData;
    });
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prevStep) => prevStep + 1);
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prevStep) => Math.max(prevStep - 1, 0));
  }, []);

  const handlePasswordSuccess = useCallback(() => {
    setIsAuthenticated(true);
    setCurrentStep(1);
  }, []);

  // Definer steps og memoiser dem
  const steps = useMemo(
    () => [
      {
        component: PasswordPage,
        props: { onNext: handlePasswordSuccess, updateFormData, initialData: formData },
      },
      { component: StartJourney, props: { onNext: nextStep } },
      {
        component: UserInformationStep,
        props: {
          onNext: nextStep,
          onPrev: prevStep,
          updateFormData,
          initialData: formData,
        },
      },
      {
        component: CompanyInformationStep,
        props: {
          onNext: nextStep,
          onPrev: prevStep,
          updateFormData,
          initialData: formData,
        },
      },
      //{
        //component: AIAssistantSelectionStep,
        //props: {
          //onNext: nextStep,
          //onPrev: prevStep,
          //updateFormData,
          //initialData: formData,
        //},
      //},
      {
        component: AISetupDemoPage,
        props: {
          onNext: nextStep,
          onPrev: prevStep,
          updateFormData,
          initialData: formData,
        },
      },
      {
        component: AISetupStep,
        props: {
          onNext: nextStep,
          onPrev: prevStep,
          updateFormData,
          initialData: formData,
          sendDataToWebhook,
        },
      },
      {
        component: OnboardingComplete,
        props: { formData },
      },
    ],
    [handlePasswordSuccess, nextStep, prevStep, updateFormData, formData]
  );

  // Clear localStorage when onboarding is complete
  useEffect(() => {
    if (currentStep === steps.length - 1) {
      localStorage.removeItem("onboardingProgress");
      localStorage.setItem("onboardingCompleted", "true");
      setIsCompleted(true);
    }
  }, [currentStep, steps.length]);

  // Hent gemt tilstand fra localStorage ved første render
  useEffect(() => {
    const isOnboardingCompleted = localStorage.getItem("onboardingCompleted");
    
    if (isOnboardingCompleted) {
      // Reset everything if onboarding was completed
      localStorage.removeItem("onboardingProgress");
      localStorage.removeItem("onboardingCompleted");
      setCurrentStep(0);
      setFormData({});
      setIsAuthenticated(false);
      return;
    }

    // Only load saved progress if onboarding wasn't completed
    const savedProgress = localStorage.getItem("onboardingProgress");
    if (savedProgress) {
      const {
        currentStep: savedStep,
        formData: savedFormData,
        isAuthenticated: savedAuth,
      } = JSON.parse(savedProgress);
      setCurrentStep(savedStep);
      setFormData(savedFormData);
      setIsAuthenticated(savedAuth);
    }
  }, []);

  // Gem tilstanden i localStorage, når den ændres
  useEffect(() => {
    const progressData = {
      currentStep,
      formData,
      isAuthenticated,
    };
    localStorage.setItem("onboardingProgress", JSON.stringify(progressData));
  }, [currentStep, formData, isAuthenticated]);

  const renderStep = () => {
    if (!isAuthenticated && currentStep !== 0) {
      return <PasswordPage onNext={handlePasswordSuccess} />;
    }

    if (currentStep >= steps.length) {
      return null;
    }

    const StepComponent = steps[currentStep].component;
    return <StepComponent {...steps[currentStep].props} />;
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/images/ai-background.png')",
      }}
    >
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-black/10 to-black/30">
        <div className="w-full max-w-7xl h-[calc(100vh-2rem)]"> {/* Updated height */}
          <div className="bg-white/40 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden relative flex flex-col h-full"> {/* Changed to h-full */}
            <ProgressBar currentStep={currentStep} totalSteps={steps.length} />
            <div className="relative flex-1 w-full overflow-hidden"> {/* Added overflow-hidden */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex flex-col"
                >
                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="h-full flex flex-col justify-center">
                      <div
                        className={`${
                          currentStep === 4 || currentStep === 5
                            ? "max-w-none"
                            : "max-w-3xl"
                        } mx-auto w-full`}
                      >
                        {renderStep()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
