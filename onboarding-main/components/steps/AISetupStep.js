// AISetupStep.js 

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ChevronDown, X, Settings2 } from "lucide-react";

const AISetupStep = ({ onNext, onPrev, updateFormData, sendDataToWebhook, initialData }) => {
  // Sikr at vi starter fra begyndelsen
  const cleanedInitialData = {
    ...initialData,
    currentPart: 0,
    email: '',
    password: '',
    confirmPassword: ''
  };
  

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields, touchedFields },
    watch,
    trigger,
    getValues,
    reset,
    clearErrors,
  } = useForm({
    defaultValues: cleanedInitialData,
    mode: "onSubmit",
    reValidateMode: "onChange"
  });
  
  
  

  useEffect(() => {
    setCurrentPart(0);
    updateFormData({ currentPart: 0 });
  }, [updateFormData]);

  // State
  const [currentPart, setCurrentPart] = useState(initialData.currentPart || 0);
  const [uploadedFiles, setUploadedFiles] = useState(initialData.uploadedFiles || []);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false);
  const [hasVisitedAccountStep, setHasVisitedAccountStep] = useState(
    initialData.hasVisitedAccountStep || false
  );
  const [userHasTypedEmail, setUserHasTypedEmail] = useState(false);
  const [userHasTypedPassword, setUserHasTypedPassword] = useState(false);
  const [userHasTypedConfirmPassword, setUserHasTypedConfirmPassword] = useState(false);


  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const [hasAttemptedAccountSubmit, setHasAttemptedAccountSubmit] = useState(false);

  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const fileInputRef = useRef(null);

  const onValid = useCallback((data) => {
    if (currentPart === 4 && isCreatingAccount) {
      if (!data.email || !data.password || !data.confirmPassword) {
        setHasAttemptedAccountSubmit(true);
        return;
      }
      const combinedData = {
        ...initialData,
        ...data,
        uploadedFiles,
        hasVisitedAccountStep,
        currentPart
      };
      updateFormData(combinedData);
      sendDataToWebhook(combinedData);
      onNext();
    }
    setIsCreatingAccount(false);
}, [currentPart, initialData, uploadedFiles, hasVisitedAccountStep, updateFormData, sendDataToWebhook, onNext, isCreatingAccount]);

  const onInvalid = useCallback(() => {
    setHasAttemptedSubmit(true);
    if (currentPart === 4) {
      setHasAttemptedAccountSubmit(true);
    }
  }, [currentPart]);
  

  const watchedFields = watch([
    "websiteLink",
    "socialMediaLinks",
    "prompt",
    ...(hasVisitedAccountStep ? ["email", "password", "confirmPassword"] : []),
  ]);
  
  // Memoized handlers
  const handleFieldChange = useCallback(
    (values) => {
      const formData = {};
  
      if (values[0] !== undefined) formData.websiteLink = values[0];
      if (values[1] !== undefined) formData.socialMediaLinks = values[1];
      if (values[2] !== undefined) formData.prompt = values[2];
  
      if (hasVisitedAccountStep) {
        if (values[3] !== undefined) formData.email = values[3];
        if (values[4] !== undefined) formData.password = values[4];
        if (values[5] !== undefined) formData.confirmPassword = values[5];
      }
  
      if (Object.keys(formData).length > 0) {
        updateFormData(formData);
      }
    },
    [hasVisitedAccountStep, updateFormData]
  );
  

  // Watch for field changes
  useEffect(() => {
    handleFieldChange(watchedFields);
  }, [watchedFields, handleFieldChange]);

  

  // Handle step changes
  const handleStepChange = useCallback(async (nextStep) => {
    // Only allow progression to next step if current step is valid
    if (nextStep > currentPart) {
      // Add explicit validation for step 4
      if (currentPart === 4) {
        const isValid = await trigger(["email", "password", "confirmPassword"]);
        if (!isValid) return;
      }
      
      // Existing validation for other steps
      if (currentPart === 0) {
        const isValid = await trigger("websiteLink");
        if (!isValid) return;
      }
      
      if (currentPart === 2) {
        const isValid = await trigger("prompt");
        if (!isValid) return;
      }
    }
  
    // Rest of the function remains the same...
    if (nextStep === 4 && !hasVisitedAccountStep) {
      const values = getValues();
      reset({
        ...values,
        email: '', // Explicitly reset these fields
        password: '',
        confirmPassword: ''
      }, {
        keepErrors: false,
        keepDirty: false,
        keepTouched: false,
        keepIsValid: false,
        keepSubmitCount: false
      });
      clearErrors();
      setHasVisitedAccountStep(true);
      updateFormData({ hasVisitedAccountStep: true });
    }
  
    setCurrentPart(nextStep);
    updateFormData({ currentPart: nextStep });
    setHasAttemptedSubmit(false);
    if (nextStep === 4) {
      setHasAttemptedAccountSubmit(false);
      clearErrors();
    }
  }, [currentPart, hasVisitedAccountStep, trigger, reset, getValues, updateFormData, clearErrors]);
  
  

  // File handlers
  const handleFileUpload = useCallback((event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      Promise.all(
        files.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
              resolve({
                file: file,              // Original file for upload
                preview: e.target.result, // Data URL for preview
                metadata: {              // Metadata for reconstituting file
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  lastModified: file.lastModified
                }
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      )
      .then((processedFiles) => {
        setUploadedFiles(prevFiles => [...prevFiles, ...processedFiles]);
        updateFormData({ uploadedFiles: [...uploadedFiles, ...processedFiles] });
      });
    }
  }, [uploadedFiles, updateFormData]);

  const handleFileDelete = useCallback((index) => {
    setUploadedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      updateFormData({ uploadedFiles: newFiles });
      return newFiles;
    });
  }, [updateFormData]);

  const handleSave = useCallback((newFiles) => {
    setUploadedFiles(newFiles);
    updateFormData({ uploadedFiles: newFiles });
    setShowKnowledgeBaseModal(false);
  }, [updateFormData]);


  const triggerFileInput = (ref) => {
    ref.current.click();
  };

  const renderCurrentStep = () => {
    switch (currentPart) {
      case 0:
        return (
          <motion.div
            key="part1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white/95 backdrop-blur rounded-xl p-6 shadow-lg">
              {/* Card Header */}
              <div className="space-y-2 mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  Træn din AI med eksisterende indhold
                </h2>
                <p className="text-gray-600 text-justify">
                  Din AI Assistent kan automatisk indsamle og lære fra indholdet på din hjemmeside 
                  og sociale medier. Dette gør din AI mere effektiv til at besvare spørgsmål om 
                  din virksomhed, produkter og services.
                </p>
              </div>

              {/* Card Content */}
              <div className="space-y-6">
                {/* Website Links */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {/* First tooltip */}
                    <div className="flex items-center gap-2 text-lg font-medium">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <h2 className="text-gray-600 text-base">Link til hjemmeside</h2>
                    </div>
                    <div className="group relative flex items-center">
                      <svg 
                        className="w-[1.1rem] h-[1.1rem] text-gray-500 hover:text-gray-600 transition-colors cursor-help" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093v.5M12 18h.01M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
                        />
                      </svg>
                      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-full ml-2 w-64 p-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg">
                        Vi scanner din hjemmeside for relevant information om din virksomhed
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      {...register("websiteLink", { required: "Link til hjemmeside er påkrævet" })}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none text-gray-900 bg-transparent transition-all"
                      placeholder="solutify.ai"
                    />
                    {errors.websiteLink && (
                      <p className="text-red-500 text-sm">{errors.websiteLink.message}</p>
                    )}
                  </div>
                </div>

                {/* Social Media Links */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-lg font-medium">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <h2 className="text-gray-600 text-base">Links til sociale medier</h2>
                    </div>
                    <div className="group relative flex items-center">
                      <svg 
                        className="w-[1.1rem] h-[1.1rem] text-gray-500 hover:text-gray-600 transition-colors cursor-help" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093v.5M12 18h.01M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
                        />
                      </svg>
                      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-full ml-2 w-64 p-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg">
                        Vi indsamler også information fra dine sociale medier for at give din AI en bedre forståelse
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    {...register("socialMediaLinks")}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none text-gray-900 bg-transparent transition-all"
                    placeholder="Indsæt links til dine sociale medier"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );

        case 1:
          return (
            <motion.div
              key="knowledgeBase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-white/60 backdrop-blur rounded-xl p-6 shadow-lg">
                <div className="space-y-2 mb-4">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                    Vidensbase - Træn din AI
                  </h2>
                  <p className="text-gray-600 leading-relaxed text-justify">
                    Din AI Assistent bliver klogere ved at lære fra dine dokumenter. Upload relevante filer, 
                    for jo flere dokumenter du tilføjer, desto bedre besvarer din AI spørgsmål præcist og 
                    matcher din virksomheds tone.
                  </p>
                </div>
        
                <div className="space-y-4">
                  <ul className="grid gap-3 text-sm">
                    {[
                      "FAQ dokumenter",
                      "Produktbeskrivelser",
                      "Servicemanualer",
                      "Virksomhedspolitikker",
                      "Procedurebeskrivelser"
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        <span className="text-blue-900">{item}</span>
                      </li>
                    ))}
                  </ul>
        
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Upload dokumenter</span>
                      <span className="text-xs text-gray-500">
                        Understøttede formater: PDF, DOC, DOCX, TXT
                      </span>
                    </div>
        
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt"
                      />
                      <button
                        type="button"
                        onClick={() => triggerFileInput(fileInputRef)}
                        className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload filer
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowKnowledgeBaseModal(true)}
                        className="flex-1 items-center justify-center gap-2 border-2 border-blue-500 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium flex"
                      >
                        <Settings2 className="w-5 h-5" />
                        Administrer vidensbase {uploadedFiles.length > 0 ? `(${uploadedFiles.length})` : ''}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
        
              <AnimatePresence>
                {showKnowledgeBaseModal && (
                  <KnowledgeBaseModal 
                    onClose={() => setShowKnowledgeBaseModal(false)}
                    files={uploadedFiles}
                    onSave={handleSave}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          );

          case 2:
            return (
              <motion.div
                key="part2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white/60 backdrop-blur rounded-xl p-6 shadow-lg">
                  {/* Card Header */}
                  <div className="space-y-3 mb-6">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                      Særlige fokusområder for din AI
                    </h2>
                    <p className="text-gray-700 text-justify">
                      Fortæl os om de specifikke områder, hvor din AI Assistent skal være særligt stærk. 
                      Det kunne fx være kundeservice, produktsupport eller teknisk vejledning.
                    </p>
                  </div>
          
                  {/* Card Content */}
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 text-gray-900 font-medium">
                        Beskriv dine ønsker til AI Assistenten
                      </label>
                      <textarea
                        {...register("prompt", {
                          required: "Beskrivelse er påkrævet",
                        })}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none text-gray-900 bg-transparent transition-all placeholder:text-gray-500 placeholder:opacity-70"
                        rows={4}
                        placeholder="F.eks.: Vores AI skal være ekspert i at besvare spørgsmål om vores produktsortiment og kunne guide kunder gennem tekniske problemer."
                      />
                      {errors.prompt && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.prompt.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );

      case 3:
        return (
          <motion.div
            key="accountInfo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8 py-8"
          >
            <motion.div 
              className="text-center relative"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {/* Decorative elements */}
              <motion.div
                className="absolute -top-12 left-1/2 -translate-x-1/2"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <div className="text-4xl">🎉</div>
              </motion.div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Sidste skridt: Opret din konto
              </h2>
              <p className="text-gray-600 mb-6">
                Du er næsten i mål! Opret din konto for at få adgang til dit personlige dashboard.
              </p>
            </motion.div>

            {/* Benefits section */}
            <div className="grid gap-4 max-w-md mx-auto">
              {[
                {
                  icon: "✨",
                  title: "Personligt Dashboard",
                  description: "Få overblik over din AI Assistent og alle dens funktioner"
                },
                {
                  icon: "🚀",
                  title: "Øjeblikkelig Adgang",
                  description: "Start med at tilpasse din AI Assistent med det samme"
                },
                {
                  icon: "🔄",
                  title: "Løbende Opdateringer",
                  description: "Få adgang til nye features og forbedringer"
                }
              ].map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.4 }}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="text-2xl">{benefit.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{benefit.title}</h3>
                    <p className="text-sm text-gray-600">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="accountCreation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                Opret din dashboard-konto
              </h2>
              <p className="mt-2 text-gray-600">
                Med din konto får du adgang til dit personlige dashboard
              </p>
              <p className="mt-2 text-gray-500">
                Vælg en unik adgangskode, der kun bruges til dashboardet
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  type="email"
                  {...register("email", {
                    validate: value => {
                      if (!hasAttemptedAccountSubmit) return true;
                      if (!value) return "E-mail er påkrævet";
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                        return "Indtast en gyldig e-mailadresse";
                      }
                      return true;
                    }
                  })}
                  autoComplete="off"
                  placeholder="Din e-mailadresse"
                  className="w-full p-3 text-lg border-b-2 border-gray-300 focus:border-blue-500 outline-none text-gray-900 bg-transparent placeholder:text-gray-500 placeholder:opacity-70"
                  onKeyDown={() => setUserHasTypedEmail(true)}
                  onPaste={() => setUserHasTypedEmail(true)}
                  onCompositionEnd={() => setUserHasTypedEmail(true)}
                />
                {hasAttemptedAccountSubmit && errors.email && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </div>
              <div>
                <input
                  type="password"
                  {...register("password", {
                    validate: value => {
                      if (!hasAttemptedAccountSubmit) return true;
                      if (!value) return "Adgangskode er påkrævet";
                      if (value.length < 6) {
                        return "Adgangskoden skal være mindst 6 tegn";
                      }
                      return true;
                    }
                  })}
                  autoComplete="new-password"
                  placeholder="Vælg en adgangskode"
                  className="w-full p-3 text-lg border-b-2 border-gray-300 focus:border-blue-500 outline-none text-gray-900 bg-transparent placeholder:text-gray-500 placeholder:opacity-70"
                  onKeyDown={() => setUserHasTypedPassword(true)}
                  onPaste={() => setUserHasTypedPassword(true)}
                  onCompositionEnd={() => setUserHasTypedPassword(true)}
                />
                {hasAttemptedAccountSubmit && errors.password && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {errors.password.message}
                  </motion.p>
                )}
              </div>

              <div>
                <input
                  type="password"
                  {...register("confirmPassword", {
                    validate: value => {
                      if (!hasAttemptedAccountSubmit) return true;
                      if (!value) return "Bekræft venligst din adgangskode";
                      if (value !== watch("password")) {
                        return "Adgangskoderne er ikke ens";
                      }
                      return true;
                    }
                  })}
                  autoComplete="new-password"
                  placeholder="Gentag adgangskode"
                  className="w-full p-3 text-lg border-b-2 border-gray-300 focus:border-blue-500 outline-none text-gray-900 bg-transparent placeholder:text-gray-500 placeholder:opacity-70"
                  onKeyDown={() => setUserHasTypedConfirmPassword(true)}
                  onPaste={() => setUserHasTypedConfirmPassword(true)}
                  onCompositionEnd={() => setUserHasTypedConfirmPassword(true)}
                />
                {hasAttemptedAccountSubmit && errors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-sm mt-1"
                  >
                    {errors.confirmPassword.message}
                  </motion.p>
                )}
              </div>
            </div>
          </motion.div>
        );

      default:
        console.error('Unknown step:', currentPart);
        return null;
    }
  };  

  return (
    <div className="p-6">
      <div className="max-w-xl mx-auto">
        <form onSubmit={handleSubmit(onValid, onInvalid)} className="space-y-6">
          {/* Hidden fields to prevent autofill */}
          <input
            type="text"
            name="fakeEmail"
            autoComplete="username"
            style={{ display: "none" }}
          />
          <input
            type="password"
            name="fakePassword"
            autoComplete="new-password"
            style={{ display: "none" }}
          />
          <AnimatePresence mode="wait">
            {renderCurrentStep()}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="sticky bottom-0 pt-4 border-t mt-8">
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => {
                  if (currentPart === 0) {
                    onPrev();
                  } else {
                    setCurrentPart((prev) => prev - 1);
                    setHasAttemptedSubmit(false); // Reset submit attempt when going back
                    clearErrors(); // Rydder alle fejl ved tilbage-knap
                  }
                }}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Tilbage
              </button>
              {currentPart === 4 ? (
                <button
                  type="submit"
                  onClick={() => setIsCreatingAccount(true)} // Add this
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Opret konto
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStepChange(currentPart + 1)}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Næste
                </button>
              )}
            </div>

            {currentPart < 5 && (
              <div className="flex justify-center mt-6">
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((step) => (
                    <motion.div
                      key={step}
                      className={`h-1 w-8 rounded-full ${
                        step === currentPart
                          ? "bg-blue-500" 
                          : "bg-gray-200"
                      }`}
                      animate={{
                        backgroundColor:
                          step === currentPart
                            ? "#3B82F6"
                            : "#E5E7EB",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

const FileListItem = ({ file, onDelete }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -5 }}
    transition={{ duration: 0.15 }}
    className="flex items-center justify-between bg-white hover:bg-gray-50 p-2 rounded-md border border-gray-100 group"
  >
    <div className="flex items-center gap-2 min-w-0">
      <svg
        className="w-4 h-4 text-gray-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      <span className="text-sm text-gray-900 truncate">
        {file.metadata ? file.metadata.name : file.name}
      </span>
    </div>
    <button
      type="button"
      onClick={onDelete}
      className="text-gray-400 hover:text-red-500 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </motion.div>
);

const KnowledgeBaseModal = ({ onClose, files, onSave }) => {
  const modalFileInputRef = useRef(null);
  const [localFiles, setLocalFiles] = useState([...files]);

  const handleLocalFileUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      Promise.all(
        files.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
              resolve({
                file: file,
                preview: e.target.result,
                metadata: {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  lastModified: file.lastModified
                }
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      )
      .then((processedFiles) => {
        setLocalFiles(prev => [...prev, ...processedFiles]);
      })
      .catch((error) => {
        console.error("Error reading files:", error);
      });
    }
  };

  const handleLocalFileDelete = (index) => {
    setLocalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(localFiles);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden relative"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal header */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Administrer vidensbase
          </h3>
        </div>

        {/* Modal content */}
        <div className="p-4">
          <input
            type="file"
            multiple
            ref={modalFileInputRef}
            onChange={handleLocalFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt"
          />

          <button
            type="button"
            onClick={() => modalFileInputRef.current?.click()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 group mb-4"
          >
            <div className="flex items-center justify-center py-3 px-4">
              <svg
                className="w-5 h-5 mr-2 transition-transform group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Upload filer
            </div>
          </button>

          <div className="max-h-[400px] overflow-y-auto">
            {localFiles.length > 0 ? (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {localFiles.map((file, index) => (
                    <FileListItem
                      key={index}
                      file={file}
                      onDelete={() => handleLocalFileDelete(index)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Ingen filer uploadet endnu
              </div>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Annuller
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Gem ændringer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AISetupStep;
